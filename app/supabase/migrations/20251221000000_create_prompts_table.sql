-- Prompts Table Migration
-- Story 4.5: Prompt Storage & Queue

-- ============================================
-- ENABLE PG_NET EXTENSION
-- Required for async HTTP calls in triggers
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================
-- PROMPTS TABLE
-- ============================================
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  metadata JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_analysis_status CHECK (
    analysis_status IN ('pending', 'processing', 'complete', 'failed')
  )
);

-- ============================================
-- INDEXES
-- ============================================
-- Basic column indexes for filtering
CREATE INDEX idx_prompts_team_id ON prompts(team_id);
CREATE INDEX idx_prompts_user_id ON prompts(user_id);
CREATE INDEX idx_prompts_created_at ON prompts(created_at);
CREATE INDEX idx_prompts_analysis_status ON prompts(analysis_status);

-- Composite index for dashboard queries (team + time ordering)
CREATE INDEX idx_prompts_team_created ON prompts(team_id, created_at DESC);

-- Partial composite index for queue processing (only pending prompts)
CREATE INDEX idx_prompts_queue ON prompts(analysis_status, created_at)
  WHERE analysis_status = 'pending';

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Team members can view their team's prompts
-- Uses team_members lookup for proper multi-tenancy
--
-- Note on service_role access:
-- The service_role clause allows backend Edge Functions (analyze-prompt) to
-- read prompts for analysis. This is intentional and secure because:
-- 1. service_role key is server-side only (stored in GCP Secret Manager)
-- 2. Edge Functions need to read prompts to generate analysis
-- 3. The key is never exposed to clients - only used in secure server contexts
CREATE POLICY "Team members can view prompts" ON prompts
FOR SELECT USING (
  team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid())
  OR auth.role() = 'service_role'
);

-- Service role can insert prompts (used by capture API)
CREATE POLICY "Service role can insert prompts" ON prompts
FOR INSERT TO service_role
WITH CHECK (true);

-- ============================================
-- ANALYSIS TRIGGER FUNCTION
-- Asynchronously notifies analysis Edge Function via pg_net
-- ============================================
CREATE OR REPLACE FUNCTION notify_analysis()
RETURNS TRIGGER AS $$
DECLARE
  analysis_url TEXT;
BEGIN
  -- Get analysis function URL from app settings
  -- This should be configured in Supabase project settings
  BEGIN
    analysis_url := current_setting('app.settings.analysis_function_url', true);
  EXCEPTION WHEN OTHERS THEN
    analysis_url := NULL;
  END;

  -- Only call if URL is configured
  IF analysis_url IS NOT NULL AND analysis_url != '' THEN
    PERFORM net.http_post(
      url := analysis_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object('prompt_id', NEW.id)::text
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log warning but don't block the insert
  RAISE WARNING 'Analysis notification failed for prompt %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ATTACH TRIGGER
-- ============================================
CREATE TRIGGER on_prompt_insert
  AFTER INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION notify_analysis();
