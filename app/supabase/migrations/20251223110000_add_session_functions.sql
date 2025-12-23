-- Session Functions Migration
-- Story 16-2: Session Detection Logic
-- Creates database functions for session management

-- ============================================
-- INCREMENT SESSION PROMPT COUNT FUNCTION
-- ============================================
-- Atomically increments the prompt count for a session.
-- Uses atomic UPDATE to handle concurrent calls safely.

CREATE OR REPLACE FUNCTION increment_session_prompt_count(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sessions
  SET
    total_prompts = total_prompts + 1,
    updated_at = NOW()
  WHERE id = p_session_id;

  -- Return silently if session not found (non-blocking behavior)
  -- The calling code will handle session existence checks separately
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION increment_session_prompt_count(UUID) TO service_role;

-- ============================================
-- GET NEXT SEQUENCE NUMBER FUNCTION
-- ============================================
-- Returns the next sequence number for a session.
-- Used when linking prompts to sessions.

CREATE OR REPLACE FUNCTION get_session_next_sequence(p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_seq INTEGER;
BEGIN
  -- Get current total_prompts + 1 for the next sequence
  SELECT total_prompts + 1 INTO v_next_seq
  FROM sessions
  WHERE id = p_session_id;

  -- Return 1 if session not found (safe default)
  IF v_next_seq IS NULL THEN
    RETURN 1;
  END IF;

  RETURN v_next_seq;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_session_next_sequence(UUID) TO service_role;

-- ============================================
-- LINK PROMPT TO SESSION FUNCTION
-- ============================================
-- Atomically links a prompt to a session and increments the count.
-- This ensures sequence numbers are assigned correctly even with concurrent requests.

CREATE OR REPLACE FUNCTION link_prompt_to_session(
  p_prompt_id UUID,
  p_session_id UUID
)
RETURNS TABLE(sequence_number INTEGER, success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence INTEGER;
BEGIN
  -- Lock the session row to prevent race conditions
  -- and get the next sequence number
  SELECT total_prompts + 1 INTO v_sequence
  FROM sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_sequence IS NULL THEN
    -- Session not found
    RETURN QUERY SELECT 0::INTEGER, FALSE;
    RETURN;
  END IF;

  -- Update the prompt with session reference and sequence number
  UPDATE prompts
  SET
    session_uuid = p_session_id,
    sequence_number = v_sequence
  WHERE id = p_prompt_id;

  -- Increment the session prompt count
  UPDATE sessions
  SET
    total_prompts = total_prompts + 1,
    updated_at = NOW()
  WHERE id = p_session_id;

  RETURN QUERY SELECT v_sequence, TRUE;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION link_prompt_to_session(UUID, UUID) TO service_role;

-- ============================================
-- FUNCTION COMMENTS
-- ============================================

COMMENT ON FUNCTION increment_session_prompt_count(UUID) IS
  'Atomically increments the total_prompts counter for a session. Safe for concurrent calls.';

COMMENT ON FUNCTION get_session_next_sequence(UUID) IS
  'Returns the next sequence number for a prompt in a session (total_prompts + 1).';

COMMENT ON FUNCTION link_prompt_to_session(UUID, UUID) IS
  'Atomically links a prompt to a session, assigns sequence number, and increments count. Uses row-level locking for safety.';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== SESSION FUNCTIONS MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created increment_session_prompt_count(UUID)';
  RAISE NOTICE 'Created get_session_next_sequence(UUID)';
  RAISE NOTICE 'Created link_prompt_to_session(UUID, UUID)';
  RAISE NOTICE '===========================================';
END $$;
