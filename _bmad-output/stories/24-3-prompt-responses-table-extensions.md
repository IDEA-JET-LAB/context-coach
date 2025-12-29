# Story 24-3: Prompt Responses Table Extensions

Status: Review

## Story

**As a** developer working on Phase 3 conversation intelligence,
**I want** the prompt_responses table extended with columns for thinking and tool metadata,
**So that** we can store compressed thinking summaries and track response characteristics.

## Acceptance Criteria

1. **Given** the existing prompt_responses table
   **When** this migration is applied
   **Then** a `thinking_summary` TEXT column exists for compressed thinking content
   **And** it stores the first N characters (configurable, default 500)

2. **Given** the prompt_responses table
   **When** this migration is applied
   **Then** a `thinking_word_count` INTEGER column exists
   **And** it stores the original word count before compression

3. **Given** the prompt_responses table
   **When** this migration is applied
   **Then** a `stop_reason` VARCHAR(50) column exists
   **And** it stores values like 'end_turn', 'max_tokens', 'tool_use'

4. **Given** the prompt_responses table
   **When** this migration is applied
   **Then** a `cache_stats` JSONB column exists
   **And** it can store data like {"creation": 9364, "read": 39481, "tier": "standard"}

5. **Given** existing responses in the database
   **When** this migration runs
   **Then** existing response data is not corrupted
   **And** all new columns accept NULL values

6. **Given** the response capture API
   **When** a response is captured with thinking content
   **Then** the thinking is compressed to configurable length (default 500 chars)
   **And** original word count is preserved

## Tasks / Subtasks

- [x] **Task 1: Create migration file** (AC: #1-#5)
  - [x] Create `app/supabase/migrations/20251225220000_responses_phase3_extensions.sql`
  - [x] Add `thinking_summary` column as TEXT
  - [x] Add `thinking_word_count` column as INTEGER
  - [x] Add `stop_reason` column with CHECK constraint
  - [x] Add `cache_stats` column as JSONB

- [x] **Task 2: Add column comments** (AC: #1-#4)
  - [x] Document purpose of each new column
  - [x] Include example JSONB structure for cache_stats
  - [x] Document thinking compression strategy

- [x] **Task 3: Update insert_encrypted_response function** (AC: #6)
  - [x] Add new parameters for thinking_summary, thinking_word_count, stop_reason, cache_stats
  - [x] Maintain backward compatibility with existing callers (all new params have defaults)

- [x] **Task 4: Update get_decrypted_response functions** (AC: #1-#4)
  - [x] Include new columns in return types
  - [x] Update both get_decrypted_response and get_decrypted_response_by_prompt

- [x] **Task 5: Verify migration safety** (AC: #5)
  - [x] Migration uses IF NOT EXISTS for idempotent column additions
  - [x] Uses DO blocks with constraint existence checks for safe re-runs
  - [x] All columns nullable for backward compatibility

## Dev Notes

### Technology Stack
- PostgreSQL 15.x (Supabase)
- JSONB for flexible cache stats storage
- TEXT for potentially long thinking summaries

### Database Schema Addition

```sql
-- 20251225220000_responses_phase3_extensions.sql
-- Phase 3: Prompt responses table extensions for thinking and metadata

-- ============================================
-- ADD PHASE 3 COLUMNS
-- ============================================
-- All columns nullable for backward compatibility

ALTER TABLE prompt_responses
  ADD COLUMN IF NOT EXISTS thinking_summary TEXT,
  ADD COLUMN IF NOT EXISTS thinking_word_count INTEGER,
  ADD COLUMN IF NOT EXISTS stop_reason VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cache_stats JSONB;

-- ============================================
-- ADD CHECK CONSTRAINTS
-- ============================================

ALTER TABLE prompt_responses
  ADD CONSTRAINT valid_stop_reason CHECK (
    stop_reason IS NULL OR stop_reason IN (
      'end_turn', 'max_tokens', 'tool_use', 'stop_sequence', 'content_filtered'
    )
  );

ALTER TABLE prompt_responses
  ADD CONSTRAINT valid_thinking_word_count CHECK (
    thinking_word_count IS NULL OR thinking_word_count >= 0
  );

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

DROP FUNCTION IF EXISTS insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN);

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
```

### Column Specifications

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `thinking_summary` | TEXT | NULL | Compressed thinking content |
| `thinking_word_count` | INTEGER | NULL | Original word count |
| `stop_reason` | VARCHAR(50) | NULL | Why Claude stopped |
| `cache_stats` | JSONB | NULL | Cache usage statistics |

### Stop Reason Values

| Value | Description |
|-------|-------------|
| `end_turn` | Natural completion |
| `max_tokens` | Hit token limit |
| `tool_use` | Invoking a tool |
| `stop_sequence` | Hit stop sequence |
| `content_filtered` | Safety filter triggered |

### Cache Stats JSONB Structure

```json
{
  "creation": 9364,
  "read": 39481,
  "tier": "standard"
}
```

### Prior Epic Columns

The `tools_used TEXT[]` column may already exist from Epic 15 (Transcript parsing for response capture). The migration uses `ADD COLUMN IF NOT EXISTS` for all columns, making it safe to run regardless of prior schema state. The function updates use `DROP FUNCTION IF EXISTS` before recreating to ensure the signature matches the expected parameters.

### Common Pitfalls

1. **DO NOT** add indexes on thinking_summary - it's TEXT and rarely filtered
2. **DO NOT** encrypt thinking_summary - it's already compressed/truncated
3. **DO NOT** forget to update the function signatures
4. **DO NOT** make columns NOT NULL - existing responses would fail
5. **DO NOT** skip updating both getter functions

### Testing Checklist

- [ ] Migration applies cleanly to empty database
- [ ] Migration applies cleanly to database with existing responses
- [ ] Existing response data is preserved after migration
- [ ] New responses can be inserted with all new columns
- [ ] insert_encrypted_response accepts new parameters
- [ ] insert_encrypted_response works with only original parameters (backward compat)
- [ ] get_decrypted_response returns new columns
- [ ] get_decrypted_response_by_prompt returns new columns
- [ ] CHECK constraints reject invalid stop_reason values
- [ ] NULL values are accepted for all new columns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- **All columns added:** thinking_summary (TEXT), thinking_word_count (INTEGER), stop_reason (VARCHAR(50)), cache_stats (JSONB)
- **Functions updated:** insert_encrypted_response now accepts 12 parameters (4 new) with defaults for backward compatibility
- **Both getter functions updated:** get_decrypted_response and get_decrypted_response_by_prompt now return 4 additional columns
- **Idempotent design:** Uses IF NOT EXISTS for columns and DO blocks for constraints

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Created Phase 3 responses extensions migration | Dev Agent (Amelia) |

### File List

- **Created:** `app/supabase/migrations/20251225220000_responses_phase3_extensions.sql`
