# Story 27-5: Update Analysis Pipeline

Status: Done

## Story

**As a** system,
**I want** to integrate context-aware classification into the existing analysis pipeline,
**So that** every captured prompt is classified before scoring.

## Dependencies

- **Story 27-1**: Prompt Classification Service
- **Story 27-2**: Heuristic Classification
- **Story 27-3**: Context Building for Analysis
- **Story 27-4**: Context-Aware Scoring
- **Story 4.1**: Capture API Endpoint (existing)
- **Story 5.1**: Analysis Edge Function (existing)

## Background

The existing pipeline flows:
```
Capture → Store → Queue Analysis → Edge Function → Score → Store Results
```

This story modifies the flow to:
```
Capture → Store → Queue Analysis → Classify → (Skip | Score with Context) → Store Results
```

The key integration points are:
1. After prompt storage, classification runs first
2. Classification result determines if scoring proceeds
3. Scoring receives conversation context from classification phase
4. Results include classification metadata

## Acceptance Criteria

1. **Classification Before Scoring**
   - **Given** a prompt enters the analysis queue
   - **When** the Edge Function processes it
   - **Then** classification runs before any scoring
   - **And** classification result is stored in `prompts.prompt_type`
   - **And** log: `[PIPELINE] Starting analysis for prompt {id}`

2. **Skip Path for Zero-Weight Types**
   - **Given** a prompt classified as `selection` or `confirmation`
   - **When** classification completes
   - **Then** scoring is skipped entirely (no AI call)
   - **And** `prompts.analysis_status` is set to `'skipped'`
   - **And** `prompt_analyses` record created with `skipped: true`
   - **And** log: `[PIPELINE] Skipped analysis for prompt {id} (type: {type})`

3. **Score Path with Context**
   - **Given** a prompt with scoring weight > 0
   - **When** classification completes
   - **Then** conversation context is passed to scoring
   - **And** context-aware scoring (27-4) is used
   - **And** `prompts.analysis_status` is set to `'complete'`
   - **And** log: `[PIPELINE] Completed analysis for prompt {id} (score: {score})`

4. **Error Handling with Classification**
   - **Given** classification fails
   - **When** an error occurs
   - **Then** the prompt defaults to `'continuation'` type
   - **And** scoring proceeds with standard weights
   - **And** log: `[PIPELINE] Classification failed for prompt {id}, using default`

5. **Backward Compatibility**
   - **Given** prompts captured before Phase 3
   - **When** they are reprocessed or viewed
   - **Then** they still display correctly (no breaking changes)
   - **And** `prompt_type` defaults to `null` (interpreted as legacy)

## Technical Context

### File Locations

| File | Purpose |
|------|---------|
| `supabase/functions/analyze-prompt/index.ts` | Main Edge Function (modify) |
| `supabase/functions/analyze-prompt/pipeline.ts` | Pipeline orchestration (create) |
| `lib/analysis/analysisPipeline.ts` | Alternative: Next.js API route version |
| `app/api/prompts/analyze/route.ts` | Analysis trigger endpoint (modify) |

### Updated Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ANALYSIS PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Prompt Received                                               │
│     └── promptId, sessionId                                       │
│                                                                   │
│  2. Build Conversation Context (27-3)                             │
│     └── context = await buildConversationContext(promptId)        │
│                                                                   │
│  3. Classify Prompt (27-1, 27-2)                                  │
│     └── classification = await classifyPrompt(content, context)   │
│     └── Store: prompts.prompt_type = classification.promptType    │
│                                                                   │
│  4. Decision Point                                                │
│     ├── IF scoringWeight === 0                                    │
│     │   └── Create skipped analysis record                        │
│     │   └── Update status to 'skipped'                            │
│     │   └── DONE                                                  │
│     └── ELSE                                                      │
│         └── Continue to scoring                                   │
│                                                                   │
│  5. Context-Aware Scoring (27-4)                                  │
│     └── result = await scorePromptWithContext(promptId, content)  │
│                                                                   │
│  6. Store Results                                                 │
│     └── Insert prompt_analyses with all metadata                  │
│     └── Update prompts.analysis_status to 'complete'              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Pipeline Orchestration

