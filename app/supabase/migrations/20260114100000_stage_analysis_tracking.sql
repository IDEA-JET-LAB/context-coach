-- Stage Analysis Tracking Migration
-- Story 31-2: Stage Persistence & Backfill
--
-- Adds columns to track stage analysis status on sessions
-- and creates indexes for efficient stage-based queries.

-- ============================================
-- ADD STAGE ANALYSIS COLUMNS TO SESSIONS
-- ============================================

-- Analysis processing status for stage detection
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS stage_analysis_status TEXT DEFAULT 'pending';

-- Timestamp when stage analysis was completed
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS stage_analysis_at TIMESTAMPTZ;

-- Error message if analysis failed
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS stage_analysis_error TEXT;

-- ============================================
-- ADD CHECK CONSTRAINT FOR STATUS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_stage_analysis_status'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT valid_stage_analysis_status CHECK (
      stage_analysis_status IS NULL OR stage_analysis_status IN (
        'pending', 'processing', 'complete', 'error'
      )
    );
  END IF;
END $$;

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Index on prompts.detected_stage for filtering by stage
CREATE INDEX IF NOT EXISTS idx_prompts_stage
  ON prompts(detected_stage)
  WHERE detected_stage IS NOT NULL;

-- Index on sessions.stage_analysis_status for queue processing
CREATE INDEX IF NOT EXISTS idx_sessions_stage_analysis_status
  ON sessions(stage_analysis_status)
  WHERE stage_analysis_status IN ('pending', 'processing');

-- Composite index for project-level batch processing
CREATE INDEX IF NOT EXISTS idx_sessions_project_stage_status
  ON sessions(project_id, stage_analysis_status)
  WHERE project_id IS NOT NULL;

-- ============================================
-- COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN sessions.stage_analysis_status IS
  'Status of stage detection analysis: pending (not started), processing (in progress), complete (done), error (failed)';

COMMENT ON COLUMN sessions.stage_analysis_at IS
  'Timestamp when stage analysis was completed (NULL if not yet complete)';

COMMENT ON COLUMN sessions.stage_analysis_error IS
  'Error message if stage analysis failed (NULL on success)';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== STAGE ANALYSIS TRACKING MIGRATION COMPLETE ===';
  RAISE NOTICE 'Added columns: stage_analysis_status, stage_analysis_at, stage_analysis_error';
  RAISE NOTICE 'Created indexes: idx_prompts_stage, idx_sessions_stage_analysis_status, idx_sessions_project_stage_status';
  RAISE NOTICE '================================================';
END $$;
