-- Conversation Analyses Table Migration
-- Story 30-3: Analysis Storage Schema
-- Creates table for storing LLM-powered conversation analysis results

-- ============================================
-- CONVERSATION ANALYSES TABLE
-- ============================================
-- Stores analysis results from AI-powered conversation analysis feature

CREATE TABLE conversation_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session reference (Claude Code session identifier)
  session_id TEXT NOT NULL,

  -- Ownership and access control
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Analysis request
  question TEXT NOT NULL,
  question_type TEXT CHECK (question_type IS NULL OR question_type IN ('custom', 'summarize', 'find_issues', 'suggestions', 'deep_dive')),

  -- Analysis response
  response TEXT NOT NULL,

  -- Model and usage tracking
  model TEXT NOT NULL CHECK (model IN ('haiku', 'sonnet', 'opus')),
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_cents NUMERIC(10,4) NOT NULL,

  -- Content inclusion flags
  included_prompts BOOLEAN NOT NULL DEFAULT true,
  included_responses BOOLEAN NOT NULL DEFAULT true,
  included_thinking BOOLEAN NOT NULL DEFAULT false,
  included_tools BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key to sessions table
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES
-- ============================================

-- Lookup analyses by session
CREATE INDEX idx_conversation_analyses_session ON conversation_analyses(session_id);

-- Team's analyses for access control and listing
CREATE INDEX idx_conversation_analyses_team ON conversation_analyses(team_id);

-- User's analyses for personal history
CREATE INDEX idx_conversation_analyses_user ON conversation_analyses(user_id);

-- Ordered by most recent first
CREATE INDEX idx_conversation_analyses_created ON conversation_analyses(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE conversation_analyses ENABLE ROW LEVEL SECURITY;

-- Team members can view analyses for their team
CREATE POLICY "Users can view team analyses" ON conversation_analyses
  FOR SELECT USING (
    team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid())
  );

-- Users can create analyses for their team (must be their own user_id)
CREATE POLICY "Users can create analyses for their team" ON conversation_analyses
  FOR INSERT WITH CHECK (
    team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid())
    AND user_id = auth.uid()
  );

-- Users can delete their own analyses
CREATE POLICY "Users can delete own analyses" ON conversation_analyses
  FOR DELETE USING (user_id = auth.uid());

-- Service role has full access for API operations
CREATE POLICY "Service role full access" ON conversation_analyses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE conversation_analyses IS
  'Stores LLM-powered analysis results for Claude Code conversations';

COMMENT ON COLUMN conversation_analyses.id IS
  'Internal UUID primary key';

COMMENT ON COLUMN conversation_analyses.session_id IS
  'Claude Code session identifier - references sessions(session_id)';

COMMENT ON COLUMN conversation_analyses.team_id IS
  'Team that owns this analysis';

COMMENT ON COLUMN conversation_analyses.user_id IS
  'User who requested this analysis';

COMMENT ON COLUMN conversation_analyses.question IS
  'The analysis question/prompt submitted by the user';

COMMENT ON COLUMN conversation_analyses.question_type IS
  'Predefined question type: custom, summarize, find_issues, suggestions, deep_dive';

COMMENT ON COLUMN conversation_analyses.response IS
  'The LLM-generated analysis response';

COMMENT ON COLUMN conversation_analyses.model IS
  'Anthropic model used: haiku, sonnet, or opus';

COMMENT ON COLUMN conversation_analyses.input_tokens IS
  'Number of input tokens consumed';

COMMENT ON COLUMN conversation_analyses.output_tokens IS
  'Number of output tokens generated';

COMMENT ON COLUMN conversation_analyses.estimated_cost_cents IS
  'Estimated cost of this analysis in cents (USD)';

COMMENT ON COLUMN conversation_analyses.included_prompts IS
  'Whether user prompts were included in context';

COMMENT ON COLUMN conversation_analyses.included_responses IS
  'Whether AI responses were included in context';

COMMENT ON COLUMN conversation_analyses.included_thinking IS
  'Whether thinking/reasoning content was included';

COMMENT ON COLUMN conversation_analyses.included_tools IS
  'Whether tool usage was included in context';

COMMENT ON COLUMN conversation_analyses.created_at IS
  'When this analysis was performed';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== CONVERSATION ANALYSES MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created conversation_analyses table with all columns';
  RAISE NOTICE 'Created indexes for efficient queries';
  RAISE NOTICE 'Enabled RLS with team-based access policies';
  RAISE NOTICE '================================================';
END $$;
