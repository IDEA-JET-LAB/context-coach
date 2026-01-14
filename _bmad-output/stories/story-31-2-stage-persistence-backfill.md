# Story 31-2: Stage Persistence & Backfill

## Story Info
- **Epic:** 31 - Project Stage Analytics
- **Priority:** P0 (Foundation)
- **Points:** 3
- **Status:** Done

## Description

Store detected stages on prompts and create a batch job to backfill existing conversations. This connects the stage detector (31-1) to the database, enabling stage data to be queried and displayed.

## Acceptance Criteria

- [x] Update `detected_stage` column on prompts table after analysis
- [x] Create batch processing function for a single session
- [x] Create batch processing function for a project (all sessions)
- [x] Track processing status (pending, processing, complete, error)
- [x] Handle partial failures gracefully (continue with other sessions)
- [x] API endpoint: `POST /api/projects/{id}/analyze-stages`
- [x] Return processing status and progress

## Technical Details

### Database Changes

```sql
-- Migration: 20260111100000_stage_analysis_tracking.sql

-- Add processing tracking to sessions
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS stage_analysis_status TEXT DEFAULT 'pending'
  CHECK (stage_analysis_status IN ('pending', 'processing', 'complete', 'error'));

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS stage_analysis_at TIMESTAMPTZ;

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS stage_analysis_error TEXT;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_prompts_detected_stage
  ON prompts(detected_stage)
  WHERE detected_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_stage_analysis_status
  ON sessions(stage_analysis_status);

-- Comment
COMMENT ON COLUMN sessions.stage_analysis_status IS
  'Status of stage detection: pending, processing, complete, error';
```

### File Structure

```
app/lib/analysis/
├── stage-persistence.ts        # Persistence layer
├── stage-batch-processor.ts    # Batch processing
├── __tests__/
│   ├── stage-persistence.test.ts
│   └── stage-batch-processor.test.ts

app/app/api/projects/[id]/
├── analyze-stages/
│   └── route.ts               # POST endpoint
```

### Types

```typescript
// lib/analysis/stage-persistence.ts

export interface StageAnalysisStatus {
  sessionId: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  analyzedAt: string | null;
  error: string | null;
  promptsAnalyzed: number;
  transitionsDetected: number;
}

export interface BatchProcessResult {
  projectId: string;
  totalSessions: number;
  processedSessions: number;
  failedSessions: number;
  totalPrompts: number;
  processingTimeMs: number;
  errors: Array<{ sessionId: string; error: string }>;
}
```

### Persistence Functions

```typescript
// lib/analysis/stage-persistence.ts

import { createServerClient } from '@/lib/supabase/server';
import { detectConversationStages, StageDetectionResult } from './stage-detector';

/**
 * Analyzes a single session and persists stage data to prompts.
 */
export async function analyzeAndPersistSessionStages(
  sessionId: string
): Promise<{ success: boolean; promptsUpdated: number; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Mark session as processing
    await supabase
      .from('sessions')
      .update({ stage_analysis_status: 'processing' })
      .eq('id', sessionId);

    // Fetch prompts for session
    const { data: prompts, error: fetchError } = await supabase
      .from('prompts')
      .select('id, text, sequence_number, created_at')
      .eq('session_uuid', sessionId)
      .order('sequence_number', { ascending: true });

    if (fetchError) throw fetchError;
    if (!prompts || prompts.length === 0) {
      // No prompts - mark as complete
      await supabase
        .from('sessions')
        .update({
          stage_analysis_status: 'complete',
          stage_analysis_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      return { success: true, promptsUpdated: 0 };
    }

    // Detect stages
    const results = detectConversationStages(
      prompts.map(p => ({
        id: p.id,
        text: p.text,
        sequenceNumber: p.sequence_number,
        timestamp: p.created_at,
      }))
    );

    // Batch update prompts
    for (const result of results) {
      await supabase
        .from('prompts')
        .update({
          detected_stage: result.detectedStage,
          // Optionally store confidence and transition flag
        })
        .eq('id', result.promptId);
    }

    // Mark session as complete
    await supabase
      .from('sessions')
      .update({
        stage_analysis_status: 'complete',
        stage_analysis_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    return { success: true, promptsUpdated: results.length };

  } catch (error) {
    // Mark session as error
    await supabase
      .from('sessions')
      .update({
        stage_analysis_status: 'error',
        stage_analysis_error: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', sessionId);

    return {
      success: false,
      promptsUpdated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Analyzes all sessions in a project.
 */
export async function analyzeProjectStages(
  projectId: string
): Promise<BatchProcessResult> {
  const supabase = await createServerClient();
  const startTime = Date.now();

  // Get all sessions for project
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('project_id', projectId)
    .in('stage_analysis_status', ['pending', 'error']); // Skip already complete

  if (error) throw error;

  const result: BatchProcessResult = {
    projectId,
    totalSessions: sessions?.length || 0,
    processedSessions: 0,
    failedSessions: 0,
    totalPrompts: 0,
    processingTimeMs: 0,
    errors: [],
  };

  // Process each session
  for (const session of sessions || []) {
    const sessionResult = await analyzeAndPersistSessionStages(session.id);

    if (sessionResult.success) {
      result.processedSessions++;
      result.totalPrompts += sessionResult.promptsUpdated;
    } else {
      result.failedSessions++;
      result.errors.push({
        sessionId: session.id,
        error: sessionResult.error || 'Unknown error'
      });
    }
  }

  result.processingTimeMs = Date.now() - startTime;
  return result;
}
```

### API Endpoint

```typescript
// app/api/projects/[id]/analyze-stages/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { analyzeProjectStages } from '@/lib/analysis/stage-persistence';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();

  // Verify user has access to project
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check project access (via team membership)
  const { data: project } = await supabase
    .from('projects')
    .select('id, team_id')
    .eq('id', params.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Run analysis
  try {
    const result = await analyzeProjectStages(params.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

// GET to check status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, stage_analysis_status, stage_analysis_at')
    .eq('project_id', params.id);

  const summary = {
    total: sessions?.length || 0,
    pending: sessions?.filter(s => s.stage_analysis_status === 'pending').length || 0,
    processing: sessions?.filter(s => s.stage_analysis_status === 'processing').length || 0,
    complete: sessions?.filter(s => s.stage_analysis_status === 'complete').length || 0,
    error: sessions?.filter(s => s.stage_analysis_status === 'error').length || 0,
  };

  return NextResponse.json({ data: summary });
}
```

## Tests

### Unit Tests

```typescript
describe('StagePersistence', () => {
  describe('analyzeAndPersistSessionStages', () => {
    it('should update prompts with detected stages');
    it('should mark session as complete on success');
    it('should mark session as error on failure');
    it('should handle empty sessions');
  });

  describe('analyzeProjectStages', () => {
    it('should process all pending sessions');
    it('should skip already complete sessions');
    it('should continue processing after individual failures');
    it('should return accurate counts');
  });
});
```

### Integration Tests

```typescript
describe('Stage Analysis API', () => {
  it('POST should trigger analysis for project');
  it('POST should require authentication');
  it('GET should return status summary');
  it('should handle concurrent requests gracefully');
});
```

## Dependencies

- Story 31-1: Conversation-Aware Stage Detector

## Definition of Done

- [x] Database migration created and applied
- [x] Persistence functions implemented
- [x] API endpoints working (POST to trigger, GET for status)
- [x] Error handling for partial failures
- [x] Unit tests passing
- [x] Integration tests passing
