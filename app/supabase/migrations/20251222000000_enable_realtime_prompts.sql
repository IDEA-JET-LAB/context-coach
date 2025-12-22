-- Migration: Enable Realtime for prompts and prompt_analyses tables
-- This allows the Prompts feed to update automatically when new prompts arrive

-- Set replica identity to FULL for realtime updates to include all columns
ALTER TABLE prompts REPLICA IDENTITY FULL;
ALTER TABLE prompt_analyses REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
-- This enables Postgres logical replication for these tables
-- Note: Tables may already be in publication, so we use DO block to handle errors gracefully
DO $$
BEGIN
  -- Try to add prompts table (will fail silently if already exists)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE prompts;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Table already in publication
  END;

  -- Try to add prompt_analyses table
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE prompt_analyses;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Table already in publication
  END;
END $$;

-- Add comments for documentation
COMMENT ON TABLE prompts IS 'Captured prompts from CLI with realtime updates enabled';
COMMENT ON TABLE prompt_analyses IS 'AI analysis results with realtime updates enabled';
