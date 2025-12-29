# Story 27-1: Prompt Classification Service

Status: Complete (Task 4 deferred to Story 27-5)

## Story

**As a** system,
**I want** to classify each prompt by its conversational role,
**So that** prompts can be scored appropriately based on their context.

## Dependencies

- **Epic 24**: Schema Extensions (prompt_type column exists)
  - Requires these columns from Story 24-2: `prompts.prompt_type`, `prompts.prompt_type_confidence`, `prompts.detected_stage`, `prompts.is_in_debugging_loop`
- **Epic 25**: Conversations API (context endpoint available)
- **Story 27-2**: Heuristic Classification (provides fast path)
- **Story 27-3**: Context Building (provides conversation context)

## Background

Not all prompts should be scored equally. A "Yes" confirming Claude's question is a valid response that shouldn't be penalized for lacking context. The classification service determines prompt type to:
1. Skip scoring for selection/confirmation prompts (scoringWeight = 0)
2. Apply weighted scoring adjustments for other types
3. Provide context-aware analysis

## Prompt Type Classification Table

| Type | Description | Scoring Weight | When to Apply |
|------|-------------|----------------|---------------|
| `initiating` | Starts new task or topic | 100% | First in session, or topic change |
| `continuation` | Provides requested information | 70% | Follows LLM question |
| `selection` | Chooses from presented options | 0% (skip) | Short, matches option pattern |
| `correction` | Redirects or corrects LLM | 80% | Contains negation, "instead" |
| `confirmation` | Approves to proceed | 0% (skip) | "yes", "proceed", "go ahead" |
| `clarification` | Asks for explanation | 60% | Question format, "explain" |

## Acceptance Criteria

1. **Classification Service Created**
   - **Given** the prompt classification service at `lib/analysis/promptClassifier.ts`
   - **When** `classifyPrompt(prompt, context)` is called
   - **Then** it returns `ClassificationResult` with type, confidence, and scoringWeight
   - **And** confidence is a number between 0.0 and 1.0
   - **And** scoringWeight matches the table above

2. **Heuristic-First Strategy**
   - **Given** a prompt to classify
   - **When** heuristic classification returns confidence > 0.9
   - **Then** the heuristic result is returned immediately
   - **And** no LLM call is made (cost optimization)

3. **LLM Fallback Classification**
   - **Given** a prompt where heuristic confidence <= 0.9
   - **When** LLM classification is needed
   - **Then** conversation context is included in the prompt
   - **And** the LLM returns type and reasoning
   - **And** LLM response is parsed and validated

4. **Classification Stored in Database**
   - **Given** a successful classification
   - **When** the prompt is updated
   - **Then** `prompts.prompt_type` is set to the classification type
   - **And** `prompts.prompt_type_confidence` is set to the confidence score
   - **And** log format: `[ANALYSIS] Classified prompt {id} as {type} (confidence: {score})`

5. **Scoring Weight Applied**
   - **Given** a classified prompt
   - **When** scoring weight is determined
   - **Then** selection and confirmation types return `scoringWeight: 0`
   - **And** other types return their respective weights from the table
   - **And** weight is used by Story 27-4 for adjusted scoring

## Technical Context

### File Locations

| File | Purpose |
|------|---------|
| `lib/analysis/promptClassifier.ts` | Main classification service |
| `lib/analysis/classificationPatterns.ts` | Heuristic patterns (from 27-2) |
| `lib/analysis/llmClassifier.ts` | LLM-based classification |
| `lib/types/classification.ts` | TypeScript interfaces |

### TypeScript Interfaces

```typescript
// lib/types/classification.ts

export type PromptType =
  | 'initiating'
  | 'continuation'
  | 'selection'
  | 'correction'
  | 'confirmation'
  | 'clarification';

export interface ClassificationResult {
  promptType: PromptType;
  confidence: number;  // 0.0 - 1.0
  scoringWeight: number;  // 0.0 - 1.0
  reasoning?: string;  // Optional explanation
  method: 'heuristic' | 'llm';  // How classification was made
}

export interface ConversationContext {
  sessionId: string;
  messageIndex: number;  // 0 = first message
  messages: ConversationMessage[];
  lastResponse?: ResponseSummary;
  lastResponseOptions?: string[];  // Extracted options like "1.", "A)", etc.
  tokenBudget: number;
  totalTokens: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  promptType?: PromptType;  // For user messages
  truncated: boolean;
  tokenCount: number;
}

export interface ResponseSummary {
  text: string;
  askedQuestion: boolean;
  presentedOptions: string[];
  toolsUsed: string[];
}
```

