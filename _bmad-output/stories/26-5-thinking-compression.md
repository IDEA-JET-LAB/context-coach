# Story 26-5: Thinking Compression

Status: Complete

## Story

**As a** Contextor system,
**I want** to compress extended thinking content to a configurable length,
**So that** thinking summaries can be stored efficiently while preserving key insights.

## Background

Claude's extended thinking can be substantial - often thousands of words for complex tasks. Storing full thinking content would:

1. Consume excessive database storage
2. Slow down API responses
3. Overwhelm the UI with text

This story implements intelligent compression that:
- Truncates to a configurable length (default 500 chars)
- Breaks at sentence boundaries when possible
- Preserves the original word count for analytics
- Provides a meaningful summary preview

## Acceptance Criteria

1. **Length-Based Truncation**
   - [x] **Given** thinking content longer than the limit
   - [x] **When** compressing
   - [x] **Then** the result is at most `maxLength` characters
   - [x] **And** the original word count is preserved

2. **Sentence Boundary Breaking**
   - [x] **Given** thinking content that can break at a sentence
   - [x] **When** compressing
   - [x] **Then** truncation occurs at the last complete sentence within the limit
   - [x] **And** no trailing ellipsis is needed if breaking at sentence

3. **Word Boundary Fallback**
   - [x] **Given** thinking content with no sentence break within limit
   - [x] **When** compressing
   - [x] **Then** truncation occurs at the last word boundary
   - [x] **And** "..." is appended to indicate truncation

4. **Short Content Passthrough**
   - [x] **Given** thinking content shorter than the limit
   - [x] **When** compressing
   - [x] **Then** the full content is returned unchanged
   - [x] **And** `truncated` flag is false

5. **Configurable Limit**
   - [x] **Given** a custom `maxLength` parameter
   - [x] **When** compressing
   - [x] **Then** the custom limit is respected
   - [x] **And** defaults to 500 characters if not specified

6. **Empty Input Handling**
   - [x] **Given** empty or null thinking content
   - [x] **When** compressing
   - [x] **Then** an empty summary is returned
   - [x] **And** word count is 0

## Tasks / Subtasks

