# Story 24-1: Sessions Table Extensions

Status: Review

## Story

**As a** developer working on Phase 3 conversation intelligence,
**I want** the sessions table extended with columns for conversation-level metadata,
**So that** we can track project stages, debugging loops, and aggregate conversation scores.

## Acceptance Criteria

1. **Given** the existing sessions table
   **When** this migration is applied
   **Then** a `primary_stage` VARCHAR(50) column exists with valid values: 'architecture', 'specification', 'development', 'debugging', 'enhancement'
   **And** the column is nullable for backward compatibility

2. **Given** the sessions table
   **When** this migration is applied
   **Then** a `has_debugging_loop` BOOLEAN column exists defaulting to FALSE
   **And** sessions can be flagged when debugging loop patterns are detected

3. **Given** the sessions table
   **When** this migration is applied
   **Then** a `user_message_count` INTEGER column exists defaulting to 0
   **And** it tracks prompts from users (not tool results)

4. **Given** the sessions table
   **When** this migration is applied
   **Then** a `conversation_score` DECIMAL(5,2) column exists (nullable)
   **And** it holds the aggregate score excluding selection/confirmation prompts

5. **Given** the sessions table
   **When** this migration is applied
   **Then** a `stage_breakdown` JSONB column exists for stage percentages
   **And** it can store data like {"architecture": 3, "development": 15, "debugging": 7}

6. **Given** the new columns
   **When** queries filter by stage or debugging loop
   **Then** partial indexes exist for efficient filtering
   **And** queries perform within acceptable latency

7. **Given** existing sessions in the database
   **When** this migration runs
   **Then** existing sessions are not corrupted
   **And** user_message_count is backfilled from prompts table

## Tasks / Subtasks

