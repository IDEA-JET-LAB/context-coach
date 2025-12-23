/**
 * Exhaustion Feedback Generator
 * Story 21-1: Context Window Management (AC #9)
 *
 * Generates dynamic feedback messages based on user's context exhaustion rate.
 * Provides severity-based messaging to help users understand their session patterns.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Severity level for exhaustion feedback
 */
export type ExhaustionSeverity = 'low' | 'moderate' | 'high';

/**
 * Feedback message with severity classification
 */
export interface ExhaustionFeedback {
  /** Human-readable feedback message */
  message: string;
  /** Severity level based on exhaustion rate */
  severity: ExhaustionSeverity;
  /** Suggestion for improvement */
  suggestion: string;
}

// ============================================================================
// Thresholds
// ============================================================================

/**
 * Exhaustion rate thresholds for severity classification
 */
export const EXHAUSTION_THRESHOLDS = {
  /** Rate above which is considered high severity */
  HIGH: 0.5,
  /** Rate above which is considered moderate severity */
  MODERATE: 0.25,
} as const;

// ============================================================================
// Suggestions
// ============================================================================

/**
 * Improvement suggestions based on severity
 */
const SUGGESTIONS: Record<ExhaustionSeverity, string> = {
  high: 'Consider breaking large tasks into smaller, focused sessions. Start fresh more often to maintain AI response quality.',
  moderate: 'Try summarizing progress before sessions get too long. Consider using session checkpoints.',
  low: 'Your session management is good! Continue maintaining reasonable session lengths.',
};

// ============================================================================
// Feedback Generation
// ============================================================================

/**
 * Determine the severity level based on exhaustion rate.
 *
 * Thresholds:
 * - High: > 50% of sessions hit context limits
 * - Moderate: > 25% of sessions hit context limits
 * - Low: <= 25% of sessions hit context limits
 *
 * @param exhaustionRate - Rate between 0.0 and 1.0
 * @returns Severity level
 */
export function determineExhaustionSeverity(exhaustionRate: number): ExhaustionSeverity {
  if (exhaustionRate > EXHAUSTION_THRESHOLDS.HIGH) {
    return 'high';
  }
  if (exhaustionRate > EXHAUSTION_THRESHOLDS.MODERATE) {
    return 'moderate';
  }
  return 'low';
}

/**
 * Generate feedback message for the user based on their exhaustion rate.
 *
 * The message format is: "You hit context limits in X% of sessions"
 * with an appropriate severity classification and improvement suggestion.
 *
 * @param exhaustionRate - Rate between 0.0 and 1.0 (e.g., 0.35 = 35%)
 * @returns Feedback with message, severity, and suggestion
 *
 * @example
 * ```typescript
 * // High exhaustion rate
 * generateExhaustionFeedback(0.6);
 * // {
 * //   message: "You hit context limits in 60% of sessions",
 * //   severity: "high",
 * //   suggestion: "Consider breaking large tasks..."
 * // }
 *
 * // Low exhaustion rate
 * generateExhaustionFeedback(0.1);
 * // {
 * //   message: "You hit context limits in 10% of sessions",
 * //   severity: "low",
 * //   suggestion: "Your session management is good!..."
 * // }
 * ```
 */
export function generateExhaustionFeedback(exhaustionRate: number): ExhaustionFeedback {
  // Clamp rate to valid range
  const clampedRate = Math.max(0, Math.min(1, exhaustionRate));
  const percentage = Math.round(clampedRate * 100);
  const severity = determineExhaustionSeverity(clampedRate);

  return {
    message: `You hit context limits in ${percentage}% of sessions`,
    severity,
    suggestion: SUGGESTIONS[severity],
  };
}

/**
 * Generate a warning message for sessions approaching context exhaustion.
 *
 * Used when a session is detected as potentially exhausted but the user
 * hasn't explicitly indicated it.
 *
 * @param confidence - Detection confidence (0.0 to 1.0)
 * @returns Warning message and suggested action
 */
export function generateSessionWarning(confidence: number): {
  warning: string;
  action: string;
} {
  if (confidence >= 0.9) {
    return {
      warning: 'This session appears to have reached its context window limit.',
      action: 'Consider summarizing your progress and starting a fresh session for better AI responses.',
    };
  }

  if (confidence >= 0.6) {
    return {
      warning: 'This session may be approaching its context window limit.',
      action: 'Consider creating a summary checkpoint or starting a new session soon.',
    };
  }

  return {
    warning: 'Session health is good.',
    action: 'Continue with your current session.',
  };
}
