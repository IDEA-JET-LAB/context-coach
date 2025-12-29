# Story 24-5: Apply Migrations

Status: Review

## Story

**As a** developer working on Phase 3 conversation intelligence,
**I want** the schema extension migrations applied safely to the Cloud Supabase database,
**So that** the database is ready for Phase 3 features without data loss.

## Acceptance Criteria

1. **Given** the four migration files from stories 24-1 through 24-4
   **When** migrations are applied to Cloud Supabase
   **Then** all migrations complete successfully
   **And** no existing data is corrupted

2. **Given** the sessions table
   **When** migration 24-1 is applied
   **Then** all 5 new columns exist (primary_stage, has_debugging_loop, user_message_count, conversation_score, stage_breakdown)
   **And** existing session rows have user_message_count backfilled

3. **Given** the prompts table
   **When** migration 24-2 is applied
   **Then** all 6 new columns exist (prompt_type, prompt_type_confidence, message_uuid, parent_message_uuid, is_in_debugging_loop, detected_stage)
   **And** indexes are created for prompt_type and message_uuid

4. **Given** the prompt_responses table
   **When** migration 24-3 is applied
   **Then** all 4 new columns exist (thinking_summary, thinking_word_count, stop_reason, cache_stats)
   **And** insert_encrypted_response and get_decrypted_response functions are updated

5. **Given** the database
   **When** migration 24-4 is applied
   **Then** all aggregation functions exist and are executable
   **And** triggers are attached to prompts and prompt_analyses tables

6. **Given** a rollback is needed
   **When** any migration fails
   **Then** the database state is unchanged
   **And** the failure reason is logged

## Tasks / Subtasks

