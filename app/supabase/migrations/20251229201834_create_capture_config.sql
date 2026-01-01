-- Migration: Create capture_config table for prompt filtering settings
-- This table stores admin-configurable settings for prompt capture filtering

-- Create the capture_config table
CREATE TABLE IF NOT EXISTS capture_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Length constraints
  min_prompt_length INTEGER NOT NULL DEFAULT 10
    CONSTRAINT min_prompt_length_positive CHECK (min_prompt_length >= 0),
  max_prompt_length INTEGER NOT NULL DEFAULT 100000
    CONSTRAINT max_prompt_length_positive CHECK (max_prompt_length > 0),

  -- Garbage patterns - regex patterns to filter out system messages
  garbage_patterns JSONB NOT NULL DEFAULT '["^<bash-notification>", "^<system-reminder>", "^<output-file>", "^<shell-id>", "^<"]'::jsonb,

  -- Classification settings
  skip_command_only BOOLEAN NOT NULL DEFAULT true,
  min_command_args_length INTEGER NOT NULL DEFAULT 10
    CONSTRAINT min_command_args_positive CHECK (min_command_args_length >= 0),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Add constraint to ensure min < max for lengths
ALTER TABLE capture_config
  ADD CONSTRAINT min_less_than_max CHECK (min_prompt_length < max_prompt_length);

-- Create a singleton row with a fixed ID
-- This ensures only one config exists globally
INSERT INTO capture_config (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Create index on updated_at for audit queries
CREATE INDEX IF NOT EXISTS idx_capture_config_updated_at ON capture_config(updated_at);

-- RLS policies
ALTER TABLE capture_config ENABLE ROW LEVEL SECURITY;

-- Only super admins can view capture config
CREATE POLICY "Super admins can view capture config"
  ON capture_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

-- Only super admins can update capture config
CREATE POLICY "Super admins can update capture config"
  ON capture_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

-- Service role can always access (for capture pipeline)
CREATE POLICY "Service role can access capture config"
  ON capture_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_capture_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER capture_config_updated_at
  BEFORE UPDATE ON capture_config
  FOR EACH ROW
  EXECUTE FUNCTION update_capture_config_timestamp();

-- Comment on table
COMMENT ON TABLE capture_config IS 'Global configuration for prompt capture filtering. Singleton table with one row.';
COMMENT ON COLUMN capture_config.min_prompt_length IS 'Minimum character length for prompts. Shorter prompts are rejected.';
COMMENT ON COLUMN capture_config.max_prompt_length IS 'Maximum character length for prompts. Longer prompts are rejected.';
COMMENT ON COLUMN capture_config.garbage_patterns IS 'JSON array of regex patterns to filter out system/garbage messages.';
COMMENT ON COLUMN capture_config.skip_command_only IS 'Whether to skip analysis for pure slash commands (e.g., /commit).';
COMMENT ON COLUMN capture_config.min_command_args_length IS 'Minimum length of args after a command to trigger analysis.';
