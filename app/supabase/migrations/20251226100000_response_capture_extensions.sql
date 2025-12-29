-- Response Capture Extensions
-- Story 25-1: Response Capture Endpoint
--
-- Extends prompt_responses table to support response capture endpoint:
-- 1. Add session_uuid and message_uuid for linking
-- 2. Make prompt_id nullable (response may arrive before prompt)
-- 3. Update RPC function to handle nullable prompt_id

-- ============================================
-- ADD SESSION AND MESSAGE TRACKING COLUMNS
-- ============================================

-- Session UUID for direct session linkage
ALTER TABLE prompt_responses
ADD COLUMN IF NOT EXISTS session_uuid UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- Message UUID from Claude Code transcript for prompt correlation
ALTER TABLE prompt_responses
ADD COLUMN IF NOT EXISTS message_uuid VARCHAR(100);

-- ============================================
-- MAKE PROMPT_ID NULLABLE
-- ============================================
-- Response may arrive before its prompt in edge cases.
-- We correlate later via message_uuid matching.

-- Drop the NOT NULL constraint on prompt_id
ALTER TABLE prompt_responses
ALTER COLUMN prompt_id DROP NOT NULL;

-- ============================================
-- ADD INDEXES
-- ============================================

-- Index for session lookup
CREATE INDEX IF NOT EXISTS idx_responses_session_uuid
  ON prompt_responses(session_uuid)
  WHERE session_uuid IS NOT NULL;

-- Index for message UUID correlation with prompts
CREATE INDEX IF NOT EXISTS idx_responses_message_uuid
  ON prompt_responses(message_uuid)
  WHERE message_uuid IS NOT NULL;

-- Index for finding responses without linked prompts (for background linking job)
CREATE INDEX IF NOT EXISTS idx_responses_unlinked
  ON prompt_responses(message_uuid, created_at)
  WHERE prompt_id IS NULL AND message_uuid IS NOT NULL;

-- ============================================
-- UPDATE INSERT_ENCRYPTED_RESPONSE FUNCTION
-- ============================================
-- Add session_uuid and message_uuid parameters

-- Drop existing function signatures to recreate with new parameters
DROP FUNCTION IF EXISTS insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, VARCHAR, JSONB);

-- Create new function with all parameters
CREATE OR REPLACE FUNCTION insert_encrypted_response(
  p_prompt_id UUID DEFAULT NULL,           -- Now nullable
  p_response_text TEXT DEFAULT NULL,
  p_tool_count INTEGER DEFAULT 0,
  p_tools_used TEXT[] DEFAULT '{}',
  p_model TEXT DEFAULT NULL,
  p_tokens_in INTEGER DEFAULT NULL,
  p_tokens_out INTEGER DEFAULT NULL,
  p_has_thinking BOOLEAN DEFAULT FALSE,
  p_thinking_summary TEXT DEFAULT NULL,
  p_thinking_word_count INTEGER DEFAULT NULL,
  p_stop_reason VARCHAR(50) DEFAULT NULL,
  p_cache_stats JSONB DEFAULT NULL,
  p_session_uuid UUID DEFAULT NULL,        -- New parameter
  p_message_uuid VARCHAR(100) DEFAULT NULL -- New parameter
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO prompt_responses (
    prompt_id,
    response_text_encrypted,
    tool_count,
    tools_used,
    model,
    tokens_in,
    tokens_out,
    has_thinking,
    thinking_summary,
    thinking_word_count,
    stop_reason,
    cache_stats,
    session_uuid,
    message_uuid
  ) VALUES (
    p_prompt_id,
    encrypt_response_text(p_response_text),
    p_tool_count,
    p_tools_used,
    p_model,
    p_tokens_in,
    p_tokens_out,
    p_has_thinking,
    p_thinking_summary,
    p_thinking_word_count,
    p_stop_reason,
    p_cache_stats,
    p_session_uuid,
    p_message_uuid
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, VARCHAR, JSONB, UUID, VARCHAR) TO service_role;

COMMENT ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, VARCHAR, JSONB, UUID, VARCHAR) IS
  'Inserts a response with encrypted text, Phase 3 metadata, and session/message tracking. Returns the new response ID. prompt_id is now nullable for responses arriving before their prompts.';

-- ============================================
-- UPDATE GET_DECRYPTED_RESPONSE FUNCTION
-- ============================================
-- Add session_uuid and message_uuid to return

