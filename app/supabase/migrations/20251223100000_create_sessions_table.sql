-- Sessions Table Migration
-- Story 16-1: Sessions Database Schema
-- Creates sessions table and extends prompts table for session tracking

-- ============================================
-- SESSIONS TABLE
-- ============================================
-- Tracks Claude Code sessions for grouping related prompts

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Claude Code's session identifier (from CLAUDE_SESSION_ID)
  session_id TEXT NOT NULL UNIQUE,

  -- Ownership
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,

  -- Session lifecycle
  end_reason TEXT,

  -- Context metadata
  git_branch TEXT,
  claude_code_version TEXT,
  slug TEXT,  -- Human-readable session name
  cwd TEXT,   -- Current working directory

  -- Aggregated stats (updated by triggers or API)
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_end_reason CHECK (
    end_reason IS NULL OR end_reason IN ('completed', 'abandoned', 'interrupted', 'unknown')
  ),
  CONSTRAINT valid_ended_at CHECK (
    ended_at IS NULL OR ended_at >= started_at
  )
);

-- ============================================
-- PROMPTS TABLE EXTENSIONS
-- ============================================
-- Add session tracking columns to prompts table

-- Session reference (nullable for backward compatibility)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS session_uuid UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- Sequence number within session (for ordering)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

-- Parent prompt reference (for conversation threading)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS parent_prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES FOR SESSIONS
-- ============================================

-- User's sessions, ordered by most recent
CREATE INDEX idx_sessions_user ON sessions(user_id, started_at DESC);

-- Team's sessions, ordered by most recent
CREATE INDEX idx_sessions_team ON sessions(team_id, started_at DESC);

-- Lookup by Claude Code's session identifier
CREATE INDEX idx_sessions_session_id ON sessions(session_id);

-- Project's sessions (partial index for non-null project_id)
CREATE INDEX idx_sessions_project ON sessions(project_id, started_at DESC)
  WHERE project_id IS NOT NULL;

-- Active sessions (no end time)
CREATE INDEX idx_sessions_active ON sessions(user_id, started_at DESC)
  WHERE ended_at IS NULL;

-- ============================================
-- INDEXES FOR PROMPTS (Session-related)
-- ============================================

-- Prompts within a session, ordered by sequence
CREATE INDEX idx_prompts_session ON prompts(session_uuid, sequence_number);

-- Parent prompt lookup (for conversation threading)
CREATE INDEX idx_prompts_parent ON prompts(parent_prompt_id)
  WHERE parent_prompt_id IS NOT NULL;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
-- Reuses the existing handle_updated_at() function from initial_setup.sql

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Team members can view sessions for their teams
CREATE POLICY "Team members can view sessions" ON sessions
  FOR SELECT USING (
    team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- Service role can insert sessions (used by capture API)
CREATE POLICY "Service role can insert sessions" ON sessions
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Service role can update sessions (for end time, stats, etc.)
CREATE POLICY "Service role can update sessions" ON sessions
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can delete sessions
CREATE POLICY "Service role can delete sessions" ON sessions
  FOR DELETE TO service_role
  USING (true);

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE sessions IS
  'Tracks Claude Code sessions for grouping related prompts and enabling session analytics';

COMMENT ON COLUMN sessions.id IS
  'Internal UUID primary key';

COMMENT ON COLUMN sessions.session_id IS
  'Claude Code session identifier from CLAUDE_SESSION_ID environment variable. Unique across all sessions.';

COMMENT ON COLUMN sessions.user_id IS
  'User who owns this session';

COMMENT ON COLUMN sessions.team_id IS
  'Team this session belongs to';

COMMENT ON COLUMN sessions.project_id IS
  'Project this session is associated with (nullable, set to NULL on project deletion)';

COMMENT ON COLUMN sessions.started_at IS
  'When the session started (first prompt timestamp or explicit start)';

COMMENT ON COLUMN sessions.ended_at IS
  'When the session ended (NULL for active sessions)';

COMMENT ON COLUMN sessions.end_reason IS
  'How the session ended: completed (normal exit), abandoned (timeout), interrupted (crash/force-quit), unknown';

COMMENT ON COLUMN sessions.git_branch IS
  'Git branch active during the session';

COMMENT ON COLUMN sessions.claude_code_version IS
  'Version of Claude Code CLI used';

COMMENT ON COLUMN sessions.slug IS
  'Human-readable session name (auto-generated or user-provided)';

COMMENT ON COLUMN sessions.cwd IS
  'Current working directory at session start';

COMMENT ON COLUMN sessions.total_prompts IS
  'Count of prompts in this session (denormalized for performance)';

COMMENT ON COLUMN sessions.total_tokens IS
  'Total tokens used in this session (denormalized for performance)';

COMMENT ON COLUMN prompts.session_uuid IS
  'Reference to the session this prompt belongs to';

COMMENT ON COLUMN prompts.sequence_number IS
  'Order of this prompt within its session (1-indexed)';

COMMENT ON COLUMN prompts.parent_prompt_id IS
  'Reference to parent prompt for conversation threading';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== SESSIONS SCHEMA MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created sessions table with all columns and constraints';
  RAISE NOTICE 'Added session tracking columns to prompts table';
  RAISE NOTICE 'Created indexes for efficient queries';
  RAISE NOTICE 'Enabled RLS with team-based access policies';
  RAISE NOTICE '==========================================';
END $$;
