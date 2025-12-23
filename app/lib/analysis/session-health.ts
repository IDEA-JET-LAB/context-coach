/**
 * Session Health Score Calculator
 * Story 21-7: Session Health Score
 *
 * Calculates a composite health score (0-100) for sessions based on:
 * - Duration (25 pts max)
 * - Context usage (25 pts max)
 * - Frustration rate (25 pts max)
 * - Retry rate (20 pts max)
 * - Tool error rate (20 pts max)
 *
 * Total maximum: 115 pts, normalized to 100
 *
 * Health levels:
 * - healthy: score >= 75
 * - warning: score >= 50 and < 75
 * - critical: score < 50
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Health level classification
 */
export type HealthLevel = 'healthy' | 'warning' | 'critical';

/**
 * Input data for session health calculation
 */
export interface SessionHealthInput {
  /** Session duration in minutes */
  durationMinutes: number;
  /** Context window usage estimate (0.0 to 1.0) */
  contextUsageEstimate: number;
  /** Number of prompts with frustrated sentiment */
  frustrationCount: number;
  /** Total prompts in session */
  totalPrompts: number;
  /** Number of retry prompts */
  retryCount: number;
  /** Number of failed tool executions */
  toolErrorCount: number;
  /** Total tool calls in session */
  toolCallCount: number;
}

/**
 * Individual factor scores
 */
export interface HealthFactors {
  /** Duration score (0-25) */
  durationScore: number;
  /** Context usage score (0-25) */
  contextScore: number;
  /** Frustration rate score (0-25) */
  frustrationScore: number;
  /** Retry rate score (0-20) */
  retryScore: number;
  /** Tool error rate score (0-20) */
  toolErrorScore: number;
}

/**
 * Warning with suggestion
 */
export interface HealthWarning {
  /** Factor that triggered the warning */
  factor: keyof HealthFactors;
  /** Warning message */
  warning: string;
  /** Actionable suggestion */
  suggestion: string;
  /** Severity: low (score < threshold but ok), medium (score <= 50%), high (score <= 25%) */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Complete session health metrics
 */
export interface SessionHealthMetrics {
  /** Overall health score (0-100) */
  healthScore: number;
  /** Health level classification */
  healthLevel: HealthLevel;
  /** Individual factor scores */
  factors: HealthFactors;
  /** Warnings for low-scoring factors */
  warnings: HealthWarning[];
  /** Aggregated suggestions for improvement */
  suggestions: string[];
}

/**
 * Health trend point for history tracking
 */
export interface HealthTrendPoint {
  /** ISO timestamp */
  timestamp: string;
  /** Health score at this point */
  healthScore: number;
  /** Health level at this point */
  healthLevel: HealthLevel;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum points for each factor
 */
export const FACTOR_MAX_POINTS = {
  duration: 25,
  context: 25,
  frustration: 25,
  retry: 20,
  toolError: 20,
} as const;

/**
 * Total maximum raw points (before normalization)
 */
export const TOTAL_MAX_POINTS =
  FACTOR_MAX_POINTS.duration +
  FACTOR_MAX_POINTS.context +
  FACTOR_MAX_POINTS.frustration +
  FACTOR_MAX_POINTS.retry +
  FACTOR_MAX_POINTS.toolError; // 115

/**
 * Health level thresholds
 */
export const HEALTH_THRESHOLDS = {
  healthy: 75,
  warning: 50,
} as const;

/**
 * Warning thresholds for factors (below this triggers a warning)
 * - 25pt factors: threshold at 15 (60%)
 * - 20pt factors: threshold at 12 (60%)
 */
export const WARNING_THRESHOLDS = {
  duration: 15,
  context: 15,
  frustration: 15,
  retry: 12,
  toolError: 12,
} as const;

// ============================================================================
// Duration Scoring
// ============================================================================

/**
 * Calculate duration score based on session length.
 *
 * Scoring:
 * - <=60min = 25pts (optimal)
 * - <=90min = 20pts (good)
 * - <=120min = 15pts (acceptable)
 * - <=180min = 10pts (long)
 * - >180min = 5pts (very long)
 *
 * @param minutes - Session duration in minutes
 * @returns Score from 5 to 25
 */
export function calculateDurationScore(minutes: number): number {
  // Handle invalid input
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
    return FACTOR_MAX_POINTS.duration; // Assume best case for invalid/new sessions
  }