- [x] **Task 1: Prepare migration files** (AC: #1)
  - [x] Verify migration file naming follows pattern: `YYYYMMDDHHMMSS_description.sql`
  - [x] Ensure migrations are idempotent (IF NOT EXISTS, IF EXISTS checks)
  - [x] All 4 migration files created and verified

- [x] **Task 2: Test migrations locally** (AC: #1, #6)
  - [x] N/A - Project uses Cloud Supabase only (no local instance)
  - [x] Migrations reviewed for syntax and logic correctness
  - [x] All use idempotent patterns for safe re-runs

- [ ] **Task 3: Apply to Cloud Supabase** (AC: #1-#5)
  - [ ] Run `SUPABASE_ACCESS_TOKEN=... npx supabase db push`
  - [ ] Monitor for errors during migration
  - [ ] Verify migration success in Supabase dashboard
  - **REQUIRES USER CONFIRMATION** - Do not deploy without explicit approval

- [ ] **Task 4: Verify sessions extensions** (AC: #2)
  - [ ] Check columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions'`
  - [ ] Verify user_message_count is backfilled for existing sessions
  - [ ] Test INSERT with new columns

- [ ] **Task 5: Verify prompts extensions** (AC: #3)
  - [ ] Check columns exist via information_schema
  - [ ] Verify indexes: `SELECT indexname FROM pg_indexes WHERE tablename = 'prompts'`
  - [ ] Test INSERT with new columns

- [ ] **Task 6: Verify responses extensions** (AC: #4)
  - [ ] Check columns exist via information_schema
  - [ ] Test insert_encrypted_response with new parameters
  - [ ] Test get_decrypted_response returns new columns

- [ ] **Task 7: Verify aggregation functions** (AC: #5)
  - [ ] List functions: `SELECT proname FROM pg_proc WHERE proname LIKE '%session%' OR proname LIKE '%score%'`
  - [ ] Test update_session_stats with sample session
  - [ ] Test calculate_conversation_score
  - [ ] Verify triggers exist and fire

- [ ] **Task 8: Document migration results**
  - [ ] Record migration timestamps
  - [ ] Note any warnings or issues
  - [ ] Update CLAUDE.md if needed

## Dev Notes

### Technology Stack
- Supabase CLI for migrations
- Cloud Supabase (ddskanjiobrjphscskog)
- PostgreSQL 15.x

### Pre-Migration Checklist

```bash
# 1. Ensure you have the access token
cat ../.env | grep SUPABASE_ACCESS_TOKEN

# 2. Verify you're linked to the correct project
cd app && npx supabase projects list

# 3. Check current migration status
npx supabase migration list
```

### Migration Order

Migrations must be applied in order:

1. `20251225200000_sessions_phase3_extensions.sql` - Sessions table columns
2. `20251225210000_prompts_phase3_extensions.sql` - Prompts table columns
3. `20251225220000_responses_phase3_extensions.sql` - Responses columns + functions
4. `20251225230000_session_aggregation_functions.sql` - Aggregation functions + triggers

### Apply Migrations Command

```bash
# Apply all pending migrations to Cloud Supabase
cd app && SUPABASE_ACCESS_TOKEN=$(cat ../.env | grep SUPABASE_ACCESS_TOKEN | cut -d= -f2) npx supabase db push
```

### Verification Queries

```sql
-- Verify sessions columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sessions'
AND column_name IN (
  'primary_stage', 'has_debugging_loop', 'user_message_count',
  'conversation_score', 'stage_breakdown'
);

-- Verify prompts columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'prompts'
AND column_name IN (
  'prompt_type', 'prompt_type_confidence', 'message_uuid',
  'parent_message_uuid', 'is_in_debugging_loop', 'detected_stage'
);

-- Verify responses columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'prompt_responses'
AND column_name IN (
  'thinking_summary', 'thinking_word_count', 'stop_reason', 'cache_stats'
);

-- Verify indexes (actual names from migrations)
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('sessions', 'prompts')
AND indexname IN (
  'idx_sessions_stage',           -- From 24-1: primary_stage
  'idx_sessions_debugging_loop',  -- From 24-1: has_debugging_loop
  'idx_prompts_type',             -- From 24-2: prompt_type
  'idx_prompts_message_uuid',     -- From 24-2: message_uuid
  'idx_prompts_parent_uuid',      -- From 24-2: parent_message_uuid
  'idx_prompts_detected_stage'    -- From 24-2: detected_stage
);

-- Verify functions
SELECT proname, proargnames
FROM pg_proc
WHERE proname IN (
  'update_session_stats', 'calculate_conversation_score',
  'get_prompt_scoring_weight', 'update_session_aggregates', 'on_analysis_complete'
);

-- Verify triggers
SELECT tgname, relname
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE relname IN ('prompts', 'prompt_analyses')
AND tgname LIKE 'on_%';

-- Test aggregation function
SELECT update_session_stats('<session_uuid>'::uuid);
```

### Rollback Procedure

If migration fails, the transaction should rollback automatically. For manual rollback:

```sql
-- Remove new columns from sessions (if needed)
ALTER TABLE sessions
  DROP COLUMN IF EXISTS primary_stage,
  DROP COLUMN IF EXISTS has_debugging_loop,
  DROP COLUMN IF EXISTS user_message_count,
  DROP COLUMN IF EXISTS conversation_score,
  DROP COLUMN IF EXISTS stage_breakdown;

-- Remove new columns from prompts (if needed)
ALTER TABLE prompts
  DROP COLUMN IF EXISTS prompt_type,
  DROP COLUMN IF EXISTS prompt_type_confidence,
  DROP COLUMN IF EXISTS message_uuid,
  DROP COLUMN IF EXISTS parent_message_uuid,
  DROP COLUMN IF EXISTS is_in_debugging_loop,
  DROP COLUMN IF EXISTS detected_stage;

-- Remove new columns from prompt_responses (if needed)
ALTER TABLE prompt_responses
  DROP COLUMN IF EXISTS thinking_summary,
  DROP COLUMN IF EXISTS thinking_word_count,
  DROP COLUMN IF EXISTS stop_reason,
  DROP COLUMN IF EXISTS cache_stats;

-- Drop functions (if needed)
DROP FUNCTION IF EXISTS update_session_stats(UUID);
DROP FUNCTION IF EXISTS calculate_conversation_score(UUID);
DROP FUNCTION IF EXISTS get_prompt_scoring_weight(VARCHAR);
DROP FUNCTION IF EXISTS on_analysis_complete();
```

### Common Pitfalls

1. **DO NOT** run migrations without checking current state first
2. **DO NOT** skip verification after migration
3. **DO NOT** apply migrations during peak usage hours
4. **DO NOT** forget to test functions after migration
5. **DO NOT** assume backfill completed - verify row counts

### Testing Checklist

- [ ] All 4 migration files exist in correct naming format
- [ ] Migrations are idempotent (can run twice safely)
- [ ] Migrations applied successfully to Cloud Supabase
- [ ] Sessions table has 5 new columns
- [ ] Prompts table has 6 new columns
- [ ] Prompt responses table has 4 new columns
- [ ] All new indexes exist and are valid
- [ ] All new functions exist and are executable
- [ ] All triggers are attached and fire correctly
- [ ] Existing data is preserved and accurate
- [ ] user_message_count backfill completed
- [ ] Sample insert with new columns succeeds
- [ ] Sample function calls return expected results

## Critical Reminders from CLAUDE.md

**DO NOT wipe data:**
> NEVER use `supabase db reset` unless explicitly requested by the user. It wipes ALL data.

**Applying migrations:**
```bash
cd app && SUPABASE_ACCESS_TOKEN=<token> npx supabase db push
```

**Cloud Supabase URL:** `https://ddskanjiobrjphscskog.supabase.co`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- **All 4 migration files created and verified:**
  1. `20251225200000_sessions_phase3_extensions.sql` - Story 24-1: stage_breakdown, indexes, backfill
  2. `20251225210000_prompts_phase3_extensions.sql` - Story 24-2: prompt_classification, message_uuid, threading
  3. `20251225220000_responses_phase3_extensions.sql` - Story 24-3: thinking_summary, stop_reason, cache_stats
  4. `20251225230000_session_aggregation_functions.sql` - Story 24-4: scoring functions, triggers
- **Note on column rename:** Story 24-2 uses `prompt_classification` instead of `prompt_type` due to existing column conflict
- **Deployment pending:** Requires user confirmation before running `supabase db push`

### Migration Order (IMPORTANT)

Migrations will be applied in this order based on timestamps:
1. Sessions extensions (24-1)
2. Prompts extensions (24-2)
3. Responses extensions (24-3)
4. Aggregation functions (24-4) - **DEPENDS ON 24-2** for prompt_classification column

### Deployment Command

```bash
cd app && SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN ../.env | cut -d= -f2) npx supabase db push
```

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Verified all Phase 3 migration files ready | Dev Agent (Amelia) |

### File List

- **Verified:** `app/supabase/migrations/20251225200000_sessions_phase3_extensions.sql`
- **Verified:** `app/supabase/migrations/20251225210000_prompts_phase3_extensions.sql`
- **Verified:** `app/supabase/migrations/20251225220000_responses_phase3_extensions.sql`
- **Verified:** `app/supabase/migrations/20251225230000_session_aggregation_functions.sql`
