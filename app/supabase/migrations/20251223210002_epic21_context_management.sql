-- Context Window Management Migration
-- Story 21-1: Context Window Management
--
-- Adds context exhaustion tracking columns to the sessions table.
-- This enables tracking when users hit context window limits during sessions.

-- ============================================
-- ADD CONTEXT MANAGEMENT COLUMNS TO SESSIONS
-- ============================================

-- Flag indicating if context exhaustion was detected during this session
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS context_exhausted BOOLEAN DEFAULT false;

-- Timestamp when context exhaustion was first detected
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS exhaustion_detected_at TIMESTAMPTZ;

-- Estimated context window usage (0.00 to 1.00)
-- This allows tracking how much of the context window was used
-- DECIMAL(3,2) allows values from 0.00 to 9.99, constrained by CHECK to 0.00-1.00
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS context_usage_estimate DECIMAL(3,2);

-- ============================================
-- ADD CONSTRAINTS
-- ============================================

-- Ensure context_usage_estimate is between 0 and 1
ALTER TABLE sessions
ADD CONSTRAINT check_context_usage_range
CHECK (context_usage_estimate IS NULL OR (context_usage_estimate >= 0 AND context_usage_estimate <= 1));

-- Ensure exhaustion_detected_at is only set when context_exhausted is true
ALTER TABLE sessions
ADD CONSTRAINT check_exhaustion_consistency
CHECK (
  (context_exhausted = false AND exhaustion_detected_at IS NULL) OR
  (context_exhausted = true)
);

-- ============================================
-- ADD INDEXES
-- ============================================

-- Index for querying exhausted sessions (for analytics)
CREATE INDEX IF NOT EXISTS idx_sessions_context_exhausted
ON sessions(team_id, context_exhausted, started_at DESC)
WHERE context_exhausted = true;

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON COLUMN sessions.context_exhausted IS
  'Flag indicating if context exhaustion was detected during this session (via keyword patterns or duration heuristics)';

COMMENT ON COLUMN sessions.exhaustion_detected_at IS
  'Timestamp when context exhaustion was first detected in this session';

COMMENT ON COLUMN sessions.context_usage_estimate IS
  'Estimated context window usage as a decimal (0.00 to 1.00). Based on tokens used and session characteristics.';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== CONTEXT MANAGEMENT MIGRATION COMPLETE ===';
  RAISE NOTICE 'Added context_exhausted column to sessions table';
  RAISE NOTICE 'Added exhaustion_detected_at column to sessions table';
  RAISE NOTICE 'Added context_usage_estimate column to sessions table';
  RAISE NOTICE 'Added constraints for data integrity';
  RAISE NOTICE 'Added index for efficient exhaustion queries';
  RAISE NOTICE '=============================================';
END $$;