### Classification Service Implementation

```typescript
// lib/analysis/promptClassifier.ts

import { classifyByHeuristics } from './classificationPatterns';
import { classifyByLLM } from './llmClassifier';
import { ClassificationResult, ConversationContext, PromptType } from '@/lib/types/classification';

const SCORING_WEIGHTS: Record<PromptType, number> = {
  initiating: 1.0,
  continuation: 0.7,
  selection: 0,
  correction: 0.8,
  confirmation: 0,
  clarification: 0.6,
};

const HEURISTIC_CONFIDENCE_THRESHOLD = 0.9;

export async function classifyPrompt(
  prompt: string,
  context: ConversationContext
): Promise<ClassificationResult> {
  // 1. Try heuristic classification first (fast, free)
  const heuristicResult = classifyByHeuristics(prompt, context);

  if (heuristicResult.confidence > HEURISTIC_CONFIDENCE_THRESHOLD) {
    console.log(`[ANALYSIS] Heuristic classification: ${heuristicResult.promptType} (${heuristicResult.confidence})`);
    return {
      ...heuristicResult,
      scoringWeight: SCORING_WEIGHTS[heuristicResult.promptType],
      method: 'heuristic',
    };
  }

  // 2. Fall back to LLM classification
  console.log(`[ANALYSIS] Heuristic confidence low (${heuristicResult.confidence}), using LLM`);
  const llmResult = await classifyByLLM(prompt, context);

  return {
    ...llmResult,
    scoringWeight: SCORING_WEIGHTS[llmResult.promptType],
    method: 'llm',
  };
}

export function getScoringWeight(promptType: PromptType): number {
  return SCORING_WEIGHTS[promptType];
}

export function shouldSkipScoring(promptType: PromptType): boolean {
  return SCORING_WEIGHTS[promptType] === 0;
}
```

### LLM Classification Prompt

```typescript
// lib/analysis/llmClassifier.ts

const CLASSIFICATION_SYSTEM_PROMPT = `You are a conversation analyst classifying prompts in developer-AI interactions.

Given a prompt and its conversation context, classify it into one of these types:
- initiating: Starts a new task or introduces a new topic
- continuation: Provides information the AI requested
- selection: Chooses from options the AI presented (e.g., "Option 2", "the second one")
- correction: Redirects or corrects the AI's approach
- confirmation: Approves the AI to proceed (e.g., "yes", "go ahead")
- clarification: Asks the AI to explain something

