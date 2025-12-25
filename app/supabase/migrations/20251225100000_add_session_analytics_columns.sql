-- Add analytics columns to sessions table
-- Story: Phase 3 UI - Conversations View

-- ============================================
-- ADD MISSING COLUMNS TO SESSIONS
-- ============================================

-- Primary development stage detected in the session
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS primary_stage TEXT;

-- Whether the session contained debugging loops
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS has_debugging_loop BOOLEAN DEFAULT false;

-- Overall conversation quality score (0-100)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS conversation_score INTEGER;

-- Count of user messages (vs system/assistant)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS user_message_count INTEGER DEFAULT 0;

-- Constraint for valid primary_stage values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_primary_stage'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT valid_primary_stage CHECK (
      primary_stage IS NULL OR primary_stage IN (
        'planning', 'implementation', 'debugging', 'refactoring',
        'testing', 'documentation', 'review', 'exploration', 'unknown'
      )
    );
  END IF;
END $$;

-- Constraint for valid conversation_score range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_conversation_score'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT valid_conversation_score CHECK (
      conversation_score IS NULL OR (conversation_score >= 0 AND conversation_score <= 100)
    );
  END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN sessions.primary_stage IS
  'Primary development stage detected in the session (planning, implementation, debugging, etc.)';

COMMENT ON COLUMN sessions.has_debugging_loop IS
  'Whether the session contained debugging loops (repeated error-fix cycles)';

COMMENT ON COLUMN sessions.conversation_score IS
  'Overall conversation quality score (0-100) based on prompt analysis';

COMMENT ON COLUMN sessions.user_message_count IS
  'Count of user messages in the session';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== SESSION ANALYTICS COLUMNS MIGRATION COMPLETE ===';
END $$;
