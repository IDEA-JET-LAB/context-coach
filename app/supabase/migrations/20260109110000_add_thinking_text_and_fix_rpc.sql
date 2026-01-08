-- Add full thinking text storage and reconcile insert_encrypted_response signatures
-- Phase 3 Enhancement: Full thinking capture for imports

-- ============================================
-- ADD THINKING TEXT COLUMN
-- ============================================
-- Stores the full encrypted thinking text (can be large)

ALTER TABLE prompt_responses
ADD COLUMN IF NOT EXISTS thinking_text_encrypted BYTEA;

COMMENT ON COLUMN prompt_responses.thinking_text_encrypted IS
  'PGP-encrypted full thinking text. Use get_decrypted_thinking() to read. May be large (10KB+).';

-- ============================================
-- ENCRYPTION FUNCTION FOR THINKING
-- ============================================
-- Reuses the same encryption as response text

CREATE OR REPLACE FUNCTION encrypt_thinking_text(plaintext TEXT)
RETURNS BYTEA AS $$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_encrypt(
    plaintext,
    encode(get_encryption_key(), 'escape'),
    'compress-algo=1, cipher-algo=aes256'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_thinking_text(ciphertext BYTEA)
RETURNS TEXT AS $$
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(
    ciphertext,
    encode(get_encryption_key(), 'escape')
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to decrypt thinking text: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION encrypt_thinking_text(TEXT) IS
  'Encrypts thinking text using AES-256 with key from Vault or app settings';

COMMENT ON FUNCTION decrypt_thinking_text(BYTEA) IS
  'Decrypts thinking text encrypted by encrypt_thinking_text()';

-- ============================================
-- UNIFIED INSERT_ENCRYPTED_RESPONSE FUNCTION
-- ============================================
-- Combines all parameters: original, Phase 3, created_at, and thinking_text

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
  p_thinking_text TEXT DEFAULT NULL,
  p_stop_reason VARCHAR(50) DEFAULT NULL,
  p_cache_stats JSONB DEFAULT NULL,
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
    COALESCE(p_created_at, NOW())
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, TEXT, VARCHAR, JSONB, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER, TEXT, VARCHAR, JSONB, TIMESTAMPTZ) IS
  'Inserts a response with encrypted text and thinking. Returns the new response ID. Supports all columns including created_at for imports.';

-- ============================================
-- GET DECRYPTED THINKING FUNCTION
-- ============================================
-- Returns decrypted thinking text for a response

CREATE OR REPLACE FUNCTION get_decrypted_thinking(p_response_id UUID)
RETURNS TEXT AS $$
DECLARE
  thinking_text TEXT;
BEGIN
  SELECT decrypt_thinking_text(pr.thinking_text_encrypted) INTO thinking_text
  FROM prompt_responses pr
  WHERE pr.id = p_response_id
  AND (
    check_response_team_access(pr.prompt_id)
    OR auth.role() = 'service_role'
  );

  RETURN thinking_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_decrypted_thinking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_thinking(UUID) TO service_role;

COMMENT ON FUNCTION get_decrypted_thinking(UUID) IS
  'Returns decrypted thinking text for a response. Respects team access.';

-- ============================================
-- UPDATE GET_DECRYPTED_RESPONSE TO INCLUDE THINKING
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
  thinking_text TEXT,
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
    decrypt_thinking_text(pr.thinking_text_encrypted) as thinking_text,
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

GRANT EXECUTE ON FUNCTION get_decrypted_response(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_response(UUID) TO service_role;

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
  thinking_text TEXT,
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
    decrypt_thinking_text(pr.thinking_text_encrypted) as thinking_text,
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

GRANT EXECUTE ON FUNCTION get_decrypted_response_by_prompt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_response_by_prompt(UUID) TO service_role;

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== THINKING TEXT STORAGE MIGRATION COMPLETE ===';
  RAISE NOTICE 'Added thinking_text_encrypted column';
  RAISE NOTICE 'Created encrypt/decrypt_thinking_text functions';
  RAISE NOTICE 'Created get_decrypted_thinking RPC';
  RAISE NOTICE 'Updated insert_encrypted_response with all parameters';
  RAISE NOTICE 'Updated get_decrypted_response* to include thinking_text';
  RAISE NOTICE '================================================';
END $$;
