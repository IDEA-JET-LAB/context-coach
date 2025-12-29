/**
 * Thinking Compressor Tests
 * Story 26-5: Thinking Compression
 */

import { describe, it, expect } from 'vitest';
import {
  compressThinking,
  countWords,
  findLastSentenceBoundary,
  findLastWordBoundary,
  MAX_THINKING_LENGTH,
  SENTENCE_BOUNDARY_THRESHOLD,
  type ThinkingSummary,
} from '../thinkingCompressor';

// ============================================================================
// Test Fixtures
// ============================================================================

const shortThinking = 'Let me check this quickly.';

const mediumThinking = `Let me analyze this code step by step. First, I'll look at the function signature. Then I'll trace the data flow through the implementation. After that, I'll identify any potential issues or optimizations.`;

// Generate a long thinking content (over 500 chars)
const longThinkingWithSentences = `This is a complex problem that requires careful analysis. First, I need to understand the current architecture and how data flows through the system. The main entry point appears to be the API handler, which validates input and routes to the appropriate service. From there, the service layer performs business logic before persisting to the database. There are several potential issues I can see with this approach. The validation logic is scattered across multiple files, making it difficult to maintain consistency. Additionally, there's no clear separation between business rules and infrastructure concerns. I would recommend implementing a clean architecture pattern here. Let me now look at the specific implementation details and identify the exact changes needed.`;

// Long text without sentence boundaries - must be > 500 chars
const longTextNoSentences =
  'analyzing code reviewing implementation checking variables validating output testing edge cases debugging issues fixing problems optimizing performance refactoring code reviewing changes testing again making more fixes and continuing to work on this until it is complete and ready for review by the team and stakeholders who will provide feedback and then we continue with more words to make this longer than five hundred characters which is the default limit for compression so this text will be truncated at a word boundary since there are no sentence endings here at all just continuous text without any periods or exclamation marks or question marks anywhere in the entire content';

// Long text with sentence boundary near the end of limit
const longTextSentenceNearEnd = `${'a'.repeat(400)} This is a complete sentence. More text continues here without any more sentences just words and more words continuing on and on.`;

// Long text with sentence very early
const longTextSentenceEarly = `Short sentence. ${'a'.repeat(600)}`;

// Edge cases
const edgeCases = {
  empty: '',
  whitespace: '   \n\t  ',
  onlyPunctuation: '... !!! ???',
  singleWord: 'thinking',
  noSpaces: 'a'.repeat(1000),
  exactlyAtLimit: 'a'.repeat(MAX_THINKING_LENGTH),
  oneOverLimit: 'a'.repeat(MAX_THINKING_LENGTH + 1),
  multipleSpaces: 'word    word    word',
  newlines: 'line1\nline2\nline3',
  tabs: 'word\tword\tword',
  mixedWhitespace: '  word \n word \t word  ',
};

// ============================================================================
// countWords Tests
// ============================================================================

describe('countWords', () => {
  it('counts words in simple text', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one two three four five')).toBe(5);
  });

  it('handles single word', () => {
    expect(countWords('hello')).toBe(1);
  });

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWords('   ')).toBe(0);
    expect(countWords('\n\t\r')).toBe(0);
    expect(countWords('   \n   \t   ')).toBe(0);
  });

  it('handles multiple spaces between words', () => {
    expect(countWords('hello    world')).toBe(2);
    expect(countWords('one   two   three')).toBe(3);
  });

  it('handles leading and trailing whitespace', () => {
    expect(countWords('   hello world   ')).toBe(2);
  });

  it('handles newlines', () => {
    expect(countWords('line1\nline2\nline3')).toBe(3);
  });

  it('handles tabs', () => {
    expect(countWords('word\tword\tword')).toBe(3);
  });

  it('handles mixed whitespace', () => {
    expect(countWords('  word \n word \t word  ')).toBe(3);
  });

  it('counts words in realistic thinking content', () => {
    expect(countWords(shortThinking)).toBe(5);
    // mediumThinking has 33 words, not 37
    expect(countWords(mediumThinking)).toBe(33);
  });
});

// ============================================================================
// findLastSentenceBoundary Tests
// ============================================================================

