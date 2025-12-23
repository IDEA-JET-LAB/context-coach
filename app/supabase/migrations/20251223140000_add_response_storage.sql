-- Response Storage Schema Migration
-- Story 15-6: Response Storage Schema
-- Creates prompt_responses table and encryption functions for storing AI responses

-- ============================================
-- ENABLE PGCRYPTO EXTENSION
-- ============================================
-- Required for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- EXTEND PROMPTS TABLE
-- ============================================
-- Add columns for model and token tracking on prompts

-- Model used for the request
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS model TEXT;

-- Token counts for the request
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS input_tokens INTEGER;

ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS output_tokens INTEGER;

-- Whether the response included thinking/reasoning
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS has_thinking BOOLEAN DEFAULT FALSE;

-- ============================================
-- PROMPT_RESPONSES TABLE
-- ============================================
-- Stores AI responses linked to prompts with encrypted response text

CREATE TABLE IF NOT EXISTS prompt_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to prompts
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,

  -- Encrypted response text (nullable - may be omitted for privacy)
  response_text_encrypted BYTEA,

  -- Tool usage metadata
  tool_count INTEGER DEFAULT 0,
  tools_used TEXT[] DEFAULT '{}',

  -- Model and token info (may differ from prompt if retry)
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,

  -- Whether response included thinking/reasoning
  has_thinking BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Fast lookup by prompt
CREATE INDEX IF NOT EXISTS idx_responses_prompt ON prompt_responses(prompt_id);

-- GIN index for tool usage queries (e.g., find all responses using 'Edit' tool)
CREATE INDEX IF NOT EXISTS idx_responses_tools ON prompt_responses USING GIN(tools_used);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE prompt_responses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: CHECK RESPONSE ACCESS
-- ============================================
-- Validates that a user can access a response via team membership

