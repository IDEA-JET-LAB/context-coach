/**
 * Sentiment Classifier for Contextor
 * Story 21-3: Sentiment Analysis
 *
 * Automatically classifies prompts into one of 5 sentiment categories:
 * polite, frustrated, neutral, directive, collaborative
 *
 * Performance Requirements:
 * - Average execution: <2ms per prompt
 * - No external dependencies or API calls
 */

/**
 * The 5 sentiment types for prompt classification.
 */
export const SENTIMENT_TYPES = [
  'polite',
  'frustrated',
  'neutral',
  'directive',
  'collaborative',
] as const;

/**
 * Type for valid sentiment values.
 */
export type Sentiment = (typeof SENTIMENT_TYPES)[number];

/**
 * Result of analyzing a prompt's sentiment.
 */
export interface SentimentResult {
  /** The classified sentiment */
  sentiment: Sentiment;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Polite score (0-1) */
  politeScore: number;
  /** Frustrated score (0-1) */
  frustratedScore: number;
  /** Directive score (0-1) */
  directiveScore: number;
  /** Collaborative score (0-1) */
  collaborativeScore: number;
}

/**
 * Weighted pattern for sentiment detection.
 */
interface WeightedPattern {
  pattern: RegExp;
  weight: number;
}

// ============================================================================
// Pattern Definitions
// ============================================================================

/**
 * Polite patterns with weights.
 * Higher weights for stronger polite signals.
 * Threshold is >= 0.3 so single patterns need at least 0.31
 */
const POLITE_PATTERNS: WeightedPattern[] = [
  { pattern: /please/i, weight: 0.35 },
  { pattern: /thank you|thanks/i, weight: 0.4 },
  { pattern: /could you|would you/i, weight: 0.35 },
  { pattern: /would you mind/i, weight: 0.4 },
  { pattern: /great|awesome|excellent|perfect/i, weight: 0.35 },
  { pattern: /great job|good job|nice work/i, weight: 0.4 },
  { pattern: /appreciate/i, weight: 0.35 },
  { pattern: /kindly/i, weight: 0.3 },
];

/**
 * Frustrated patterns with weights.
 * Higher weights for stronger frustration signals.
 * Threshold is > 0.4 so need accumulated weight > 0.4
 */
