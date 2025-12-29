# Story 27-2: Heuristic Classification

Status: Complete

## Story

**As a** system,
**I want** to classify prompts using fast pattern matching,
**So that** most prompts are classified without LLM calls.

## Dependencies

- **Story 27-1**: Prompt Classification Service (defines interfaces)

## Background

Heuristic classification handles the common cases quickly and cheaply. Research shows that ~70% of prompts fall into clear patterns that can be detected with regex and simple rules. This story implements those patterns.

## Acceptance Criteria

1. **Confirmation Pattern Detection** - DONE
   - **Given** a prompt like "yes", "proceed", "go ahead", "do it", "sounds good"
   - **When** `classifyByHeuristics()` is called
   - **Then** it returns `{ promptType: 'confirmation', confidence: 0.9 }`
   - **And** case-insensitive matching is used
   - **And** minor punctuation variations are handled (e.g., "Yes.", "yes!")

2. **Selection Pattern Detection** - DONE
   - **Given** a prompt like "Option 2", "#1", "the second one", "B"
   - **When** the previous response contained numbered/lettered options
   - **Then** it returns `{ promptType: 'selection', confidence: 0.95 }`
   - **And** the pattern matches the format of presented options

3. **Correction Pattern Detection** - DONE
   - **Given** a prompt containing "no,", "instead", "actually", "wrong", "that's not"
   - **When** `classifyByHeuristics()` is called
   - **Then** it returns `{ promptType: 'correction', confidence: 0.85 }`
   - **And** the pattern must be at word boundaries (not "economy" matching "no")

4. **Initiating Detection (First Message)** - DONE
   - **Given** a prompt that is the first message in a session
   - **When** `context.messageIndex === 0`
   - **Then** it returns `{ promptType: 'initiating', confidence: 0.95 }`
   - **And** no other pattern matching is needed

5. **Clarification Pattern Detection** - DONE
   - **Given** a prompt ending with "?" containing "why", "how", "explain", "what does"
   - **When** `classifyByHeuristics()` is called
   - **Then** it returns `{ promptType: 'clarification', confidence: 0.8 }`
   - **And** the prompt is asking about the AI's previous response

6. **Default Continuation** - DONE
   - **Given** a prompt that matches no specific patterns
   - **When** `classifyByHeuristics()` is called
   - **Then** it returns `{ promptType: 'continuation', confidence: 0.6 }`
   - **And** this low confidence triggers LLM fallback in Story 27-1

## Implementation Summary

### Files Created

| File | Purpose |
|------|---------|
| `lib/types/conversation-classification.ts` | Type definitions for classification |
| `lib/analysis/classificationPatterns.ts` | All heuristic patterns and matching logic |
| `lib/analysis/optionExtractor.ts` | Extract options from AI responses |
| `lib/analysis/__tests__/classificationPatterns.test.ts` | 173 unit tests |
| `lib/analysis/__tests__/optionExtractor.test.ts` | 51 unit tests |

### Key Functions

```typescript
// Main classification function
function classifyByHeuristics(
  prompt: string,
  context: ConversationContext
): ConversationClassificationResult;

// Extract options from AI responses for context-aware selection detection
function extractOptionsFromResponse(responseText: string | undefined): string[];

// Check if response has options (quick check)
function hasOptions(responseText: string | undefined): boolean;
```

### Classification Types

```typescript
type ConversationPromptType =
  | 'initiating'    // First message in session
  | 'confirmation'  // Agreeing or approving
  | 'selection'     // Choosing from options
  | 'correction'    // Correcting the AI
  | 'clarification' // Asking for explanation
  | 'continuation'; // Default/follow-up

interface ConversationClassificationResult {
  promptType: ConversationPromptType;
  confidence: number;
  method: 'heuristic' | 'llm';
  matchedPattern?: string;
}
```

### Confidence Levels

| Type | Confidence | Trigger |
|------|------------|---------|
| Initiating | 0.95 | `messageIndex === 0` |
| Confirmation | 0.90 | Exact match or pattern |
| Selection | 0.95 | Numbered/lettered/ordinal pattern |
| Correction | 0.85 | Word boundary patterns |
| Clarification | 0.80 | Question with keywords |
| Continuation | 0.60 | Default (triggers LLM fallback) |

