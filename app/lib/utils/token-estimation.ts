/**
 * Token Estimation Utilities - Story 25-4
 *
 * Simple heuristics for estimating token counts in text.
 * Uses word-based estimation which works well for context budgeting.
 *
 * Note: These are estimates, not exact counts. For precise token counting,
 * use the model's actual tokenizer.
 */

/**
 * Estimate token count for text.
 *
 * Uses simple heuristic: words * 1.3 for English text.
 * This is conservative and works well for context budgeting.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * estimateTokens("Hello world"); // ~3 tokens
 * estimateTokens(""); // 0 tokens
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Split on whitespace to count words
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);

  // Words are roughly 1.3 tokens on average for English
  return Math.ceil(words.length * 1.3);
}

/**
 * Truncate text to fit within a token budget.
 *
 * Tries to end at a sentence or word boundary for cleaner truncation.
 * Returns the truncated text and whether truncation occurred.
 *
 * @param text - The text to truncate
 * @param maxTokens - Maximum number of tokens allowed
 * @returns Object with truncated text and truncation flag
 *
 * @example
 * truncateToTokens("Hello world. This is a test.", 5);
 * // { text: "Hello world.", truncated: true }
 */
export function truncateToTokens(
  text: string,
  maxTokens: number
): { text: string; truncated: boolean; tokenCount: number } {
  if (!text || text.length === 0) {
    return { text: "", truncated: false, tokenCount: 0 };
  }

  const currentTokens = estimateTokens(text);

  if (currentTokens <= maxTokens) {
    return { text, truncated: false, tokenCount: currentTokens };
  }

  // Estimate characters to keep (tokens * ~4 chars per token for English)
  // Use a slightly conservative estimate to ensure we're under budget
  const charLimit = Math.floor(maxTokens * 3);

  if (charLimit <= 0) {
    return { text: "", truncated: true, tokenCount: 0 };
  }

  const truncated = text.substring(0, charLimit);

  // Try to end at sentence boundary (. ! ?)
  const sentenceEndPattern = /[.!?]/g;
  let lastSentenceEnd = -1;
  let match;

  while ((match = sentenceEndPattern.exec(truncated)) !== null) {
    // Only consider sentence ends in the latter 70% of the text
    // This prevents truncating too early
    if (match.index > charLimit * 0.5) {
      lastSentenceEnd = match.index;
    }
  }

  if (lastSentenceEnd > 0) {
    const result = truncated.substring(0, lastSentenceEnd + 1);
    return {
      text: result,
      truncated: true,
      tokenCount: estimateTokens(result)
    };
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > charLimit * 0.5) {
    const result = truncated.substring(0, lastSpace) + "...";
    return {
      text: result,
      truncated: true,
      tokenCount: estimateTokens(result)
    };
  }

  // Last resort: just cut at character limit
  const result = truncated.substring(0, charLimit - 3) + "...";
  return {
    text: result,
    truncated: true,
    tokenCount: estimateTokens(result)
  };
}

/**
 * Calculate the percentage of token budget used.
 *
 * @param usedTokens - Number of tokens used
 * @param totalBudget - Total token budget
 * @returns Percentage used (0-100)
 */
export function getTokenBudgetUsage(usedTokens: number, totalBudget: number): number {
  if (totalBudget <= 0) {
    return 100;
  }
  return Math.min(100, Math.round((usedTokens / totalBudget) * 100));
}

/**
 * Check if adding more content would exceed the token budget.
 *
 * @param currentTokens - Current token count
 * @param additionalTokens - Tokens to add
 * @param budget - Token budget
 * @returns true if adding would exceed budget
 */
export function wouldExceedBudget(
  currentTokens: number,
  additionalTokens: number,
  budget: number
): boolean {
  return currentTokens + additionalTokens > budget;
}
