/**
 * Prompt Complexity Analyzer
 * Story 21-4: Prompt Complexity Metrics
 *
 * Analyzes prompts for structural complexity including:
 * - Sentence count
 * - Code detection (fenced blocks, inline code, keywords)
 * - File reference detection (extensions, paths)
 * - Complexity scoring (0-100)
 *
 * Performance requirement: <2ms per prompt
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Complexity level classification
 */
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

/**
 * Full complexity metrics for a prompt
 */
export interface ComplexityMetrics {
  /** Character count (passed through from input) */
  charCount: number;
  /** Word count (passed through from input) */
  wordCount: number;
  /** Number of sentences detected */
  sentenceCount: number;
  /** Whether the prompt contains code */
  hasCode: boolean;
  /** Whether the prompt contains file references */
  hasFileRefs: boolean;
  /** Count of fenced code blocks (```) */
  codeBlockCount: number;
  /** Count of file references detected */
  fileRefCount: number;
  /** Complexity level classification */
  complexityLevel: ComplexityLevel;
  /** Numeric complexity score (0-100) */
  complexityScore: number;
}

// ============================================================================
// Detection Patterns
// ============================================================================

/**
 * Pattern for fenced code blocks (```...```)
 * Uses non-greedy match to handle multiple blocks
 */
const FENCED_CODE_PATTERN = /```[\s\S]*?```/g;

/**
 * Pattern for inline code (`...`)
 * Matches single backtick wrapped content
 */
