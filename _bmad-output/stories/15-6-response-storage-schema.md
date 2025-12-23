# Story 15.6: Response Storage Schema

**Status:** ✅ COMPLETED (2025-12-23)

## Dependencies

- **Epic 14.5-4 (Column-Level Encryption):** This story references encryption functions. If Epic 14.5-4 creates generic encryption helpers, this story should use them. Otherwise, this story creates response-specific encryption functions.
- **Epic 16-1 (Sessions Database Schema):** The `session_uuid` column references the `sessions` table which is created in Epic 16. **This migration intentionally omits the FK constraint** - it will be added by Epic 16-1 migration after the sessions table exists.

## Story
**As a** Contextor system,
**I want** database tables to store prompt-response pairs with their relationships,
**So that** response context is persisted and queryable for analysis.

## Acceptance Criteria
1. **Given** a prompt-response pair
   **When** stored in the database
   **Then** the `prompt_responses` table links to the `prompts` table via `prompt_id`
   **And** response text is encrypted at rest using pgcrypto

2. **Given** the response schema
   **When** designing the table
   **Then** it stores: response_text_encrypted, tool_count, tools_used[], model, tokens_in, tokens_out, has_thinking
   **And** foreign key references `prompts(id)` with CASCADE delete

3. **Given** session context
   **When** extending the prompts table
   **Then** new columns are added: session_uuid, sequence_number, parent_prompt_id, model, input_tokens, output_tokens, has_thinking

4. **Given** RLS requirements
   **When** accessing response data
   **Then** policies ensure users can only see responses for their team's prompts
   **And** service role can bypass RLS for Edge Functions

5. **Given** query requirements
   **When** designing indexes
   **Then** `prompt_id` is indexed for fast joins
   **And** `tools_used` supports array containment queries

