/**
 * Option Extraction Utilities - Story 25-4
 *
 * Extracts options/choices from Claude's responses.
 * Looks for numbered lists, lettered options, and bullet points.
 *
 * This is useful for understanding when Claude is presenting choices
 * to the user and what those choices are.
 */

/**
 * Maximum number of options to extract from a response.
 * Limits prevent over-extraction from long lists.
 */
const MAX_OPTIONS = 10;

/**
 * Maximum length for a single option text.
 * Longer items are likely paragraphs, not options.
 */
const MAX_OPTION_LENGTH = 200;

/**
 * Minimum length for a valid option.
 * Very short items are likely not meaningful options.
 */
const MIN_OPTION_LENGTH = 3;

/**
 * Extract options from Claude's response.
 *
 * Searches for common option patterns in order of specificity:
 * 1. Numbered options (1. Option text, 2. Option text)
 * 2. Lettered options (A. Option, B. Option) or (Option A:, Option B:)
 * 3. Bullet points (- item, * item)
 *
 * Only returns options from the first matching pattern to avoid mixing.
 *
 * @param responseText - The response text to extract options from
 * @returns Array of extracted option strings (max 10)
 *
 * @example
 * extractOptions("Choose one:\n1. Option A\n2. Option B");
 * // ["Option A", "Option B"]
 *
 * extractOptions("The options are:\n- First choice\n- Second choice");
 * // ["First choice", "Second choice"]
 */
export function extractOptions(responseText: string): string[] {
  if (!responseText || responseText.length === 0) {
    return [];
  }

  // Try numbered options first (most specific for choices)
  const numbered = extractNumberedOptions(responseText);
  if (numbered.length >= 2) {
    return numbered;
  }

  // Try lettered options (A. B. C. or Option A:, Option B:)
  const lettered = extractLetteredOptions(responseText);
  if (lettered.length >= 2) {
    return lettered;
  }

  // Try bullet points (less specific, may be just a list)
  const bullets = extractBulletOptions(responseText);
  if (bullets.length >= 2) {
    return bullets;
  }

  return [];
}

/**
 * Extract numbered options (1. 2. 3. format).
 *
 * @param text - Text to search
 * @returns Array of option strings
 */
function extractNumberedOptions(text: string): string[] {
  const options: string[] = [];

  // Pattern: number followed by . or ) at start of line
  // Captures content until newline or end of string
  const pattern = /^\s*(\d+)[.)]\s+(.+?)(?=\n\s*\d+[.)]|\n\n|\n$|$)/gm;

  let match;
  let lastNumber = 0;

  while ((match = pattern.exec(text)) !== null) {
    const numberStr = match[1];
    const contentStr = match[2];
    if (!numberStr || !contentStr) continue;

    const number = parseInt(numberStr, 10);
    const content = cleanOptionText(contentStr);

    // Only include if it looks like sequential numbering
    if (number === lastNumber + 1 || lastNumber === 0) {
      if (isValidOption(content)) {
        options.push(content);
        lastNumber = number;
      }
    }

    if (options.length >= MAX_OPTIONS) break;
  }

  return options;
}

/**
 * Extract lettered options (A. B. C. or Option A: format).
 *
 * @param text - Text to search
 * @returns Array of option strings
 */
function extractLetteredOptions(text: string): string[] {
  const options: string[] = [];

  // Pattern 1: Letter at start of line (A. or A))
  const pattern1 = /^\s*([A-Za-z])[.)]\s+(.+?)(?=\n\s*[A-Za-z][.)]|\n\n|\n$|$)/gm;

  let match;
  let lastLetter = "";

  while ((match = pattern1.exec(text)) !== null) {
    const letterStr = match[1];
    const contentStr = match[2];
    if (!letterStr || !contentStr) continue;

    const letter = letterStr.toUpperCase();
    const content = cleanOptionText(contentStr);

    // Only include if sequential (A -> B -> C)
    const expectedLetter = lastLetter
      ? String.fromCharCode(lastLetter.charCodeAt(0) + 1)
      : "A";

    if (letter === expectedLetter || lastLetter === "") {
      if (isValidOption(content)) {
        options.push(content);
        lastLetter = letter;
      }
    }

    if (options.length >= MAX_OPTIONS) break;
  }

  if (options.length >= 2) {
    return options;
  }

  // Pattern 2: "Option A:", "Option B:", etc.
  options.length = 0;
  const pattern2 = /\bOption\s+([A-Za-z])[\s:]+(.+?)(?=\bOption\s+[A-Za-z]|\n\n|$)/gi;

  while ((match = pattern2.exec(text)) !== null) {
    const contentStr = match[2];
    if (!contentStr) continue;

    const content = cleanOptionText(contentStr);

    if (isValidOption(content)) {
      options.push(content);
    }

    if (options.length >= MAX_OPTIONS) break;
  }

  return options;
}

