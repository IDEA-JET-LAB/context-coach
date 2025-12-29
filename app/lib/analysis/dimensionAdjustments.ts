/**
 * Dimension Adjustments Module
 * Story 27-4: Context-Aware Scoring
 *
 * Provides scoring configuration for each prompt type with dimension-specific
 * weight adjustments. Determines which prompts should skip scoring and how
 * to adjust dimension weights for those that are scored.
 *
 * Scoring configurations:
 * - initiating: 100% weight, standard dimensions
 * - continuation: 70% weight, Context -50%, Goal +20%
 * - selection: 0% (skip scoring)
 * - correction: 80% weight, Clarity +30%, Context -20%
 * - confirmation: 0% (skip scoring)
 * - clarification: 60% weight, Specificity +40%, Constraints -30%
 */

import type { PromptType } from '@/lib/types/classification';
import type {
  ScoringConfig,
  ScoringConfigs,
  DimensionName,
  DimensionAdjustments,
  AdjustedDimensionScore,
  DIMENSION_NAMES,
} from '@/lib/types/scoring';
import type { DimensionScore, DimensionScores } from '@/lib/types/analysis';

// ============================================================================
// Constants
// ============================================================================

/**
 * Base weight for each dimension (equal weighting: 20% each for 5 dimensions).
 */
export const BASE_DIMENSION_WEIGHT = 0.2;

/**
 * Scoring configurations for each prompt type.
 * Based on Story 27-4 requirements.
 */
export const SCORING_CONFIGS: ScoringConfigs = {
  initiating: {
    promptType: 'initiating',
    overallWeight: 1.0,
    skipScoring: false,
    dimensionAdjustments: {},
  },
  continuation: {
    promptType: 'continuation',
    overallWeight: 0.7,
    skipScoring: false,
    dimensionAdjustments: {
      Context: -50,
      Goal: 20,
    },
  },
  selection: {
    promptType: 'selection',
    overallWeight: 0,
    skipScoring: true,
    skipReason: 'Selection prompts (choosing from options) do not require quality scoring',
    dimensionAdjustments: {},
  },
  correction: {
    promptType: 'correction',
    overallWeight: 0.8,
    skipScoring: false,
    dimensionAdjustments: {
      Clarity: 30,
      Context: -20,
    },
  },
  confirmation: {
    promptType: 'confirmation',
    overallWeight: 0,
    skipScoring: true,
    skipReason: 'Confirmation prompts (yes/no responses) do not require quality scoring',
    dimensionAdjustments: {},
  },
  clarification: {
    promptType: 'clarification',
    overallWeight: 0.6,
    skipScoring: false,
    dimensionAdjustments: {
      Specificity: 40,
      Constraints: -30,
    },
  },
};

/**
 * Default dimension names for validation.
 */
export const DEFAULT_DIMENSION_NAMES: readonly DimensionName[] = [
  'Clarity',
  'Context',
  'Goal',
  'Specificity',
  'Constraints',
];

// ============================================================================
// Configuration Access Functions
// ============================================================================

/**
 * Gets the scoring configuration for a prompt type.
 *
 * @param promptType - The prompt type
 * @returns The scoring configuration for that type
 *
 * @example
 * const config = getScoringConfig('continuation');
 * // => { promptType: 'continuation', overallWeight: 0.7, ... }
 */
export function getScoringConfig(promptType: PromptType): ScoringConfig {
  return SCORING_CONFIGS[promptType];
}

/**
 * Determines if scoring should be skipped for a prompt type.
 *
 * @param promptType - The prompt type
 * @returns true if scoring should be skipped (selection, confirmation)
 *
 * @example
 * shouldSkipScoringByType('selection') // => true
 * shouldSkipScoringByType('initiating') // => false
 */
export function shouldSkipScoringByType(promptType: PromptType): boolean {
  return SCORING_CONFIGS[promptType].skipScoring;
}

/**
 * Gets the skip reason for a prompt type that should be skipped.
 *
 * @param promptType - The prompt type
 * @returns The skip reason, or undefined if not a skipped type
 *
 * @example
 * getSkipReason('selection') // => 'Selection prompts...'
 * getSkipReason('initiating') // => undefined
 */
