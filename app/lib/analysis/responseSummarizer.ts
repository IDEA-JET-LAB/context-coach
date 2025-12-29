/**
 * Response Summarization for Analysis Context
 * Story 27-3: Context Building for Analysis
 *
 * Functions for summarizing AI responses and extracting metadata.
 * Handles response truncation at sentence boundaries and detection
 * of questions and tool usage.
 *
 * Performance Requirements:
 * - Sub-millisecond execution
 * - No external dependencies
 */

/**
 * Question patterns to detect when AI is asking for user input.
 */
const QUESTION_PATTERNS = [
  /would you like me to/i,
  /should I proceed/i,
  /do you want me to/i,
  /let me know if/i,
  /which option/i,
  /what would you prefer/i,
  /shall I/i,
  /can I/i,
  /may I/i,
];

/**
 * Summarizes a response to fit within character limit.
 * Tries to break at sentence boundaries for cleaner output.
 *
 * @param text - The response text to summarize
 * @param maxLength - Maximum character length (default: 500)
 * @returns Summarized text with ellipsis if truncated
 *
 * @example
 * summarizeResponse("First sentence. Second sentence.", 30);
 * // => "First sentence..."
 */
export function summarizeResponse(
  text: string,
  maxLength: number = 500
): string {
  if (!text || text.length === 0) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  // Find sentence boundary near limit
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('. ');
  const lastQuestion = truncated.lastIndexOf('? ');
  const lastExclaim = truncated.lastIndexOf('! ');
  const lastNewline = truncated.lastIndexOf('\n');

  const breakPoints = [lastPeriod, lastQuestion, lastExclaim, lastNewline].filter(
    (p) => p > maxLength * 0.6 // At least 60% of content
  );

  if (breakPoints.length > 0) {
    const breakPoint = Math.max(...breakPoints);
    return truncated.slice(0, breakPoint + 1).trim() + '...';
  }

  return truncated.trim() + '...';
}

/**
 * Detects if response ends with a question to the user.
 * Checks the last 200 characters for question patterns.
 *
 * @param text - The response text to analyze
 * @returns true if the response appears to be asking a question
 *
 * @example
 * detectQuestion("Would you like me to proceed?"); // true
 * detectQuestion("The code has been updated."); // false
 */
export function detectQuestion(text: string): boolean {
  if (!text || text.length === 0) {
    return false;
  }

  // Check last 200 characters for question patterns
  const tail = text.slice(-200).trim();

  // Direct question at end
  if (tail.endsWith('?')) {
    return true;
  }

  // Common question patterns
  return QUESTION_PATTERNS.some((p) => p.test(tail));
}

/**
 * Extracts tool names from tools_used JSONB field.
 * Handles both string arrays and object arrays with name property.
 *
 * @param toolsUsed - The tools_used field from the database (can be any type)
 * @returns Array of tool names
 *
 * @example
 * extractToolsUsed(['Read', 'Write']); // ['Read', 'Write']
 * extractToolsUsed([{ name: 'Read', count: 5 }]); // ['Read']
 * extractToolsUsed(null); // []
 */
export function extractToolsUsed(toolsUsed: unknown): string[] {
  if (!toolsUsed) {
    return [];
  }

  if (!Array.isArray(toolsUsed)) {
    return [];
  }

  return toolsUsed.map((t) => {
    if (typeof t === 'string') {
      return t;
    }
    if (typeof t === 'object' && t !== null && 'name' in t) {
      return (t as { name: string }).name;
    }
    return String(t);
  });
}
