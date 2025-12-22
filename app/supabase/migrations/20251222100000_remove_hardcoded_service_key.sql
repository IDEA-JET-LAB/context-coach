-- Migration: Remove hardcoded service role key from analyze-prompt trigger
-- Security Fix: Keys should never be in source code, even as fallbacks
--
-- This migration updates the trigger function to FAIL EXPLICITLY if the
-- service_role_key setting is not configured, rather than falling back
-- to a hardcoded key.

-- Update the trigger function to remove hardcoded key fallback
CREATE OR REPLACE FUNCTION trigger_analyze_prompt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  function_url TEXT;
  request_id BIGINT;
BEGIN
  -- Only trigger for pending prompts
  IF NEW.analysis_status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL from environment (set by Supabase)
  -- In local dev on Mac/Windows, use host.docker.internal to reach host from container
  -- In production, app.settings.supabase_url will be set
  supabase_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'http://host.docker.internal:54321'
  );

  -- Get service role key for auth (MUST be configured)
  -- SECURITY: No fallback key - fail explicitly if not configured
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING '[analyze-prompt-trigger] service_role_key not configured - skipping analysis trigger for prompt %', NEW.id;
    RETURN NEW;
  END IF;

  -- Build function URL
  function_url := supabase_url || '/functions/v1/analyze-prompt';

  -- Make async HTTP POST to Edge Function
  -- pg_net.http_post returns immediately, doesn't block the INSERT
  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object('prompt_id', NEW.id::text)
    ) INTO request_id;

    -- Log successful trigger (for debugging)
    RAISE LOG '[analyze-prompt-trigger] Triggered for prompt %, request_id: %', NEW.id, request_id;

  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the INSERT
    -- The prompt is still saved, analysis can be retried later
    RAISE WARNING '[analyze-prompt-trigger] Failed to trigger for prompt %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION trigger_analyze_prompt() IS
  'Automatically triggers the analyze-prompt Edge Function when a new prompt is inserted with pending status. Uses pg_net for async HTTP calls. Requires app.settings.service_role_key to be configured.';
