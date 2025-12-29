# Story 27-4: Context-Aware Scoring

Status: Complete

## Story

**As a** system,
**I want** to score prompts with awareness of conversation context,
**So that** scores reflect appropriate expectations for each prompt type.

## Dependencies

- **Story 27-1**: Prompt Classification Service (provides prompt type)
- **Story 27-2**: Heuristic Classification (provides patterns)
- **Story 27-3**: Context Building (provides conversation context)
- **Story 5.2**: 5-Dimension Scoring (existing scoring system to extend)

## Background

The existing scoring system evaluates prompts on 5 dimensions (Clarity, Context, Specificity, Goal, Constraints) without considering conversation flow. This creates problems:

1. **"Yes" gets low scores** - A confirmation prompt scores low on all dimensions
2. **"Use option 2" gets penalized** - Selection prompts lack context by design
3. **Continuation prompts miss credit** - Providing requested info builds on prior context

Context-aware scoring solves this by:
1. Skipping scoring entirely for selection/confirmation prompts
2. Adjusting dimension weights based on prompt type
3. Including conversation context in the analysis prompt

## Scoring Weight by Prompt Type

| Type | Overall Weight | Dimension Adjustments |
|------|---------------|----------------------|
| `initiating` | 100% | Standard weights |
| `continuation` | 70% | Context -50%, Goal +20% |
| `selection` | 0% (skip) | Not scored |
| `correction` | 80% | Clarity +30%, Context -20% |
| `confirmation` | 0% (skip) | Not scored |
| `clarification` | 60% | Specificity +40%, Constraints -30% |

## Acceptance Criteria

1. **Skip Scoring for Zero-Weight Types**
   - **Given** a prompt classified as `selection` or `confirmation`
   - **When** the scoring pipeline runs
   - **Then** no AI analysis is performed
   - **And** `prompts.analysis_status` is set to `'skipped'`
   - **And** `prompt_analyses` record has `skipped: true` and `skip_reason`
   - **And** log: `[ANALYSIS] Skipped scoring for prompt {id} (type: {type})`

2. **Context-Aware Analysis Prompt**
   - **Given** a prompt with scoring weight > 0
   - **When** the AI analyzer is called
   - **Then** the conversation context is included in the system prompt
   - **And** the prompt type is communicated to the AI
   - **And** type-specific dimension adjustments are applied

3. **Dimension Weight Adjustments**
   - **Given** a `continuation` type prompt
   - **When** dimension scores are calculated
   - **Then** Context dimension weight is reduced by 50%
   - **And** Goal dimension weight is increased by 20%
   - **And** the overall score reflects adjusted weights

4. **Weighted Overall Score**
   - **Given** dimension scores and a prompt type with weight < 100%
   - **When** the overall score is calculated
   - **Then** the raw overall is multiplied by the scoring weight
   - **And** both raw and weighted scores are stored
   - **And** `prompt_analyses.scoring_weight` is recorded

5. **Analysis Response Storage**
   - **Given** a successful context-aware analysis
   - **When** results are stored
   - **Then** `prompt_analyses.conversation_context_used` is `true`
   - **And** `prompt_analyses.prompt_type` matches the classification
   - **And** `prompt_analyses.context_message_count` records context size

## Technical Context

### File Locations

| File | Purpose |
|------|---------|
| `lib/analysis/contextAwareScoring.ts` | Main scoring with context |
| `lib/analysis/dimensionAdjustments.ts` | Type-specific weight adjustments |
| `lib/analysis/scoringPrompts.ts` | Context-aware prompt templates |
| `supabase/functions/analyze-prompt/index.ts` | Edge function (extend) |

### TypeScript Interfaces

```typescript
// lib/types/scoring.ts

export interface ScoringConfig {
  promptType: PromptType;
  scoringWeight: number;  // 0.0 - 1.0
  dimensionAdjustments: DimensionAdjustment[];
}

export interface DimensionAdjustment {
  dimension: 'clarity' | 'context' | 'specificity' | 'goal' | 'constraints';
  multiplier: number;  // e.g., 0.5 for -50%, 1.3 for +30%
}

export interface ContextAwareScoringResult {
  promptType: PromptType;
  skipped: boolean;
  skipReason?: string;
  rawScores?: DimensionScores;
  adjustedScores?: DimensionScores;
  rawOverall?: number;
  weightedOverall?: number;
  scoringWeight: number;
  contextUsed: {
    messageCount: number;
    tokenCount: number;
  };
}

export interface DimensionScores {
  clarity: number;
  context: number;
  specificity: number;
  goal: number;
  constraints: number;
}

export interface SkippedAnalysis {
  id: string;
  prompt_id: string;
  skipped: true;
  skip_reason: string;
  prompt_type: PromptType;
  created_at: string;
}
```

