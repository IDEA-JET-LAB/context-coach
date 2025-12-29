-- Phase 3: Prompt Responses Table Extensions
-- Story 24-3: Prompt Responses Table Extensions
--
-- Adds columns for thinking metadata and response characteristics

-- ============================================
-- ADD PHASE 3 COLUMNS
-- ============================================
-- All columns nullable for backward compatibility

-- Compressed/truncated thinking content
ALTER TABLE prompt_responses
ADD COLUMN IF NOT EXISTS thinking_summary TEXT;

-- Original word count before compression
ALTER TABLE prompt_responses
ADD COLUMN IF NOT EXISTS thinking_word_count INTEGER;

-- Stop reason from the response
ALTER TABLE prompt_responses
ADD COLUMN IF NOT EXISTS stop_reason VARCHAR(50);

-- Cache usage statistics
ALTER TABLE prompt_responses
ADD COLUMN IF NOT EXISTS cache_stats JSONB;

-- ============================================
-- ADD CHECK CONSTRAINTS
-- ============================================

-- Valid stop_reason values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_stop_reason'
  ) THEN
    ALTER TABLE prompt_responses ADD CONSTRAINT valid_stop_reason CHECK (
      stop_reason IS NULL OR stop_reason IN (
        'end_turn', 'max_tokens', 'tool_use', 'stop_sequence', 'content_filtered'
      )
    );
  END IF;
END $$;

-- Valid thinking_word_count (non-negative)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_thinking_word_count'
  ) THEN
    ALTER TABLE prompt_responses ADD CONSTRAINT valid_thinking_word_count CHECK (
      thinking_word_count IS NULL OR thinking_word_count >= 0
    );
  END IF;
END $$;

-- ============================================
-- COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN prompt_responses.thinking_summary IS
  'Compressed/truncated version of extended thinking content. Default limit: 500 characters. Truncated at sentence boundary when possible.';

COMMENT ON COLUMN prompt_responses.thinking_word_count IS
  'Original word count of the full thinking content before compression. Useful for understanding thinking depth.';

COMMENT ON COLUMN prompt_responses.stop_reason IS
  'Reason why Claude stopped generating. Values: end_turn (natural completion), max_tokens (hit limit), tool_use (invoking tool), stop_sequence (hit stop sequence), content_filtered (safety filter).';

COMMENT ON COLUMN prompt_responses.cache_stats IS
  'Cache usage statistics from the response. Example: {"creation": 9364, "read": 39481, "tier": "standard"}. Creation = tokens written to cache, read = tokens read from cache.';

-- ============================================
-- UPDATE INSERT_ENCRYPTED_RESPONSE FUNCTION
-- ============================================
-- Add new parameters while maintaining backward compatibility

-- First drop the old function signature
DROP FUNCTION IF EXISTS insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN);

-- Create new function with all parameters (using defaults for backward compat)
CREATE OR REPLACE FUNCTION insert_encrypted_response(
  p_prompt_id UUID,
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
  p_cache_stats JSONB DEFAULT NULL
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
    cache_stats
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
    p_cache_stats
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, VARCHAR, JSONB) TO service_role;

COMMENT ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, VARCHAR, JSONB) IS
  'Inserts a response with encrypted text and Phase 3 metadata. Returns the new response ID. Backward compatible with existing callers.';

-- ============================================
-- UPDATE GET_DECRYPTED_RESPONSE FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS get_decrypted_response(UUID);

CREATE OR REPLACE FUNCTION get_decrypted_response(p_response_id UUID)
RETURNS TABLE (
  id UUID,
  prompt_id UUID,
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
    check_response_team_access(pr.prompt_id)
    OR auth.role() = 'service_role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_decrypted_response(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_response(UUID) TO service_role;

COMMENT ON FUNCTION get_decrypted_response(UUID) IS
  'Returns a response with decrypted text by response ID. Includes Phase 3 columns.';

-- ============================================
-- UPDATE GET_DECRYPTED_RESPONSE_BY_PROMPT
-- ============================================

DROP FUNCTION IF EXISTS get_decrypted_response_by_prompt(UUID);

CREATE OR REPLACE FUNCTION get_decrypted_response_by_prompt(p_prompt_id UUID)
RETURNS TABLE (
  id UUID,
  prompt_id UUID,
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
  WHERE pr.prompt_id = p_prompt_id
  AND (
    check_response_team_access(pr.prompt_id)
    OR auth.role() = 'service_role'
  )
  ORDER BY pr.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_decrypted_response_by_prompt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_response_by_prompt(UUID) TO service_role;

COMMENT ON FUNCTION get_decrypted_response_by_prompt(UUID) IS
  'Returns the most recent response for a prompt with decrypted text. Includes Phase 3 columns.';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 3: RESPONSES EXTENSIONS COMPLETE ===';
  RAISE NOTICE 'Added columns: thinking_summary, thinking_word_count, stop_reason, cache_stats';
  RAISE NOTICE 'Updated functions: insert_encrypted_response, get_decrypted_response, get_decrypted_response_by_prompt';
  RAISE NOTICE '=============================================';
END $$;
