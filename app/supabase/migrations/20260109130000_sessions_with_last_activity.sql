-- Migration: Create view for sessions with calculated last_activity_at
-- Replaces the need for triggers by calculating last message timestamp dynamically

-- Drop the triggers we added (they're no longer needed)
DROP TRIGGER IF EXISTS trigger_update_session_ended_at ON prompts;
DROP TRIGGER IF EXISTS trigger_update_session_ended_at_response ON prompt_responses;
DROP FUNCTION IF EXISTS update_session_ended_at();
DROP FUNCTION IF EXISTS update_session_ended_at_from_response();

-- Create a function to get last activity for a session
-- This is more efficient than a view for large datasets
CREATE OR REPLACE FUNCTION get_session_last_activity(session_uuid UUID)
RETURNS TIMESTAMPTZ AS $$
  SELECT GREATEST(
    COALESCE((SELECT MAX(created_at) FROM prompts WHERE prompts.session_uuid = $1), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(created_at) FROM prompt_responses WHERE prompt_responses.session_uuid = $1), '1970-01-01'::timestamptz)
  );
$$ LANGUAGE SQL STABLE;

-- Create an RPC function that returns sessions with calculated last_activity_at
-- This replaces the ended_at field with a calculated value
CREATE OR REPLACE FUNCTION get_sessions_with_activity(
  p_team_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  session_id TEXT,
  slug TEXT,
  project_id UUID,
  user_id UUID,
  started_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  total_prompts INTEGER,
  user_message_count INTEGER,
  primary_stage TEXT,
  has_debugging_loop BOOLEAN,
  conversation_score NUMERIC,
  stage_breakdown JSONB,
  git_branch TEXT,
  cwd TEXT,
  claude_code_version TEXT,
  is_imported BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.session_id,
    s.slug,
    s.project_id,
    s.user_id,
    s.started_at,
    GREATEST(
      s.started_at,
      COALESCE((SELECT MAX(p.created_at) FROM prompts p WHERE p.session_uuid = s.id), s.started_at),
      COALESCE((SELECT MAX(pr.created_at) FROM prompt_responses pr WHERE pr.session_uuid = s.id), s.started_at)
    ) as last_activity_at,
    s.total_prompts,
    s.user_message_count,
    s.primary_stage,
    s.has_debugging_loop,
    s.conversation_score,
    s.stage_breakdown,
    s.git_branch,
    s.cwd,
    s.claude_code_version,
    s.is_imported
  FROM sessions s
  WHERE s.team_id = p_team_id
  ORDER BY s.started_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_sessions_with_activity(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_last_activity(UUID) TO authenticated;