const FRUSTRATED_PATTERNS: WeightedPattern[] = [
  { pattern: /why (is|does|doesn't|doesn't|isn't|isn't) (this|it)/i, weight: 0.3 },
  { pattern: /why does this keep/i, weight: 0.45 },
  { pattern: /still (not|wrong|broken|failing)/i, weight: 0.5 },
  { pattern: /this (cannot|can't|can't|shouldn't|shouldn't) be/i, weight: 0.45 },
  { pattern: /cannot be right|can't be right/i, weight: 0.45 },
  { pattern: /something is wrong/i, weight: 0.45 },
  { pattern: /what the|wtf/i, weight: 0.7 },
  { pattern: /frustrat|annoy|irritat/i, weight: 0.6 },
  { pattern: /again\?!?|another error/i, weight: 0.4 },
  { pattern: /i (don't|dont|can't|cant) understand why/i, weight: 0.45 },
  { pattern: /keeps? (failing|breaking)/i, weight: 0.45 },
];

/**
 * Directive patterns with weights.
 * Focused on imperative verb patterns at the start of prompts.
 */
const DIRECTIVE_PATTERNS: WeightedPattern[] = [
  { pattern: /^(do|make|create|add|remove|fix|update|delete|refactor)\b/i, weight: 0.4 },
  { pattern: /^[A-Z][a-z]+\s+(the|a|this)\s+/m, weight: 0.2 },
];

/**
 * Collaborative patterns with weights.
 * Focused on inclusive language and team-oriented phrases.
 * Threshold is > 0.35 so single patterns need >= 0.36
 */
const COLLABORATIVE_PATTERNS: WeightedPattern[] = [
  { pattern: /let's/i, weight: 0.4 },
  { pattern: /we (could|can|should)/i, weight: 0.4 },
  { pattern: /shall we/i, weight: 0.4 },
  { pattern: /together/i, weight: 0.35 },
  { pattern: /how about we/i, weight: 0.4 },
  { pattern: /what if we/i, weight: 0.4 },
  { pattern: /help me understand/i, weight: 0.4 },
  { pattern: /work with me/i, weight: 0.4 },
];

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate cumulative score for a set of patterns.
 * @param text - The text to analyze
 * @param patterns - Array of weighted patterns
 * @returns Cumulative score (capped at 1.0)
 */
function calculateScore(text: string, patterns: WeightedPattern[]): number {
  let score = 0;
  for (const { pattern, weight } of patterns) {
    if (pattern.test(text)) {
      score += weight;
    }
  }
  return Math.min(1, score);
}

// ============================================================================
// Main Analyzer
// ============================================================================

/**
 * Analyzes a prompt for sentiment.
 *
 * Uses weighted pattern matching to calculate scores for each sentiment type,
 * then applies priority-based classification:
 * 1. frustrated (>0.4) - highest priority due to user experience impact
 * 2. collaborative (>0.35) - team-oriented communication
 * 3. polite (>0.3) - courteous communication
 * 4. directive (>0.3) - command-style communication
 * 5. neutral - fallback for unclassified prompts
 *
 * @param promptText - The prompt text to analyze
 * @returns SentimentResult with sentiment, confidence, and individual scores
 *
 * @example
 * ```ts
 * analyzeSentiment('please help me')
 * // => { sentiment: 'polite', confidence: 0.5, politeScore: 0.3, ... }
 *
 * analyzeSentiment('wtf is this?!')
 * // => { sentiment: 'frustrated', confidence: 0.95, frustratedScore: 0.7, ... }
 *
 * analyzeSentiment("let's work together")
 * // => { sentiment: 'collaborative', confidence: 0.65, collaborativeScore: 0.4, ... }
 * ```
 */
export function analyzeSentiment(promptText: string): SentimentResult {
  const trimmed = promptText.trim();

  // Calculate scores for each sentiment type
  const politeScore = calculateScore(trimmed, POLITE_PATTERNS);
  const frustratedScore = calculateScore(trimmed, FRUSTRATED_PATTERNS);
  const directiveScore = calculateScore(trimmed, DIRECTIVE_PATTERNS);
  const collaborativeScore = calculateScore(trimmed, COLLABORATIVE_PATTERNS);

  // Determine sentiment based on priority and thresholds
  // Priority: frustrated > (polite if stronger than collaborative) > collaborative > polite > directive > neutral
  // When polite and collaborative both match, compare their relative strengths
  let sentiment: Sentiment;
  let confidence: number;

  if (frustratedScore >= 0.45) {
    sentiment = 'frustrated';
    confidence = Math.min(0.95, frustratedScore + 0.3);
  } else if (collaborativeScore >= 0.36 && collaborativeScore > politeScore) {
    // Collaborative only wins if it's stronger than polite
    sentiment = 'collaborative';
    confidence = Math.min(0.90, collaborativeScore + 0.25);
  } else if (politeScore >= 0.35) {
    sentiment = 'polite';
    confidence = Math.min(0.95, politeScore + 0.2);
  } else if (collaborativeScore >= 0.36) {
    // Fallback to collaborative if polite didn't meet threshold
    sentiment = 'collaborative';
    confidence = Math.min(0.90, collaborativeScore + 0.25);
  } else if (directiveScore >= 0.35) {
    sentiment = 'directive';
    confidence = Math.min(0.85, directiveScore + 0.2);
  } else {
    sentiment = 'neutral';
    confidence = 0.7;
  }

  return {
    sentiment,
    confidence,
    politeScore,
    frustratedScore,
    directiveScore,
    collaborativeScore,
  };
}

/**
 * Converts SentimentResult scores to JSONB format for database storage.
 *
 * @param result - The sentiment analysis result
 * @returns Object with individual scores for JSONB storage
 *
 * @example
 * ```ts
 * const result = analyzeSentiment('please help');
 * const scores = toSentimentScoresJson(result);
 * // => { polite: 0.3, frustrated: 0, directive: 0, collaborative: 0 }
 * ```
 */
export function toSentimentScoresJson(result: SentimentResult): {
  polite: number;
  frustrated: number;
  directive: number;
  collaborative: number;
} {
  return {
    polite: result.politeScore,
    frustrated: result.frustratedScore,
    directive: result.directiveScore,
    collaborative: result.collaborativeScore,
  };
}