DROP FUNCTION IF EXISTS get_decrypted_response(UUID);

CREATE OR REPLACE FUNCTION get_decrypted_response(p_response_id UUID)
RETURNS TABLE (
  id UUID,
  prompt_id UUID,
  session_uuid UUID,
  message_uuid VARCHAR(100),
  response_text TEXT,
  tool_count INTEGER,
  tools_used TEXT[],
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  has_thinking BOOLEAN,
  thinking_summary TEXT,
  thinking_word_count INTEGER,
  stop_reason VARCHAR(50),
  cache_stats JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.prompt_id,
    pr.session_uuid,
    pr.message_uuid,
    decrypt_response_text(pr.response_text_encrypted) as response_text,
    pr.tool_count,
    pr.tools_used,
    pr.model,
    pr.tokens_in,
    pr.tokens_out,
    pr.has_thinking,
    pr.thinking_summary,
    pr.thinking_word_count,
    pr.stop_reason,
    pr.cache_stats,
    pr.created_at
  FROM prompt_responses pr
  WHERE pr.id = p_response_id
  AND (
    -- Allow if user has access via prompt's team
    (pr.prompt_id IS NOT NULL AND check_response_team_access(pr.prompt_id))
    -- Allow if user has access via session's team
    OR EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE s.id = pr.session_uuid AND tm.user_id = auth.uid()
    )
    -- Always allow service role
    OR auth.role() = 'service_role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_decrypted_response(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_response(UUID) TO service_role;

COMMENT ON FUNCTION get_decrypted_response(UUID) IS
  'Returns a response with decrypted text by response ID. Includes session_uuid and message_uuid for Phase 3 correlation.';

-- ============================================
-- CREATE FUNCTION: LINK RESPONSE TO PROMPT
-- ============================================
-- Links an unlinked response to its prompt via message_uuid matching

CREATE OR REPLACE FUNCTION link_response_to_prompt(
  p_response_id UUID,
  p_prompt_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE prompt_responses
  SET prompt_id = p_prompt_id
  WHERE id = p_response_id
  AND prompt_id IS NULL;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION link_response_to_prompt(UUID, UUID) TO service_role;

COMMENT ON FUNCTION link_response_to_prompt(UUID, UUID) IS
  'Links an unlinked response to a prompt. Used when prompt arrives after response. Returns true if link was made.';

-- ============================================
-- CREATE FUNCTION: GET RESPONSES BY SESSION
-- ============================================
-- Retrieves all responses for a session

CREATE OR REPLACE FUNCTION get_session_responses(p_session_uuid UUID)
RETURNS TABLE (
  id UUID,
  prompt_id UUID,
  message_uuid VARCHAR(100),
  response_text TEXT,
  tool_count INTEGER,
  tools_used TEXT[],
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  has_thinking BOOLEAN,
  thinking_summary TEXT,
  stop_reason VARCHAR(50),
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.prompt_id,
    pr.message_uuid,
    decrypt_response_text(pr.response_text_encrypted) as response_text,
    pr.tool_count,
    pr.tools_used,
    pr.model,
    pr.tokens_in,
    pr.tokens_out,
    pr.has_thinking,
    pr.thinking_summary,
    pr.stop_reason,
    pr.created_at
  FROM prompt_responses pr
  WHERE pr.session_uuid = p_session_uuid
  AND (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE s.id = p_session_uuid AND tm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  )
  ORDER BY pr.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_session_responses(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_responses(UUID) TO service_role;

COMMENT ON FUNCTION get_session_responses(UUID) IS
  'Returns all responses for a session with decrypted text, ordered by creation time.';

-- ============================================
-- COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN prompt_responses.session_uuid IS
  'Foreign key to sessions table. Links response directly to its session for queries without requiring prompt linkage.';

COMMENT ON COLUMN prompt_responses.message_uuid IS
  'Claude Code message UUID from the transcript. Used to correlate response with its prompt via prompts.message_uuid matching.';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== STORY 25-1: RESPONSE CAPTURE EXTENSIONS COMPLETE ===';
  RAISE NOTICE 'Added columns: session_uuid, message_uuid';
  RAISE NOTICE 'Made prompt_id nullable for edge cases';
  RAISE NOTICE 'Updated RPC functions: insert_encrypted_response, get_decrypted_response';
  RAISE NOTICE 'Added functions: link_response_to_prompt, get_session_responses';
  RAISE NOTICE '========================================================';
END $$;
