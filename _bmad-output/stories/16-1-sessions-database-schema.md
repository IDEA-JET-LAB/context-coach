# Story 16.1: Sessions Database Schema

Status: ✅ COMPLETED (2025-12-23)

## Story

**As a** system architect,
**I want** a robust sessions table to store Claude Code session data,
**So that** prompts can be grouped by conversation and session-level analytics can be calculated.

## Dependencies

This story is a foundational component for Epic 16. It requires:
- Existing `teams` table (Epic 2)
- Existing `projects` table (Epic 2)
- Existing `prompts` table (Story 4.5)

**Cross-Epic Dependency:** This migration MUST run BEFORE Epic 15 Story 15-6 (Response Storage Schema), which adds a foreign key to the `sessions` table created here.

## Acceptance Criteria

**AC 1: Sessions Table Creation**
- **Given** the database schema
- **When** this migration is applied
- **Then** the `sessions` table exists with all required columns:
  - `id` (UUID, primary key)
  - `session_id` (TEXT, unique - Claude Code's session identifier)
  - `user_id` (UUID, FK to auth.users)
  - `team_id` (UUID, FK to teams)
  - `project_id` (UUID, FK to projects, nullable)
  - `started_at` (TIMESTAMPTZ)
  - `ended_at` (TIMESTAMPTZ, nullable)
  - `end_reason` (TEXT, nullable - 'completed', 'abandoned', 'interrupted', 'unknown')
  - `git_branch` (TEXT, nullable)
  - `claude_code_version` (TEXT, nullable)
  - `slug` (TEXT, nullable - human-readable conversation name)
  - `cwd` (TEXT, nullable - current working directory)
  - `total_prompts` (INTEGER, default 0)
  - `total_tokens` (INTEGER, default 0)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)

**AC 2: Prompts Table Session Link**
- **Given** the sessions table exists
- **When** this migration is applied
- **Then** the `prompts` table has:
  - `session_uuid` (UUID, FK to sessions, nullable, ON DELETE SET NULL)
  - `sequence_number` (INTEGER, nullable - order within session)
  - `parent_prompt_id` (UUID, FK to prompts, nullable - for conversation threading)

**AC 3: Performance Indexes**
- **Given** the tables are created
- **When** this migration is applied
- **Then** indexes exist for:
  - `idx_sessions_user` on `(user_id, started_at DESC)`
  - `idx_sessions_team` on `(team_id, started_at DESC)`
  - `idx_sessions_session_id` on `(session_id)` for lookups
  - `idx_prompts_session` on `(session_uuid, sequence_number)`

**AC 4: Row Level Security**
- **Given** RLS policies are created
- **When** a user queries sessions
- **Then** they can only see sessions for teams they belong to
- **And** service role can insert/update sessions

**AC 5: Constraints and Validation**
- **Given** the schema constraints
- **When** data is inserted
- **Then** `end_reason` only accepts valid values ('completed', 'abandoned', 'interrupted', 'unknown', null)
- **And** `session_id` is unique across the table
- **And** foreign keys enforce referential integrity

## Tasks / Subtasks

