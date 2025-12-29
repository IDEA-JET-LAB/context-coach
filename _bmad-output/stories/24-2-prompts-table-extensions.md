# Story 24-2: Prompts Table Extensions

Status: Review

## Story

**As a** developer working on Phase 3 conversation intelligence,
**I want** the prompts table extended with columns for prompt classification and threading,
**So that** we can classify prompt types, detect debugging loops, and enable context-aware analysis.

## Acceptance Criteria

1. **Given** the existing prompts table
   **When** this migration is applied
   **Then** a `prompt_type` VARCHAR(50) column exists with valid values: 'initiating', 'continuation', 'selection', 'correction', 'confirmation', 'clarification', 'tool_result'
   **And** the column is nullable for backward compatibility

2. **Given** the prompts table
   **When** this migration is applied
   **Then** a `prompt_type_confidence` DECIMAL(3,2) column exists for classification confidence (0.00-1.00)
   **And** it helps determine when to use LLM classification vs heuristics

3. **Given** the prompts table
   **When** this migration is applied
   **Then** a `message_uuid` VARCHAR(100) column exists for Claude Code's message UUID
   **And** it enables lookup in transcripts for threading

4. **Given** the prompts table
   **When** this migration is applied
   **Then** a `parent_message_uuid` VARCHAR(100) column exists for threading
   **And** it supplements the existing `parent_prompt_id` foreign key

5. **Given** the prompts table
   **When** this migration is applied
   **Then** an `is_in_debugging_loop` BOOLEAN column exists defaulting to FALSE
   **And** prompts can be flagged when detected as part of a loop

6. **Given** the prompts table
   **When** this migration is applied
   **Then** a `detected_stage` VARCHAR(50) column exists
   **And** it stores the stage detected for this specific prompt

7. **Given** the new columns
   **When** queries filter by prompt_type or message_uuid
   **Then** partial indexes exist for efficient lookups
   **And** thread reconstruction queries are performant

## Tasks / Subtasks