## Tasks / Subtasks
- [ ] **Task 1: Create migration file** (AC: #1, #2, #3)
  - [ ] Create `supabase/migrations/YYYYMMDDHHMMSS_add_response_context.sql`
  - [ ] Enable pgcrypto extension if not already enabled
  - [ ] Add new columns to `prompts` table
  - [ ] Create `prompt_responses` table with all columns

- [ ] **Task 2: Design prompt_responses table** (AC: #2)
  - [ ] Add `id` UUID primary key with uuid_generate_v4()
  - [ ] Add `prompt_id` UUID foreign key to prompts
  - [ ] Add `response_text_encrypted` BYTEA for encrypted storage
  - [ ] Add `tool_count` INTEGER DEFAULT 0
  - [ ] Add `tools_used` TEXT[] DEFAULT '{}'
  - [ ] Add `model` TEXT for model name
  - [ ] Add `tokens_in` INTEGER and `tokens_out` INTEGER
  - [ ] Add `has_thinking` BOOLEAN DEFAULT FALSE
  - [ ] Add `created_at` TIMESTAMPTZ DEFAULT NOW()

- [ ] **Task 3: Extend prompts table** (AC: #3)
  - [ ] Add `session_uuid` UUID (nullable, NO FK - added by Epic 16-1)
  - [ ] Add `sequence_number` INTEGER for order in session
  - [ ] Add `parent_prompt_id` UUID self-reference for threading
  - [ ] Add `model` TEXT for model used in response
  - [ ] Add `input_tokens` INTEGER
  - [ ] Add `output_tokens` INTEGER
  - [ ] Add `has_thinking` BOOLEAN DEFAULT FALSE

- [ ] **Task 4: Set up encryption functions** (AC: #1)
  - [ ] Verify pgcrypto is enabled
  - [ ] Create `encrypt_response_text()` function
  - [ ] Create `decrypt_response_text()` function
  - [ ] Create `insert_encrypted_response()` RPC for inserting with encryption
  - [ ] Create `get_decrypted_response()` RPC for retrieving with decryption
  - [ ] Document key storage in Supabase Vault
  - [ ] Note: If Epic 14.5-4 provides generic encryption functions, refactor to use those

- [ ] **Task 5: Create RLS policies** (AC: #4)
  - [ ] Create policy for SELECT on prompt_responses
  - [ ] Policy uses EXISTS subquery to verify team access via prompts table
  - [ ] Create policy for INSERT (same team check)
  - [ ] Create policy for UPDATE (same team check)
  - [ ] Create policy for DELETE (same team check)

- [ ] **Task 6: Create indexes** (AC: #5)
  - [ ] Index `prompt_responses(prompt_id)` for fast joins
  - [ ] GIN index on `tools_used` for array queries
  - [ ] Index `prompts(session_uuid, sequence_number)` for session queries
  - [ ] Index `prompts(parent_prompt_id)` for threading queries

- [ ] **Task 7: Create TypeScript types** (AC: #1, #2, #3)
  - [ ] Add `PromptResponse` interface to `lib/db/types.ts`
  - [ ] Update `Prompt` interface with new columns
  - [ ] Create helper functions for encryption/decryption

## Dev Notes

### Schema Design Decisions (Differences from PRD)

This schema includes intentional improvements over the original PRD specification:

| PRD Spec | Implementation | Rationale |
|----------|----------------|-----------|
| `response_text TEXT` | `response_text_encrypted BYTEA` | BYTEA is required for pgcrypto's `pgp_sym_encrypt()` output. TEXT would require base64 encoding/decoding overhead. |
| `tools_used JSONB` | `tools_used TEXT[]` | For simple string arrays of tool names, TEXT[] is more efficient and supports GIN indexing for containment queries (`@>` operator). JSONB adds overhead for structured data we don't need here. |
| No RPC functions | `insert_encrypted_response()`, `get_decrypted_response()` | Encapsulates encryption/decryption logic at the database level, ensuring encryption key is never exposed to application layer. |
| Single RLS policy | Separate SELECT/INSERT/UPDATE/DELETE policies | More granular security control; follows principle of least privilege. |
| FK to sessions | No FK (deferred) | `sessions` table created in Epic 16. FK constraint will be added by Epic 16-1 migration to avoid circular dependency. |

### Migration SQL

```sql
-- Migration: YYYYMMDDHHMMSS_add_response_context.sql

-- Enable pgcrypto (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- EXTEND PROMPTS TABLE
-- =============================================================================

-- Add session tracking columns
-- NOTE: session_uuid has NO FK constraint here. The FK to sessions(id) will be
-- added by Epic 16-1 migration after the sessions table is created.
ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS session_uuid UUID,  -- FK added by Epic 16-1
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS parent_prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL;

-- Add comment documenting the deferred FK
COMMENT ON COLUMN prompts.session_uuid IS 'Session UUID - FK constraint added by Epic 16-1 migration';

-- Add token tracking columns
ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS has_thinking BOOLEAN DEFAULT FALSE;

-- Index for session queries
CREATE INDEX IF NOT EXISTS idx_prompts_session_seq
  ON prompts(session_uuid, sequence_number);

-- Index for conversation threading
CREATE INDEX IF NOT EXISTS idx_prompts_parent
  ON prompts(parent_prompt_id);

-- =============================================================================
-- CREATE PROMPT_RESPONSES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,

  -- Response content (encrypted at rest)
  response_text_encrypted BYTEA,

  -- Tool usage
  tool_count INTEGER DEFAULT 0,
  tools_used TEXT[] DEFAULT '{}',

  -- Model and token info
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,

  -- Thinking blocks
  has_thinking BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for joining with prompts
CREATE INDEX IF NOT EXISTS idx_responses_prompt
  ON prompt_responses(prompt_id);

-- GIN index for tool array queries
CREATE INDEX IF NOT EXISTS idx_responses_tools
  ON prompt_responses USING GIN (tools_used);

-- =============================================================================
-- ENCRYPTION FUNCTIONS
-- =============================================================================

-- Encrypt function using Supabase Vault key
CREATE OR REPLACE FUNCTION encrypt_response_text(plaintext TEXT)
RETURNS BYTEA AS $$
DECLARE
  key TEXT;
BEGIN
  -- Get key from Vault (or fall back to setting)
  BEGIN
    SELECT decrypted_secret INTO key
    FROM vault.decrypted_secrets
    WHERE name = 'contextor_encryption_key'
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      key := current_setting('app.encryption_key', true);
  END;

  IF key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  RETURN pgp_sym_encrypt(plaintext, key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt function
CREATE OR REPLACE FUNCTION decrypt_response_text(ciphertext BYTEA)
RETURNS TEXT AS $$
DECLARE
  key TEXT;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get key from Vault (or fall back to setting)
  BEGIN
    SELECT decrypted_secret INTO key
    FROM vault.decrypted_secrets
    WHERE name = 'contextor_encryption_key'
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      key := current_setting('app.encryption_key', true);
  END;

  IF key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  RETURN pgp_sym_decrypt(ciphertext, key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC FUNCTIONS FOR ENCRYPTED OPERATIONS
-- =============================================================================

-- Insert a response with encrypted text
CREATE OR REPLACE FUNCTION insert_encrypted_response(
  p_prompt_id UUID,
  p_response_text TEXT,
  p_model TEXT,
  p_tokens_in INTEGER,
  p_tokens_out INTEGER,
  p_tools_used TEXT[],
  p_has_thinking BOOLEAN
)
RETURNS UUID AS $$
DECLARE
  v_response_id UUID;
BEGIN
  INSERT INTO prompt_responses (
    prompt_id,
    response_text_encrypted,
    model,
    tokens_in,
    tokens_out,
    tool_count,
    tools_used,
    has_thinking
  )
  VALUES (
    p_prompt_id,
    encrypt_response_text(p_response_text),
    p_model,
    p_tokens_in,
    p_tokens_out,
    COALESCE(array_length(p_tools_used, 1), 0),
    COALESCE(p_tools_used, '{}'),
    COALESCE(p_has_thinking, FALSE)
  )
  RETURNING id INTO v_response_id;

  RETURN v_response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get decrypted response text by response ID
CREATE OR REPLACE FUNCTION get_decrypted_response(p_response_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_encrypted BYTEA;
BEGIN
  SELECT response_text_encrypted INTO v_encrypted
  FROM prompt_responses
  WHERE id = p_response_id;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN decrypt_response_text(v_encrypted);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE prompt_responses ENABLE ROW LEVEL SECURITY;

-- Helper function to check team access via prompt
CREATE OR REPLACE FUNCTION check_response_team_access(response_prompt_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM prompts p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE p.id = response_prompt_id
      AND tm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: SELECT - users can read responses for their team's prompts
CREATE POLICY responses_select_policy ON prompt_responses
  FOR SELECT
  USING (check_response_team_access(prompt_id));

-- Policy: INSERT - users can insert responses for their team's prompts
CREATE POLICY responses_insert_policy ON prompt_responses
  FOR INSERT
  WITH CHECK (check_response_team_access(prompt_id));

-- Policy: UPDATE - users can update responses for their team's prompts
CREATE POLICY responses_update_policy ON prompt_responses
  FOR UPDATE
  USING (check_response_team_access(prompt_id))
  WITH CHECK (check_response_team_access(prompt_id));

-- Policy: DELETE - users can delete responses for their team's prompts
CREATE POLICY responses_delete_policy ON prompt_responses
  FOR DELETE
  USING (check_response_team_access(prompt_id));

-- Grant service role full access (for Edge Functions)
GRANT ALL ON prompt_responses TO service_role;
GRANT EXECUTE ON FUNCTION encrypt_response_text(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_response_text(BYTEA) TO service_role;
GRANT EXECUTE ON FUNCTION insert_encrypted_response(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT[], BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION get_decrypted_response(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION check_response_team_access(UUID) TO authenticated;
```

### TypeScript Types

```typescript
// lib/db/types.ts - additions

export interface PromptResponse {
  id: string;
  prompt_id: string;
  response_text_encrypted: Uint8Array | null;
  tool_count: number;
  tools_used: string[];
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  has_thinking: boolean;
  created_at: string;
}

// Extended Prompt with new fields
export interface PromptWithSession extends Prompt {
  session_uuid: string | null;
  sequence_number: number | null;
  parent_prompt_id: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  has_thinking: boolean;
}

// Combined prompt with response
export interface PromptWithResponse extends PromptWithSession {
  response: PromptResponse | null;
}
```

### API Functions

```typescript
// lib/api/responses.ts

import { createClient } from '@/lib/supabase/server';

/**
 * Store a prompt-response pair.
 */
export async function storePromptResponse(
  promptId: string,
  response: {
    text: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    toolsUsed: string[];
    hasThinking: boolean;
  }
): Promise<{ id: string }> {
  const supabase = await createClient();

  // Encrypt response text using database function
  const { data, error } = await supabase.rpc('insert_encrypted_response', {
    p_prompt_id: promptId,
    p_response_text: response.text,
    p_model: response.model,
    p_tokens_in: response.tokensIn,
    p_tokens_out: response.tokensOut,
    p_tools_used: response.toolsUsed,
    p_has_thinking: response.hasThinking,
  });

  if (error) throw error;
  return { id: data };
}

/**
 * Get prompt with decrypted response.
 */
export async function getPromptWithResponse(
  promptId: string
): Promise<PromptWithResponse | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('prompts')
    .select(`
      *,
      response:prompt_responses(
        id,
        prompt_id,
        tool_count,
        tools_used,
        model,
        tokens_in,
        tokens_out,
        has_thinking,
        created_at
      )
    `)
    .eq('id', promptId)
    .single();

  if (error || !data) return null;

  // Decrypt response text if present
  if (data.response) {
    const { data: decrypted } = await supabase.rpc('get_decrypted_response', {
      p_response_id: data.response.id,
    });
    data.response.text = decrypted;
  }

  return data as PromptWithResponse;
}
```

### Encryption Key Setup

**Supabase Vault:**
```sql
-- Store encryption key in Vault (run once via Supabase Dashboard)
SELECT vault.create_secret(
  'contextor_encryption_key',
  'your-secure-32-character-key-here',
  'Encryption key for response text'
);
```

**Fallback (local development):**
```bash
# In .env.local
ENCRYPTION_KEY=your-secure-32-character-key-here
```

### Data Relationships

```
prompts
  ├── id (PK)
  ├── session_uuid UUID (NO FK - added by Epic 16-1 after sessions table exists)
  ├── parent_prompt_id → prompts.id (self-ref FK, ON DELETE SET NULL)
  └── ... existing columns ...

prompt_responses
  ├── id (PK)
  ├── prompt_id → prompts.id (FK, ON DELETE CASCADE)
  ├── response_text_encrypted BYTEA (encrypted via pgcrypto)
  └── ... tool/token columns ...
```

**Note:** The `session_uuid` column is created without a foreign key constraint in this migration. Epic 16-1 will add the FK constraint after creating the `sessions` table:
```sql
-- Added by Epic 16-1 migration
ALTER TABLE prompts
  ADD CONSTRAINT fk_prompts_session
  FOREIGN KEY (session_uuid) REFERENCES sessions(id) ON DELETE SET NULL;
```

### File Structure

| File | Path |
|------|------|
| Migration | `app/supabase/migrations/YYYYMMDDHHMMSS_add_response_context.sql` |
| DB Types | `app/lib/db/types.ts` |
| API Functions | `app/lib/api/responses.ts` |

### Verification Checklist
- [ ] Migration applies without errors
- [ ] prompt_responses table is created with all columns
- [ ] prompts table has new columns added
- [ ] Foreign key constraints work correctly
- [ ] CASCADE delete removes responses when prompt deleted
- [ ] Encryption functions work with Vault key
- [ ] RLS policies restrict access to team members
- [ ] Indexes are created for performance
- [ ] TypeScript types match database schema

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
