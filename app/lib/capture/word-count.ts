/**
 * Word Count Utility for Contextor Capture Pipeline
 *
 * Calculates word count for prompt text before storage.
 * Used to provide analytics and insights on prompt complexity.
 */

/**
 * Calculate word count for a prompt text.
 *
 * Words are defined as sequences of non-whitespace characters.
 * This matches how most text editors count words.
 *
 * @param text - The input text to count words in
 * @returns The number of words in the text
 *
 * @example
 * ```ts
 * calculateWordCount("hello world") // 2
 * calculateWordCount("hello   world") // 2 (multiple spaces)
 * calculateWordCount("") // 0
 * calculateWordCount("  \n\t  ") // 0 (whitespace only)
 * ```
 */
export function calculateWordCount(text: string): number {
  // Handle empty or falsy input
  if (!text || typeof text !== "string") {
    return 0;
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  // Split on whitespace (spaces, tabs, newlines) and filter empty strings
  return trimmed.split(/\s+/).filter(Boolean).length;
}
