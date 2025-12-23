/**
 * Session Sentiment Tracker for Contextor
 * Story 21-3: Sentiment Analysis
 *
 * Tracks session-level sentiment metrics:
 * - Frustration trend (increasing, decreasing, stable)
 * - Rising frustration detection
 * - Politeness ratio
 *
 * Performance Requirements:
 * - Process 100 prompts in under 5ms
 * - No external dependencies or API calls
 */

import { Sentiment } from './sentiment-classifier';

/**
 * Frustration trend within a session.
 */
export type FrustrationTrend = 'increasing' | 'decreasing' | 'stable';

/**
 * Minimal prompt data needed for sentiment tracking.
 */
export interface PromptWithSentiment {
  id: string;
  sentiment: Sentiment | null;
  sentiment_scores: {
    polite: number;
    frustrated: number;
    directive: number;
    collaborative: number;
  } | null;
}

/**
 * Session-level sentiment metrics.
 */
export interface SessionSentimentMetrics {
  /** Frustration trend within session */
  frustrationTrend: FrustrationTrend;
  /** Flag for sessions with rising frustration */
  frustrationRising: boolean;
  /** Politeness ratio (0-1) */
  politenessRatio: number;
  /** Count of each sentiment type */
  sentimentBreakdown: {
    polite: number;
    frustrated: number;
    neutral: number;
    directive: number;
    collaborative: number;
  };
}

/**
 * Calculate frustration trend based on session prompts.
 *
 * Compares the average frustration score of the first half to the second half.
 * - If second half avg is > 0.1 higher: increasing
 * - If second half avg is > 0.1 lower: decreasing
 * - Otherwise: stable
 *
 * @param prompts - Array of prompts with sentiment scores
 * @returns Frustration trend: 'increasing' | 'decreasing' | 'stable'
 *
 * @example
 * ```ts
 * calculateFrustrationTrend([
 *   { sentiment_scores: { frustrated: 0.1 } },
 *   { sentiment_scores: { frustrated: 0.2 } },
 *   { sentiment_scores: { frustrated: 0.5 } },
 *   { sentiment_scores: { frustrated: 0.7 } },
 * ]) // => 'increasing'
 * ```
 */
export function calculateFrustrationTrend(
  prompts: PromptWithSentiment[]
): FrustrationTrend {
  if (prompts.length < 3) {
    return 'stable';
  }

  const scores = prompts.map((p) => p.sentiment_scores?.frustrated ?? 0);
  const midpoint = Math.floor(scores.length / 2);

  const firstHalf = scores.slice(0, midpoint);
  const secondHalf = scores.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;

  if (diff > 0.1) {
    return 'increasing';
  }
  if (diff < -0.1) {
    return 'decreasing';
  }
  return 'stable';
}

/**
 * Detect rising frustration for flagging/review.
 *
 * Returns true if either:
 * - 3+ consecutive frustrated prompts
 * - Frustration score increases by > 0.3 from first to last prompt
 *
 * @param prompts - Array of prompts with sentiment
 * @returns true if rising frustration detected
 *
 * @example
 * ```ts
 * // 3 consecutive frustrated prompts
 * detectRisingFrustration([
 *   { sentiment: 'frustrated' },
 *   { sentiment: 'frustrated' },
 *   { sentiment: 'frustrated' },
 * ]) // => true
 *
 * // Frustration score increase > 0.3
 * detectRisingFrustration([
 *   { sentiment_scores: { frustrated: 0.1 } },
 *   { sentiment_scores: { frustrated: 0.5 } }, // 0.5 - 0.1 = 0.4 > 0.3
 * ]) // => true (if length >= 3)
 * ```
 */
export function detectRisingFrustration(
  prompts: PromptWithSentiment[]
): boolean {
  if (prompts.length < 3) {
    return false;
  }

  // Check for 3+ consecutive frustrated prompts
  let consecutiveFrustrated = 0;
  for (const prompt of prompts) {
    if (prompt.sentiment === 'frustrated') {
      consecutiveFrustrated++;
      if (consecutiveFrustrated >= 3) {
        return true;
      }
    } else {
      consecutiveFrustrated = 0;
    }
  }

  // Check for frustration score increase > 0.3 from start to end
  const firstScore = prompts[0]?.sentiment_scores?.frustrated ?? 0;
  const lastScore =
    prompts[prompts.length - 1]?.sentiment_scores?.frustrated ?? 0;

  if (lastScore - firstScore > 0.3) {
    return true;
  }

  return false;
}

/**
 * Calculate politeness ratio for a session.
 *
 * Formula: polite_count / (polite_count + frustrated_count)
 * Returns 0.5 if there are no polite or frustrated prompts (neutral default).
 *
 * @param prompts - Array of prompts with sentiment
 * @returns Politeness ratio from 0 to 1
 *
 * @example
 * ```ts
 * calculatePolitenessRatio([
 *   { sentiment: 'polite' },
 *   { sentiment: 'polite' },
 *   { sentiment: 'frustrated' },
 *   { sentiment: 'neutral' },
 * ]) // => 0.67 (2 polite / 3 total polite+frustrated)
 * ```
 */
export function calculatePolitenessRatio(
  prompts: PromptWithSentiment[]
): number {
  const politeCount = prompts.filter((p) => p.sentiment === 'polite').length;
  const frustratedCount = prompts.filter(
    (p) => p.sentiment === 'frustrated'
  ).length;

  if (politeCount + frustratedCount === 0) {
    return 0.5; // neutral default
  }

  return politeCount / (politeCount + frustratedCount);
}

/**
 * Calculate sentiment breakdown counts.
 *
 * @param prompts - Array of prompts with sentiment
 * @returns Object with count for each sentiment type
 */
function calculateSentimentBreakdown(prompts: PromptWithSentiment[]): {
  polite: number;
  frustrated: number;
  neutral: number;
  directive: number;
  collaborative: number;
} {
  const breakdown = {
    polite: 0,
    frustrated: 0,
    neutral: 0,
    directive: 0,
    collaborative: 0,
  };

  for (const prompt of prompts) {
    if (prompt.sentiment && prompt.sentiment in breakdown) {
      breakdown[prompt.sentiment]++;
    }
  }

  return breakdown;
}

/**
 * Calculate all session-level sentiment metrics.
 *
 * @param prompts - Array of prompts with sentiment data
 * @returns Complete session sentiment metrics
 *
 * @example
 * ```ts
 * const metrics = calculateSessionSentimentMetrics(sessionPrompts);
 * // => {
 * //   frustrationTrend: 'increasing',
 * //   frustrationRising: true,
 * //   politenessRatio: 0.25,
 * //   sentimentBreakdown: { polite: 1, frustrated: 3, ... }
 * // }
 * ```
 */
export function calculateSessionSentimentMetrics(
  prompts: PromptWithSentiment[]
): SessionSentimentMetrics {
  return {
    frustrationTrend: calculateFrustrationTrend(prompts),
    frustrationRising: detectRisingFrustration(prompts),
    politenessRatio: calculatePolitenessRatio(prompts),
    sentimentBreakdown: calculateSentimentBreakdown(prompts),
  };
}
