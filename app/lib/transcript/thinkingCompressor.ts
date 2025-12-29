/**
 * Thinking Compressor - Story 26-5
 *
 * Utility to compress Claude's extended thinking content to a configurable length.
 * Preserves word count for analytics while providing a meaningful summary preview.
 */

/**
 * Result of thinking compression.
 */
export interface ThinkingSummary {
  /** Compressed content (at most maxLength characters) */
  summary: string;
  /** Word count of original content (for analytics) */
  originalWordCount: number;
  /** Whether truncation occurred */
  truncated: boolean;
}

/**
 * Legacy interface for backward compatibility.
 * @deprecated Use ThinkingSummary instead
 */
export interface ThinkingCompressionResult {
  /** Compressed summary of thinking content */
  summary: string;
  /** Original character count */
  originalCharCount: number;
  /** Compressed character count */
  compressedCharCount: number;
  /** Compression ratio (0-1, lower is more compressed) */
  compressionRatio: number;
}

/**
 * Default maximum length for thinking summaries.
 */
export const MAX_THINKING_LENGTH = 500;

/**
 * Threshold for sentence boundary breaking.
 * If sentence boundary is found within this percentage of the limit, use it.
 */
export const SENTENCE_BOUNDARY_THRESHOLD = 0.7;

/**
 * Compresses extended thinking content to a summary.
 *
 * Truncation strategy:
 * 1. If within limit, return unchanged
 * 2. Try to break at last sentence boundary (within 70% of limit)
 * 3. Fall back to word boundary with ellipsis
 * 4. Hard truncate if no boundary found
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
  if (sentenceBoundary > maxLength * SENTENCE_BOUNDARY_THRESHOLD) {
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

  // No boundary found - hard truncate (rare edge case: very long word or no spaces)
  return {
    summary: thinkingContent.substring(0, maxLength - 3).trim() + '...',
    originalWordCount,
    truncated: true,
  };
}

/**
 * Count words in text (whitespace-separated).
 *
 * @param text - Text to count words in
 * @returns Number of words
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Find the index of the last sentence-ending punctuation.
 * Looks for . ! ? followed by space or at end of text.
 *
 * @param text - Text to search in
 * @param maxIndex - Maximum index to search up to
 * @returns Index of sentence boundary, or -1 if not found
 */
export function findLastSentenceBoundary(text: string, maxIndex: number): number {
  // Look for . ! ? followed by space or end of string
  // Also handle cases like ". " or "." at end
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
 * Find the index of the last whitespace character.
 *
 * @param text - Text to search in
 * @param maxIndex - Maximum index to search up to
 * @returns Index of word boundary (whitespace), or -1 if not found
 */
export function findLastWordBoundary(text: string, maxIndex: number): number {
  // Search backwards from maxIndex for whitespace
  for (let i = Math.min(maxIndex, text.length) - 1; i >= 0; i--) {
    if (/\s/.test(text[i])) {
      return i;
    }
  }
  return -1;
}