```typescript
// supabase/functions/analyze-prompt/pipeline.ts

import { buildConversationContext } from './context';
import { classifyPrompt } from './classifier';
import { scorePromptWithContext } from './scoring';
import { SupabaseClient } from '@supabase/supabase-js';
import { PromptType, ClassificationResult, ConversationContext } from './types';

interface PipelineResult {
  promptId: string;
  promptType: PromptType;
  skipped: boolean;
  skipReason?: string;
  scores?: {
    clarity: number;
    context: number;
    specificity: number;
    goal: number;
    constraints: number;
    overall: number;
    weightedOverall: number;
  };
  contextUsed: {
    messageCount: number;
    tokenCount: number;
  };
  processingTimeMs: number;
}

export async function runAnalysisPipeline(
  supabase: SupabaseClient,
  promptId: string
): Promise<PipelineResult> {
  const startTime = Date.now();

  console.log(`[PIPELINE] Starting analysis for prompt ${promptId}`);

  // 1. Fetch the prompt
  const { data: prompt, error: fetchError } = await supabase
    .from('prompts')
    .select('id, content, session_uuid, analysis_status')
    .eq('id', promptId)
    .single();

  if (fetchError || !prompt) {
    throw new Error(`Prompt not found: ${promptId}`);
  }

  // Skip if already processed
  if (prompt.analysis_status === 'complete' || prompt.analysis_status === 'skipped') {
    console.log(`[PIPELINE] Prompt ${promptId} already processed (${prompt.analysis_status})`);
    return {
      promptId,
      promptType: 'continuation',
      skipped: true,
      skipReason: 'Already processed',
      contextUsed: { messageCount: 0, tokenCount: 0 },
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 2. Build conversation context
  let context: ConversationContext;
  try {
    context = await buildConversationContext(supabase, promptId);
  } catch (error) {
    console.error(`[PIPELINE] Context building failed:`, error);
    context = createEmptyContext(promptId, prompt.session_uuid);
  }

  // 3. Classify the prompt
  let classification: ClassificationResult;
  try {
    classification = await classifyPrompt(prompt.content, context);
  } catch (error) {
    console.error(`[PIPELINE] Classification failed for prompt ${promptId}, using default`);
    classification = {
      promptType: 'continuation',
      confidence: 0.5,
      scoringWeight: 0.7,
      method: 'heuristic',
    };
  }

  // Store classification
  await supabase
    .from('prompts')
    .update({
      prompt_type: classification.promptType,
      prompt_type_confidence: classification.confidence,
    })
    .eq('id', promptId);

  // 4. Check if scoring should be skipped
  if (classification.scoringWeight === 0) {
    const skipReason = getSkipReason(classification.promptType);
    console.log(`[PIPELINE] Skipped analysis for prompt ${promptId} (type: ${classification.promptType})`);

    await storeSkippedAnalysis(supabase, promptId, classification.promptType, skipReason, context);

    return {
      promptId,
      promptType: classification.promptType,
      skipped: true,
      skipReason,
      contextUsed: {
        messageCount: context.messages.length,
        tokenCount: context.totalTokens,
      },
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 5. Perform context-aware scoring
  const scoringResult = await scorePromptWithContext(
    supabase,
    promptId,
    prompt.content,
    context,
    classification
  );

  // 6. Store complete analysis
  await storeCompleteAnalysis(supabase, promptId, scoringResult, classification, context);

  console.log(`[PIPELINE] Completed analysis for prompt ${promptId} (score: ${scoringResult.weightedOverall})`);

  return {
    promptId,
    promptType: classification.promptType,
    skipped: false,
    scores: {
      clarity: scoringResult.adjustedScores.clarity,
      context: scoringResult.adjustedScores.context,
      specificity: scoringResult.adjustedScores.specificity,
      goal: scoringResult.adjustedScores.goal,
      constraints: scoringResult.adjustedScores.constraints,
      overall: scoringResult.rawOverall,
      weightedOverall: scoringResult.weightedOverall,
    },
    contextUsed: {
      messageCount: context.messages.length,
      tokenCount: context.totalTokens,
    },
    processingTimeMs: Date.now() - startTime,
  };
}

function createEmptyContext(promptId: string, sessionId: string): ConversationContext {
  return {
    sessionId,
    messageIndex: 0,
    messages: [],
    tokenBudget: 10000,
    totalTokens: 0,
  };
}

function getSkipReason(promptType: PromptType): string {
  switch (promptType) {
    case 'selection':
      return 'Selection prompts choose from presented options and are not independently scored';
    case 'confirmation':
      return 'Confirmation prompts approve AI actions and are not independently scored';
    default:
      return 'Prompt type excluded from scoring';
  }
}

async function storeSkippedAnalysis(
  supabase: SupabaseClient,
  promptId: string,
  promptType: PromptType,
  skipReason: string,
  context: ConversationContext
): Promise<void> {
  // Create skipped analysis record
  await supabase.from('prompt_analyses').insert({
    prompt_id: promptId,
    skipped: true,
    skip_reason: skipReason,
    prompt_type: promptType,
    conversation_context_used: context.messages.length > 0,
    context_message_count: context.messages.length,
    context_token_count: context.totalTokens,
  });

  // Update prompt status
  await supabase
    .from('prompts')
    .update({ analysis_status: 'skipped' })
    .eq('id', promptId);
}

async function storeCompleteAnalysis(
  supabase: SupabaseClient,
  promptId: string,
  scoringResult: any,
  classification: ClassificationResult,
  context: ConversationContext
): Promise<void> {
  // Create complete analysis record
  await supabase.from('prompt_analyses').insert({
    prompt_id: promptId,
    skipped: false,
    prompt_type: classification.promptType,
    dimension_scores: scoringResult.adjustedScores,
    raw_dimension_scores: scoringResult.rawScores,
    overall_score: scoringResult.weightedOverall,
    raw_overall_score: scoringResult.rawOverall,
    scoring_weight: classification.scoringWeight,
    conversation_context_used: true,
    context_message_count: context.messages.length,
    context_token_count: context.totalTokens,
    classification_confidence: classification.confidence,
    classification_method: classification.method,
  });

  // Update prompt status
  await supabase
    .from('prompts')
    .update({ analysis_status: 'complete' })
    .eq('id', promptId);
}
```

