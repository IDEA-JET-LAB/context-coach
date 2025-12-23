-- Tool Usage Profiling Migration
-- Story 21-6: Tool Usage Profiling
-- Creates session_tool_usage and tool_mastery_snapshots tables

-- ============================================
-- SESSION_TOOL_USAGE TABLE
-- ============================================
-- Tracks Claude Code tool usage per session for analytics

CREATE TABLE IF NOT EXISTS session_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session reference
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- Tool identification
  tool_name VARCHAR(50) NOT NULL,

  -- Usage count for this tool in this session
  usage_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint to prevent duplicate tool entries per session
  CONSTRAINT unique_session_tool UNIQUE (session_id, tool_name)
);

-- ============================================
-- INDEXES FOR SESSION_TOOL_USAGE
-- ============================================

-- Fast lookup by session
CREATE INDEX IF NOT EXISTS idx_session_tool_usage_session ON session_tool_usage(session_id);

-- Fast lookup by tool name (for analytics across sessions)
CREATE INDEX IF NOT EXISTS idx_session_tool_usage_tool ON session_tool_usage(tool_name);

-- ============================================
-- TOOL_MASTERY_SNAPSHOTS TABLE
-- ============================================
-- Weekly/monthly snapshots of user tool mastery levels for progression tracking

CREATE TABLE IF NOT EXISTS tool_mastery_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Tool identification
  tool_name VARCHAR(50) NOT NULL,

  -- Mastery level
  mastery_level VARCHAR(20) NOT NULL CHECK (
    mastery_level IN ('beginner', 'intermediate', 'advanced', 'power_user')
  ),

  -- Total usage count at snapshot time
  total_usage_count INTEGER NOT NULL DEFAULT 0,

  -- Snapshot date (for weekly/monthly tracking)
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint to prevent duplicate snapshots per user/tool/date
  CONSTRAINT unique_user_tool_date UNIQUE (user_id, tool_name, snapshot_date)
);

-- ============================================
-- INDEXES FOR TOOL_MASTERY_SNAPSHOTS
-- ============================================

-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_tool_mastery_user ON tool_mastery_snapshots(user_id);

-- Fast lookup by date (for historical queries)
CREATE INDEX IF NOT EXISTS idx_tool_mastery_date ON tool_mastery_snapshots(snapshot_date);

-- Fast lookup by user and tool for progression history
CREATE INDEX IF NOT EXISTS idx_tool_mastery_user_tool ON tool_mastery_snapshots(user_id, tool_name, snapshot_date DESC);

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE session_tool_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_mastery_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR SESSION_TOOL_USAGE
-- ============================================

-- Team members can view session tool usage for their team's sessions
CREATE POLICY "Team members can view session tool usage" ON session_tool_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE s.id = session_tool_usage.session_id
        AND tm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- Service role can insert session tool usage
CREATE POLICY "Service role can insert session tool usage" ON session_tool_usage
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Service role can update session tool usage (for incrementing counts)
CREATE POLICY "Service role can update session tool usage" ON session_tool_usage
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can delete session tool usage
CREATE POLICY "Service role can delete session tool usage" ON session_tool_usage
  FOR DELETE TO service_role
  USING (true);

-- ============================================
-- RLS POLICIES FOR TOOL_MASTERY_SNAPSHOTS
-- ============================================