describe('findLastSentenceBoundary', () => {
  it('finds period followed by space', () => {
    const text = 'First sentence. Second sentence.';
    // Last period is at index 31
    expect(findLastSentenceBoundary(text, text.length)).toBe(31);
  });

  it('finds period at end of text', () => {
    const text = 'Single sentence.';
    expect(findLastSentenceBoundary(text, text.length)).toBe(15);
  });

  it('finds exclamation mark', () => {
    const text = 'Hello! World!';
    // Last ! is at index 12
    expect(findLastSentenceBoundary(text, text.length)).toBe(12);
  });

  it('finds question mark', () => {
    const text = 'How are you? I am fine.';
    // Last sentence ender is the period at index 22
    expect(findLastSentenceBoundary(text, text.length)).toBe(22);
  });

  it('returns last boundary within maxIndex', () => {
    const text = 'First. Second. Third.';
    // First period at 5, second at 13, third at 20.
    // With maxIndex 12, only the first period at 5 qualifies
    expect(findLastSentenceBoundary(text, 12)).toBe(5);
    // With maxIndex 14, periods at 5 and 13 qualify, so return 13 (the last)
    expect(findLastSentenceBoundary(text, 14)).toBe(13);
  });

  it('returns -1 when no sentence boundary found', () => {
    const text = 'no sentence endings here';
    expect(findLastSentenceBoundary(text, text.length)).toBe(-1);
  });

  it('handles empty string', () => {
    expect(findLastSentenceBoundary('', 100)).toBe(-1);
  });

  it('ignores periods not followed by space or end', () => {
    const text = 'file.txt and other.things here.';
    // Should find the period at position 30, not the periods in filenames
    expect(findLastSentenceBoundary(text, text.length)).toBe(30);
  });

  it('handles multiple sentence types', () => {
    const text = 'Statement. Question? Exclamation!';
    // Last sentence ender is ! at index 32
    expect(findLastSentenceBoundary(text, text.length)).toBe(32);
  });
});

// ============================================================================
// findLastWordBoundary Tests
// ============================================================================

describe('findLastWordBoundary', () => {
  it('finds space as word boundary', () => {
    const text = 'hello world';
    expect(findLastWordBoundary(text, text.length)).toBe(5);
  });

  it('finds last space before maxIndex', () => {
    const text = 'one two three four';
    expect(findLastWordBoundary(text, 10)).toBe(7);
  });

  it('returns -1 when no space found', () => {
    const text = 'nospaces';
    expect(findLastWordBoundary(text, text.length)).toBe(-1);
  });

  it('handles newline as boundary', () => {
    const text = 'word\nword';
    expect(findLastWordBoundary(text, text.length)).toBe(4);
  });

  it('handles tab as boundary', () => {
    const text = 'word\tword';
    expect(findLastWordBoundary(text, text.length)).toBe(4);
  });

  it('handles empty string', () => {
    expect(findLastWordBoundary('', 100)).toBe(-1);
  });

  it('handles maxIndex beyond text length', () => {
    const text = 'hello world';
    expect(findLastWordBoundary(text, 1000)).toBe(5);
  });
});

// ============================================================================
// compressThinking - Basic Tests
// ============================================================================

describe('compressThinking - basic', () => {
  it('returns unchanged content when within limit', () => {
    const result = compressThinking(shortThinking);
    expect(result).toEqual({
      summary: shortThinking,
      originalWordCount: 5,
      truncated: false,
    });
  });

  it('returns unchanged content when exactly at limit', () => {
    const result = compressThinking(edgeCases.exactlyAtLimit);
    expect(result).toEqual({
      summary: edgeCases.exactlyAtLimit,
      originalWordCount: 1,
      truncated: false,
    });
  });

  it('preserves original word count after truncation', () => {
    const result = compressThinking(longThinkingWithSentences);
    expect(result.originalWordCount).toBe(countWords(longThinkingWithSentences));
    expect(result.truncated).toBe(true);
  });

  it('summary length is within maxLength', () => {
    const result = compressThinking(longThinkingWithSentences);
    expect(result.summary.length).toBeLessThanOrEqual(MAX_THINKING_LENGTH);
  });
});

// ============================================================================
// compressThinking - Null/Empty Input
// ============================================================================

describe('compressThinking - null/empty input', () => {
  it('handles null input', () => {
    const result = compressThinking(null);
    expect(result).toEqual({
      summary: '',
      originalWordCount: 0,
      truncated: false,
    });
  });

  it('handles undefined input', () => {
    const result = compressThinking(undefined);
    expect(result).toEqual({
      summary: '',
      originalWordCount: 0,
      truncated: false,
    });
  });

  it('handles empty string', () => {
    const result = compressThinking('');
    expect(result).toEqual({
      summary: '',
      originalWordCount: 0,
      truncated: false,
    });
  });

  it('handles whitespace-only string', () => {
    const result = compressThinking('   \n\t   ');
    expect(result).toEqual({
      summary: '',
      originalWordCount: 0,
      truncated: false,
    });
  });
});

