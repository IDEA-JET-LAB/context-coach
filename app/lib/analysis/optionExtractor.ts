/**
 * Option Extractor for AI Responses
 * Story 27-2: Heuristic Classification
 *
 * Extracts options from AI response text to enable context-aware selection detection.
 * When an AI presents numbered or lettered options, this extractor identifies them
 * so subsequent user prompts like "Option 2" or "B" can be correctly classified.
 *
 * Supported Formats:
 * - Numbered lists: "1. Option text", "1) Option text", "1: Option text"
 * - Lettered lists: "A. Option text", "A) Option text", "(A) Option text"
 * - Labeled options: "Option 1:", "Choice A:", "Alternative 1:"
 * - Bullet alternatives: "- Option 1:", "* Alternative A:"
 *
 * Performance Requirements:
 * - Average execution: <1ms per response
 * - No external dependencies
 */

/**
 * Maximum length of option text to extract (prevents memory issues).
 */
const MAX_OPTION_TEXT_LENGTH = 100;

/**
 * Maximum number of options to extract from a response.
 */
const MAX_OPTIONS = 20;

/**
 * Extracted option with metadata.
 */
export interface ExtractedOption {
  /**
   * The option identifier (e.g., "1", "A", "2").
   */
  identifier: string;

  /**
   * The text content of the option (truncated if too long).
   */
  text: string;

  /**
   * The format type of the option.
   */
  format: 'numbered' | 'lettered' | 'labeled' | 'bullet';

  /**
   * Starting position in the original text.
   */
  position: number;
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

/**
 * Pattern for numbered lists: "1. ", "1) ", "1: ", "#1 "
 * Captures: group 1 = number, group 2 = text content
 */
const NUMBERED_PATTERN = /(?:^|\n)\s*(?:#)?(\d+)[.\):]\s+(.+?)(?=\n\s*(?:#)?\d+[.\):]|\n\n|$)/gs;

/**
 * Pattern for lettered lists: "A. ", "a) ", "(A) ", "A: "
 * Captures: group 1 = letter, group 2 = text content
 */
const LETTERED_PATTERN = /(?:^|\n)\s*(?:\()?([A-Za-z])[.\):]\s*\)?\s+(.+?)(?=\n\s*(?:\()?[A-Za-z][.\):]|\n\n|$)/gs;

/**
 * Pattern for labeled options: "Option 1:", "Choice A:", "Alternative 2:"
 * Captures: group 1 = identifier, group 2 = text content
 */
const LABELED_PATTERN = /(?:Option|Choice|Alternative)\s+(\d+|[A-Za-z]):\s*(.+?)(?=\n(?:Option|Choice|Alternative)\s+|\n\n|$)/gis;

/**
 * Pattern for bullet with options: "- Option 1:", "* Choice A:"
 * Captures: group 1 = identifier, group 2 = text content
 */
const BULLET_OPTION_PATTERN = /(?:^|\n)\s*[-*]\s+(?:Option|Choice)\s+(\d+|[A-Za-z]):\s*(.+?)(?=\n\s*[-*]\s+(?:Option|Choice)|\n\n|$)/gis;

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Truncate text to maximum length with ellipsis.
 */
function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.substring(0, maxLength - 3) + '...';
}

/**
 * Extract numbered options from response text.
 */
function extractNumberedOptions(text: string): ExtractedOption[] {
  const options: ExtractedOption[] = [];
  NUMBERED_PATTERN.lastIndex = 0; // Reset regex state

  let match: RegExpExecArray | null;
  while ((match = NUMBERED_PATTERN.exec(text)) !== null && options.length < MAX_OPTIONS) {
    const [fullMatch, identifier, content] = match;
    if (identifier && content) {
      options.push({
        identifier: identifier,
        text: truncateText(content, MAX_OPTION_TEXT_LENGTH),
        format: 'numbered',
        position: match.index,
      });
    }
  }

  return options;
}

/**
 * Extract lettered options from response text.
 */
function extractLetteredOptions(text: string): ExtractedOption[] {
  const options: ExtractedOption[] = [];
  LETTERED_PATTERN.lastIndex = 0; // Reset regex state

  let match: RegExpExecArray | null;
  while ((match = LETTERED_PATTERN.exec(text)) !== null && options.length < MAX_OPTIONS) {
    const [fullMatch, identifier, content] = match;
    if (identifier && content) {
      options.push({
        identifier: identifier.toUpperCase(), // Normalize to uppercase
        text: truncateText(content, MAX_OPTION_TEXT_LENGTH),
        format: 'lettered',
        position: match.index,
      });
    }
  }

  return options;
}

/**
 * Extract labeled options from response text.
 */
