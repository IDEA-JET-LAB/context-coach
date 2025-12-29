/**
 * Token Estimation for Analysis Context
 * Story 27-3: Context Building for Analysis
 *
 * Simple heuristics for estimating token counts in text.
 * Uses character-based estimation which works well for context budgeting.
 *
 * Performance Requirements:
 * - Sub-millisecond execution
 * - No external dependencies (no tiktoken)
 */

/**
 * Code content indicators that trigger a 30% token increase.
 * Code typically has more tokens per character due to special characters.
 */
const CODE_INDICATORS = ['```', 'function', 'const ', 'import ', 'export '];

/**
 * Estimates token count for text.
 *
 * Uses simple heuristic: ~4 characters per token for English text.
 * Adjusts by +30% for code content (more tokens due to special chars).
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * estimateTokens("Hello world"); // ~3 tokens
 * estimateTokens(""); // 0 tokens
 * estimateTokens("const x = 1;"); // ~4 tokens (code adjustment)
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Base estimate: 4 chars per token
  const baseEstimate = Math.ceil(text.length / 4);

  // Adjust for code content (more tokens due to special chars)
  const hasCode = CODE_INDICATORS.some((ind) => text.includes(ind));

  if (hasCode) {
    return Math.ceil(baseEstimate * 1.3); // 30% more tokens for code
  }

  return baseEstimate;
}

/**
 * Check if content fits within token budget.
 *
 * @param text - The text to check
 * @param budget - The token budget
 * @returns true if the text fits in the budget
 */
export function fitsInBudget(text: string, budget: number): boolean {
  return estimateTokens(text) <= budget;
}

/**
 * Truncate text to fit within a token budget.
 *
 * Tries to break at sentence boundaries for cleaner truncation.
 *
 * @param text - The text to truncate
 * @param maxTokens - Maximum number of tokens allowed
 * @returns The truncated text with ellipsis if truncated
 */
export function truncateToFit(text: string, maxTokens: number): string {
  if (!text) return '';
  if (fitsInBudget(text, maxTokens)) return text;

  // Rough estimate: 4 chars per token
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  // Find sentence boundary near limit
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);

  if (breakPoint > maxChars * 0.7) {
    return truncated.slice(0, breakPoint + 1) + '...';
  }

  return truncated + '...';
}