export function getSkipReason(promptType: PromptType): string | undefined {
  const config = SCORING_CONFIGS[promptType];
  return config.skipScoring ? config.skipReason : undefined;
}

/**
 * Gets the overall weight multiplier for a prompt type.
 *
 * @param promptType - The prompt type
 * @returns The overall weight (0-1.0)
 *
 * @example
 * getOverallWeight('continuation') // => 0.7
 * getOverallWeight('selection') // => 0
 */
export function getOverallWeight(promptType: PromptType): number {
  return SCORING_CONFIGS[promptType].overallWeight;
}

/**
 * Gets the dimension adjustments for a prompt type.
 *
 * @param promptType - The prompt type
 * @returns Map of dimension names to adjustment percentages
 *
 * @example
 * getDimensionAdjustments('continuation')
 * // => { Context: -50, Goal: 20 }
 */
export function getDimensionAdjustments(promptType: PromptType): DimensionAdjustments {
  return SCORING_CONFIGS[promptType].dimensionAdjustments;
}

// ============================================================================
// Dimension Weight Calculation
// ============================================================================

/**
 * Calculates adjusted weights for all dimensions based on adjustments.
 * Weights are normalized to sum to 1.0.
 *
 * @param adjustments - Dimension adjustments (percentages)
 * @param dimensionNames - List of dimension names (defaults to standard 5)
 * @returns Map of dimension names to their adjusted weights
 *
 * @example
 * calculateAdjustedWeights({ Context: -50, Goal: 20 })
 * // => { Clarity: 0.2, Context: 0.1, Goal: 0.24, Specificity: 0.2, Constraints: 0.2 }
 * // (normalized to sum to ~1.0)
 */
export function calculateAdjustedWeights(
  adjustments: DimensionAdjustments,
  dimensionNames: readonly DimensionName[] = DEFAULT_DIMENSION_NAMES
): Record<DimensionName, number> {
  // Calculate raw adjusted weights
  const rawWeights: Record<string, number> = {};
  let totalWeight = 0;

  for (const dimension of dimensionNames) {
    const adjustment = adjustments[dimension] ?? 0;
    // Apply percentage adjustment: base * (1 + adjustment/100)
    const adjustedWeight = BASE_DIMENSION_WEIGHT * (1 + adjustment / 100);
    // Ensure non-negative
    rawWeights[dimension] = Math.max(0, adjustedWeight);
    totalWeight += rawWeights[dimension];
  }

  // Normalize to sum to 1.0
  const normalizedWeights: Record<DimensionName, number> = {} as Record<DimensionName, number>;
  for (const dimension of dimensionNames) {
    const weight = rawWeights[dimension] ?? 1;
    normalizedWeights[dimension] =
      totalWeight > 0 ? weight / totalWeight : 1 / dimensionNames.length;
  }

  return normalizedWeights;
}

/**
 * Applies dimension adjustments to raw scores and calculates weighted contributions.
 *
 * @param rawScores - Raw dimension scores from analysis
 * @param promptType - The prompt type for determining adjustments
 * @returns Array of adjusted dimension scores with weighted contributions
 *
 * @example
 * const raw = {
 *   Clarity: { score: 8, reasoning: 'Clear' },
 *   Context: { score: 6, reasoning: 'Good' },
 *   // ...
 * };
 * const adjusted = applyDimensionAdjustments(raw, 'continuation');
 * // => [{ dimension: 'Clarity', rawScore: 8, adjustedWeight: 0.21, ... }, ...]
 */
