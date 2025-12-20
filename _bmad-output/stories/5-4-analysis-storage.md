# Story 5.4: Analysis Storage

Status: complete

## Story

**As a** system,
**I want** to store analysis results,
**So that** they can be displayed in the dashboard.

## Acceptance Criteria

1. **Given** analysis completes successfully
   **When** results are stored
   **Then** a `prompt_analyses` row is created with: id, prompt_id, config_id, overall_score, dimension_scores (JSONB), suggestions (JSONB), created_at
   **And** `prompts.analysis_status` is updated to 'complete'
   **And** both operations complete atomically (both succeed or both fail)

2. **Given** the database schema
   **When** this story is complete
   **Then** the `prompt_analyses` table exists
   **And** RLS policies allow reading via prompt's team_id
   **And** `config_id` references the analysis config version used
   **And** unique constraint prevents duplicate analyses per prompt

3. **Given** an analysis already exists for a prompt
   **When** storage is attempted
   **Then** the operation handles the conflict gracefully (upsert or reject with clear error)

## Tasks / Subtasks

- [ ] **Task 1: Create prompt_analyses table migration** (AC: #2)
  - [ ] Create migration file `YYYYMMDDHHMMSS_create_prompt_analyses_table.sql`
  - [ ] Define table: id (UUID PK), prompt_id (FK), config_id (FK), overall_score (DECIMAL(3,1)), dimension_scores (JSONB), suggestions (JSONB), created_at (TIMESTAMPTZ)
  - [ ] Add foreign key to `prompts` table with ON DELETE CASCADE
  - [ ] Add foreign key to `analysis_configs` table
  - [ ] Add unique constraint on `prompt_id`
  - [ ] Add indexes: prompt_id, created_at DESC, overall_score, config_id
  - [ ] Add CHECK constraint: overall_score BETWEEN 1 AND 10

- [ ] **Task 2: Create RLS policies for prompt_analyses** (AC: #2)
  - [ ] Enable RLS on `prompt_analyses` table
  - [ ] Create SELECT policy: allow read if user's team owns the prompt (JOIN through prompts table, compare UUIDs)
  - [ ] No INSERT/UPDATE/DELETE policies for regular users (service role only)

- [ ] **Task 3: Implement storage function** (AC: #1, #3)
  - [ ] Create `supabase/functions/analyze-prompt/lib/storage.ts`
  - [ ] Implement `storeAnalysisResult()` using database function for atomic operation
  - [ ] Handle unique constraint violation (UPSERT or clear error)
  - [ ] Use service role client
  - [ ] Log operations per architecture pattern: `[EDGE] storage: action`
  - [ ] Return analysis ID on success

- [ ] **Task 4: Create atomic storage database function** (AC: #1)
  - [ ] Create `store_analysis_result` PostgreSQL function
  - [ ] Insert into `prompt_analyses` and update `prompts.analysis_status` in single transaction
  - [ ] Return analysis ID or raise exception on failure

- [ ] **Task 5: Integrate storage into Edge Function** (AC: #1)
  - [ ] Import storage module into main Edge Function
  - [ ] Call storage after successful scoring and suggestion generation
  - [ ] Handle storage errors with appropriate logging
  - [ ] Return success response with analysis_id

- [ ] **Task 6: Create dashboard query helpers** (AC: #2)
  - [ ] Create `lib/db/queries/analyses.ts`
  - [ ] Implement `getAnalysisByPromptId(promptId)` - returns null if not found
  - [ ] Implement `getLatestAnalyses(limit)` - returns empty array if none
  - [ ] Use Supabase client with RLS (not service role)
  - [ ] Include TypeScript return types

## Dev Notes

### Table Schema

```sql
CREATE TABLE prompt_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES analysis_configs(id),
  overall_score DECIMAL(3,1) NOT NULL CHECK (overall_score >= 1 AND overall_score <= 10),
  dimension_scores JSONB NOT NULL,
  suggestions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_prompt_analysis UNIQUE (prompt_id)
);

CREATE INDEX idx_prompt_analyses_prompt_id ON prompt_analyses(prompt_id);
CREATE INDEX idx_prompt_analyses_created_at ON prompt_analyses(created_at DESC);
CREATE INDEX idx_prompt_analyses_overall_score ON prompt_analyses(overall_score);
CREATE INDEX idx_prompt_analyses_config_id ON prompt_analyses(config_id);

ALTER TABLE prompt_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read analyses for their team's prompts"
  ON prompt_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM prompts p
      WHERE p.id = prompt_analyses.prompt_id
      AND p.team_id = (auth.jwt() ->> 'team_id')::uuid
    )
  );

COMMENT ON TABLE prompt_analyses IS 'Stores AI analysis results for each prompt';
```

### Atomic Storage Function

```sql
CREATE OR REPLACE FUNCTION store_analysis_result(
  p_prompt_id UUID,
  p_config_id UUID,
  p_overall_score DECIMAL(3,1),
  p_dimension_scores JSONB,
  p_suggestions JSONB
) RETURNS UUID AS $$
DECLARE
  v_analysis_id UUID;
BEGIN
  INSERT INTO prompt_analyses (prompt_id, config_id, overall_score, dimension_scores, suggestions)
  VALUES (p_prompt_id, p_config_id, p_overall_score, p_dimension_scores, p_suggestions)
  RETURNING id INTO v_analysis_id;

  UPDATE prompts SET analysis_status = 'complete' WHERE id = p_prompt_id;

  RETURN v_analysis_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Analysis already exists for prompt %', p_prompt_id;
END;
$$ LANGUAGE plpgsql;
```

### JSONB Structures

```typescript
// dimension_scores: { [dimensionName]: { score: 1-10, reasoning: string } }
// Example: { "Clarity": { "score": 8, "reasoning": "Clear request..." } }

// suggestions: { byDimension: {...}, prioritized: string[], generatedAt: ISO }
// Example: { "byDimension": { "Clarity": { "type": "reinforcement", "message": "..." } }, "prioritized": ["Add context"], "generatedAt": "2025-01-15T10:30:00Z" }
```

### Storage Implementation

```typescript
// supabase/functions/analyze-prompt/lib/storage.ts
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AnalysisResult {
  promptId: string;
  configId: string;
  overallScore: number;
  dimensionScores: Record<string, { score: number; reasoning: string }>;
  suggestions: {
    byDimension: Record<string, { type: string; message: string; example?: string }>;
    prioritized: string[];
    generatedAt: string;
  };
}

export async function storeAnalysisResult(
  supabase: SupabaseClient,
  result: AnalysisResult
): Promise<string> {
  console.log('[EDGE] storage: storing analysis for prompt', result.promptId);

  const { data, error } = await supabase.rpc('store_analysis_result', {
    p_prompt_id: result.promptId,
    p_config_id: result.configId,
    p_overall_score: result.overallScore,
    p_dimension_scores: result.dimensionScores,
    p_suggestions: result.suggestions,
  });

  if (error) {
    console.error('[EDGE] storage: failed', error.message);
    throw new Error(`Storage failed: ${error.message}`);
  }

  console.log('[EDGE] storage: complete', { analysisId: data, promptId: result.promptId });
  return data;
}
```

### Dashboard Queries

```typescript
// lib/db/queries/analyses.ts
import { createClient } from '@/lib/supabase/server';

export interface PromptAnalysis {
  id: string;
  prompt_id: string;
  config_id: string;
  overall_score: number;
  dimension_scores: Record<string, { score: number; reasoning: string }>;
  suggestions: {
    byDimension: Record<string, { type: string; message: string; example?: string }>;
    prioritized: string[];
    generatedAt: string;
  };
  created_at: string;
}

export async function getAnalysisByPromptId(promptId: string): Promise<PromptAnalysis | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('prompt_analyses')
    .select('*')
    .eq('prompt_id', promptId)
    .single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function getLatestAnalyses(limit = 10): Promise<PromptAnalysis[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('prompt_analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
```

### File Locations

| File | Path |
|------|------|
| Migration | `supabase/migrations/YYYYMMDDHHMMSS_create_prompt_analyses_table.sql` |
| Storage Module | `supabase/functions/analyze-prompt/lib/storage.ts` |
| Dashboard Queries | `lib/db/queries/analyses.ts` |
| TypeScript Types | `lib/types/analysis.ts` |

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `ANALYSIS_STORAGE_FAILED` | 500 | Database insert failed |
| `ANALYSIS_ALREADY_EXISTS` | 409 | Unique constraint violation |
| `INVALID_ANALYSIS_DATA` | 400 | Invalid score or malformed JSONB |

### Pitfalls to Avoid

1. **DO NOT** allow direct INSERT from client - service role only
2. **DO NOT** skip the atomic storage function - use `store_analysis_result` RPC
3. **DO NOT** use client-side Supabase for storage operations
4. **DO NOT** store raw AI response - validate and structure data first
5. **DO NOT** forget to handle unique constraint violations gracefully

### Verification Checklist

- [ ] `prompt_analyses` table exists with correct schema
- [ ] RLS policy allows reading via team's prompts
- [ ] Atomic storage function creates both records or neither
- [ ] `prompts.analysis_status` updates to 'complete' after storage
- [ ] Unique constraint prevents duplicate analyses
- [ ] Dashboard queries return data with RLS applied
- [ ] JSONB columns contain valid structured data
- [ ] Error codes returned for failure scenarios

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
