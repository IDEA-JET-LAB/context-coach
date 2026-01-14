# Story 30-3: Analysis Storage Schema

## Story Info
- **Epic:** 30 - Conversation Analysis
- **Priority:** P0 (Foundation)
- **Points:** 2
- **Status:** Done
- **Completed:** 2026-01-10

## Description

Create database schema to store conversation analysis results for later review. Users should be able to see their past analyses and the questions they asked.

## Acceptance Criteria

- [x] Create migration for `conversation_analyses` table
- [x] Support multiple analyses per conversation
- [x] Track model used, tokens consumed, estimated cost
- [x] Store content selection options used
- [x] Enable querying past analyses
- [x] RLS policies for team-based access
- [x] Create TypeScript types matching schema

## Technical Details

### Migration

```sql
-- Migration: 20260109_create_conversation_analyses.sql

-- Table for storing conversation analysis results
CREATE TABLE conversation_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  session_id TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Analysis request
  question TEXT NOT NULL,
  question_type TEXT, -- 'custom', 'summarize', 'find_issues', 'suggestions', 'deep_dive'

  -- Analysis response
  response TEXT NOT NULL,

  -- Model info
  model TEXT NOT NULL CHECK (model IN ('haiku', 'sonnet', 'opus')),

  -- Token tracking
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_cents NUMERIC(10,4) NOT NULL,

  -- Content selection (what was included in context)
  included_prompts BOOLEAN NOT NULL DEFAULT true,
  included_responses BOOLEAN NOT NULL DEFAULT true,
  included_thinking BOOLEAN NOT NULL DEFAULT false,
  included_tools BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key to sessions (soft reference since session_id is TEXT)
  CONSTRAINT fk_session FOREIGN KEY (session_id)
    REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_conversation_analyses_session
  ON conversation_analyses(session_id);

CREATE INDEX idx_conversation_analyses_team
  ON conversation_analyses(team_id);

CREATE INDEX idx_conversation_analyses_user
  ON conversation_analyses(user_id);

CREATE INDEX idx_conversation_analyses_created
  ON conversation_analyses(created_at DESC);

CREATE INDEX idx_conversation_analyses_question_type
  ON conversation_analyses(question_type)
  WHERE question_type IS NOT NULL;

-- Enable RLS
ALTER TABLE conversation_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view analyses for sessions in their teams
CREATE POLICY "Users can view team analyses"
  ON conversation_analyses
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can create analyses for sessions in their teams
CREATE POLICY "Users can create analyses for their team"
  ON conversation_analyses
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Policy: Users can only delete their own analyses
CREATE POLICY "Users can delete own analyses"
  ON conversation_analyses
  FOR DELETE
  USING (user_id = auth.uid());

-- Add comment
COMMENT ON TABLE conversation_analyses IS
  'Stores LLM-powered analysis results for conversations';
```

### TypeScript Types

```typescript
// lib/types/conversation-analysis.ts

export interface ConversationAnalysis {
  id: string;
  sessionId: string;
  teamId: string;
  userId: string;

  // Request
  question: string;
  questionType: 'custom' | 'summarize' | 'find_issues' | 'suggestions' | 'deep_dive' | null;

  // Response
  response: string;

  // Model
  model: 'haiku' | 'sonnet' | 'opus';

  // Tokens & cost
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;

  // Content selection
  includedPrompts: boolean;
  includedResponses: boolean;
  includedThinking: boolean;
  includedTools: boolean;

  // Metadata
  createdAt: string;
}

export interface CreateAnalysisInput {
  sessionId: string;
  teamId: string;
  question: string;
  questionType?: ConversationAnalysis['questionType'];
  response: string;
  model: ConversationAnalysis['model'];
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  includedPrompts: boolean;
  includedResponses: boolean;
  includedThinking: boolean;
  includedTools: boolean;
}
```

### Repository Functions

```typescript
// lib/repositories/conversation-analysis.ts

export async function createAnalysis(
  supabase: SupabaseClient,
  input: CreateAnalysisInput
): Promise<ConversationAnalysis> {
  const { data, error } = await supabase
    .from('conversation_analyses')
    .insert({
      session_id: input.sessionId,
      team_id: input.teamId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      question: input.question,
      question_type: input.questionType,
      response: input.response,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      estimated_cost_cents: input.estimatedCostCents,
      included_prompts: input.includedPrompts,
      included_responses: input.includedResponses,
      included_thinking: input.includedThinking,
      included_tools: input.includedTools,
    })
    .select()
    .single();

  if (error) throw error;
  return mapToConversationAnalysis(data);
}

export async function getAnalysesForSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<ConversationAnalysis[]> {
  const { data, error } = await supabase
    .from('conversation_analyses')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(mapToConversationAnalysis);
}

export async function getAnalysisById(
  supabase: SupabaseClient,
  id: string
): Promise<ConversationAnalysis | null> {
  const { data, error } = await supabase
    .from('conversation_analyses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapToConversationAnalysis(data);
}

export async function deleteAnalysis(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_analyses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
```

### Query Examples

```sql
-- Get all analyses for a session
SELECT * FROM conversation_analyses
WHERE session_id = 'abc123'
ORDER BY created_at DESC;

-- Get user's recent analyses across all sessions
SELECT ca.*, s.slug as session_name
FROM conversation_analyses ca
JOIN sessions s ON s.session_id = ca.session_id
WHERE ca.user_id = 'user-uuid'
ORDER BY ca.created_at DESC
LIMIT 20;

-- Get most popular question types
SELECT question_type, COUNT(*) as count
FROM conversation_analyses
WHERE question_type IS NOT NULL
GROUP BY question_type
ORDER BY count DESC;

-- Get total cost by model
SELECT model, SUM(estimated_cost_cents) as total_cents
FROM conversation_analyses
WHERE team_id = 'team-uuid'
GROUP BY model;
```

## Tests

### Migration Tests

```typescript
describe('conversation_analyses table', () => {
  it('should create analysis with all fields');
  it('should enforce model enum constraint');
  it('should cascade delete when session deleted');
  it('should cascade delete when team deleted');
});
```

### RLS Tests

```typescript
describe('conversation_analyses RLS', () => {
  it('should allow user to view analyses for their team');
  it('should deny viewing analyses for other teams');
  it('should allow user to create analysis for their team');
  it('should deny creating analysis for other teams');
  it('should allow user to delete their own analysis');
  it('should deny deleting other users analyses');
});
```

### Repository Tests

```typescript
describe('ConversationAnalysisRepository', () => {
  describe('createAnalysis', () => {
    it('should create and return analysis');
    it('should set user_id from auth context');
  });

  describe('getAnalysesForSession', () => {
    it('should return analyses ordered by created_at desc');
    it('should return empty array for session with no analyses');
  });

  describe('deleteAnalysis', () => {
    it('should delete analysis');
    it('should throw for non-existent analysis');
  });
});
```

## Dependencies

- Existing sessions table
- Existing teams table
- Existing team_members table

## Out of Scope

- API endpoints (Story 30-7)
- UI for viewing past analyses (Story 30-7)

## Definition of Done

- [ ] Migration created and tested locally
- [ ] Migration applied to Cloud Supabase
- [ ] TypeScript types created
- [ ] Repository functions implemented
- [ ] RLS policies verified
- [ ] Tests passing