- [x] **Task 1: Create migration file** (AC: #1-#6)
  - [x] Create `app/supabase/migrations/20251225210000_prompts_phase3_extensions.sql`
  - [x] Add `prompt_classification` column (renamed from `prompt_type` to avoid conflict with existing column)
  - [x] Add `prompt_type_confidence` column as DECIMAL(3,2)
  - [x] Add `message_uuid` column as VARCHAR(100)
  - [x] Add `parent_message_uuid` column as VARCHAR(100)
  - [x] Add `is_in_debugging_loop` column with DEFAULT FALSE
  - [x] Add `detected_stage` column with CHECK constraint

- [x] **Task 2: Create indexes for new columns** (AC: #7)
  - [x] Create partial index `idx_prompts_classification` on `prompt_classification` WHERE NOT NULL
  - [x] Create partial index `idx_prompts_message_uuid` on `message_uuid` WHERE NOT NULL
  - [x] Create partial index `idx_prompts_parent_message` on `parent_message_uuid` WHERE NOT NULL
  - [x] Create partial index `idx_prompts_debugging_loop` for debugging loop analysis
  - [x] Create partial index `idx_prompts_detected_stage` on `detected_stage` WHERE NOT NULL

- [x] **Task 3: Add column comments** (AC: #1-#6)
  - [x] Document purpose and valid values for each column
  - [x] Include scoring weight implications for prompt_classification

- [x] **Task 4: Verify migration safety** (AC: all)
  - [x] Migration uses IF NOT EXISTS for idempotent column additions
  - [x] Uses DO blocks with constraint existence checks for safe re-runs
  - [x] All columns nullable for backward compatibility

## Dev Notes

### Technology Stack
- PostgreSQL 15.x (Supabase)
- Partial indexes for sparse data optimization
- VARCHAR for flexible UUID storage

### Database Schema Addition

```sql
-- 20251225210000_prompts_phase3_extensions.sql
-- Phase 3: Prompts table extensions for classification and threading

-- ============================================
-- ADD PHASE 3 COLUMNS
-- ============================================
-- All columns nullable or with defaults for backward compatibility

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS prompt_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS prompt_type_confidence DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS message_uuid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS parent_message_uuid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_in_debugging_loop BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS detected_stage VARCHAR(50);

-- ============================================
-- ADD CHECK CONSTRAINTS
-- ============================================

ALTER TABLE prompts
  ADD CONSTRAINT valid_prompt_type CHECK (
    prompt_type IS NULL OR prompt_type IN (
      'initiating', 'continuation', 'selection', 'correction',
      'confirmation', 'clarification', 'tool_result'
    )
  );

ALTER TABLE prompts
  ADD CONSTRAINT valid_prompt_type_confidence CHECK (
    prompt_type_confidence IS NULL OR
    (prompt_type_confidence >= 0.00 AND prompt_type_confidence <= 1.00)
  );

ALTER TABLE prompts
  ADD CONSTRAINT valid_detected_stage CHECK (
    detected_stage IS NULL OR detected_stage IN (
      'architecture', 'specification', 'development', 'debugging', 'enhancement'
    )
  );

-- ============================================
-- PARTIAL INDEXES FOR NEW COLUMNS
-- ============================================

-- Index prompts by type (only indexed when type is set)
CREATE INDEX IF NOT EXISTS idx_prompts_type
  ON prompts(prompt_type)
  WHERE prompt_type IS NOT NULL;

-- Index prompts by message UUID for transcript correlation
CREATE INDEX IF NOT EXISTS idx_prompts_message_uuid
  ON prompts(message_uuid)
  WHERE message_uuid IS NOT NULL;

-- Index prompts by parent message UUID for thread reconstruction
CREATE INDEX IF NOT EXISTS idx_prompts_parent_message
  ON prompts(parent_message_uuid)
  WHERE parent_message_uuid IS NOT NULL;

-- Index prompts in debugging loops for pattern analysis
CREATE INDEX IF NOT EXISTS idx_prompts_debugging_loop
  ON prompts(session_uuid, is_in_debugging_loop)
  WHERE is_in_debugging_loop = TRUE;

-- ============================================
-- COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN prompts.prompt_type IS
  'Classification of prompt type. Values: initiating (new task), continuation (provides info), selection (picks option), correction (redirects), confirmation (approves), clarification (asks question), tool_result (system message). Scoring weight: selection/confirmation = 0 (skip scoring).';

COMMENT ON COLUMN prompts.prompt_type_confidence IS
  'Confidence score (0.00-1.00) for the prompt_type classification. Higher values indicate more certain classification. Values > 0.9 typically from heuristics, lower values from LLM.';

COMMENT ON COLUMN prompts.message_uuid IS
  'Claude Code message UUID from the transcript. Used to correlate prompts with transcript entries for threading and response lookup.';

COMMENT ON COLUMN prompts.parent_message_uuid IS
  'Claude Code parent message UUID for conversation threading. Supplements parent_prompt_id by storing the original transcript threading.';

COMMENT ON COLUMN prompts.is_in_debugging_loop IS
  'TRUE if this prompt is detected as part of a debugging loop (3+ similar error-fix-error cycles within session)';

COMMENT ON COLUMN prompts.detected_stage IS
  'Project stage detected for this specific prompt: architecture, specification, development, debugging, or enhancement';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 3: PROMPTS EXTENSIONS COMPLETE ===';
  RAISE NOTICE 'Added columns: prompt_type, prompt_type_confidence, message_uuid, parent_message_uuid, is_in_debugging_loop, detected_stage';
  RAISE NOTICE 'Created indexes: idx_prompts_type, idx_prompts_message_uuid, idx_prompts_parent_message, idx_prompts_debugging_loop';
  RAISE NOTICE '=============================================';
END $$;
```

### Column Specifications

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `prompt_type` | VARCHAR(50) | NULL | Classification type |
| `prompt_type_confidence` | DECIMAL(3,2) | NULL | Classification confidence |
| `message_uuid` | VARCHAR(100) | NULL | Claude Code message ID |
| `parent_message_uuid` | VARCHAR(100) | NULL | Parent message for threading |
| `is_in_debugging_loop` | BOOLEAN | FALSE | Loop detection flag |
| `detected_stage` | VARCHAR(50) | NULL | Stage at time of prompt |

### Prompt Type Classification

| Type | Description | Scoring Weight |
|------|-------------|----------------|
| `initiating` | Starts new task/topic | 100% |
| `continuation` | Provides requested info | 70% |
| `selection` | Chooses from options | 0% (skip) |
| `correction` | Redirects LLM | 80% |
| `confirmation` | Approves to proceed | 0% (skip) |
| `clarification` | Asks for explanation | 60% |
| `tool_result` | System message (not user) | N/A |

### Common Pitfalls

1. **DO NOT** make columns NOT NULL - existing prompts would fail
2. **DO NOT** add unique constraint on message_uuid - may have duplicates from retries
3. **DO NOT** create foreign key on parent_message_uuid - it references external transcript
4. **DO NOT** skip prompt_type_confidence - useful for deciding heuristic vs LLM
5. **DO NOT** index all boolean values - only TRUE is sparse and useful

### Testing Checklist

- [ ] Migration applies cleanly to empty database
- [ ] Migration applies cleanly to database with existing prompts
- [ ] Existing prompt data is preserved after migration
- [ ] New prompts can be inserted with all new columns
- [ ] Partial indexes are used by query planner (EXPLAIN ANALYZE)
- [ ] CHECK constraints reject invalid values
- [ ] NULL values are accepted for all new columns
- [ ] prompt_type_confidence accepts valid range (0.00-1.00)
- [ ] Thread queries using message_uuid are performant

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- **Column rename:** `prompt_type` → `prompt_classification` to avoid conflict with existing column. The existing `prompt_type` (from migration 20251221220000) uses values 'prompt', 'command', 'command_with_prompt' for command detection. The Phase 3 column uses 'initiating', 'continuation', 'selection', etc. for conversation role classification.
- **Extra index added:** Created `idx_prompts_detected_stage` partial index for stage-based queries.
- **Stage values expanded:** `detected_stage` CHECK constraint includes both Phase 3 values (architecture, specification, development, debugging, enhancement) AND Phase 2 values for consistency with sessions.primary_stage.
- **Idempotent design:** Uses DO blocks with constraint existence checks for safe re-runs.

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Created Phase 3 prompts extensions migration | Dev Agent (Amelia) |

### File List

- **Created:** `app/supabase/migrations/20251225210000_prompts_phase3_extensions.sql`