## Test Results

**224 tests passing:**

- Classification Types and Structure: 2 tests
- Initiating Detection: 3 tests
- Confirmation Detection: 47 tests (exact matches, case, punctuation, patterns)
- Selection Detection: 19 tests (numbered, lettered, ordinals, context)
- Correction Detection: 27 tests (patterns + word boundary tests)
- Clarification Detection: 11 tests
- Continuation Fallback: 9 tests
- Priority Order: 4 tests
- Helper Functions: 12 tests
- Edge Cases: 6 tests
- Performance: 2 tests
- Real-World Examples: 6 tests
- Validation Dataset: 1 test (80%+ accuracy)
- Option Extractor: 51 tests

### Performance

- Single classification: <1ms
- 1000 classifications: <100ms
- Option extraction: <1ms for typical responses

## Tasks / Subtasks

- [x] **Task 1: Create Pattern Definitions File** (AC: #1, #2, #3, #5)
  - [x] Create `lib/types/conversation-classification.ts`
  - [x] Create `lib/analysis/classificationPatterns.ts`
  - [x] Define `CONFIRMATION_EXACT_MATCHES` Set (36 entries)
  - [x] Define `CONFIRMATION_PATTERNS` regex array (11 patterns)
  - [x] Define `SELECTION_PATTERNS` regex array (7 patterns)
  - [x] Define `CORRECTION_INDICATORS` regex array (15 patterns with word boundaries)
  - [x] Define `CLARIFICATION_PATTERNS` regex array (11 patterns)
  - [x] Add comments documenting each pattern's purpose

- [x] **Task 2: Implement Classification Logic** (AC: #1-6)
  - [x] Implement `classifyByHeuristics(prompt, context)` function
  - [x] Implement `normalizePrompt()` for consistent matching
  - [x] Implement `isConfirmation()` with exact match fast path
  - [x] Implement `isSelection()` with context awareness
  - [x] Implement `isCorrection()` with word boundary checks
  - [x] Implement `isClarification()` with question detection
  - [x] Return correct confidence levels per classification

- [x] **Task 3: Create Option Extractor** (AC: #2)
  - [x] Create `lib/analysis/optionExtractor.ts`
  - [x] Implement `extractOptionsFromResponse()` function
  - [x] Handle numbered lists (1. 2. 3.)
  - [x] Handle lettered lists (A. B. C.)
  - [x] Handle labeled options (Option 1:, Choice A:)
  - [x] Handle bullet options (- Option 1:)
  - [x] Return deduplicated option list
  - [x] Implement `extractOptionsWithMetadata()` for detailed analysis
  - [x] Implement `hasOptions()` for quick checks

- [x] **Task 4: Write Comprehensive Unit Tests**
  - [x] Test confirmation detection with all exact matches
  - [x] Test confirmation with punctuation variations
  - [x] Test selection detection with context options
  - [x] Test selection without context (still detects clear patterns)
  - [x] Test correction detection at word boundaries
  - [x] Test that "economy" doesn't match correction ("no")
  - [x] Test first message always returns initiating
  - [x] Test clarification with question marks
  - [x] Test default continuation for ambiguous prompts
  - [x] Test option extraction from various response formats

- [x] **Task 5: Update Exports**
  - [x] Add exports to `lib/analysis/index.ts`

## Testing Checklist

- [x] "yes" returns confirmation with confidence >= 0.9
- [x] "Yes." returns confirmation (punctuation handled)
- [x] "YES" returns confirmation (case insensitive)
- [x] "Option 2" returns selection with confidence >= 0.9
- [x] "#1" returns selection
- [x] "the second one" returns selection
- [x] "no, use the other approach" returns correction
- [x] "economy" does NOT match correction pattern
- [x] "instead" in prompt returns correction
- [x] First message returns initiating regardless of content
- [x] "why did you do that?" returns clarification
- [x] Random long prompt returns continuation with low confidence
- [x] Option extraction finds numbered options in response
- [x] Option extraction deduplicates results

## Design System Requirements

This story is backend-only. No UI components required.