### Dimension Adjustments by Type

```typescript
// lib/analysis/dimensionAdjustments.ts

import { PromptType, ScoringConfig, DimensionAdjustment } from '@/lib/types/scoring';

const SCORING_CONFIGS: Record<PromptType, ScoringConfig> = {
  initiating: {
    promptType: 'initiating',
    scoringWeight: 1.0,
    dimensionAdjustments: [],  // Standard weights
  },

  continuation: {
    promptType: 'continuation',
    scoringWeight: 0.7,
    dimensionAdjustments: [
      { dimension: 'context', multiplier: 0.5 },   // -50%: Context was already established
      { dimension: 'goal', multiplier: 1.2 },      // +20%: Should clearly address the question
    ],
  },

  selection: {
    promptType: 'selection',
    scoringWeight: 0,  // Skip scoring
    dimensionAdjustments: [],
  },

  correction: {
    promptType: 'correction',
    scoringWeight: 0.8,
    dimensionAdjustments: [
      { dimension: 'clarity', multiplier: 1.3 },   // +30%: Must be clear about what's wrong
      { dimension: 'context', multiplier: 0.8 },   // -20%: Some context from prior exchange
    ],
  },

  confirmation: {
    promptType: 'confirmation',
    scoringWeight: 0,  // Skip scoring
    dimensionAdjustments: [],
  },

  clarification: {
    promptType: 'clarification',
    scoringWeight: 0.6,
    dimensionAdjustments: [
      { dimension: 'specificity', multiplier: 1.4 },  // +40%: Should ask specific questions
      { dimension: 'constraints', multiplier: 0.7 },  // -30%: Less relevant for questions
    ],
  },
};

export function getScoringConfig(promptType: PromptType): ScoringConfig {
  return SCORING_CONFIGS[promptType];
}

export function shouldSkipScoring(promptType: PromptType): boolean {
  return SCORING_CONFIGS[promptType].scoringWeight === 0;
}

export function getSkipReason(promptType: PromptType): string {
  switch (promptType) {
    case 'selection':
      return 'Selection prompts choose from presented options and are not independently scored';
    case 'confirmation':
      return 'Confirmation prompts approve AI actions and are not independently scored';
    default:
      return 'Prompt type excluded from scoring';
  }
}

export function applyDimensionAdjustments(
  rawScores: DimensionScores,
  adjustments: DimensionAdjustment[]
): DimensionScores {
  const adjusted = { ...rawScores };

  for (const adj of adjustments) {
    adjusted[adj.dimension] = Math.round(adjusted[adj.dimension] * adj.multiplier * 10) / 10;
    // Cap scores at 10
    adjusted[adj.dimension] = Math.min(10, adjusted[adj.dimension]);
  }

  return adjusted;
}
```

### Context-Aware Scoring Implementation