/**
 * Extract bullet point options (- or * format).
 *
 * More selective than numbered/lettered to avoid extracting
 * random lists that aren't options.
 *
 * @param text - Text to search
 * @returns Array of option strings
 */
function extractBulletOptions(text: string): string[] {
  const options: string[] = [];

  // Pattern: dash or asterisk at start of line
  const pattern = /^\s*[-*]\s+(.+?)$/gm;

  let match;

  while ((match = pattern.exec(text)) !== null) {
    const contentStr = match[1];
    if (!contentStr) continue;

    const content = cleanOptionText(contentStr);

    // More strict for bullets - must look like an option
    if (isValidOption(content) && looksLikeOption(content)) {
      options.push(content);
    }

    if (options.length >= MAX_OPTIONS) break;
  }

  return options;
}

/**
 * Clean up option text by removing extra whitespace and trailing punctuation.
 *
 * @param text - Raw option text
 * @returns Cleaned text
 */
function cleanOptionText(text: string): string {
  return text
    .trim()
    // Remove trailing colons that might be from "Option A: description"
    .replace(/:\s*$/, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    // Remove leading/trailing quotes
    .replace(/^["']|["']$/g, "");
}

/**
 * Check if text is a valid option (right length, not a sentence fragment).
 *
 * @param text - Option text to validate
 * @returns true if valid option
 */
function isValidOption(text: string): boolean {
  if (text.length < MIN_OPTION_LENGTH || text.length > MAX_OPTION_LENGTH) {
    return false;
  }

  // Reject if it ends with a colon (likely a header, not an option)
  if (text.endsWith(":")) {
    return false;
  }

  // Reject if it's just a number or single word that's too short
  if (text.length < 5 && !/\s/.test(text)) {
    return false;
  }

  return true;
}

/**
 * Check if bullet point text looks like an option (actionable/chooseable).
 *
 * This helps filter out random lists that aren't options.
 *
 * @param text - Text to check
 * @returns true if it looks like an option
 */
function looksLikeOption(text: string): boolean {
  // Options often start with verbs or action words
  const actionPatterns = [
    /^(use|create|add|remove|update|change|enable|disable|set|configure|install|implement|apply|select)/i,
    /^(option|choice|alternative)/i,
    /\b(recommended|preferred|default)\b/i,
  ];

  for (const pattern of actionPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Short bullet points are more likely to be options
  if (text.length < 80 && !text.endsWith(".")) {
    return true;
  }

  // Starts with capital letter and is reasonably short
  if (/^[A-Z]/.test(text) && text.length < 100) {
    return true;
  }

  return false;
}

/**
 * Check if a response likely contains options for the user to choose from.
 *
 * Faster than extractOptions when you just need to know if there are options.
 *
 * @param responseText - Response text to check
 * @returns true if response likely contains options
 */
export function hasOptions(responseText: string): boolean {
  if (!responseText || responseText.length === 0) {
    return false;
  }

  // Quick patterns that suggest options
  const quickPatterns = [
    /^\s*1[.)]\s/m, // Numbered list
    /^\s*[A-C][.)]\s/m, // Lettered list (A, B, C)
    /\boption\s+[A-C]\b/i, // "Option A", "Option B"
    /(?:choose|select|pick)\s+(?:one|from|between)/i, // Choice language
  ];

  for (const pattern of quickPatterns) {
    if (pattern.test(responseText)) {
      return true;
    }
  }

  return false;
}
