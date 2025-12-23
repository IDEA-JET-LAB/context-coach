/**
 * Context Window Management
 * Story 21-1: Context Window Management
 *
 * Detects when sessions are approaching or have exhausted their context window.
 * Uses keyword patterns and session duration heuristics to identify exhaustion.
 *
 * Performance requirement: <1ms per prompt
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Detection method used to identify context exhaustion
 */
export type DetectionMethod = 'keyword' | 'session_duration' | 'pattern';

/**
 * Result of context exhaustion detection
 */
export interface ContextExhaustionResult {
  /** Whether context exhaustion was detected */
  isExhausted: boolean;
  /** Confidence level (0.0 to 1.0) */
  confidence: number;
  /** Method used for detection (null if not exhausted) */
  detectionMethod: DetectionMethod | null;
}

// ============================================================================
// Exhaustion Patterns
// ============================================================================

/**
 * Regex patterns that indicate context exhaustion.
 * These patterns match phrases users commonly use when resuming
 * a conversation after hitting context limits.
 *
 * Case-insensitive matching is applied at detection time.
 */
export const EXHAUSTION_PATTERNS: RegExp[] = [
  /continued from (?:a )?previous conversation/i,
  /ran out of context/i,
  /context limit/i,
  /start(?:ing)? fresh/i,
  /new conversation/i,
  /let me summarize where we were/i,
  /picking up from/i,
  /where we left off/i,
  /resuming (?:the|our) (?:previous )?conversation/i,
  /continuing from (?:the )?last session/i,
];

// ============================================================================
// Detection Constants
// ============================================================================

/**
 * Confidence level for keyword-based detection (high)
 */
const KEYWORD_CONFIDENCE = 0.95;

/**
 * Confidence level for duration-based detection (moderate)
 */
const DURATION_CONFIDENCE = 0.60;

/**
 * Session duration threshold in minutes for duration-based detection
 * Sessions exceeding this duration are flagged with moderate confidence
 */
const DURATION_THRESHOLD_MINUTES = 90;

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Check if prompt text matches any exhaustion keyword patterns.
 *
 * @param text - The prompt text to analyze
 * @returns true if any exhaustion pattern matches
 */
export function matchesExhaustionKeywords(text: string): boolean {
  if (!text || text.length === 0) {
    return false;
  }

  // Check each pattern for a match
  for (const pattern of EXHAUSTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if session duration indicates potential context exhaustion.
 *
 * @param durationMinutes - Session duration in minutes
 * @returns true if duration exceeds threshold
 */
export function exceedsDurationThreshold(durationMinutes: number): boolean {
  if (typeof durationMinutes !== 'number' || isNaN(durationMinutes)) {
    return false;
  }

  return durationMinutes > DURATION_THRESHOLD_MINUTES;
}

/**
 * Detect context exhaustion in a prompt.
 *
 * Detection priority:
 * 1. Keyword match = 95% confidence (high)
 * 2. Session > 90 minutes = 60% confidence (moderate)
 * 3. Default = no exhaustion detected
 *
 * Performance: Designed to complete in <1ms per prompt.
 *
 * @param promptText - The prompt text to analyze
 * @param sessionDurationMinutes - Current session duration in minutes
 * @returns Detection result with exhaustion status, confidence, and method
 *
 * @example
 * ```typescript
 * // Keyword detection
 * detectContextExhaustion('Continued from a previous conversation...', 30);
 * // { isExhausted: true, confidence: 0.95, detectionMethod: 'keyword' }
 *
 * // Duration detection
 * detectContextExhaustion('Help me fix this bug', 95);
 * // { isExhausted: true, confidence: 0.60, detectionMethod: 'session_duration' }
 *
 * // No detection
 * detectContextExhaustion('Write a unit test', 30);
 * // { isExhausted: false, confidence: 0, detectionMethod: null }
 * ```
 */
export function detectContextExhaustion(
  promptText: string,
  sessionDurationMinutes: number
): ContextExhaustionResult {
  // Priority 1: Check for keyword patterns (highest confidence)
  if (matchesExhaustionKeywords(promptText)) {
    return {
      isExhausted: true,
      confidence: KEYWORD_CONFIDENCE,
      detectionMethod: 'keyword',
    };
  }

  // Priority 2: Check session duration (moderate confidence)
  if (exceedsDurationThreshold(sessionDurationMinutes)) {
    return {
      isExhausted: true,
      confidence: DURATION_CONFIDENCE,
      detectionMethod: 'session_duration',
    };
  }

  // No exhaustion detected
  return {
    isExhausted: false,
    confidence: 0,
    detectionMethod: null,
  };
}

// ============================================================================
// Session Update Functions
// ============================================================================

/**
 * Interface for session exhaustion update
 */
export interface SessionExhaustionUpdate {
  context_exhausted: boolean;
  exhaustion_detected_at: string | null;
}

/**
 * Create an update object for marking a session as context exhausted.
 *
 * @param result - The context exhaustion detection result
 * @returns Update object for the session
 */
export function createExhaustionUpdate(
  result: ContextExhaustionResult
): SessionExhaustionUpdate | null {
  if (!result.isExhausted) {
    return null;
  }

  return {
    context_exhausted: true,
    exhaustion_detected_at: new Date().toISOString(),
  };
}