-- Users can view their own mastery snapshots
CREATE POLICY "Users can view own mastery snapshots" ON tool_mastery_snapshots
  FOR SELECT USING (
    user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

-- Service role can manage all mastery snapshots
CREATE POLICY "Service role can manage mastery snapshots" ON tool_mastery_snapshots
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- UPSERT FUNCTION FOR TOOL USAGE
-- ============================================
-- Increments tool usage count for a session, creating record if needed

CREATE OR REPLACE FUNCTION increment_session_tool_usage(
  p_session_id UUID,
  p_tool_name TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS session_tool_usage AS $$
DECLARE
  result session_tool_usage;
BEGIN
  INSERT INTO session_tool_usage (session_id, tool_name, usage_count)
  VALUES (p_session_id, p_tool_name, p_increment)
  ON CONFLICT (session_id, tool_name)
  DO UPDATE SET usage_count = session_tool_usage.usage_count + p_increment
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION increment_session_tool_usage(UUID, TEXT, INTEGER) TO service_role;

-- ============================================
-- AGGREGATION FUNCTION: GET SESSION TOOL DISTRIBUTION
-- ============================================
-- Returns tool usage distribution for a session

CREATE OR REPLACE FUNCTION get_session_tool_distribution(p_session_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
  session_team_id UUID;
BEGIN
  -- Get the team_id from the session
  SELECT s.team_id INTO session_team_id
  FROM sessions s
  WHERE s.id = p_session_id;

  IF session_team_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Verify user has access to this team
  IF NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = session_team_id
    AND tm.user_id = auth.uid()
  ) AND auth.role() != 'service_role' THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'session_id', p_session_id,
    'total_tool_calls', COALESCE(SUM(usage_count), 0),
    'distribution', COALESCE(
      json_object_agg(tool_name, usage_count),
      '{}'::json
    )
  ) INTO result
  FROM session_tool_usage
  WHERE session_id = p_session_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users and service_role
GRANT EXECUTE ON FUNCTION get_session_tool_distribution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_tool_distribution(UUID) TO service_role;

-- ============================================
-- AGGREGATION FUNCTION: GET USER TOOL DISTRIBUTION
-- ============================================
-- Returns aggregated tool usage distribution for a user across all sessions

CREATE OR REPLACE FUNCTION get_user_tool_distribution(
  p_user_id UUID,
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- User can only see their own distribution, or service_role can see any
  IF p_user_id != auth.uid() AND auth.role() != 'service_role' THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'user_id', p_user_id,
    'period_start', p_since,
    'period_end', NOW(),
    'total_tool_calls', COALESCE(SUM(stu.usage_count), 0),
    'session_count', COUNT(DISTINCT stu.session_id),
    'distribution', COALESCE(
      json_object_agg(stu.tool_name, stu.total_count),
      '{}'::json
    )
  ) INTO result
  FROM (
    SELECT
      tool_name,
      SUM(usage_count) as total_count
    FROM session_tool_usage stu
    INNER JOIN sessions s ON stu.session_id = s.id
    WHERE s.user_id = p_user_id
    AND s.started_at >= p_since
    GROUP BY tool_name
  ) stu;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users and service_role
GRANT EXECUTE ON FUNCTION get_user_tool_distribution(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tool_distribution(UUID, TIMESTAMPTZ) TO service_role;

-- ============================================
-- AGGREGATION FUNCTION: GET TEAM TOOL AVERAGES
-- ============================================
-- Returns average tool usage distribution for a team

CREATE OR REPLACE FUNCTION get_team_tool_averages(
  p_team_id UUID,
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  member_count INTEGER;
BEGIN
  -- Verify user has access to this team
  IF NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = p_team_id
    AND tm.user_id = auth.uid()
  ) AND auth.role() != 'service_role' THEN
    RETURN NULL;
  END IF;

  -- Get active member count for this period
  SELECT COUNT(DISTINCT s.user_id) INTO member_count
  FROM sessions s
  WHERE s.team_id = p_team_id
  AND s.started_at >= p_since;

  SELECT json_build_object(
    'team_id', p_team_id,
    'period_start', p_since,
    'period_end', NOW(),
    'member_count', member_count,
    'total_tool_calls', COALESCE(SUM(tool_data.total_count), 0),
    'averages', COALESCE(
      json_object_agg(
        tool_data.tool_name,
        json_build_object(
          'total_count', tool_data.total_count,
          'avg_per_user', ROUND(tool_data.total_count::NUMERIC / GREATEST(member_count, 1), 2),
          'percentage', tool_data.percentage
        )
      ),
      '{}'::json
    )
  ) INTO result
  FROM (
    SELECT
      stu.tool_name,
      SUM(stu.usage_count) as total_count,
      ROUND(
        SUM(stu.usage_count)::NUMERIC * 100 /
        NULLIF(SUM(SUM(stu.usage_count)) OVER (), 0),
        2
      ) as percentage
    FROM session_tool_usage stu
    INNER JOIN sessions s ON stu.session_id = s.id
    WHERE s.team_id = p_team_id
    AND s.started_at >= p_since
    GROUP BY stu.tool_name
  ) tool_data;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users and service_role
GRANT EXECUTE ON FUNCTION get_team_tool_averages(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_tool_averages(UUID, TIMESTAMPTZ) TO service_role;

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE session_tool_usage IS
  'Tracks Claude Code tool usage per session for analytics and profiling';

COMMENT ON COLUMN session_tool_usage.id IS
  'Primary key UUID';

COMMENT ON COLUMN session_tool_usage.session_id IS
  'Foreign key to the session this tool usage belongs to';

COMMENT ON COLUMN session_tool_usage.tool_name IS
  'Name of the Claude Code tool (e.g., Bash, Read, Edit, Write, Glob, Grep, TodoWrite, Task, WebFetch, WebSearch, NotebookEdit)';

COMMENT ON COLUMN session_tool_usage.usage_count IS
  'Number of times this tool was used in this session';

COMMENT ON TABLE tool_mastery_snapshots IS
  'Weekly/monthly snapshots of user tool mastery levels for progression tracking';

COMMENT ON COLUMN tool_mastery_snapshots.id IS
  'Primary key UUID';

COMMENT ON COLUMN tool_mastery_snapshots.user_id IS
  'User whose mastery is being tracked';

COMMENT ON COLUMN tool_mastery_snapshots.tool_name IS
  'Name of the Claude Code tool';

COMMENT ON COLUMN tool_mastery_snapshots.mastery_level IS
  'Mastery level: beginner, intermediate, advanced, or power_user';

COMMENT ON COLUMN tool_mastery_snapshots.total_usage_count IS
  'Total cumulative usage count at the time of snapshot';

COMMENT ON COLUMN tool_mastery_snapshots.snapshot_date IS
  'Date of the snapshot (for weekly/monthly tracking)';

COMMENT ON FUNCTION increment_session_tool_usage(UUID, TEXT, INTEGER) IS
  'Upserts tool usage count for a session, incrementing if exists or creating if not';

COMMENT ON FUNCTION get_session_tool_distribution(UUID) IS
  'Returns tool usage distribution for a specific session';

COMMENT ON FUNCTION get_user_tool_distribution(UUID, TIMESTAMPTZ) IS
  'Returns aggregated tool usage distribution for a user across all sessions';

COMMENT ON FUNCTION get_team_tool_averages(UUID, TIMESTAMPTZ) IS
  'Returns average tool usage distribution for a team';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== TOOL USAGE PROFILING MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created session_tool_usage table with indexes';
  RAISE NOTICE 'Created tool_mastery_snapshots table with indexes';
  RAISE NOTICE 'Created RLS policies for team-based access';
  RAISE NOTICE 'Created increment_session_tool_usage function';
  RAISE NOTICE 'Created get_session_tool_distribution function';
  RAISE NOTICE 'Created get_user_tool_distribution function';
  RAISE NOTICE 'Created get_team_tool_averages function';
  RAISE NOTICE '================================================';
END $$;