const INLINE_CODE_PATTERN = /`[^`\n]+`/g;

/**
 * Patterns indicating code content (keywords, operators)
 */
const CODE_KEYWORD_PATTERNS = [
  // JavaScript/TypeScript keywords
  /\b(function|const|let|var|class|interface|type|import|export|return|async|await|if|else|for|while)\b/,
  // Common operators that indicate code
  /=>|===|!==|\|\||&&|\+=|-=|\*=|\/=/,
  // Python keywords
  /\b(def|elif|except|lambda|yield|from|as|with|try)\b/,
  // Common code patterns
  /\(\s*\)|{\s*}|\[\s*\]/,
] as const;

/**
 * File extension pattern - matches common programming extensions
 * Captures file references like "file.ts", "component.tsx", "index.py"
 */
const FILE_EXTENSION_PATTERN = /\b[\w-]+\.(ts|tsx|js|jsx|py|go|rs|sql|md|json|yaml|yml|css|scss|html|vue|svelte|php|rb|java|kt|swift|c|cpp|h|hpp)\b/gi;

/**
 * Absolute path patterns (Unix and Windows)
 */
const ABSOLUTE_PATH_PATTERNS = [
  /\/Users\/[^\s"'<>]+/g,          // macOS paths
  /\/home\/[^\s"'<>]+/g,           // Linux paths
  /[A-Za-z]:\\[^\s"'<>]+/g,        // Windows paths
  /\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\-/.]+/g, // Generic Unix paths
] as const;

/**
 * Relative path patterns
 */
const RELATIVE_PATH_PATTERNS = [
  /\.\/[^\s"'<>]+/g,               // ./relative/path
  /\.\.\/[^\s"'<>]+/g,             // ../parent/path
] as const;

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Count sentences in text using sentence-ending punctuation.
 * Handles common abbreviations and decimal numbers.
 *
 * @param text - The text to analyze
 * @returns Number of sentences detected
 */
export function countSentences(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // Remove code blocks to avoid counting periods in code
  const textWithoutCode = text.replace(FENCED_CODE_PATTERN, ' ');

  // Split by sentence-ending punctuation
  // Matches: . ! ? followed by space or end of string
  // Excludes: numbers like 1.5, abbreviations like "e.g."
  const sentenceEnders = textWithoutCode.match(/[.!?]+(?=\s|$)/g);

  // If no sentence enders found, treat the whole text as one sentence
  // (if it has content)
  if (!sentenceEnders || sentenceEnders.length === 0) {
    return textWithoutCode.trim().length > 0 ? 1 : 0;
  }

  return sentenceEnders.length;
}

/**
 * Count fenced code blocks (```...```)
 *
 * @param text - The text to analyze
 * @returns Number of fenced code blocks
 */
export function countCodeBlocks(text: string): number {
  const matches = text.match(FENCED_CODE_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Check if text contains inline code (`...`)
 *
 * @param text - The text to analyze
 * @returns true if inline code is present
 */
export function hasInlineCode(text: string): boolean {
  return INLINE_CODE_PATTERN.test(text);
}

/**
 * Check if text contains code-like patterns (keywords, operators)
 *
 * @param text - The text to analyze
 * @returns true if code patterns are detected
 */
export function hasCodePatterns(text: string): boolean {
  return CODE_KEYWORD_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Detect if text contains any code (blocks, inline, or patterns)
 *
 * @param text - The text to analyze
 * @returns true if any code is detected
 */
export function detectCode(text: string): boolean {
  // Check fenced blocks first (most definitive)
  if (FENCED_CODE_PATTERN.test(text)) {
    return true;
  }

  // Check inline code
  if (hasInlineCode(text)) {
    return true;
  }

  // Check code patterns
  if (hasCodePatterns(text)) {
    return true;
  }

  return false;
}

/**
 * Count file extension references in text
 *
 * @param text - The text to analyze
 * @returns Number of file extension matches
 */
export function countFileExtensions(text: string): number {
  const matches = text.match(FILE_EXTENSION_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Count path references in text (absolute and relative)
 *
 * @param text - The text to analyze
 * @returns Number of path references
 */
export function countPathReferences(text: string): number {
  let count = 0;

  // Count absolute paths
  for (const pattern of ABSOLUTE_PATH_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  // Count relative paths
  for (const pattern of RELATIVE_PATH_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Count all file references (extensions + paths)
 * Deduplicates overlapping matches
 *
 * @param text - The text to analyze
 * @returns Total file reference count
 */
export function countFileReferences(text: string): number {
  // Use a Set to track unique references
  const refs = new Set<string>();

  // Collect file extensions
  const extMatches = text.match(FILE_EXTENSION_PATTERN);
  if (extMatches) {
    extMatches.forEach(match => refs.add(match.toLowerCase()));
  }

  // Collect paths (extract filename part to avoid double-counting)
  for (const pattern of [...ABSOLUTE_PATH_PATTERNS, ...RELATIVE_PATH_PATTERNS]) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => refs.add(match.toLowerCase()));
    }
  }

  return refs.size;
}

/**
 * Detect if text contains file references
 *
 * @param text - The text to analyze
 * @returns true if file references are detected
 */
export function detectFileRefs(text: string): boolean {
  // Check extensions first (most common)
  if (FILE_EXTENSION_PATTERN.test(text)) {
    return true;
  }

  // Check absolute paths
  for (const pattern of ABSOLUTE_PATH_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Check relative paths
  for (const pattern of RELATIVE_PATH_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate the complexity score based on metrics.
 *
 * Scoring factors:
 * - Length: >500 chars (+20), >200 chars (+10)
 * - Structure: >3 sentences (+20), >1 sentence (+10)
 * - Technical: has_code (+25), has_file_refs (+15)
 * - Code blocks: +5 per block (max +10)
 * - Word complexity: avg word length >6 (+10)
 *
 * @param metrics - Partial metrics to calculate score from
 * @returns Complexity score (0-100)
 */
export function calculateComplexityScore(
  metrics: Partial<ComplexityMetrics>
): number {
  let score = 0;

  // Length factors
  const charCount = metrics.charCount ?? 0;
  if (charCount > 500) {
    score += 20;
  } else if (charCount > 200) {
    score += 10;
  }

  // Structure factors
  const sentenceCount = metrics.sentenceCount ?? 0;
  if (sentenceCount > 3) {
    score += 20;
  } else if (sentenceCount > 1) {
    score += 10;
  }

  // Technical factors
  if (metrics.hasCode) {
    score += 25;
  }
  if (metrics.hasFileRefs) {
    score += 15;
  }

  // Code block bonus (capped at 10)
  const codeBlockCount = metrics.codeBlockCount ?? 0;
  score += Math.min(10, codeBlockCount * 5);

  // Word complexity (average word length > 6 indicates technical content)
  const wordCount = metrics.wordCount ?? 1;
  const avgWordLength = charCount / Math.max(1, wordCount);
  if (avgWordLength > 6) {
    score += 10;
  }

  // Cap at 100
  return Math.min(100, score);
}

/**
 * Determine complexity level from score.
 *
 * Thresholds:
 * - 60-100: complex
 * - 30-59: moderate
 * - 0-29: simple
 *
 * @param score - Complexity score (0-100)
 * @returns Complexity level
 */
export function determineComplexityLevel(score: number): ComplexityLevel {
  if (score >= 60) {
    return 'complex';
  }
  if (score >= 30) {
    return 'moderate';
  }
  return 'simple';
}

// ============================================================================
// Main Analyzer
// ============================================================================

/**
 * Analyze a prompt for complexity metrics.
 *
 * This function takes the prompt text along with pre-calculated
 * char_count and word_count (which already exist in the prompts table)
 * and computes additional complexity metrics.
 *
 * Performance target: <2ms per prompt
 *
 * @param text - The prompt text to analyze
 * @param charCount - Pre-calculated character count
 * @param wordCount - Pre-calculated word count
 * @returns Full complexity metrics
 */
export function analyzeComplexity(
  text: string,
  charCount: number,
  wordCount: number
): ComplexityMetrics {
  // Count sentences
  const sentenceCount = countSentences(text);

  // Detect code
  const hasCode = detectCode(text);
  const codeBlockCount = countCodeBlocks(text);

  // Detect file references
  const hasFileRefs = detectFileRefs(text);
  const fileRefCount = countFileReferences(text);

  // Build partial metrics for scoring
  const partialMetrics: Partial<ComplexityMetrics> = {
    charCount,
    wordCount,
    sentenceCount,
    hasCode,
    hasFileRefs,
    codeBlockCount,
    fileRefCount,
  };

  // Calculate score and level
  const complexityScore = calculateComplexityScore(partialMetrics);
  const complexityLevel = determineComplexityLevel(complexityScore);

  return {
    charCount,
    wordCount,
    sentenceCount,
    hasCode,
    hasFileRefs,
    codeBlockCount,
    fileRefCount,
    complexityLevel,
    complexityScore,
  };
}

/**
 * Quick complexity check for performance-sensitive paths.
 * Returns just the score and level without detailed metrics.
 *
 * @param text - The prompt text to analyze
 * @param charCount - Pre-calculated character count
 * @param wordCount - Pre-calculated word count
 * @returns Just score and level
 */
export function quickComplexityCheck(
  text: string,
  charCount: number,
  wordCount: number
): Pick<ComplexityMetrics, 'complexityScore' | 'complexityLevel'> {
  const sentenceCount = countSentences(text);
  const hasCode = detectCode(text);
  const hasFileRefs = detectFileRefs(text);
  const codeBlockCount = countCodeBlocks(text);

  const score = calculateComplexityScore({
    charCount,
    wordCount,
    sentenceCount,
    hasCode,
    hasFileRefs,
    codeBlockCount,
  });

  return {
    complexityScore: score,
    complexityLevel: determineComplexityLevel(score),
  };
}