- [x] **Task 1: Create compression module** (AC: #1-6)
  - [x] Create `lib/transcript/thinkingCompressor.ts`
  - [x] Define `ThinkingSummary` interface
  - [x] Export main `compressThinking()` function
  - [x] Add default `MAX_THINKING_LENGTH = 500` constant

- [x] **Task 2: Implement word count calculation** (AC: #1, #4)
  - [x] Create `countWords(text: string): number`
  - [x] Handle whitespace normalization
  - [x] Handle empty strings

- [x] **Task 3: Implement sentence boundary detection** (AC: #2)
  - [x] Create `findLastSentenceBoundary(text: string, maxIndex: number): number`
  - [x] Match sentence-ending punctuation (. ! ?)
  - [x] Return -1 if no boundary found within threshold

- [x] **Task 4: Implement word boundary detection** (AC: #3)
  - [x] Create `findLastWordBoundary(text: string, maxIndex: number): number`
  - [x] Match whitespace as word boundary
  - [x] Handle edge cases (no spaces)

- [x] **Task 5: Implement main compression function** (AC: #1-6)
  - [x] Check if content is within limit
  - [x] Try sentence boundary first
  - [x] Fall back to word boundary
  - [x] Append ellipsis if needed
  - [x] Return structured result

- [x] **Task 6: Add validation and edge cases** (AC: #6)
  - [x] Handle null/undefined input
  - [x] Handle empty string
  - [x] Handle whitespace-only input
  - [x] Handle very long words (no boundaries)

- [x] **Task 7: Write unit tests**
  - [x] Test short content passthrough
  - [x] Test sentence boundary truncation
  - [x] Test word boundary fallback
  - [x] Test ellipsis appending
  - [x] Test word count accuracy
  - [x] Test custom maxLength
  - [x] Test empty/null input
  - [x] Test edge cases

## Dev Notes

### ThinkingSummary Interface

```typescript
// lib/transcript/thinkingCompressor.ts

export interface ThinkingSummary {
  summary: string;           // Compressed content
  originalWordCount: number; // Word count of original
  truncated: boolean;        // Whether truncation occurred
}

export const MAX_THINKING_LENGTH = 500;
```

### Compression Algorithm

```typescript
// lib/transcript/thinkingCompressor.ts

/**
 * Compresses extended thinking content to a summary.
 *
 * Truncation strategy:
 * 1. If within limit, return unchanged
 * 2. Try to break at last sentence boundary (within 70% of limit)
 * 3. Fall back to word boundary with ellipsis
 *
 * @param thinkingContent - Full thinking text
 * @param maxLength - Maximum summary length (default 500)
 * @returns ThinkingSummary with compressed text and metadata
 */
export function compressThinking(
  thinkingContent: string | null | undefined,
  maxLength: number = MAX_THINKING_LENGTH
): ThinkingSummary {
  // Handle empty/null input
  if (!thinkingContent || thinkingContent.trim().length === 0) {
    return {
      summary: '',
      originalWordCount: 0,
      truncated: false,
    };
  }

  const originalWordCount = countWords(thinkingContent);

  // If content is within limit, return unchanged
  if (thinkingContent.length <= maxLength) {
    return {
      summary: thinkingContent,
      originalWordCount,
      truncated: false,
    };
  }

  // Try to break at sentence boundary
  const truncatedText = thinkingContent.substring(0, maxLength);
  const sentenceBoundary = findLastSentenceBoundary(truncatedText, maxLength);

  // Sentence boundary found within acceptable range (70% of limit)
  if (sentenceBoundary > maxLength * 0.7) {
    return {
      summary: thinkingContent.substring(0, sentenceBoundary + 1).trim(),
      originalWordCount,
      truncated: true,
    };
  }

  // Fall back to word boundary
  const wordBoundary = findLastWordBoundary(truncatedText, maxLength);

  if (wordBoundary > 0) {
    return {
      summary: thinkingContent.substring(0, wordBoundary).trim() + '...',
      originalWordCount,
      truncated: true,
    };
  }

  // No boundary found - hard truncate (rare edge case)
  return {
    summary: thinkingContent.substring(0, maxLength - 3).trim() + '...',
    originalWordCount,
    truncated: true,
  };
}

/**
 * Count words in text (whitespace-separated)
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Find the index of the last sentence-ending punctuation
 * Returns -1 if no sentence boundary found
 */
function findLastSentenceBoundary(text: string, maxIndex: number): number {
  // Look for . ! ? followed by space or end of string
  const sentenceEnders = /[.!?](?:\s|$)/g;
  let lastMatch = -1;
  let match;

  while ((match = sentenceEnders.exec(text)) !== null) {
    if (match.index < maxIndex) {
      lastMatch = match.index;
    } else {
      break;
    }
  }

  return lastMatch;
}

/**
 * Find the index of the last whitespace character
 * Returns -1 if no word boundary found
 */
function findLastWordBoundary(text: string, maxIndex: number): number {
  // Search backwards from maxIndex for whitespace
  for (let i = Math.min(maxIndex, text.length) - 1; i >= 0; i--) {
    if (/\s/.test(text[i])) {
      return i;
    }
  }
  return -1;
}
```

### Usage Examples

```typescript
import { compressThinking } from '@/lib/transcript/thinkingCompressor';

// Short content - unchanged
const short = compressThinking("Let me think about this.");
// { summary: "Let me think about this.", originalWordCount: 5, truncated: false }

// Long content - sentence boundary
const long = compressThinking("First, I'll analyze the code. Then I'll check for bugs. After that...");
// { summary: "First, I'll analyze the code. Then I'll check for bugs.", originalWordCount: 14, truncated: true }

// Long content - word boundary with ellipsis
const noSentence = compressThinking("analyzing the implementation of the function and checking all the variables", 50);
// { summary: "analyzing the implementation of the function...", originalWordCount: 12, truncated: true }

// Custom limit
const custom = compressThinking(longThinking, 1000);
// Uses 1000 char limit instead of default 500

// Empty input
const empty = compressThinking(null);
// { summary: '', originalWordCount: 0, truncated: false }
```

### Integration with Response Extraction

```typescript
// lib/transcript/extractResponse.ts

import { compressThinking } from './thinkingCompressor';

function extractThinkingContent(content: ContentBlock[]): ThinkingResult | null {
  const thinkingBlocks = content
    .filter(block => block.type === 'thinking')
    .map(block => block.thinking);

  if (thinkingBlocks.length === 0) {
    return null;
  }

  const fullText = thinkingBlocks.join('\n');
  const { summary, originalWordCount, truncated } = compressThinking(fullText);

  return {
    summary,
    wordCount: originalWordCount,
    fullText,          // Keep full text for optional storage
    truncated,
  };
}
```

### Configuration Options

For future flexibility, the compression can be configured:

```typescript
// lib/config/analysis.ts (future)

export const analysisConfig = {
  thinking: {
    maxSummaryLength: 500,        // Configurable via admin
    sentenceThreshold: 0.7,       // Minimum % for sentence break
  }
};

// Usage with config
compressThinking(content, analysisConfig.thinking.maxSummaryLength);
```

### Test Fixtures

```typescript
// __tests__/fixtures/thinkingContent.ts

export const shortThinking = "Let me check this quickly.";

export const mediumThinking = `
Let me analyze this code step by step. First, I'll look at the function signature.
Then I'll trace the data flow through the implementation. After that, I'll identify
any potential issues or optimizations.
`;

export const longThinking = `
This is a complex problem that requires careful analysis. First, I need to understand
the current architecture and how data flows through the system. The main entry point
appears to be the API handler, which validates input and routes to the appropriate
service. From there, the service layer performs business logic before persisting
to the database. There are several potential issues I can see...
[continues for 2000+ characters]
`;

export const noSentenceThinking =
  "analyzing code reviewing implementation checking variables validating output testing edge cases";

export const edgeCaseThinking = {
  empty: "",
  whitespace: "   \n\t  ",
  onlyPunctuation: "... !!! ???",
  singleWord: "thinking",
  noSpaces: "a".repeat(1000),
};
```

### Test Scenarios

| Scenario | Input | Expected |
|----------|-------|----------|
| Short content | "Quick thought." | Returns unchanged, truncated: false |
| Sentence boundary | "First sentence. Second sentence. Third..." | Breaks at sentence, no ellipsis |
| Word boundary | "Long text without sentence end" | Breaks at word, adds "..." |
| Custom limit | content, 100 | Uses 100 char limit |
| Empty string | "" | summary: "", wordCount: 0 |
| Null input | null | summary: "", wordCount: 0 |
| Whitespace only | "   " | summary: "", wordCount: 0 |
| No boundaries | "aaa...aaa" (1000 a's) | Hard truncate at limit-3 |
| Exactly at limit | 500 chars exactly | Returns unchanged |
| One char over | 501 chars | Truncates |

### Performance Considerations

The compression algorithm is designed for efficiency:

1. **Single pass for word count**: O(n) where n is content length
2. **Single pass for sentence boundary**: O(n) regex match
3. **Backward search for word boundary**: O(limit) in worst case
4. **No string allocations until final result**: Minimizes memory

For typical thinking content (1000-5000 chars), compression should complete in < 1ms.

### Verification Checklist

- [ ] `compressThinking` returns correct structure
- [ ] Short content passes through unchanged
- [ ] Long content truncates at sentence boundary
- [ ] Word boundary fallback works
- [ ] Ellipsis appended when word boundary used
- [ ] Word count is accurate
- [ ] Empty/null input handled gracefully
- [ ] Custom maxLength respected
- [ ] Sentence boundary threshold (70%) works
- [ ] No boundary edge case handled
- [ ] Unit tests cover all scenarios
- [ ] Performance acceptable (< 1ms for typical input)

### Dependencies

None - this is a standalone utility module.

### Future Enhancements

1. **Semantic Compression**: Use LLM to generate true summaries (Phase 4)
2. **Key Phrase Extraction**: Identify important terms to preserve
3. **Configurable Thresholds**: Admin-adjustable compression settings
4. **Full Text Storage Option**: Team setting to store complete thinking

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Implemented full thinking compression module with all required functions
2. Created comprehensive unit test suite with 63 tests covering all edge cases
3. Maintained backward compatibility by keeping legacy `ThinkingCompressionResult` interface
4. All acceptance criteria verified and passing
5. Exported module through `lib/transcript/index.ts`

### Verification Checklist

- [x] `compressThinking` returns correct structure
- [x] Short content passes through unchanged
- [x] Long content truncates at sentence boundary
- [x] Word boundary fallback works
- [x] Ellipsis appended when word boundary used
- [x] Word count is accurate
- [x] Empty/null input handled gracefully
- [x] Custom maxLength respected
- [x] Sentence boundary threshold (70%) works
- [x] No boundary edge case handled
- [x] Unit tests cover all scenarios (63 tests)
- [x] Performance acceptable (< 1ms for typical input)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-25 | Story created | PM Agent |
| 2025-12-26 | Implementation complete with 63 unit tests | Dev Agent (Claude Opus 4.5) |

### File List

**Created:**
- `app/lib/transcript/thinkingCompressor.ts` - Main compression module
- `app/lib/transcript/__tests__/thinkingCompressor.test.ts` - Unit tests (63 tests)

**Modified:**
- `app/lib/transcript/index.ts` - Added exports for thinking compressor module