```typescript
// lib/analysis/contextAwareScoring.ts

import { buildConversationContext } from './conversationContext';
import { classifyPrompt } from './promptClassifier';
import { getScoringConfig, shouldSkipScoring, getSkipReason, applyDimensionAdjustments } from './dimensionAdjustments';
import { analyzeWithContext } from './scoringPrompts';
import { ContextAwareScoringResult, DimensionScores, SkippedAnalysis } from '@/lib/types/scoring';
import { createAdminClient } from '@/lib/supabase/admin';

export async function scorePromptWithContext(
  promptId: string,
  promptContent: string
): Promise<ContextAwareScoringResult> {
  const supabase = createAdminClient();

  // 1. Build conversation context
  const context = await buildConversationContext(promptId);

  // 2. Classify the prompt
  const classification = await classifyPrompt(promptContent, context);

  console.log(`[ANALYSIS] Prompt ${promptId} classified as ${classification.promptType} (confidence: ${classification.confidence})`);

  // 3. Check if scoring should be skipped
  if (shouldSkipScoring(classification.promptType)) {
    const skipReason = getSkipReason(classification.promptType);
    console.log(`[ANALYSIS] Skipped scoring for prompt ${promptId} (type: ${classification.promptType})`);

    // Store skipped analysis record
    await storeSkippedAnalysis(supabase, promptId, classification.promptType, skipReason);

    return {
      promptType: classification.promptType,
      skipped: true,
      skipReason,
      scoringWeight: 0,
      contextUsed: {
        messageCount: context.messages.length,
        tokenCount: context.totalTokens,
      },
    };
  }

  // 4. Get scoring config for this prompt type
  const config = getScoringConfig(classification.promptType);

  // 5. Perform AI analysis with context
  const rawScores = await analyzeWithContext(promptContent, context, classification.promptType);

  // 6. Apply dimension adjustments
  const adjustedScores = applyDimensionAdjustments(rawScores, config.dimensionAdjustments);

  // 7. Calculate overall scores
  const rawOverall = calculateOverall(rawScores);
  const adjustedOverall = calculateOverall(adjustedScores);
  const weightedOverall = Math.round(adjustedOverall * config.scoringWeight * 10) / 10;

  console.log(`[ANALYSIS] Scored prompt ${promptId}: raw=${rawOverall}, weighted=${weightedOverall}`);

  return {
    promptType: classification.promptType,
    skipped: false,
    rawScores,
    adjustedScores,
    rawOverall,
    weightedOverall,
    scoringWeight: config.scoringWeight,
    contextUsed: {
      messageCount: context.messages.length,
      tokenCount: context.totalTokens,
    },
  };
}

async function storeSkippedAnalysis(
  supabase: ReturnType<typeof createAdminClient>,
  promptId: string,
  promptType: PromptType,
  skipReason: string
): Promise<void> {
  const { error } = await supabase
    .from('prompt_analyses')
    .insert({
      prompt_id: promptId,
      skipped: true,
      skip_reason: skipReason,
      prompt_type: promptType,
      conversation_context_used: false,
    });

  if (error) {
    console.error(`[ANALYSIS] Failed to store skipped analysis:`, error);
  }

  // Update prompt status
  await supabase
    .from('prompts')
    .update({ analysis_status: 'skipped' })
    .eq('id', promptId);
}

function calculateOverall(scores: DimensionScores): number {
  // Use default weights: Clarity 25%, Context 25%, Specificity 20%, Goal 15%, Constraints 15%
  const weighted =
    scores.clarity * 0.25 +
    scores.context * 0.25 +
    scores.specificity * 0.20 +
    scores.goal * 0.15 +
    scores.constraints * 0.15;

  return Math.round(weighted * 10) / 10;
}
```

### Context-Aware Analysis Prompt

```typescript
// lib/analysis/scoringPrompts.ts

import { ConversationContext, PromptType } from '@/lib/types/classification';
import { DimensionScores } from '@/lib/types/scoring';

const CONTEXT_AWARE_SYSTEM_PROMPT = `You are a prompt quality analyst for AI-assisted development.

You are evaluating a prompt within a CONVERSATION CONTEXT. The prompt type has been classified as: {PROMPT_TYPE}

{TYPE_GUIDANCE}

Score the prompt on these 5 dimensions (1-10):
- Clarity: How clear and unambiguous is the request?
- Context: How much relevant background is provided? (Consider: prior messages may have provided context)
- Specificity: How specific are the requirements?
- Goal: How clearly is the desired outcome stated?
- Constraints: How well are limitations/boundaries defined?

IMPORTANT: Evaluate based on the prompt type:
- For 'initiating' prompts: Expect full context and clear goals
- For 'continuation' prompts: Context is already established; focus on clarity and addressing the AI's question
- For 'correction' prompts: Focus on clarity about what's wrong and what's expected instead
- For 'clarification' prompts: Focus on specificity of the question being asked

Respond with JSON only:
{
  "scores": {
    "clarity": <1-10>,
    "context": <1-10>,
    "specificity": <1-10>,
    "goal": <1-10>,
    "constraints": <1-10>
  },
  "reasoning": {
    "clarity": "<brief explanation>",
    "context": "<brief explanation>",
    "specificity": "<brief explanation>",
    "goal": "<brief explanation>",
    "constraints": "<brief explanation>"
  }
}`;

const TYPE_GUIDANCE: Record<PromptType, string> = {
  initiating: 'This is an INITIATING prompt that starts a new task. Full context and clear goals are expected.',
  continuation: 'This is a CONTINUATION prompt responding to the AI\'s question. Prior context has been established.',
  selection: 'This is a SELECTION prompt choosing from options. (Should not be scored)',
  correction: 'This is a CORRECTION prompt redirecting the AI. Focus on clarity about what\'s wrong.',
  confirmation: 'This is a CONFIRMATION prompt approving action. (Should not be scored)',
  clarification: 'This is a CLARIFICATION prompt asking for explanation. Focus on question specificity.',
};

export async function analyzeWithContext(
  promptContent: string,
  context: ConversationContext,
  promptType: PromptType
): Promise<DimensionScores> {
  const systemPrompt = CONTEXT_AWARE_SYSTEM_PROMPT
    .replace('{PROMPT_TYPE}', promptType.toUpperCase())
    .replace('{TYPE_GUIDANCE}', TYPE_GUIDANCE[promptType]);

  const userPrompt = buildUserPrompt(promptContent, context);

  const response = await callOpenAI({
    model: 'gpt-4o-mini',
    systemPrompt,
    userPrompt,
    temperature: 0,
    maxTokens: 500,
  });

  return parseScoresResponse(response);
}

function buildUserPrompt(promptContent: string, context: ConversationContext): string {
  let conversationSection = '';

  if (context.messages.length > 0) {
    conversationSection = `
