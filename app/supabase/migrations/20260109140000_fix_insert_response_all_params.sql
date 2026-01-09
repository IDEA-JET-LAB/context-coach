-- Fix insert_encrypted_response to include ALL parameters
-- This fixes the bug where the 20260109110000 migration removed session_uuid/message_uuid
-- when adding thinking_text support
--
-- Required parameters:
-- - Original: p_prompt_id, p_response_text, p_tool_count, p_tools_used, p_model, p_tokens_in, p_tokens_out
-- - Phase 3: p_has_thinking, p_thinking_summary, p_thinking_word_count, p_stop_reason, p_cache_stats
-- - Session tracking (25-1): p_session_uuid, p_message_uuid
-- - Import support: p_created_at
-- - Thinking text: p_thinking_text

-- Drop existing function first
DROP FUNCTION IF EXISTS insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, TEXT, VARCHAR, JSONB, TIMESTAMPTZ);

-- Create unified function with ALL parameters
CREATE OR REPLACE FUNCTION insert_encrypted_response(
  p_prompt_id UUID DEFAULT NULL,
  p_response_text TEXT DEFAULT NULL,
  p_tool_count INTEGER DEFAULT 0,
  p_tools_used TEXT[] DEFAULT '{}',
  p_model TEXT DEFAULT NULL,
  p_tokens_in INTEGER DEFAULT NULL,
  p_tokens_out INTEGER DEFAULT NULL,
  p_has_thinking BOOLEAN DEFAULT FALSE,
  p_thinking_summary TEXT DEFAULT NULL,
  p_thinking_word_count INTEGER DEFAULT NULL,
  p_thinking_text TEXT DEFAULT NULL,
  p_stop_reason VARCHAR(50) DEFAULT NULL,
  p_cache_stats JSONB DEFAULT NULL,
  p_session_uuid UUID DEFAULT NULL,
  p_message_uuid VARCHAR(100) DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT NULL
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
    thinking_text_encrypted,
    stop_reason,
    cache_stats,
    session_uuid,
    message_uuid,
    created_at
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
    encrypt_thinking_text(p_thinking_text),
    p_stop_reason,
    p_cache_stats,
    p_session_uuid,
    p_message_uuid,
    COALESCE(p_created_at, NOW())
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, TEXT, VARCHAR, JSONB, UUID, VARCHAR, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, TEXT, VARCHAR, JSONB, UUID, VARCHAR, TIMESTAMPTZ) IS
  'Inserts a response with encrypted text and thinking. Supports all parameters: Phase 3 metadata, session tracking (session_uuid, message_uuid), import support (created_at), and thinking_text.';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== FIX: insert_encrypted_response WITH ALL PARAMETERS ===';
  RAISE NOTICE 'Now includes: p_session_uuid, p_message_uuid, p_thinking_text, p_created_at';
  RAISE NOTICE '============================================================';
END $$;