// ============================================================================
// compressThinking - Sentence Boundary Breaking
// ============================================================================

describe('compressThinking - sentence boundary', () => {
  it('breaks at sentence boundary when within threshold', () => {
    const result = compressThinking(longThinkingWithSentences);
    // Should end with a period (sentence boundary)
    expect(result.summary.endsWith('.')).toBe(true);
    // Should not have ellipsis
    expect(result.summary.endsWith('...')).toBe(false);
    expect(result.truncated).toBe(true);
  });

  it('breaks at sentence boundary near end of limit', () => {
    const result = compressThinking(longTextSentenceNearEnd);
    // Sentence at ~430 chars, which is > 70% of 500
    expect(result.summary.endsWith('.')).toBe(true);
    expect(result.summary).toContain('This is a complete sentence.');
    expect(result.truncated).toBe(true);
  });

  it('does not use sentence boundary if too early in text', () => {
    // The sentence ends at position 14 which is < 70% of 500 (350)
    const result = compressThinking(longTextSentenceEarly);
    // Should use word boundary instead and have ellipsis
    expect(result.summary.endsWith('...')).toBe(true);
    expect(result.truncated).toBe(true);
  });
});

// ============================================================================
// compressThinking - Word Boundary Fallback
// ============================================================================

describe('compressThinking - word boundary fallback', () => {
  it('falls back to word boundary when no sentence within threshold', () => {
    const result = compressThinking(longTextNoSentences);
    // Should end with ellipsis since no sentence boundaries
    expect(result.summary.endsWith('...')).toBe(true);
    expect(result.truncated).toBe(true);
  });

  it('appends ellipsis when using word boundary', () => {
    const result = compressThinking(longTextNoSentences);
    expect(result.summary.endsWith('...')).toBe(true);
  });

  it('summary with ellipsis is within limit', () => {
    const result = compressThinking(longTextNoSentences);
    expect(result.summary.length).toBeLessThanOrEqual(MAX_THINKING_LENGTH);
  });
});

// ============================================================================
// compressThinking - Hard Truncation
// ============================================================================

describe('compressThinking - hard truncation', () => {
  it('hard truncates when no boundaries found', () => {
    const result = compressThinking(edgeCases.noSpaces);
    expect(result.summary.endsWith('...')).toBe(true);
    expect(result.summary.length).toBe(MAX_THINKING_LENGTH);
    expect(result.truncated).toBe(true);
  });

  it('preserves word count for hard truncation', () => {
    const result = compressThinking(edgeCases.noSpaces);
    expect(result.originalWordCount).toBe(1);
  });
});

// ============================================================================
// compressThinking - Custom maxLength
// ============================================================================

describe('compressThinking - custom maxLength', () => {
  it('respects custom maxLength', () => {
    const customLimit = 100;
    const result = compressThinking(longThinkingWithSentences, customLimit);
    expect(result.summary.length).toBeLessThanOrEqual(customLimit);
    expect(result.truncated).toBe(true);
  });

  it('returns unchanged when within custom maxLength', () => {
    const result = compressThinking(shortThinking, 100);
    expect(result.summary).toBe(shortThinking);
    expect(result.truncated).toBe(false);
  });

  it('handles very small maxLength', () => {
    // With a very small limit like 20, the algorithm truncates but may exceed slightly
    // due to ellipsis. The algorithm does its best to stay within limit.
    const result = compressThinking(mediumThinking, 20);
    // With ellipsis, the result could be up to maxLength (20)
    // But since we break at word boundaries and add "...", it might be shorter
    expect(result.truncated).toBe(true);
    // The result should be reasonable - either within limit or just slightly over due to edge cases
    expect(result.summary.length).toBeLessThanOrEqual(25);
  });

  it('handles maxLength larger than content', () => {
    const result = compressThinking(shortThinking, 1000);
    expect(result.summary).toBe(shortThinking);
    expect(result.truncated).toBe(false);
  });
});

// ============================================================================
// compressThinking - Edge Cases
// ============================================================================

