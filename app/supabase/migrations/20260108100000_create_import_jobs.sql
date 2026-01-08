-- Migration: Create import_jobs table for cloud-based import tracking
-- This enables async file upload and processing with progress tracking

-- Create enum for import job status
CREATE TYPE import_job_status AS ENUM (
  'pending',      -- Job created, waiting to start
  'uploading',    -- Files being uploaded
  'processing',   -- Server processing files
  'completed',    -- Successfully completed
  'failed',       -- Failed with error
  'cancelled'     -- Cancelled by user
);

-- Create import_jobs table
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Job status
  status import_job_status NOT NULL DEFAULT 'pending',

  -- Progress tracking
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  total_prompts INTEGER NOT NULL DEFAULT 0,
  imported_prompts INTEGER NOT NULL DEFAULT 0,
  skipped_prompts INTEGER NOT NULL DEFAULT 0,
  failed_prompts INTEGER NOT NULL DEFAULT 0,

  -- Project info (which projects are being imported)
  projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{ "path": "/Users/.../project", "displayName": "project", "fileCount": 10 }]

  -- Current progress message for UI
  status_message TEXT,
  current_project TEXT,

  -- Error info if failed
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_progress CHECK (processed_files <= total_files),
  CONSTRAINT valid_prompts CHECK (imported_prompts + skipped_prompts + failed_prompts <= total_prompts)
);

-- Create indexes
CREATE INDEX idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX idx_import_jobs_team_id ON import_jobs(team_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);
CREATE INDEX idx_import_jobs_created_at ON import_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own import jobs
CREATE POLICY "Users can view own import jobs"
  ON import_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import jobs"
  ON import_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update import job progress
CREATE OR REPLACE FUNCTION update_import_job_progress(
  p_job_id UUID,
  p_processed_files INTEGER DEFAULT NULL,
  p_imported_prompts INTEGER DEFAULT NULL,
  p_skipped_prompts INTEGER DEFAULT NULL,
  p_failed_prompts INTEGER DEFAULT NULL,
  p_status_message TEXT DEFAULT NULL,
  p_current_project TEXT DEFAULT NULL
)
RETURNS import_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job import_jobs;
BEGIN
  UPDATE import_jobs
  SET
    processed_files = COALESCE(p_processed_files, processed_files),
    imported_prompts = COALESCE(p_imported_prompts, imported_prompts),
    skipped_prompts = COALESCE(p_skipped_prompts, skipped_prompts),
    failed_prompts = COALESCE(p_failed_prompts, failed_prompts),
    status_message = COALESCE(p_status_message, status_message),
    current_project = COALESCE(p_current_project, current_project)
  WHERE id = p_job_id
    AND user_id = auth.uid()
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

-- Function to complete an import job
CREATE OR REPLACE FUNCTION complete_import_job(
  p_job_id UUID,
  p_status import_job_status,
  p_error_message TEXT DEFAULT NULL
)
RETURNS import_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job import_jobs;
BEGIN
  UPDATE import_jobs
  SET
    status = p_status,
    error_message = p_error_message,
    completed_at = NOW()
  WHERE id = p_job_id
    AND user_id = auth.uid()
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_import_job_progress TO authenticated;
GRANT EXECUTE ON FUNCTION complete_import_job TO authenticated;

COMMENT ON TABLE import_jobs IS 'Tracks cloud-based import jobs for async file processing';