function extractLabeledOptions(text: string): ExtractedOption[] {
  const options: ExtractedOption[] = [];
  LABELED_PATTERN.lastIndex = 0; // Reset regex state

  let match: RegExpExecArray | null;
  while ((match = LABELED_PATTERN.exec(text)) !== null && options.length < MAX_OPTIONS) {
    const [fullMatch, identifier, content] = match;
    if (identifier && content) {
      // Normalize letter identifiers to uppercase
      const normalizedId = /^[A-Za-z]$/.test(identifier)
        ? identifier.toUpperCase()
        : identifier;
      options.push({
        identifier: normalizedId,
        text: truncateText(content, MAX_OPTION_TEXT_LENGTH),
        format: 'labeled',
        position: match.index,
      });
    }
  }

  return options;
}

/**
 * Extract bullet options from response text.
 */
function extractBulletOptions(text: string): ExtractedOption[] {
  const options: ExtractedOption[] = [];
  BULLET_OPTION_PATTERN.lastIndex = 0; // Reset regex state

  let match: RegExpExecArray | null;
  while ((match = BULLET_OPTION_PATTERN.exec(text)) !== null && options.length < MAX_OPTIONS) {
    const [fullMatch, identifier, content] = match;
    if (identifier && content) {
      const normalizedId = /^[A-Za-z]$/.test(identifier)
        ? identifier.toUpperCase()
        : identifier;
      options.push({
        identifier: normalizedId,
        text: truncateText(content, MAX_OPTION_TEXT_LENGTH),
        format: 'bullet',
        position: match.index,
      });
    }
  }

  return options;
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract options from an AI response for context-aware selection detection.
 *
 * Returns a deduplicated list of option identifiers that can be used to
 * match user selection prompts like "Option 2" or "B".
 *
 * @param responseText - The AI response text to analyze
 * @returns Array of option identifiers (e.g., ["1", "2", "3"] or ["A", "B"])
 *
 * @example
 * ```ts
 * const response = `Here are your options:
 * 1. Create a new file
 * 2. Modify existing file
 * 3. Delete the file`;
 *
 * extractOptionsFromResponse(response)
 * // => ["1", "2", "3"]
 *
 * const response2 = `Choose an approach:
 * Option A: Fast but less accurate
 * Option B: Slow but precise`;
 *
 * extractOptionsFromResponse(response2)
 * // => ["A", "B"]
 * ```
 */
export function extractOptionsFromResponse(responseText: string | undefined): string[] {
  if (!responseText || responseText.trim().length === 0) {
    return [];
  }

  // Collect all options from different formats
  const allOptions: ExtractedOption[] = [
    ...extractNumberedOptions(responseText),
    ...extractLetteredOptions(responseText),
    ...extractLabeledOptions(responseText),
    ...extractBulletOptions(responseText),
  ];

  // Sort by position to maintain order
  allOptions.sort((a, b) => a.position - b.position);

  // Extract unique identifiers
  const identifiers = new Set<string>();
  for (const opt of allOptions) {
    identifiers.add(opt.identifier);
    // Also add the option text (first few words) for text-based matching
    const firstWords = opt.text.split(/\s+/).slice(0, 5).join(' ').toLowerCase();
    if (firstWords.length > 3) {
      identifiers.add(firstWords);
    }
  }

  return [...identifiers];
}

/**
 * Extract options with full metadata for detailed analysis.
 *
 * @param responseText - The AI response text to analyze
 * @returns Array of ExtractedOption objects with full metadata
 */
export function extractOptionsWithMetadata(
  responseText: string | undefined
): ExtractedOption[] {
  if (!responseText || responseText.trim().length === 0) {
    return [];
  }

  const allOptions: ExtractedOption[] = [
    ...extractNumberedOptions(responseText),
    ...extractLetteredOptions(responseText),
    ...extractLabeledOptions(responseText),
    ...extractBulletOptions(responseText),
  ];

  // Sort by position and deduplicate by identifier
  allOptions.sort((a, b) => a.position - b.position);

  const seen = new Set<string>();
  return allOptions.filter((opt) => {
    if (seen.has(opt.identifier)) {
      return false;
    }
    seen.add(opt.identifier);
    return true;
  });
}

/**
 * Check if a response contains options.
 * Useful for quick check without full extraction.
 *
 * @param responseText - The AI response text to check
 * @returns True if the response appears to contain options
 */
export function hasOptions(responseText: string | undefined): boolean {
  if (!responseText) return false;

  // Quick pattern check without full extraction
  const quickPatterns = [
    /(?:^|\n)\s*\d+[.\):]/m, // Numbered
    /(?:^|\n)\s*[A-Za-z][.\):]/m, // Lettered
    /Option\s+\d+:/i, // Labeled numeric
    /Option\s+[A-Za-z]:/i, // Labeled letter
    /Choice\s+\d+:/i, // Choice labeled
  ];

  return quickPatterns.some((p) => p.test(responseText));
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Constants
  MAX_OPTION_TEXT_LENGTH,
  MAX_OPTIONS,
  // Patterns (for testing)
  NUMBERED_PATTERN,
  LETTERED_PATTERN,
  LABELED_PATTERN,
  BULLET_OPTION_PATTERN,
  // Individual extractors (for testing)
  extractNumberedOptions,
  extractLetteredOptions,
  extractLabeledOptions,
  extractBulletOptions,
};