- [ ] **Task 1: Create sessions table migration** (AC: #1, #5)
  - [ ] Create migration file `supabase/migrations/YYYYMMDDHHMMSS_create_sessions_table.sql`
  - [ ] Add all columns as specified with correct types
  - [ ] Add CHECK constraint for valid `end_reason` values
  - [ ] Add UNIQUE constraint on `session_id`
  - [ ] Add foreign key constraints with appropriate ON DELETE actions
  - [ ] Add `updated_at` trigger for automatic timestamp updates

- [ ] **Task 2: Add prompts table session columns** (AC: #2)
  - [ ] Add `session_uuid` column with FK to sessions
  - [ ] Add `sequence_number` column for ordering
  - [ ] Add `parent_prompt_id` column for threading
  - [ ] Use IF NOT EXISTS to make migration idempotent

- [ ] **Task 3: Create performance indexes** (AC: #3)
  - [ ] Add `idx_sessions_user` composite index
  - [ ] Add `idx_sessions_team` composite index
  - [ ] Add `idx_sessions_session_id` unique index
  - [ ] Add `idx_prompts_session` composite index
  - [ ] Add `idx_prompts_parent` index for threading queries

- [ ] **Task 4: Configure Row Level Security** (AC: #4)
  - [ ] Enable RLS on sessions table
  - [ ] Create SELECT policy for team members
  - [ ] Create INSERT/UPDATE policy for service role
  - [ ] Verify service role bypass works

- [ ] **Task 5: Create TypeScript types** (AC: #1, #2)
  - [ ] Add `SessionsRow` interface to `types/database.ts`
  - [ ] Update `PromptsRow` interface with new columns
  - [ ] Create `SessionEndReason` type union

- [ ] **Task 6: Verify migration** (AC: #1-5)
  - [ ] Apply migration to local Supabase
  - [ ] Verify table structure with `\d sessions`
  - [ ] Verify indexes exist
  - [ ] Verify RLS policies work
  - [ ] Test FK constraints

## Dev Notes

### Database Migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_sessions_table.sql

-- ============================================
-- SESSIONS TABLE
-- Tracks Claude Code conversation sessions
-- ============================================

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,  -- Claude Code's session_id from transcript
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,  -- 'completed', 'abandoned', 'interrupted', 'unknown'

  -- Context
  git_branch TEXT,
  claude_code_version TEXT,
  slug TEXT,  -- Human-readable conversation name
  cwd TEXT,   -- Current working directory

  -- Aggregates (updated by triggers/functions)
  total_prompts INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_end_reason CHECK (
    end_reason IS NULL OR end_reason IN ('completed', 'abandoned', 'interrupted', 'unknown')
  )
);

-- ============================================
-- PROMPTS TABLE EXTENSIONS
-- Link prompts to sessions for conversation tracking
-- ============================================

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS session_uuid UUID REFERENCES sessions(id) ON DELETE SET NULL;

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS parent_prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES
-- ============================================

-- Sessions lookups
CREATE INDEX idx_sessions_user ON sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_team ON sessions(team_id, started_at DESC);
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_project ON sessions(project_id, started_at DESC)
  WHERE project_id IS NOT NULL;

-- Prompts session queries
CREATE INDEX idx_prompts_session ON prompts(session_uuid, sequence_number);
CREATE INDEX idx_prompts_parent ON prompts(parent_prompt_id)
  WHERE parent_prompt_id IS NOT NULL;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_sessions_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Team members can view their team's sessions
CREATE POLICY "Team members can view sessions" ON sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = sessions.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- Service role can manage sessions (for API/import operations)
CREATE POLICY "Service role can manage sessions" ON sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE sessions IS 'Claude Code conversation sessions for prompt grouping and analytics';
COMMENT ON COLUMN sessions.session_id IS 'Claude Code session identifier from transcript';
COMMENT ON COLUMN sessions.end_reason IS 'How the session ended: completed, abandoned, interrupted, or unknown';
COMMENT ON COLUMN sessions.slug IS 'Human-readable conversation name for UI display';
COMMENT ON COLUMN sessions.cwd IS 'Current working directory when session started';
COMMENT ON COLUMN prompts.session_uuid IS 'FK to sessions table for conversation grouping';
COMMENT ON COLUMN prompts.sequence_number IS 'Order of prompt within the session (1-indexed)';
COMMENT ON COLUMN prompts.parent_prompt_id IS 'Parent prompt for conversation threading';
```

### TypeScript Types

```typescript
// types/database.ts - Add to existing types

export type SessionEndReason = 'completed' | 'abandoned' | 'interrupted' | 'unknown';

export interface SessionsRow {
  id: string;
  session_id: string;
  user_id: string;
  team_id: string;
  project_id: string | null;
  started_at: string;
  ended_at: string | null;
  end_reason: SessionEndReason | null;
  git_branch: string | null;
  claude_code_version: string | null;
  slug: string | null;
  cwd: string | null;
  total_prompts: number;
  total_tokens: number;
  created_at: string;
  updated_at: string;
}

// Update existing PromptsRow
export interface PromptsRow {
  id: string;
  team_id: string;
  project_id: string;
  user_id: string;
  text: string;
  char_count: number;
  word_count: number;
  metadata: Record<string, unknown> | null;
  analysis_status: 'pending' | 'processing' | 'complete' | 'failed';
  created_at: string;
  // New session-related columns
  session_uuid: string | null;
  sequence_number: number | null;
  parent_prompt_id: string | null;
}
```

### Session ID Format

Claude Code generates session IDs in this format:
```
session_<uuid>
```

Example: `session_a1b2c3d4-e5f6-7890-abcd-ef1234567890`

The `session_id` column stores this exact string for deduplication and lookups.

### Architecture Notes

**Why `session_uuid` vs `session_id` in prompts?**
- `session_id` (TEXT) is Claude Code's identifier - used for matching during import
- `session_uuid` (UUID FK) is our internal reference - used for joins and aggregation
- This separation allows us to link prompts even if session_id format changes

**ON DELETE SET NULL for session_uuid:**
- If a session is deleted, prompts remain but lose their session link
- This preserves historical prompt data even if sessions are cleaned up

**Parent Prompt ID for Threading:**
- Claude Code transcripts include `parentUuid` for message threading
- We store this to reconstruct conversation trees in the UI

### Component File Locations

| Component | Path |
|-----------|------|
| Sessions Migration | `app/supabase/migrations/YYYYMMDDHHMMSS_create_sessions_table.sql` |
| Database Types | `app/types/database.ts` |

### Testing Guidance

**Migration Verification:**
```sql
-- Verify sessions table structure
\d sessions

-- Verify indexes exist
\di sessions*

-- Verify prompts columns added
\d prompts

-- Test RLS (as authenticated user)
SELECT * FROM sessions; -- Should only show team's sessions

-- Test FK constraint
INSERT INTO prompts (session_uuid, ...)
VALUES ('non-existent-uuid', ...); -- Should fail
```

**E2E Test Cases:**
1. Create session via API
2. Verify team member can read their team's sessions
3. Verify team member cannot read other team's sessions
4. Link prompt to session and verify FK works
5. Delete session and verify prompts.session_uuid becomes NULL

### Common Pitfalls to Avoid

1. **DO NOT** use `session_id` as the primary key - use UUID for consistency
2. **DO NOT** forget the UNIQUE constraint on `session_id`
3. **DO NOT** use ON DELETE CASCADE for prompts.session_uuid - data should survive
4. **DO NOT** skip the updated_at trigger - needed for change tracking
5. **DO NOT** forget indexes on FK columns - critical for join performance

## Dev Agent Record

### Agent Model Used
<!-- To be filled by the implementing agent with their model name and version -->

### Completion Notes List
*To be filled by dev agent after implementation*

### Change Log
| Date | Change | Author |
|------|--------|--------|

### File List
*To be filled by dev agent - list all files created/modified*