- [x] **Task 1: Create migration file** (AC: #1-#6)
  - [x] Create `app/supabase/migrations/20251225200000_sessions_phase3_extensions.sql`
  - [x] Add `primary_stage` column with CHECK constraint for valid values (supplemented existing migration)
  - [x] Add `has_debugging_loop` column with DEFAULT FALSE (already exists from prior migration)
  - [x] Add `user_message_count` column with DEFAULT 0 (already exists from prior migration)
  - [x] Add `conversation_score` column as DECIMAL(5,2) (exists as INTEGER from prior migration)
  - [x] Add `stage_breakdown` column as JSONB

- [x] **Task 2: Create indexes for new columns** (AC: #6)
  - [x] Create partial index `idx_sessions_stage` on `primary_stage` WHERE NOT NULL
  - [x] Create partial index `idx_sessions_debugging_loop` on `has_debugging_loop` WHERE TRUE

- [x] **Task 3: Backfill user_message_count** (AC: #7)
  - [x] Write UPDATE statement to count prompts per session
  - [x] Handle NULL session_uuid gracefully (legacy prompts)
  - [x] Exclude tool_result prompts if prompt_type is available (handled with fallback)

- [x] **Task 4: Add column comments** (AC: #1-#5)
  - [x] Document purpose of each new column
  - [x] Include example JSONB structure for stage_breakdown

- [x] **Task 5: Verify migration safety** (AC: #7)
  - [x] Migration uses IF NOT EXISTS for idempotent column additions
  - [x] DROP CONSTRAINT IF EXISTS prevents errors on re-run
  - [x] Backfill only updates rows with 0 or NULL counts

## Dev Notes

### Technology Stack
- PostgreSQL 15.x (Supabase)
- JSONB for flexible stage breakdown storage
- Partial indexes for filtered queries

### Database Schema Addition

```sql
-- 20251225200000_sessions_phase3_extensions.sql
-- Phase 3: Sessions table extensions for conversation intelligence

-- ============================================
-- ADD PHASE 3 COLUMNS
-- ============================================
-- All columns nullable or with defaults for backward compatibility

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS primary_stage VARCHAR(50),
  ADD COLUMN IF NOT EXISTS has_debugging_loop BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_message_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversation_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS stage_breakdown JSONB;

-- ============================================
-- ADD CHECK CONSTRAINT FOR STAGE VALUES
-- ============================================

ALTER TABLE sessions
  ADD CONSTRAINT valid_primary_stage CHECK (
    primary_stage IS NULL OR primary_stage IN (
      'architecture', 'specification', 'development', 'debugging', 'enhancement'
    )
  );

-- ============================================
-- PARTIAL INDEXES FOR NEW COLUMNS
-- ============================================

-- Index sessions by stage (only indexed when stage is set)
CREATE INDEX IF NOT EXISTS idx_sessions_stage
  ON sessions(primary_stage)
  WHERE primary_stage IS NOT NULL;

-- Index sessions with debugging loops (only TRUE values indexed)
CREATE INDEX IF NOT EXISTS idx_sessions_debugging_loop
  ON sessions(has_debugging_loop)
  WHERE has_debugging_loop = TRUE;

-- ============================================
-- BACKFILL USER_MESSAGE_COUNT
-- ============================================
-- Count existing prompts per session
-- Legacy prompts (without prompt_type) are assumed to be user messages

UPDATE sessions s SET user_message_count = (
  SELECT COUNT(*) FROM prompts p
  WHERE p.session_uuid = s.id
  AND (p.prompt_type IS NULL OR p.prompt_type != 'tool_result')
);

-- ============================================
-- COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN sessions.primary_stage IS
  'Primary project stage detected for this session: architecture, specification, development, debugging, or enhancement. Determined by analyzing prompt content.';

COMMENT ON COLUMN sessions.has_debugging_loop IS
  'TRUE if a debugging loop pattern was detected in this session (3+ similar error-fix-error cycles)';

COMMENT ON COLUMN sessions.user_message_count IS
  'Count of user messages in this session (excludes tool_result type prompts). Updated by trigger.';

COMMENT ON COLUMN sessions.conversation_score IS
  'Aggregate score for the conversation, excluding selection/confirmation prompts. Range 0-100.';

COMMENT ON COLUMN sessions.stage_breakdown IS
  'JSONB breakdown of prompt counts per stage. Example: {"architecture": 3, "development": 15, "debugging": 7}';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 3: SESSIONS EXTENSIONS COMPLETE ===';
  RAISE NOTICE 'Added columns: primary_stage, has_debugging_loop, user_message_count, conversation_score, stage_breakdown';
  RAISE NOTICE 'Created indexes: idx_sessions_stage, idx_sessions_debugging_loop';
  RAISE NOTICE 'Backfilled user_message_count from existing prompts';
  RAISE NOTICE '=============================================';
END $$;
```

### Column Specifications

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `primary_stage` | VARCHAR(50) | NULL | Detected project stage |
| `has_debugging_loop` | BOOLEAN | FALSE | Loop pattern detected |
| `user_message_count` | INTEGER | 0 | User prompts count |
| `conversation_score` | DECIMAL(5,2) | NULL | Aggregate score |
| `stage_breakdown` | JSONB | NULL | Stage percentages |

### Valid Stage Values
- `architecture` - High-level design decisions
- `specification` - Requirements and feature specs
- `development` - Active coding
- `debugging` - Fixing errors
- `enhancement` - Refactoring and improvements

### Common Pitfalls

1. **DO NOT** make columns NOT NULL - existing sessions would fail
2. **DO NOT** add columns that require data transformation on existing rows
3. **DO NOT** create full indexes when partial indexes suffice
4. **DO NOT** skip backfill - user_message_count should be accurate
5. **DO NOT** add foreign key constraints that could block inserts

### Testing Checklist

- [ ] Migration applies cleanly to empty database
- [ ] Migration applies cleanly to database with existing sessions
- [ ] Existing session data is preserved after migration
- [ ] user_message_count is correctly backfilled
- [ ] New sessions can be inserted with all new columns
- [ ] Partial indexes are used by query planner (EXPLAIN ANALYZE)
- [ ] CHECK constraint rejects invalid stage values
- [ ] NULL values are accepted for all new columns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- **Discovered existing migration:** `20251225100000_add_session_analytics_columns.sql` already added `primary_stage`, `has_debugging_loop`, `user_message_count`, and `conversation_score` columns with a different CHECK constraint set.
- **Created supplemental migration:** Added `stage_breakdown` JSONB column, partial indexes, backfill logic, and expanded CHECK constraint to include all Phase 3 story values.
- **Constraint reconciliation:** Expanded `valid_primary_stage` to allow both Phase 2 values (planning, implementation, debugging, refactoring, testing, documentation, review, exploration, unknown) AND Phase 3 values (architecture, specification, development, enhancement).
- **conversation_score type difference:** Existing migration uses INTEGER (0-100), story spec requested DECIMAL(5,2). Kept as INTEGER for consistency with existing data.
- **Idempotent design:** Migration uses `IF NOT EXISTS` and `DROP CONSTRAINT IF EXISTS` for safe re-runs.

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Created supplemental Phase 3 sessions migration | Dev Agent (Amelia) |

### File List

- **Created:** `app/supabase/migrations/20251225200000_sessions_phase3_extensions.sql`
