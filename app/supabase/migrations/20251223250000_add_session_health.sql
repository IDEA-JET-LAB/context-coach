-- Session Health Score Migration
-- Story 21-7: Session Health Score
--
-- Adds session health scoring columns and related tables for tracking
-- session quality metrics over time.

-- ============================================
-- SESSIONS TABLE UPDATES
-- ============================================

-- Health score (0-100)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS health_score INTEGER;

-- Health level classification
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS health_level VARCHAR(20);

-- Counter columns for health calculation
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS frustration_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tool_error_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tool_call_count INTEGER NOT NULL DEFAULT 0;

-- Last health update timestamp
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_health_update_at TIMESTAMPTZ;

-- ============================================
-- CONSTRAINTS
-- ============================================

-- Valid health level values
ALTER TABLE sessions ADD CONSTRAINT valid_health_level
  CHECK (health_level IS NULL OR health_level IN ('healthy', 'warning', 'critical'));

-- Valid health score range
ALTER TABLE sessions ADD CONSTRAINT valid_health_score
  CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100));

-- Non-negative counters
ALTER TABLE sessions ADD CONSTRAINT valid_frustration_count
  CHECK (frustration_count >= 0);

ALTER TABLE sessions ADD CONSTRAINT valid_retry_count
  CHECK (retry_count >= 0);

ALTER TABLE sessions ADD CONSTRAINT valid_tool_error_count
  CHECK (tool_error_count >= 0);

ALTER TABLE sessions ADD CONSTRAINT valid_tool_call_count
  CHECK (tool_call_count >= 0);

-- ============================================
-- SESSION HEALTH HISTORY TABLE
-- ============================================
-- Tracks health score changes over time for trend analysis

CREATE TABLE IF NOT EXISTS session_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session reference
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- Health data at this point
  health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  health_level VARCHAR(20) NOT NULL CHECK (health_level IN ('healthy', 'warning', 'critical')),

  -- Factor breakdown for historical analysis
  factors JSONB NOT NULL,

  -- Timestamps
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  prompt_count INTEGER NOT NULL DEFAULT 0
);

-- Index for efficient trend queries
CREATE INDEX IF NOT EXISTS idx_health_history_session
  ON session_health_history(session_id, calculated_at DESC);

-- ============================================
-- RLS FOR HEALTH HISTORY
-- ============================================

ALTER TABLE session_health_history ENABLE ROW LEVEL SECURITY;

-- Team members can view health history for their sessions
CREATE POLICY "Team members can view session health history" ON session_health_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE s.id = session_health_history.session_id
      AND tm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- Service role can insert health history
CREATE POLICY "Service role can insert health history" ON session_health_history
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Service role can update health history
CREATE POLICY "Service role can update health history" ON session_health_history
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can delete health history
CREATE POLICY "Service role can delete health history" ON session_health_history
  FOR DELETE TO service_role
  USING (true);

-- ============================================
-- INDEXES FOR HEALTH QUERIES
-- ============================================

-- Sessions by health level for dashboards
CREATE INDEX IF NOT EXISTS idx_sessions_health_level
  ON sessions(health_level, team_id)
  WHERE health_level IS NOT NULL;

-- Sessions needing attention (critical health)
CREATE INDEX IF NOT EXISTS idx_sessions_critical_health
  ON sessions(team_id, updated_at DESC)
  WHERE health_level = 'critical';

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON COLUMN sessions.health_score IS
  'Session health score from 0-100, calculated from duration, context usage, frustration, retry, and tool error rates';

COMMENT ON COLUMN sessions.health_level IS
  'Health classification: healthy (>=75), warning (>=50), critical (<50)';

COMMENT ON COLUMN sessions.frustration_count IS
  'Number of prompts with frustrated sentiment detected';

COMMENT ON COLUMN sessions.retry_count IS
  'Number of retry prompts detected';

COMMENT ON COLUMN sessions.tool_error_count IS
  'Number of failed tool executions';

COMMENT ON COLUMN sessions.tool_call_count IS
  'Total number of tool calls in session';

COMMENT ON COLUMN sessions.last_health_update_at IS
  'When health was last recalculated';

COMMENT ON TABLE session_health_history IS
  'Historical health scores for trend analysis and visualization';

COMMENT ON COLUMN session_health_history.factors IS
  'JSON object containing factor breakdown: {durationScore, contextScore, frustrationScore, retryScore, toolErrorScore}';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== SESSION HEALTH MIGRATION COMPLETE ===';
  RAISE NOTICE 'Added health_score, health_level columns to sessions';
  RAISE NOTICE 'Added frustration_count, retry_count, tool_error_count, tool_call_count columns';
  RAISE NOTICE 'Created session_health_history table for trend tracking';
  RAISE NOTICE 'Added RLS policies and indexes';
  RAISE NOTICE '==========================================';
END $$;