## Conversation Context (${context.messages.length} prior messages)

${formatMessages(context.messages)}

---
`;
  }

  if (context.lastResponse) {
    conversationSection += `
## Last AI Response Summary
- Asked a question: ${context.lastResponse.askedQuestion}
- Presented options: ${context.lastResponse.presentedOptions.length > 0 ? context.lastResponse.presentedOptions.join(', ') : 'None'}
- Tools used: ${context.lastResponse.toolsUsed.join(', ') || 'None'}
- Text: "${context.lastResponse.text}"

---
`;
  }

  return `${conversationSection}
## Prompt to Evaluate (Message #${context.messageIndex + 1} in session)

"${promptContent}"

Score this prompt.`;
}

function formatMessages(messages: ConversationMessage[]): string {
  return messages
    .slice(-10)  // Last 10 messages for prompt
    .map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`)
    .join('\n\n');
}

function parseScoresResponse(response: string): DimensionScores {
  try {
    const parsed = JSON.parse(response);
    const scores = parsed.scores;

    // Validate each dimension
    const dimensions = ['clarity', 'context', 'specificity', 'goal', 'constraints'] as const;
    const result: DimensionScores = {
      clarity: 5,
      context: 5,
      specificity: 5,
      goal: 5,
      constraints: 5,
    };

    for (const dim of dimensions) {
      const score = scores[dim];
      if (typeof score === 'number' && score >= 1 && score <= 10) {
        result[dim] = Math.round(score);
      } else {
        console.warn(`[ANALYSIS] Invalid score for ${dim}: ${score}, using default 5`);
      }
    }

    return result;
  } catch (error) {
    console.error('[ANALYSIS] Failed to parse AI response:', error);
    throw new Error('Failed to parse dimension scores from AI response');
  }
}
```

## Tasks / Subtasks

- [x] **Task 1: Create Scoring Types** (AC: #4, #5)
  - [x] Create `lib/types/scoring.ts`
  - [x] Define `ScoringConfig` interface
  - [x] Define `DimensionAdjustment` interface
  - [x] Define `ContextAwareScoringResult` interface
  - [x] Define `SkippedAnalysis` interface

- [x] **Task 2: Implement Dimension Adjustments** (AC: #3)
  - [x] Create `lib/analysis/dimensionAdjustments.ts`
  - [x] Define `SCORING_CONFIGS` for all prompt types
  - [x] Implement `getScoringConfig(promptType)` function
  - [x] Implement `shouldSkipScoring(promptType)` function
  - [x] Implement `getSkipReason(promptType)` function
  - [x] Implement `applyDimensionAdjustments()` function

- [x] **Task 3: Create Context-Aware Scoring Service** (AC: #1, #2, #4)
  - [x] Create `lib/analysis/contextAwareScoring.ts`
  - [x] Implement `scorePromptWithContext(promptId, content)` function
  - [x] Integrate with context building (27-3)
  - [x] Integrate with classification (27-1)
  - [x] Handle skip logic for zero-weight types
  - [x] Calculate raw and weighted overall scores
  - [x] Add structured logging with `[ANALYSIS]` prefix

- [x] **Task 4: Create Context-Aware Prompts** (AC: #2)
  - [x] Create `lib/analysis/scoringPrompts.ts`
  - [x] Define `CONTEXT_AWARE_SYSTEM_PROMPT` template
  - [x] Define `TYPE_GUIDANCE` per prompt type
  - [x] Implement `analyzeWithContext()` function
  - [x] Implement `buildUserPrompt()` with context formatting
  - [x] Implement `parseScoresResponse()` with validation

- [x] **Task 5: Add Database Storage for Skipped Analysis** (AC: #1, #5)
  - [x] Implement `storeSkippedAnalysis()` function
  - [x] Create `prompt_analyses` record with `skipped: true`
  - [x] Store `skip_reason` and `prompt_type`
  - [x] Update `prompts.analysis_status` to `'skipped'`

- [x] **Task 6: Write Unit Tests**
  - [x] Test skipping for selection prompts
  - [x] Test skipping for confirmation prompts
  - [x] Test dimension adjustments for continuation
  - [x] Test dimension adjustments for correction
  - [x] Test weighted overall calculation
  - [x] Test context inclusion in AI prompt
  - [x] Test score parsing with valid/invalid responses
  - [x] Test database storage for skipped analysis

## Dev Notes

### Dimension Adjustment Rationale

**Continuation Prompts (-50% Context, +20% Goal):**
- Context was established in prior messages, so less context needed now
- But the prompt should clearly address what the AI asked

**Correction Prompts (+30% Clarity, -20% Context):**
- Must be crystal clear about what's wrong
- Some context inherited from what you're correcting

**Clarification Prompts (+40% Specificity, -30% Constraints):**
- Questions should be specific about what you want explained
- Constraints less relevant when asking for information

### Weighted Score Calculation

```
Raw Overall = weighted avg of dimension scores (standard weights)
Adjusted Overall = weighted avg of adjusted dimension scores
Weighted Overall = Adjusted Overall * scoringWeight