CREATE OR REPLACE FUNCTION check_response_team_access(response_prompt_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  prompt_team_id UUID;
BEGIN
  -- Get the team_id from the parent prompt
  SELECT p.team_id INTO prompt_team_id
  FROM prompts p
  WHERE p.id = response_prompt_id;

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

-- Team members can view responses for their team's prompts
CREATE POLICY "Team members can view responses" ON prompt_responses
  FOR SELECT USING (
    check_response_team_access(prompt_id)
    OR auth.role() = 'service_role'
  );

-- Service role can insert responses (used by capture API)
CREATE POLICY "Service role can insert responses" ON prompt_responses
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Service role can update responses
CREATE POLICY "Service role can update responses" ON prompt_responses
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can delete responses
CREATE POLICY "Service role can delete responses" ON prompt_responses
  FOR DELETE TO service_role
  USING (true);

-- ============================================
-- ENCRYPTION FUNCTIONS
-- ============================================
-- Uses AES-256 encryption with key from Supabase Vault or app settings

-- Get encryption key (from Vault or app settings fallback)
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS BYTEA AS $$
DECLARE
  key_text TEXT;
BEGIN
  -- Try to get key from Supabase Vault first
  BEGIN
    SELECT decrypted_secret INTO key_text
    FROM vault.decrypted_secrets
    WHERE name = 'contextor_encryption_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    key_text := NULL;
  END;

  -- Fallback to app settings (for local development)
  IF key_text IS NULL OR key_text = '' THEN
    key_text := current_setting('app.encryption_key', true);
  END IF;

  -- If still no key, use a default for development (NOT for production!)
  IF key_text IS NULL OR key_text = '' THEN
    -- 32-byte key for AES-256 (this is a development fallback only)
    RAISE WARNING 'Using development encryption key - configure contextor_encryption_key in Vault for production!';
    key_text := 'contextor_dev_key_32_bytes_long!';
  END IF;

  RETURN convert_to(key_text, 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Encrypt response text
CREATE OR REPLACE FUNCTION encrypt_response_text(plaintext TEXT)
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

-- Decrypt response text
CREATE OR REPLACE FUNCTION decrypt_response_text(ciphertext BYTEA)
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
  RAISE WARNING 'Failed to decrypt response text: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: INSERT ENCRYPTED RESPONSE
-- ============================================
-- Inserts a response with encrypted text

CREATE OR REPLACE FUNCTION insert_encrypted_response(
  p_prompt_id UUID,
  p_response_text TEXT DEFAULT NULL,
  p_tool_count INTEGER DEFAULT 0,
  p_tools_used TEXT[] DEFAULT '{}',
  p_model TEXT DEFAULT NULL,
  p_tokens_in INTEGER DEFAULT NULL,
  p_tokens_out INTEGER DEFAULT NULL,
  p_has_thinking BOOLEAN DEFAULT FALSE
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
    has_thinking
  ) VALUES (
    p_prompt_id,
    encrypt_response_text(p_response_text),
    p_tool_count,
    p_tools_used,
    p_model,
    p_tokens_in,
    p_tokens_out,
    p_has_thinking
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN) TO service_role;

-- ============================================
-- RPC: GET DECRYPTED RESPONSE
-- ============================================
-- Returns a response with decrypted text

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
    pr.created_at
  FROM prompt_responses pr
  WHERE pr.id = p_response_id
  AND (
    check_response_team_access(pr.prompt_id)
    OR auth.role() = 'service_role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users and service_role
GRANT EXECUTE ON FUNCTION get_decrypted_response(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_response(UUID) TO service_role;

-- ============================================
-- RPC: GET DECRYPTED RESPONSE BY PROMPT
-- ============================================
-- Returns the response for a given prompt

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

-- Grant execute to authenticated users and service_role
GRANT EXECUTE ON FUNCTION get_decrypted_response_by_prompt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_response_by_prompt(UUID) TO service_role;

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE prompt_responses IS
  'Stores AI responses linked to prompts with encrypted response text';

COMMENT ON COLUMN prompt_responses.id IS
  'Primary key UUID';

COMMENT ON COLUMN prompt_responses.prompt_id IS
  'Foreign key to the prompt this response belongs to';

COMMENT ON COLUMN prompt_responses.response_text_encrypted IS
  'PGP-encrypted response text (AES-256). Use get_decrypted_response() to read.';

COMMENT ON COLUMN prompt_responses.tool_count IS
  'Number of tools invoked in this response';

COMMENT ON COLUMN prompt_responses.tools_used IS
  'Array of tool names used in this response (e.g., {Read, Edit, Bash})';

COMMENT ON COLUMN prompt_responses.model IS
  'Model that generated this response (e.g., claude-3-opus-20240229)';

COMMENT ON COLUMN prompt_responses.tokens_in IS
  'Input tokens consumed by this response';

COMMENT ON COLUMN prompt_responses.tokens_out IS
  'Output tokens generated by this response';

COMMENT ON COLUMN prompt_responses.has_thinking IS
  'Whether the response included extended thinking/reasoning';

COMMENT ON COLUMN prompts.model IS
  'Model used for the request (e.g., claude-3-opus-20240229)';

COMMENT ON COLUMN prompts.input_tokens IS
  'Total input tokens for the prompt';

COMMENT ON COLUMN prompts.output_tokens IS
  'Total output tokens for the response';

COMMENT ON COLUMN prompts.has_thinking IS
  'Whether the response included extended thinking/reasoning';

COMMENT ON FUNCTION encrypt_response_text(TEXT) IS
  'Encrypts text using AES-256 with key from Vault or app settings';

COMMENT ON FUNCTION decrypt_response_text(BYTEA) IS
  'Decrypts text encrypted by encrypt_response_text()';

COMMENT ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN) IS
  'Inserts a response with encrypted text. Returns the new response ID.';

COMMENT ON FUNCTION get_decrypted_response(UUID) IS
  'Returns a response with decrypted text by response ID';

COMMENT ON FUNCTION get_decrypted_response_by_prompt(UUID) IS
  'Returns the most recent response for a prompt with decrypted text';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== RESPONSE STORAGE SCHEMA MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created prompt_responses table with encryption';
  RAISE NOTICE 'Added model/token columns to prompts table';
  RAISE NOTICE 'Created encryption functions with Vault integration';
  RAISE NOTICE 'Created RLS policies for team-based access';
  RAISE NOTICE 'IMPORTANT: Set contextor_encryption_key in Supabase Vault for production!';
  RAISE NOTICE '=================================================';
END $$;