  if (minutes <= 60) return 25;
  if (minutes <= 90) return 20;
  if (minutes <= 120) return 15;
  if (minutes <= 180) return 10;
  return 5;
}

// ============================================================================
// Context Usage Scoring
// ============================================================================

/**
 * Calculate context usage score.
 *
 * Scoring:
 * - <=50% = 25pts (low usage)
 * - <=70% = 20pts (moderate usage)
 * - <=80% = 15pts (high usage)
 * - <=90% = 10pts (very high usage)
 * - >90% = 5pts (near exhaustion)
 *
 * @param usage - Context usage estimate (0.0 to 1.0)
 * @returns Score from 5 to 25
 */
export function calculateContextScore(usage: number): number {
  // Handle invalid input
  if (typeof usage !== 'number' || isNaN(usage)) {
    return FACTOR_MAX_POINTS.context; // Assume best case for invalid
  }

  // Clamp to valid range
  const clampedUsage = Math.max(0, Math.min(1, usage));

  if (clampedUsage <= 0.5) return 25;
  if (clampedUsage <= 0.7) return 20;
  if (clampedUsage <= 0.8) return 15;
  if (clampedUsage <= 0.9) return 10;
  return 5;
}

// ============================================================================
// Frustration Rate Scoring
// ============================================================================

/**
 * Calculate frustration score based on frustrated prompt rate.
 *
 * Scoring:
 * - <=2% = 25pts (minimal frustration)
 * - <=5% = 20pts (low frustration)
 * - <=10% = 15pts (moderate frustration)
 * - <=15% = 10pts (high frustration)
 * - >15% = 5pts (very high frustration)
 *
 * @param frustrationCount - Number of frustrated prompts
 * @param totalPrompts - Total prompts in session
 * @returns Score from 5 to 25
 */
export function calculateFrustrationScore(
  frustrationCount: number,
  totalPrompts: number
): number {
  // Handle edge cases
  if (totalPrompts <= 0 || frustrationCount < 0) {
    return FACTOR_MAX_POINTS.frustration; // Assume best case for new/empty sessions
  }

  const rate = frustrationCount / totalPrompts;

  if (rate <= 0.02) return 25;
  if (rate <= 0.05) return 20;
  if (rate <= 0.1) return 15;
  if (rate <= 0.15) return 10;
  return 5;
}

/**
 * Calculate frustration rate as a decimal.
 *
 * @param frustrationCount - Number of frustrated prompts
 * @param totalPrompts - Total prompts in session
 * @returns Rate from 0 to 1
 */
export function calculateFrustrationRate(
  frustrationCount: number,
  totalPrompts: number
): number {
  if (totalPrompts <= 0 || frustrationCount < 0) {
    return 0;
  }
  return frustrationCount / totalPrompts;
}

// ============================================================================
// Retry Rate Scoring
// ============================================================================

/**
 * Calculate retry score based on retry prompt rate.
 *
 * Scoring:
 * - <=5% = 20pts (minimal retries)
 * - <=10% = 16pts (low retries)
 * - <=15% = 12pts (moderate retries)
 * - <=20% = 8pts (high retries)
 * - >20% = 4pts (very high retries)
 *
 * @param retryCount - Number of retry prompts
 * @param totalPrompts - Total prompts in session
 * @returns Score from 4 to 20
 */
export function calculateRetryScore(
  retryCount: number,
  totalPrompts: number
): number {
  // Handle edge cases
  if (totalPrompts <= 0 || retryCount < 0) {
    return FACTOR_MAX_POINTS.retry; // Assume best case for new/empty sessions
  }

  const rate = retryCount / totalPrompts;

  if (rate <= 0.05) return 20;
  if (rate <= 0.1) return 16;
  if (rate <= 0.15) return 12;
  if (rate <= 0.2) return 8;
  return 4;
}

/**
 * Calculate retry rate as a decimal.
 *
 * @param retryCount - Number of retry prompts
 * @param totalPrompts - Total prompts in session
 * @returns Rate from 0 to 1
 */
export function calculateRetryRate(
  retryCount: number,
  totalPrompts: number
): number {
  if (totalPrompts <= 0 || retryCount < 0) {
    return 0;
  }
  return retryCount / totalPrompts;
}

// ============================================================================
// Tool Error Rate Scoring
// ============================================================================

/**
 * Calculate tool error score based on tool execution failure rate.
 *
 * Scoring:
 * - <=2% = 20pts (minimal errors)
 * - <=5% = 16pts (low errors)
 * - <=10% = 12pts (moderate errors)
 * - <=20% = 8pts (high errors)
 * - >20% = 4pts (very high errors)
 *
 * Note: If no tool calls exist, returns max score (no errors possible).
 *
 * @param toolErrorCount - Number of failed tool executions
 * @param toolCallCount - Total tool calls in session
 * @returns Score from 4 to 20
 */
export function calculateToolErrorScore(
  toolErrorCount: number,
  toolCallCount: number
): number {
  // No tool calls = perfect score (no errors possible)
  if (toolCallCount <= 0) {
    return FACTOR_MAX_POINTS.toolError;
  }

  // Handle negative error count
  if (toolErrorCount < 0) {
    return FACTOR_MAX_POINTS.toolError;
  }

  const rate = toolErrorCount / toolCallCount;

  if (rate <= 0.02) return 20;
  if (rate <= 0.05) return 16;
  if (rate <= 0.1) return 12;
  if (rate <= 0.2) return 8;
  return 4;
}

/**
 * Calculate tool error rate as a decimal.
 *
 * @param toolErrorCount - Number of failed tool executions
 * @param toolCallCount - Total tool calls in session
 * @returns Rate from 0 to 1, or 0 if no tool calls
 */
export function calculateToolErrorRate(
  toolErrorCount: number,
  toolCallCount: number
): number {
  if (toolCallCount <= 0 || toolErrorCount < 0) {
    return 0;
  }
  return toolErrorCount / toolCallCount;
}

// ============================================================================
// Health Level Classification
// ============================================================================

/**
 * Determine health level from score.
 *
 * Thresholds:
 * - healthy: score >= 75
 * - warning: score >= 50 and < 75
 * - critical: score < 50
 *
 * @param score - Health score (0-100)
 * @returns Health level classification
 */
export function determineHealthLevel(score: number): HealthLevel {
  if (score >= HEALTH_THRESHOLDS.healthy) {
    return 'healthy';
  }
  if (score >= HEALTH_THRESHOLDS.warning) {
    return 'warning';
  }
  return 'critical';
}

// ============================================================================
// Warning and Suggestion Generation
// ============================================================================

/**
 * Warning messages for each factor
 */
const WARNING_MESSAGES: Record<keyof HealthFactors, string> = {
  durationScore: 'Session duration is getting long',
  contextScore: 'Context window usage is high',
  frustrationScore: 'Frustration signals detected',
  retryScore: 'High retry rate detected',
  toolErrorScore: 'High tool execution failure rate',
};

/**
 * Suggestion messages for each factor
 */
const SUGGESTION_MESSAGES: Record<keyof HealthFactors, string> = {
  durationScore: 'Consider starting a fresh session for complex new tasks',
  contextScore: 'Summarize key context and start fresh to maintain quality',
  frustrationScore: 'Take a short break or try a different approach',
  retryScore: 'Clarify requirements before retrying',
  toolErrorScore: 'Check tool configurations and permissions; simplify complex tool chains',
};

/**
 * Determine severity level based on factor score percentage.
 *
 * @param score - Factor score
 * @param maxScore - Maximum score for this factor
 * @returns Severity level
 */
export function determineSeverity(score: number, maxScore: number): 'low' | 'medium' | 'high' {
  const percentage = score / maxScore;
  if (percentage <= 0.25) return 'high';
  if (percentage <= 0.5) return 'medium';
  return 'low';
}

/**
 * Generate warnings for low-scoring factors.
 *
 * A warning is generated when a factor score falls below its threshold:
 * - 25pt factors: threshold at 15 (60%)
 * - 20pt factors: threshold at 12 (60%)
 *
 * @param factors - Health factor scores
 * @returns Array of warnings with suggestions
 */
export function generateWarnings(factors: HealthFactors): HealthWarning[] {
  const warnings: HealthWarning[] = [];

  // Check duration
  if (factors.durationScore < WARNING_THRESHOLDS.duration) {
    warnings.push({
      factor: 'durationScore',
      warning: WARNING_MESSAGES.durationScore,
      suggestion: SUGGESTION_MESSAGES.durationScore,
      severity: determineSeverity(factors.durationScore, FACTOR_MAX_POINTS.duration),
    });
  }

  // Check context
  if (factors.contextScore < WARNING_THRESHOLDS.context) {
    warnings.push({
      factor: 'contextScore',
      warning: WARNING_MESSAGES.contextScore,
      suggestion: SUGGESTION_MESSAGES.contextScore,
      severity: determineSeverity(factors.contextScore, FACTOR_MAX_POINTS.context),
    });
  }

  // Check frustration
  if (factors.frustrationScore < WARNING_THRESHOLDS.frustration) {
    warnings.push({
      factor: 'frustrationScore',
      warning: WARNING_MESSAGES.frustrationScore,
      suggestion: SUGGESTION_MESSAGES.frustrationScore,
      severity: determineSeverity(factors.frustrationScore, FACTOR_MAX_POINTS.frustration),
    });
  }

  // Check retry
  if (factors.retryScore < WARNING_THRESHOLDS.retry) {
    warnings.push({
      factor: 'retryScore',
      warning: WARNING_MESSAGES.retryScore,
      suggestion: SUGGESTION_MESSAGES.retryScore,
      severity: determineSeverity(factors.retryScore, FACTOR_MAX_POINTS.retry),
    });
  }

  // Check tool errors
  if (factors.toolErrorScore < WARNING_THRESHOLDS.toolError) {
    warnings.push({
      factor: 'toolErrorScore',
      warning: WARNING_MESSAGES.toolErrorScore,
      suggestion: SUGGESTION_MESSAGES.toolErrorScore,
      severity: determineSeverity(factors.toolErrorScore, FACTOR_MAX_POINTS.toolError),
    });
  }

  // Sort by severity (high first)
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  warnings.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  return warnings;
}

/**
 * Extract unique suggestions from warnings, prioritized by severity.
 *
 * @param warnings - Array of health warnings
 * @returns Array of unique suggestion strings
 */
export function extractSuggestions(warnings: HealthWarning[]): string[] {
  // Already sorted by severity from generateWarnings
  return warnings.map((w) => w.suggestion);
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate complete session health metrics.
 *
 * Combines all factor scores, normalizes to 0-100, determines health level,
 * and generates appropriate warnings and suggestions.
 *
 * @param input - Session health input data
 * @returns Complete health metrics including score, level, factors, warnings, suggestions
 *
 * @example
 * ```typescript
 * const health = calculateSessionHealth({
 *   durationMinutes: 45,
 *   contextUsageEstimate: 0.35,
 *   frustrationCount: 1,
 *   totalPrompts: 50,
 *   retryCount: 2,
 *   toolErrorCount: 0,
 *   toolCallCount: 30,
 * });
 * // { healthScore: 92, healthLevel: 'healthy', ... }
 * ```
 */
export function calculateSessionHealth(input: SessionHealthInput): SessionHealthMetrics {
  // Calculate individual factor scores
  const factors: HealthFactors = {
    durationScore: calculateDurationScore(input.durationMinutes),
    contextScore: calculateContextScore(input.contextUsageEstimate),
    frustrationScore: calculateFrustrationScore(input.frustrationCount, input.totalPrompts),
    retryScore: calculateRetryScore(input.retryCount, input.totalPrompts),
    toolErrorScore: calculateToolErrorScore(input.toolErrorCount, input.toolCallCount),
  };

  // Sum raw scores
  const rawScore =
    factors.durationScore +
    factors.contextScore +
    factors.frustrationScore +
    factors.retryScore +
    factors.toolErrorScore;

  // Normalize to 0-100 (raw max is 115)
  const normalizedScore = Math.round((rawScore / TOTAL_MAX_POINTS) * 100);

  // Clamp to valid range
  const healthScore = Math.max(0, Math.min(100, normalizedScore));

  // Determine health level
  const healthLevel = determineHealthLevel(healthScore);

  // Generate warnings and suggestions
  const warnings = generateWarnings(factors);
  const suggestions = extractSuggestions(warnings);

  return {
    healthScore,
    healthLevel,
    factors,
    warnings,
    suggestions,
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default session health input with optimal values.
 *
 * Useful for new sessions or testing.
 *
 * @returns Default input that produces healthy score
 */
export function createDefaultHealthInput(): SessionHealthInput {
  return {
    durationMinutes: 0,
    contextUsageEstimate: 0,
    frustrationCount: 0,
    totalPrompts: 0,
    retryCount: 0,
    toolErrorCount: 0,
    toolCallCount: 0,
  };
}

/**
 * Create a health trend point from metrics.
 *
 * @param metrics - Session health metrics
 * @param timestamp - ISO timestamp (defaults to now)
 * @returns Health trend point for history tracking
 */
export function createHealthTrendPoint(
  metrics: SessionHealthMetrics,
  timestamp?: string
): HealthTrendPoint {
  return {
    timestamp: timestamp || new Date().toISOString(),
    healthScore: metrics.healthScore,
    healthLevel: metrics.healthLevel,
  };
}

/**
 * Convert factors to JSON for database storage.
 *
 * @param factors - Health factors
 * @returns JSON-serializable object
 */
export function factorsToJson(factors: HealthFactors): Record<string, number> {
  return {
    durationScore: factors.durationScore,
    contextScore: factors.contextScore,
    frustrationScore: factors.frustrationScore,
    retryScore: factors.retryScore,
    toolErrorScore: factors.toolErrorScore,
  };
}
