/**
 * Interaction Timing Analyzer
 * Story 21-5: Interaction Timing Analysis
 *
 * Analyzes prompts for timing patterns including:
 * - Time since previous prompt
 * - Rapid-fire detection (< 30 seconds)
 * - Long-pause detection (> 5 minutes)
 * - Follow-up pattern detection
 * - Sequence numbering within sessions
 *
 * Performance requirement: <1ms per prompt
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Timing metrics for a prompt
 */
export interface TimingMetrics {
  /** Seconds since previous prompt in session (null for first prompt) */
  timeSincePrevious: number | null;
  /** True if prompt was submitted < 30 seconds after previous */
  isRapidFire: boolean;
  /** True if prompt was submitted > 5 minutes after previous */
  isLongPause: boolean;
  /** True if prompt starts with follow-up patterns */
  isFollowUp: boolean;
  /** Prompt sequence number within session */
  sequenceNumber: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Threshold for rapid-fire detection in seconds.
 * Prompts submitted faster than this are considered rapid-fire.
 */
export const RAPID_FIRE_THRESHOLD_SECONDS = 30;

/**
 * Threshold for long-pause detection in seconds.
 * Prompts submitted slower than this are considered long-pause.
 */
export const LONG_PAUSE_THRESHOLD_SECONDS = 300; // 5 minutes

/**
 * Patterns that indicate a follow-up prompt.
 * These patterns must appear at the start of the prompt text.
 */
export const FOLLOW_UP_PATTERNS: readonly RegExp[] = [
  // Continuation patterns
  /^(also|and|additionally|furthermore)\b/i,
  // Sequential patterns
  /^(now|next|then)\b/i,
  // Addition patterns
  /^(one more thing|another thing)\b/i,
  // Interjection patterns
  /^(oh|wait)\b/i,
] as const;

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Check if prompt text starts with a follow-up pattern.
 *
 * @param text - The prompt text to analyze
 * @returns true if the prompt is a follow-up
 */
export function isFollowUpPrompt(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  const trimmedText = text.trim();
  return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(trimmedText));
}

/**
 * Calculate time difference in seconds between two timestamps.
 *
 * @param current - Current timestamp
 * @param previous - Previous timestamp
 * @returns Seconds elapsed (floored to integer)
 */
function calculateTimeDifferenceSeconds(
  current: Date,
  previous: Date
): number {
  const diffMs = current.getTime() - previous.getTime();
  return Math.floor(diffMs / 1000);
}

// ============================================================================
// Main Analyzer
// ============================================================================

/**
 * Analyze timing metrics for a prompt within its session context.
 *
 * This function calculates:
 * - Time since previous prompt (if available)
 * - Whether the prompt is rapid-fire (< 30 seconds)
 * - Whether the prompt follows a long pause (> 5 minutes)
 * - Whether the prompt is a follow-up based on text patterns
 *
 * Performance target: <1ms per prompt
 *
 * @param promptText - The prompt text to analyze
 * @param currentTimestamp - When this prompt was submitted
 * @param previousTimestamp - When the previous prompt was submitted (null for first)
 * @param sequenceNumber - The sequence number of this prompt in the session
 * @returns Complete timing metrics
 */
export function analyzeTimingWithContext(
  promptText: string,
  currentTimestamp: Date,
  previousTimestamp: Date | null,
  sequenceNumber: number
): TimingMetrics {
  let timeSincePrevious: number | null = null;
  let isRapidFire = false;
  let isLongPause = false;

  // Calculate timing metrics if we have a previous timestamp
  if (previousTimestamp !== null) {
    timeSincePrevious = calculateTimeDifferenceSeconds(
      currentTimestamp,
      previousTimestamp
    );

    // Check for rapid-fire (strictly less than threshold)
    isRapidFire = timeSincePrevious < RAPID_FIRE_THRESHOLD_SECONDS;

    // Check for long-pause (strictly greater than threshold)
    isLongPause = timeSincePrevious > LONG_PAUSE_THRESHOLD_SECONDS;
  }

  // Check for follow-up patterns in text
  const isFollowUp = isFollowUpPrompt(promptText);

  return {
    timeSincePrevious,
    isRapidFire,
    isLongPause,
    isFollowUp,
    sequenceNumber,
  };
}
