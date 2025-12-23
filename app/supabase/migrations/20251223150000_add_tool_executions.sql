-- Tool Executions Storage Migration
-- Story 15-7: Tool Execution Capture
-- Creates tool_executions table for storing detailed tool execution data

-- ============================================
-- TOOL_EXECUTIONS TABLE
-- ============================================
-- Stores individual tool executions linked to prompt responses

CREATE TABLE IF NOT EXISTS tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to prompt_responses
  response_id UUID NOT NULL REFERENCES prompt_responses(id) ON DELETE CASCADE,

  -- Tool identification
  tool_name TEXT NOT NULL,
  tool_id TEXT, -- Claude's tool_use ID (e.g., 'toolu_01...')

  -- Input data
  input_summary TEXT NOT NULL,
  input_full JSONB, -- Optional full input (may be null for privacy)

  -- Output/result data
  output_summary TEXT, -- Summary of tool_result
  result_matched BOOLEAN DEFAULT FALSE, -- Whether we found a matching tool_result
  success BOOLEAN, -- NULL if result not matched, true/false based on error detection

  -- Ordering
  execution_order INTEGER NOT NULL, -- 1-indexed order within response

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Fast lookup by response
CREATE INDEX IF NOT EXISTS idx_tool_exec_response ON tool_executions(response_id);

-- Fast lookup by tool name (for analytics)
CREATE INDEX IF NOT EXISTS idx_tool_exec_name ON tool_executions(tool_name);

-- Ordered access within a response
CREATE INDEX IF NOT EXISTS idx_tool_exec_order ON tool_executions(response_id, execution_order);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: CHECK TOOL EXECUTION ACCESS
-- ============================================
-- Validates access via chain: tool_executions -> prompt_responses -> prompts -> team_members

CREATE OR REPLACE FUNCTION check_tool_execution_access(p_response_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  prompt_id_val UUID;
  prompt_team_id UUID;
BEGIN
  -- Get the prompt_id from the parent response
  SELECT pr.prompt_id INTO prompt_id_val
  FROM prompt_responses pr
  WHERE pr.id = p_response_id;

  IF prompt_id_val IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get the team_id from the prompt
  SELECT p.team_id INTO prompt_team_id
  FROM prompts p
  WHERE p.id = prompt_id_val;

  IF prompt_team_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user is a member of that team
  RETURN EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = prompt_team_id
    AND tm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Team members can view tool executions for their team's responses
CREATE POLICY "Team members can view tool executions" ON tool_executions
  FOR SELECT USING (
    check_tool_execution_access(response_id)
    OR auth.role() = 'service_role'
  );

-- Service role can insert tool executions (used by capture API)
CREATE POLICY "Service role can insert tool executions" ON tool_executions
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Service role can update tool executions
CREATE POLICY "Service role can update tool executions" ON tool_executions
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can delete tool executions
CREATE POLICY "Service role can delete tool executions" ON tool_executions
  FOR DELETE TO service_role
  USING (true);

-- ============================================
-- AGGREGATION FUNCTION: GET TOOL USAGE STATS
-- ============================================
-- Returns tool usage statistics for a team

CREATE OR REPLACE FUNCTION get_tool_usage_stats(
  p_team_id UUID,
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_limit INTEGER DEFAULT 20
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Verify user has access to this team
  IF NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = p_team_id
    AND tm.user_id = auth.uid()
  ) AND auth.role() != 'service_role' THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'period_start', p_since,
    'period_end', NOW(),
    'team_id', p_team_id,
    'total_executions', COALESCE(SUM(stats.count), 0),
    'tools', COALESCE(
      json_agg(
        json_build_object(
          'tool_name', stats.tool_name,
          'execution_count', stats.count,
          'success_count', stats.success_count,
          'failure_count', stats.failure_count,
          'unmatched_count', stats.unmatched_count,
          'success_rate', CASE
            WHEN stats.matched_count > 0
            THEN ROUND((stats.success_count::NUMERIC / stats.matched_count) * 100, 2)
            ELSE NULL
          END
        ) ORDER BY stats.count DESC
      ) FILTER (WHERE stats.tool_name IS NOT NULL),
      '[]'::json
    )
  ) INTO result
  FROM (
    SELECT
      te.tool_name,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE te.success = true) as success_count,
      COUNT(*) FILTER (WHERE te.success = false) as failure_count,
      COUNT(*) FILTER (WHERE te.result_matched = true) as matched_count,
      COUNT(*) FILTER (WHERE te.result_matched = false) as unmatched_count
    FROM tool_executions te
    INNER JOIN prompt_responses pr ON te.response_id = pr.id
    INNER JOIN prompts p ON pr.prompt_id = p.id
    WHERE p.team_id = p_team_id
    AND te.created_at >= p_since
    GROUP BY te.tool_name
    ORDER BY count DESC
    LIMIT p_limit
  ) stats;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users and service_role
GRANT EXECUTE ON FUNCTION get_tool_usage_stats(UUID, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tool_usage_stats(UUID, TIMESTAMPTZ, INTEGER) TO service_role;

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE tool_executions IS
  'Stores individual tool execution records linked to prompt responses';

COMMENT ON COLUMN tool_executions.id IS
  'Primary key UUID';

COMMENT ON COLUMN tool_executions.response_id IS
  'Foreign key to the prompt_response this execution belongs to';

COMMENT ON COLUMN tool_executions.tool_name IS
  'Name of the tool (e.g., Read, Write, Bash, Glob, Grep)';

COMMENT ON COLUMN tool_executions.tool_id IS
  'Claude API tool_use ID (e.g., toolu_01ABC...) for matching with results';

COMMENT ON COLUMN tool_executions.input_summary IS
  'Summarized/truncated tool input for display';

COMMENT ON COLUMN tool_executions.input_full IS
  'Full input JSONB (optional, may be null for privacy or size concerns)';

COMMENT ON COLUMN tool_executions.output_summary IS
  'Summary of the tool result content';

COMMENT ON COLUMN tool_executions.result_matched IS
  'Whether a tool_result was found matching this tool_use';

COMMENT ON COLUMN tool_executions.success IS
  'Whether the tool executed successfully (NULL if no result matched)';

COMMENT ON COLUMN tool_executions.execution_order IS
  'Order of execution within the response (1-indexed)';

COMMENT ON FUNCTION check_tool_execution_access(UUID) IS
  'Checks if current user can access a tool execution via team membership chain';

COMMENT ON FUNCTION get_tool_usage_stats(UUID, TIMESTAMPTZ, INTEGER) IS
  'Returns tool usage statistics for a team within a time period';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== TOOL EXECUTIONS MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created tool_executions table';
  RAISE NOTICE 'Created indexes for response_id, tool_name, and execution_order';
  RAISE NOTICE 'Created RLS policies for team-based access';
  RAISE NOTICE 'Created get_tool_usage_stats aggregation function';
  RAISE NOTICE '==========================================';
END $$;