export function applyDimensionAdjustments(
  rawScores: DimensionScores,
  promptType: PromptType
): AdjustedDimensionScore[] {
  const config = getScoringConfig(promptType);
  const adjustments = config.dimensionAdjustments;

  // Get dimension names from raw scores
  const dimensionNames = Object.keys(rawScores) as DimensionName[];

  // Calculate adjusted weights
  const adjustedWeights = calculateAdjustedWeights(adjustments, dimensionNames);

  // Build adjusted dimension scores
  const result: AdjustedDimensionScore[] = [];

  for (const dimension of dimensionNames) {
    const rawScore = rawScores[dimension];
    if (!rawScore) continue;

    const adjustmentPercent = adjustments[dimension] ?? 0;
    const adjustedWeight = adjustedWeights[dimension] ?? BASE_DIMENSION_WEIGHT;
    const weightedContribution = rawScore.score * adjustedWeight;

    result.push({
      dimension,
      rawScore: rawScore.score,
      reasoning: rawScore.reasoning,
      adjustmentPercent,
      adjustedWeight,
      weightedContribution,
    });
  }

  return result;
}

/**
 * Calculates the raw overall score from adjusted dimension scores.
 * This is a weighted average of raw scores using adjusted weights.
 *
 * @param adjustedDimensions - Array of adjusted dimension scores
 * @returns Raw overall score (1-10)
 *
 * @example
 * calculateRawOverallScore(adjustedDimensions) // => 7.5
 */
export function calculateRawOverallScore(
  adjustedDimensions: AdjustedDimensionScore[]
): number {
  if (adjustedDimensions.length === 0) {
    return 0;
  }

  let totalContribution = 0;
  let totalWeight = 0;

  for (const dim of adjustedDimensions) {
    totalContribution += dim.weightedContribution;
    totalWeight += dim.adjustedWeight;
  }

  // Avoid division by zero
  if (totalWeight === 0) {
    return 0;
  }

  // Calculate weighted average
  const rawOverall = totalContribution / totalWeight;

  // Clamp to valid range
  return Math.max(1, Math.min(10, rawOverall));
}

/**
 * Calculates the weighted overall score by applying the prompt type's overall weight.
 *
 * @param rawOverallScore - The raw overall score (1-10)
 * @param promptType - The prompt type for determining overall weight
 * @returns Weighted overall score
 *
 * @example
 * calculateWeightedOverallScore(7.5, 'continuation') // => 5.25 (7.5 * 0.7)
 */
export function calculateWeightedOverallScore(
  rawOverallScore: number,
  promptType: PromptType
): number {
  const overallWeight = getOverallWeight(promptType);
  return rawOverallScore * overallWeight;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates that a dimension name is recognized.
 *
 * @param name - The dimension name to validate
 * @returns true if the name is a valid dimension
 */
export function isValidDimensionName(name: string): name is DimensionName {
  return (DEFAULT_DIMENSION_NAMES as readonly string[]).includes(name);
}

/**
 * Validates a scoring configuration.
 *
 * @param config - The configuration to validate
 * @returns Object with isValid flag and any error messages
 */
export function validateScoringConfig(config: ScoringConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate overall weight
  if (config.overallWeight < 0 || config.overallWeight > 1) {
    errors.push(`Overall weight must be between 0 and 1, got ${config.overallWeight}`);
  }

  // Validate skip consistency
  if (config.skipScoring && !config.skipReason) {
    errors.push('Skip reason is required when skipScoring is true');
  }

  if (config.overallWeight === 0 && !config.skipScoring) {
    errors.push('skipScoring should be true when overallWeight is 0');
  }

  // Validate dimension adjustments
  for (const [dimension, adjustment] of Object.entries(config.dimensionAdjustments)) {
    if (!isValidDimensionName(dimension)) {
      errors.push(`Invalid dimension name: ${dimension}`);
    }
    if (adjustment < -100 || adjustment > 100) {
      errors.push(
        `Dimension adjustment for ${dimension} must be between -100 and 100, got ${adjustment}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates all scoring configurations.
 *
 * @returns Object with isValid flag and any error messages
 */
export function validateAllConfigs(): {
  isValid: boolean;
  errors: Record<PromptType, string[]>;
} {
  const errors: Record<PromptType, string[]> = {} as Record<PromptType, string[]>;
  let isValid = true;

  for (const [promptType, config] of Object.entries(SCORING_CONFIGS)) {
    const result = validateScoringConfig(config);
    errors[promptType as PromptType] = result.errors;
    if (!result.isValid) {
      isValid = false;
    }
  }

  return { isValid, errors };
}
