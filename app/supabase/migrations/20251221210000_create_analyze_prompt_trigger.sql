-- Migration: Create analyze-prompt trigger
-- Story 5.1 Task 2: Database trigger for prompt analysis
--
-- This trigger automatically calls the analyze-prompt Edge Function
-- when a new prompt is inserted with analysis_status = 'pending'

-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role (needed for local dev)
GRANT USAGE ON SCHEMA net TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA net TO postgres;

-- Create the trigger function
-- Uses SECURITY DEFINER to run with elevated privileges for HTTP call
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

  -- Get service role key for auth (set by Supabase in production)
  service_role_key := COALESCE(
    current_setting('app.settings.service_role_key', true),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  );

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

-- Create the trigger on prompts table
-- AFTER INSERT ensures the prompt is committed before analysis starts
DROP TRIGGER IF EXISTS on_prompt_insert_analyze ON prompts;

CREATE TRIGGER on_prompt_insert_analyze
  AFTER INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_analyze_prompt();

-- Add comment for documentation
COMMENT ON FUNCTION trigger_analyze_prompt() IS
  'Automatically triggers the analyze-prompt Edge Function when a new prompt is inserted with pending status. Uses pg_net for async HTTP calls.';

COMMENT ON TRIGGER on_prompt_insert_analyze ON prompts IS
  'Fires after prompt insert to trigger AI analysis via Edge Function.';