Respond with JSON only:
{
  "promptType": "<type>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;

export async function classifyByLLM(
  prompt: string,
  context: ConversationContext
): Promise<ClassificationResult> {
  const userPrompt = buildClassificationPrompt(prompt, context);

  const response = await callOpenAI({
    model: 'gpt-4o-mini',  // Fast and cheap for classification
    systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0,  // Deterministic
    maxTokens: 150,
  });

  return parseClassificationResponse(response);
}

function buildClassificationPrompt(prompt: string, context: ConversationContext): string {
  let contextSection = '';

  if (context.lastResponse) {
    contextSection = `
Previous AI response summary:
- Text: "${context.lastResponse.text.slice(0, 200)}..."
- Asked a question: ${context.lastResponse.askedQuestion}
- Presented options: ${context.lastResponse.presentedOptions.join(', ') || 'None'}
`;
  }

  return `${contextSection}
Current prompt (message #${context.messageIndex + 1} in session):
"${prompt}"

Classify this prompt.`;
}
```

## Tasks / Subtasks

- [x] **Task 1: Create Type Definitions** (AC: #1)
  - [x] Create `lib/types/classification.ts` with all interfaces
  - [x] Define `PromptType` union type
  - [x] Define `ClassificationResult` interface
  - [x] Define `ConversationContext` interface (uses existing from conversation-classification.ts)
  - [x] Export scoring weight constants

- [x] **Task 2: Create Main Classification Service** (AC: #1, #2)
  - [x] Create `lib/analysis/promptClassifier.ts`
  - [x] Implement `classifyPrompt(prompt, context)` function
  - [x] Implement heuristic-first strategy with confidence threshold
  - [x] Add `getScoringWeight()` helper function
  - [x] Add `shouldSkipScoring()` helper function
  - [x] Add structured logging with `[ANALYSIS]` prefix

- [x] **Task 3: Create LLM Classifier** (AC: #3)
  - [x] Create `lib/analysis/llmClassifier.ts`
  - [x] Define classification system prompt
  - [x] Implement `classifyByLLM(prompt, context)` function
  - [x] Implement `buildClassificationPrompt()` for context formatting
  - [x] Implement `parseClassificationResponse()` with validation
  - [x] Handle LLM errors gracefully (fallback to heuristic result)

- [ ] **Task 4: Create Database Update Function** (AC: #4) - DEFERRED to Story 27-5
  - [ ] Create `lib/analysis/updatePromptClassification.ts`
  - [ ] Implement `updatePromptClassification(promptId, result)` function
  - [ ] Update `prompts.prompt_type` column
  - [ ] Update `prompts.prompt_type_confidence` column
  - [ ] Log classification result with standardized format

- [x] **Task 5: Write Unit Tests** (AC: #1, #2, #3, #5)
  - [x] Test `classifyPrompt()` with various prompt types
  - [x] Test heuristic-first strategy (mock heuristic to return high confidence)
  - [x] Test LLM fallback (mock heuristic to return low confidence)
  - [x] Test scoring weight lookup for all prompt types
  - [x] Test `shouldSkipScoring()` returns true for selection/confirmation
  - [x] Test LLM response parsing with valid and invalid responses

## Dev Notes

### Heuristic vs LLM Trade-offs

| Aspect | Heuristic | LLM |
|--------|-----------|-----|
| Speed | ~1ms | ~500-1000ms |
| Cost | Free | ~$0.0001 per classification |
| Accuracy | High for clear patterns | Higher for ambiguous cases |
| Coverage | ~70% of prompts | 100% of prompts |

### Classification Decision Tree

```
Is this the first message in session?
  YES -> initiating (confidence: 0.95)
  NO -> Continue...

Does prompt match confirmation pattern? (yes/proceed/go ahead)
  YES -> confirmation (confidence: 0.9)
  NO -> Continue...

Does prompt match selection pattern? (Option 2, #1, the second one)
  YES AND last response had options -> selection (confidence: 0.95)
  NO -> Continue...

Does prompt contain correction indicators? (no, instead, actually, wrong)
  YES -> correction (confidence: 0.85)
  NO -> Continue...

Is prompt a question? (ends with ?)
  YES AND asks for explanation -> clarification (confidence: 0.8)
  NO -> Continue...

Default -> continuation (confidence: 0.6) -> Use LLM for better classification
```

### Error Handling

| Error | Handling |
|-------|----------|
| LLM timeout | Return heuristic result with lower confidence |
| LLM parse error | Return heuristic result with lower confidence |
| Invalid prompt type from LLM | Map to closest valid type |
| Database update failure | Log error, retry, don't block analysis |

### Performance Considerations

1. **Cache conversation context** - Context building is expensive, cache per session
2. **Batch classifications** - If processing multiple prompts, batch LLM calls
3. **Short-circuit common cases** - Confirmation/selection patterns are fast to detect

## Testing Checklist

- [x] Classification service returns all required fields
- [x] Heuristic results skip LLM call when confidence > 0.9
- [x] LLM is called when heuristic confidence <= 0.9
- [x] All prompt types map to correct scoring weights
- [x] Selection returns scoringWeight: 0
- [x] Confirmation returns scoringWeight: 0
- [x] Initiating returns scoringWeight: 1.0
- [ ] Database updates correctly store type and confidence (deferred to Story 27-5)
- [x] Logging follows `[ANALYSIS]` prefix convention
- [x] LLM errors fall back to heuristic gracefully
- [x] Invalid LLM responses are handled without throwing

## Design System Requirements

This story is backend-only. No UI components required.