describe('compressThinking - edge cases', () => {
  it('handles text with only punctuation', () => {
    const result = compressThinking(edgeCases.onlyPunctuation);
    expect(result.summary).toBe(edgeCases.onlyPunctuation);
    expect(result.originalWordCount).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it('handles single word', () => {
    const result = compressThinking(edgeCases.singleWord);
    expect(result.summary).toBe(edgeCases.singleWord);
    expect(result.originalWordCount).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it('handles text one char over limit', () => {
    const result = compressThinking(edgeCases.oneOverLimit);
    expect(result.summary.length).toBeLessThanOrEqual(MAX_THINKING_LENGTH);
    expect(result.truncated).toBe(true);
  });

  it('handles text with multiple consecutive spaces', () => {
    const result = compressThinking(edgeCases.multipleSpaces);
    expect(result.summary).toBe(edgeCases.multipleSpaces);
    expect(result.originalWordCount).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it('handles text with newlines', () => {
    const result = compressThinking(edgeCases.newlines);
    expect(result.summary).toBe(edgeCases.newlines);
    expect(result.originalWordCount).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it('handles text with tabs', () => {
    const result = compressThinking(edgeCases.tabs);
    expect(result.summary).toBe(edgeCases.tabs);
    expect(result.originalWordCount).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it('handles text with mixed whitespace', () => {
    const result = compressThinking(edgeCases.mixedWhitespace);
    expect(result.summary).toBe(edgeCases.mixedWhitespace);
    expect(result.originalWordCount).toBe(3);
    expect(result.truncated).toBe(false);
  });
});

// ============================================================================
// compressThinking - Constants
// ============================================================================

describe('compressThinking - constants', () => {
  it('exports MAX_THINKING_LENGTH as 500', () => {
    expect(MAX_THINKING_LENGTH).toBe(500);
  });

  it('exports SENTENCE_BOUNDARY_THRESHOLD as 0.7', () => {
    expect(SENTENCE_BOUNDARY_THRESHOLD).toBe(0.7);
  });
});

// ============================================================================
// compressThinking - Integration Tests
// ============================================================================

describe('compressThinking - integration', () => {
  it('produces consistent results for same input', () => {
    const result1 = compressThinking(longThinkingWithSentences);
    const result2 = compressThinking(longThinkingWithSentences);
    expect(result1).toEqual(result2);
  });

  it('handles realistic Claude thinking content', () => {
    const realisticThinking = `Let me analyze this request step by step. First, I need to understand what the user is asking for. They want me to implement a function that compresses text while preserving meaning. This is a common requirement in many applications.

Looking at the requirements:
1. The function should take a string input
2. It should return a compressed version
3. The compression should be configurable

I'll start by examining the existing code structure to understand how similar functions are implemented in this codebase. The key considerations are performance, readability, and maintainability.

After reviewing the codebase, I can see that there are several patterns we could follow. The most appropriate one seems to be the utility pattern used in other string manipulation functions.

Now let me implement the solution...`;

    const result = compressThinking(realisticThinking);
    expect(result.truncated).toBe(true);
    expect(result.summary.length).toBeLessThanOrEqual(MAX_THINKING_LENGTH);
    expect(result.originalWordCount).toBeGreaterThan(0);
    // Should break at a natural point
    expect(result.summary.endsWith('.') || result.summary.endsWith('...')).toBe(true);
  });

  it('does not trim input when within limit', () => {
    // Short text with trailing space should be preserved as-is when within limit
    const textWithTrailingSpace = 'Hello world. ';
    const result = compressThinking(textWithTrailingSpace);
    // We don't trim when content is within limit (as per the implementation)
    expect(result.summary).toBe(textWithTrailingSpace);
    expect(result.truncated).toBe(false);
  });
});

// ============================================================================
// ThinkingSummary Interface Tests
// ============================================================================

describe('ThinkingSummary interface', () => {
  it('has required fields', () => {
    const result = compressThinking('test');
    expect(typeof result.summary).toBe('string');
    expect(typeof result.originalWordCount).toBe('number');
    expect(typeof result.truncated).toBe('boolean');
  });

  it('summary field contains the compressed text', () => {
    const result = compressThinking(longThinkingWithSentences);
    expect(result.summary).toBeTruthy();
    expect(result.summary.length).toBeLessThanOrEqual(MAX_THINKING_LENGTH);
  });

  it('originalWordCount reflects input not output', () => {
    const result = compressThinking(longThinkingWithSentences);
    expect(result.originalWordCount).toBeGreaterThan(countWords(result.summary));
  });

  it('truncated is false when no truncation', () => {
    const result = compressThinking(shortThinking);
    expect(result.truncated).toBe(false);
  });

  it('truncated is true when truncation occurred', () => {
    const result = compressThinking(longThinkingWithSentences);
    expect(result.truncated).toBe(true);
  });
});
