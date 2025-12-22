-- Migration: Enable Realtime for prompts and prompt_analyses tables
-- This allows the Prompts feed to update automatically when new prompts arrive

-- Set replica identity to FULL for realtime updates to include all columns
ALTER TABLE prompts REPLICA IDENTITY FULL;
ALTER TABLE prompt_analyses REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
-- This enables Postgres logical replication for these tables
BEGIN;
  -- Drop existing publication membership if any (idempotent)
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS prompts;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS prompt_analyses;

  -- Add tables to publication
  ALTER PUBLICATION supabase_realtime ADD TABLE prompts;
  ALTER PUBLICATION supabase_realtime ADD TABLE prompt_analyses;
COMMIT;

-- Add comments for documentation
COMMENT ON TABLE prompts IS 'Captured prompts from CLI with realtime updates enabled';
COMMENT ON TABLE prompt_analyses IS 'AI analysis results with realtime updates enabled';
