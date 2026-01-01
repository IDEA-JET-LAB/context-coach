-- Fix Response RLS Policy for Session-Based Access
-- Phase 3 Bug Fix: Responses with NULL prompt_id were being blocked
--
-- Problem: The RLS policy only checked access via prompt_id, but Phase 3
-- responses arrive before prompts and have prompt_id = NULL.
--
-- Solution: Add session-based access check to the RLS policy.

-- ============================================
-- CREATE SESSION ACCESS CHECK FUNCTION
-- ============================================

-- Function to check if user has access to a response via session_uuid
CREATE OR REPLACE FUNCTION check_response_session_access(p_session_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- NULL session_uuid means no session-based access
  IF p_session_uuid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user is a team member of the session's team
  RETURN EXISTS (
    SELECT 1
    FROM sessions s
    JOIN team_members tm ON tm.team_id = s.team_id
    WHERE s.id = p_session_uuid
    AND tm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION check_response_session_access(UUID) TO authenticated;

COMMENT ON FUNCTION check_response_session_access(UUID) IS
  'Checks if the current user has access to a response via its session. Returns TRUE if user is a team member of the session''s team.';

-- ============================================
-- UPDATE RLS POLICY
-- ============================================

-- Drop the old policy
DROP POLICY IF EXISTS "Team members can view responses" ON prompt_responses;

-- Create new policy that checks BOTH prompt_id AND session_uuid
CREATE POLICY "Team members can view responses" ON prompt_responses
  FOR SELECT USING (
    -- Access via prompt linkage (original behavior)
    check_response_team_access(prompt_id)
    -- Access via session linkage (Phase 3 - responses before prompts)
    OR check_response_session_access(session_uuid)
    -- Service role always has access
    OR auth.role() = 'service_role'
  );

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== FIX: RESPONSE RLS SESSION ACCESS ===';
  RAISE NOTICE 'Created: check_response_session_access(UUID) function';
  RAISE NOTICE 'Updated: "Team members can view responses" policy';
  RAISE NOTICE 'Responses with NULL prompt_id can now be accessed via session_uuid';
  RAISE NOTICE '==========================================';
END $$;
