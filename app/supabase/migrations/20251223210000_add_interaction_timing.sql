-- Interaction Timing Analysis Migration
-- Story 21-5: Interaction Timing Analysis
-- Adds timing metrics columns to prompts table for tracking prompt rhythm patterns

-- ============================================
-- ADD TIMING COLUMNS TO PROMPTS TABLE
-- ============================================

-- Time since previous prompt in seconds (NULL for first prompt in session)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS time_since_previous_seconds INTEGER;

-- Rapid-fire indicator (prompt submitted < 30 seconds after previous)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS is_rapid_fire BOOLEAN DEFAULT false;

-- Long-pause indicator (prompt submitted > 300 seconds after previous)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS is_long_pause BOOLEAN DEFAULT false;

-- Follow-up indicator (prompt starts with continuation patterns)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS is_follow_up BOOLEAN DEFAULT false;

-- ============================================
-- INDEXES
-- ============================================

-- Composite index for session sequence queries (already exists from session migration)
-- Adding IF NOT EXISTS to be safe
CREATE INDEX IF NOT EXISTS idx_prompts_session_seq
  ON prompts(session_uuid, sequence_number);

-- Partial index for rapid-fire analysis queries
CREATE INDEX IF NOT EXISTS idx_prompts_rapid_fire
  ON prompts(session_uuid, created_at)
  WHERE is_rapid_fire = true;

-- Partial index for long-pause analysis queries
CREATE INDEX IF NOT EXISTS idx_prompts_long_pause
  ON prompts(session_uuid, created_at)
  WHERE is_long_pause = true;

-- Partial index for follow-up analysis queries
CREATE INDEX IF NOT EXISTS idx_prompts_follow_up
  ON prompts(session_uuid, created_at)
  WHERE is_follow_up = true;

-- Index for time-of-day distribution queries
CREATE INDEX IF NOT EXISTS idx_prompts_user_created
  ON prompts(user_id, created_at);

-- ============================================
-- COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN prompts.time_since_previous_seconds IS
  'Seconds elapsed since the previous prompt in the same session. NULL for first prompt.';

COMMENT ON COLUMN prompts.is_rapid_fire IS
  'True if this prompt was submitted less than 30 seconds after the previous prompt.';

COMMENT ON COLUMN prompts.is_long_pause IS
  'True if this prompt was submitted more than 5 minutes (300 seconds) after the previous prompt.';

COMMENT ON COLUMN prompts.is_follow_up IS
  'True if the prompt text starts with continuation patterns like "also", "and", "now", etc.';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== INTERACTION TIMING MIGRATION COMPLETE ===';
  RAISE NOTICE 'Added column: time_since_previous_seconds INTEGER';
  RAISE NOTICE 'Added column: is_rapid_fire BOOLEAN DEFAULT false';
  RAISE NOTICE 'Added column: is_long_pause BOOLEAN DEFAULT false';
  RAISE NOTICE 'Added column: is_follow_up BOOLEAN DEFAULT false';
  RAISE NOTICE 'Created indexes for timing analysis queries';
  RAISE NOTICE '=============================================';
END $$;
