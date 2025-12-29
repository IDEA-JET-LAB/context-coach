/**
 * Context-Aware Scoring Types
 * Story 27-4: Context-Aware Scoring
 *
 * Types for scoring prompts with dimension adjustments based on prompt type.
 * Supports skipping scoring for non-scorable prompts (selection, confirmation).
 */

import type { PromptType } from './classification';
import type { DimensionScores } from './analysis';

// ============================================================================
// Dimension Types
// ============================================================================

/**
 * Standard dimension names for prompt analysis.
 * These are the 5 dimensions used for prompt quality assessment.
 */
export const DIMENSION_NAMES = [
  'Clarity',
  'Context',
  'Goal',
  'Specificity',
  'Constraints',
] as const;

export type DimensionName = (typeof DIMENSION_NAMES)[number];

/**
 * Adjustment factor for a specific dimension.
 * Expressed as a percentage change (-100% to +100%).
 * E.g., +20 means increase dimension weight by 20%.
 */
export type DimensionAdjustment = number;

/**
 * Map of dimension names to their adjustment factors.
 */
export type DimensionAdjustments = Partial<Record<DimensionName, DimensionAdjustment>>;

// ============================================================================
// Scoring Configuration Types
// ============================================================================

/**
 * Configuration for scoring a specific prompt type.
 * Includes overall weight and dimension-specific adjustments.
 */
export interface ScoringConfig {
  /**
   * The prompt type this config applies to.
   */
  promptType: PromptType;

  /**
   * Overall weight multiplier for this prompt type (0-1.0).
   * - 0: Skip scoring entirely
   * - 0.6-0.8: Reduced weight
   * - 1.0: Full weight
   */
  overallWeight: number;

  /**
   * Whether scoring should be skipped entirely.
   * If true, only store skip metadata; don't analyze.
   */
  skipScoring: boolean;

  /**
   * Reason for skipping (when skipScoring is true).
   */
  skipReason?: string;

  /**
   * Dimension-specific weight adjustments.
   * Positive values increase importance, negative decrease.
   * E.g., { Context: -50, Goal: +20 } for continuation prompts.
   */
  dimensionAdjustments: DimensionAdjustments;
}

/**
 * All scoring configurations indexed by prompt type.
 */
export type ScoringConfigs = Record<PromptType, ScoringConfig>;

// ============================================================================
// Scoring Result Types
// ============================================================================

/**
 * Result of scoring a prompt that was skipped.
 */
export interface SkippedScoringResult {
  /**
   * Indicates the prompt was skipped.
   */
  skipped: true;

  /**
   * Reason for skipping.
   */
  skipReason: string;

  /**
   * The prompt type that triggered the skip.
   */
  promptType: PromptType;

  /**
   * Classification confidence.
   */
  confidence: number;
}

/**
 * Individual dimension score with adjustment applied.
 */
export interface AdjustedDimensionScore {
  /**
   * Dimension name.
   */
  dimension: DimensionName;

  /**
   * Raw score (1-10) before adjustment.
   */
  rawScore: number;

  /**
   * AI reasoning for the raw score.
   */
  reasoning: string;

  /**
   * Adjustment percentage applied (e.g., -50, +20).
   */
  adjustmentPercent: number;

  /**
   * Adjusted weight for this dimension (normalized).
   */
  adjustedWeight: number;

  /**
   * Contribution to overall score (rawScore * adjustedWeight).
   */
  weightedContribution: number;
}

/**
 * Result of scoring a prompt with context-aware adjustments.
 */
export interface ScoredResult {
  /**
   * Indicates the prompt was scored.
   */
  skipped: false;

  /**
   * The classified prompt type.
   */
  promptType: PromptType;

  /**
   * Classification confidence.
   */
  confidence: number;

  /**
   * Overall weight applied to the entire score.
   */
  overallWeight: number;

  /**
   * Raw overall score (1-10) before weighting.
   */
  rawOverallScore: number;

  /**
   * Weighted overall score (rawOverallScore * overallWeight).
   */
  weightedOverallScore: number;

  /**
   * Raw dimension scores from analysis.
   */
  rawDimensionScores: DimensionScores;

  /**
   * Adjusted dimension scores with weight information.
   */
  adjustedDimensions: AdjustedDimensionScore[];

  /**
   * The scoring configuration used.
   */
  configUsed: ScoringConfig;
}

/**
 * Union type for all scoring results.
 */
export type ContextAwareScoringResult = SkippedScoringResult | ScoredResult;

// ============================================================================
// Helper Type Guards
// ============================================================================

/**
 * Type guard to check if a scoring result was skipped.
 */
export function isSkippedResult(
  result: ContextAwareScoringResult
): result is SkippedScoringResult {
  return result.skipped === true;
}

/**
 * Type guard to check if a scoring result was scored.
 */
export function isScoredResult(
  result: ContextAwareScoringResult
): result is ScoredResult {
  return result.skipped === false;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for context-aware scoring.
 */
export interface ScoringInput {
  /**
   * The prompt ID to score.
   */
  promptId: string;

  /**
   * The prompt text content.
   */
  content: string;

  /**
   * Optional pre-classified prompt type (if already known).
   * If not provided, classification will be performed.
   */
  promptType?: PromptType;

  /**
   * Optional classification confidence (if already known).
   */
  confidence?: number;

  /**
   * Optional session ID for context building.
   */
  sessionId?: string;

  /**
   * Optional message index in conversation (0-based).
   */
  messageIndex?: number;
}

/**
 * Options for scoring operations.
 */
export interface ScoringOptions {
  /**
   * Whether to force scoring even for typically skipped types.
   * Useful for debugging or auditing.
   */
  forceScore?: boolean;

  /**
   * Whether to include raw LLM response in result.
   */
  includeRawResponse?: boolean;

  /**
   * Custom dimension weights (overrides config).
   */
  customWeights?: Partial<Record<DimensionName, number>>;

  /**
   * Token budget for context (passed to buildAnalysisContext).
   */
  contextTokenBudget?: number;
}