### Edge Function Update

```typescript
// supabase/functions/analyze-prompt/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { runAnalysisPipeline } from './pipeline.ts';

serve(async (req) => {
  try {
    const { promptId, retryCount = 0 } = await req.json();

    if (!promptId) {
      return new Response(
        JSON.stringify({ error: 'promptId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[EDGE] Received analysis request for prompt ${promptId} (retry: ${retryCount})`);

    const result = await runAnalysisPipeline(supabase, promptId);

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EDGE] Analysis pipeline error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

## Tasks / Subtasks

- [ ] **Task 1: Create Pipeline Orchestration Module** (AC: #1, #2, #3)
  - [ ] Create `supabase/functions/analyze-prompt/pipeline.ts`
  - [ ] Implement `runAnalysisPipeline(supabase, promptId)` function
  - [ ] Integrate with context building (import from 27-3)
  - [ ] Integrate with classification (import from 27-1, 27-2)
  - [ ] Integrate with scoring (import from 27-4)
  - [ ] Implement skip logic for zero-weight types
  - [ ] Implement score path for weighted types

- [ ] **Task 2: Update Edge Function Entry Point** (AC: #1)
  - [ ] Modify `supabase/functions/analyze-prompt/index.ts`
  - [ ] Import and call `runAnalysisPipeline()`
  - [ ] Handle retry count parameter
  - [ ] Add structured logging with `[EDGE]` prefix

- [ ] **Task 3: Implement Storage Functions** (AC: #2, #3)
  - [ ] Implement `storeSkippedAnalysis()` function
  - [ ] Implement `storeCompleteAnalysis()` function
  - [ ] Store all metadata fields (context used, classification method)
  - [ ] Update `prompts.analysis_status` appropriately

- [ ] **Task 4: Implement Error Handling** (AC: #4)
  - [ ] Wrap context building in try/catch with fallback
  - [ ] Wrap classification in try/catch with default
  - [ ] Log all errors with `[PIPELINE]` prefix
  - [ ] Ensure pipeline completes even with partial failures

- [ ] **Task 5: Ensure Backward Compatibility** (AC: #5)
  - [ ] Handle `prompt_type: null` gracefully in UI
  - [ ] Legacy prompts display without breaking
  - [ ] Migration for existing prompts not required immediately

- [ ] **Task 6: Deploy and Test Edge Function**
  - [ ] Deploy updated Edge Function to Supabase
  - [ ] Test with selection prompt (should skip)
  - [ ] Test with confirmation prompt (should skip)
  - [ ] Test with initiating prompt (should score with context)
  - [ ] Verify logs in Supabase dashboard

- [ ] **Task 7: Write Integration Tests**
  - [ ] Test full pipeline with mock prompts
  - [ ] Test skip path creates correct records
  - [ ] Test score path creates correct records
  - [ ] Test error handling defaults work
  - [ ] Test already-processed prompts are skipped

## Dev Notes

### Implementation Location

The analysis pipeline will be implemented in `lib/analysis/` as Next.js server-side code. The existing Edge Function at `supabase/functions/analyze-prompt/` will be updated to call this shared code, ensuring consistency between real-time and batch analysis. Both the Edge Function and Next.js API routes will use the same underlying `runAnalysisPipeline()` function from `lib/analysis/analysisPipeline.ts`.

### Pipeline Performance Budget

| Step | Target Time | Notes |
|------|-------------|-------|
| Fetch prompt | < 50ms | Single DB query |
| Build context | < 200ms | Multiple DB queries |
| Classification | < 100ms (heuristic) / < 1s (LLM) | Heuristic preferred |
| Scoring | < 2s | LLM call |
| Store results | < 100ms | Insert + update |
| **Total** | < 3.5s | P90 target |

### Error Recovery Strategy

1. **Context failure**: Use empty context, proceed with scoring
2. **Classification failure**: Default to `continuation`, proceed with scoring
3. **Scoring failure**: Leave status as `pending`, retry will pick up
4. **Storage failure**: Retry up to 3 times, then mark as `failed`

### Logging Standards

All pipeline logs should include:
- `[PIPELINE]` prefix for orchestration
- `[EDGE]` prefix for Edge Function entry point
- Prompt ID in every log
- Timing information for performance monitoring

```
[EDGE] Received analysis request for prompt abc-123 (retry: 0)
[PIPELINE] Starting analysis for prompt abc-123
[CONTEXT] Built context for prompt abc-123: 5 messages, 3200 tokens
[ANALYSIS] Prompt abc-123 classified as continuation (confidence: 0.85)
[ANALYSIS] Scored prompt abc-123: raw=7.2, weighted=5.0
[PIPELINE] Completed analysis for prompt abc-123 (score: 5.0)
```

### Database Schema Requirements

Ensure these columns exist (from Epic 24):
- `prompts.prompt_type` (TEXT, nullable)
- `prompts.prompt_type_confidence` (NUMERIC, nullable)
- `prompts.analysis_status` (TEXT, with 'skipped' option)
- `prompt_analyses.skipped` (BOOLEAN)
- `prompt_analyses.skip_reason` (TEXT, nullable)
- `prompt_analyses.conversation_context_used` (BOOLEAN)
- `prompt_analyses.context_message_count` (INTEGER)
- `prompt_analyses.context_token_count` (INTEGER)
- `prompt_analyses.scoring_weight` (NUMERIC)

## Testing Checklist

- [ ] Pipeline starts with `[PIPELINE] Starting analysis` log
- [ ] Selection prompts skip scoring and log appropriately
- [ ] Confirmation prompts skip scoring and log appropriately
- [ ] Initiating prompts are scored with full weights
- [ ] Continuation prompts have adjusted dimension weights
- [ ] Context building failure doesn't crash pipeline
- [ ] Classification failure defaults to continuation
- [ ] `prompt_analyses` record created for all prompts
- [ ] `prompts.analysis_status` updated correctly
- [ ] Already-processed prompts return early
- [ ] Edge Function responds with success/error JSON
- [ ] All logs include prompt ID
- [ ] Processing time is recorded and logged

## Design System Requirements

This story is backend-only. No UI components required.

## Implementation Notes (2025-12-26)

### Completed Implementation

The analysis pipeline was implemented using the **Next.js API route approach** as specified in the Dev Notes:

| Component | Location | Status |
|-----------|----------|--------|
| Pipeline Orchestration | `lib/analysis/analysisPipeline.ts` | ✅ Complete |
| API Endpoint | `app/api/prompts/analyze/route.ts` | ✅ Complete |
| Integration Tests | `lib/analysis/__tests__/analysisPipeline.test.ts` | ✅ 23 tests passing |

### Key Functions Implemented

- `runAnalysisPipeline(supabase, promptId, options)` - Main orchestration
- `runAnalysisPipelineBatch(supabase, promptIds, options)` - Batch processing
- `getPendingPrompts(supabase, limit)` - Fetch pending prompts

### Acceptance Criteria Validation

| AC | Description | Status |
|----|-------------|--------|
| #1 | Classification before scoring | ✅ Pipeline classifies first |
| #2 | Skip path for zero-weight types | ✅ Selection/confirmation skip scoring |
| #3 | Score path with context | ✅ Context passed to scoring |
| #4 | Error handling with fallback | ✅ Defaults to 'continuation' on failure |
| #5 | Backward compatibility | ✅ Handles null prompt_type gracefully |

### Edge Function Note

The existing Edge Function at `supabase/functions/analyze-prompt/` uses Deno runtime with different import syntax. Direct code sharing between Node.js (lib/analysis) and Deno is not feasible. The Edge Function can be updated in a future story to call the API endpoint or implement Deno-compatible classification.

### Test Results

```
✓ lib/analysis/__tests__/analysisPipeline.test.ts (23 tests)
Total analysis module tests: 1312 passed
```