Example for continuation prompt:
- Raw scores: Clarity 8, Context 5, Specificity 7, Goal 8, Constraints 6
- Raw Overall = 8*0.25 + 5*0.25 + 7*0.20 + 8*0.15 + 6*0.15 = 6.75
- After adjustments (Context *0.5, Goal *1.2):
  - Context: 5 * 0.5 = 2.5
  - Goal: 8 * 1.2 = 9.6 (capped at 10)
- Adjusted Overall = 8*0.25 + 2.5*0.25 + 7*0.20 + 9.6*0.15 + 6*0.15 = 6.56
- Weighted Overall = 6.56 * 0.7 = 4.59
```

### Performance Considerations

1. **Parallel classification and context building** - Can run concurrently
2. **Skip AI call for zero-weight types** - Immediate return for selection/confirmation
3. **Smaller context window** - Only last 10 messages in AI prompt

## Testing Checklist

- [x] Selection prompts return `skipped: true`
- [x] Confirmation prompts return `skipped: true`
- [x] Skip reason is stored in database
- [x] Prompt status updated to 'skipped' for zero-weight types
- [x] Continuation prompts have reduced context weight
- [x] Correction prompts have increased clarity weight
- [x] Dimension scores capped at 10 after adjustment
- [x] Weighted overall reflects scoring weight multiplier
- [x] Context included in AI analysis prompt
- [x] Prompt type guidance included in system prompt
- [x] All dimension scores validated (1-10 range)
- [x] Invalid AI responses handled gracefully

## Design System Requirements

This story is backend-only. No UI components required.

---

## Dev Agent Record

**Agent:** Amelia (Developer Agent)
**Model:** Claude Opus 4.5
**Date Completed:** 2025-12-26

### Implementation Notes

Most of the story was implemented by a prior agent session. This session:
1. Validated existing implementation for Tasks 1-4 and Task 6
2. Implemented Task 5 (Database Storage for Skipped Analysis):
   - Created migration `20251226110000_add_skipped_analysis_support.sql`
   - Added columns: `skipped`, `skip_reason`, `prompt_type`, `conversation_context_used`, `context_message_count`
   - Created `store_skipped_analysis()` database function
   - Updated `store_analysis_result()` with new parameters
   - Created `lib/analysis/skippedStorage.ts` with TypeScript functions
   - Created comprehensive test suite (24 tests)

### Test Results

| Test File | Tests | Status |
|-----------|-------|--------|
| `dimensionAdjustments.test.ts` | 82 | ✅ Pass |
| `contextAwareScoring.test.ts` | 62 | ✅ Pass |
| `skippedStorage.test.ts` | 24 | ✅ Pass |
| **Total** | **168** | ✅ **All Pass** |

### Files Created/Modified

**New Files:**
- `app/supabase/migrations/20251226110000_add_skipped_analysis_support.sql`
- `app/lib/analysis/skippedStorage.ts`
- `app/lib/analysis/__tests__/skippedStorage.test.ts`

**Pre-existing Implementation (validated):**
- `app/lib/types/scoring.ts` (294 lines)
- `app/lib/analysis/dimensionAdjustments.ts` (409 lines)
- `app/lib/analysis/contextAwareScoring.ts` (443 lines)
- `app/lib/analysis/scoringPrompts.ts` (437 lines)
- `app/lib/analysis/__tests__/dimensionAdjustments.test.ts` (857 lines)
- `app/lib/analysis/__tests__/contextAwareScoring.test.ts` (803 lines)
