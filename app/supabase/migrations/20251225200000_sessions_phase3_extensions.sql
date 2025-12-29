-- Phase 3: Sessions Table Extensions (Supplemental)
-- Story 24-1: Sessions Table Extensions
--
-- This migration supplements 20251225100000_add_session_analytics_columns.sql
-- by adding missing columns, indexes, and reconciling constraints.

-- ============================================
-- ADD MISSING COLUMN: stage_breakdown
-- ============================================
-- JSONB breakdown of prompt counts per stage

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS stage_breakdown JSONB;

COMMENT ON COLUMN sessions.stage_breakdown IS
  'JSONB breakdown of prompt counts per stage. Example: {"architecture": 3, "development": 15, "debugging": 7}';

-- ============================================
-- UPDATE CHECK CONSTRAINT FOR STAGE VALUES
-- ============================================
-- Existing constraint allows: planning, implementation, debugging, refactoring, testing, documentation, review, exploration, unknown
-- Story requires: architecture, specification, development, debugging, enhancement
-- Solution: Allow ALL values for flexibility (union of both sets)

-- Drop existing constraint if it exists
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS valid_primary_stage;

-- Create new constraint with all valid values
ALTER TABLE sessions ADD CONSTRAINT valid_primary_stage CHECK (
  primary_stage IS NULL OR primary_stage IN (
    -- Original Phase 2 values
    'planning', 'implementation', 'debugging', 'refactoring',
    'testing', 'documentation', 'review', 'exploration', 'unknown',
    -- Phase 3 story values
    'architecture', 'specification', 'development', 'enhancement'
  )
);

-- ============================================
-- PARTIAL INDEXES FOR EFFICIENT FILTERING
-- ============================================

-- Index sessions by stage (only indexed when stage is set)
CREATE INDEX IF NOT EXISTS idx_sessions_stage
  ON sessions(primary_stage)
  WHERE primary_stage IS NOT NULL;

-- Index sessions with debugging loops (only TRUE values indexed)
CREATE INDEX IF NOT EXISTS idx_sessions_debugging_loop
  ON sessions(has_debugging_loop)
  WHERE has_debugging_loop = TRUE;

-- ============================================
-- BACKFILL USER_MESSAGE_COUNT
-- ============================================
-- Count existing prompts per session
-- Legacy prompts (without prompt_type) are assumed to be user messages
-- Note: prompt_type column may not exist yet in prompts table

UPDATE sessions s SET user_message_count = (
  SELECT COUNT(*) FROM prompts p
  WHERE p.session_uuid = s.id
) WHERE user_message_count = 0 OR user_message_count IS NULL;

-- ============================================
-- ADDITIONAL COLUMN COMMENTS
-- ============================================

-- Update comments for clarity
COMMENT ON COLUMN sessions.primary_stage IS
  'Primary project stage detected for this session. Valid values: architecture, specification, development, debugging, enhancement, planning, implementation, refactoring, testing, documentation, review, exploration, unknown';

COMMENT ON COLUMN sessions.has_debugging_loop IS
  'TRUE if a debugging loop pattern was detected in this session (3+ similar error-fix-error cycles)';

COMMENT ON COLUMN sessions.user_message_count IS
  'Count of user messages in this session (excludes tool_result type prompts). Updated by trigger.';

COMMENT ON COLUMN sessions.conversation_score IS
  'Aggregate score for the conversation (0-100), excluding selection/confirmation prompts.';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 3: SESSIONS EXTENSIONS COMPLETE ===';
  RAISE NOTICE 'Added column: stage_breakdown (JSONB)';
  RAISE NOTICE 'Updated constraint: valid_primary_stage (expanded values)';
  RAISE NOTICE 'Created indexes: idx_sessions_stage, idx_sessions_debugging_loop';
  RAISE NOTICE 'Backfilled user_message_count from existing prompts';
  RAISE NOTICE '=============================================';
END $$;
