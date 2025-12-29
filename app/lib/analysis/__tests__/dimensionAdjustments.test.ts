/**
 * Dimension Adjustments Tests
 * Story 27-4: Context-Aware Scoring
 *
 * Tests for dimension adjustment logic including:
 * - Scoring configuration access
 * - Skip determination
 * - Weight calculations
 * - Dimension score adjustments
 */

import { describe, it, expect } from 'vitest';
import {
  SCORING_CONFIGS,
  BASE_DIMENSION_WEIGHT,
  DEFAULT_DIMENSION_NAMES,
  getScoringConfig,
  shouldSkipScoringByType,
  getSkipReason,
  getOverallWeight,
  getDimensionAdjustments,
  calculateAdjustedWeights,
  applyDimensionAdjustments,
  calculateRawOverallScore,
  calculateWeightedOverallScore,
  isValidDimensionName,
  validateScoringConfig,
  validateAllConfigs,
} from '../dimensionAdjustments';
import type { PromptType } from '@/lib/types/classification';
import type { DimensionScores } from '@/lib/types/analysis';
import type { ScoringConfig, DimensionName } from '@/lib/types/scoring';

// ============================================================================
// Test Data
// ============================================================================

function createRawScores(scores: Record<string, number>): DimensionScores {
  const result: DimensionScores = {};
  for (const [dimension, score] of Object.entries(scores)) {
    result[dimension] = {
      score,
      reasoning: `Reasoning for ${dimension}`,
    };
  }
  return result;
}

const STANDARD_RAW_SCORES = createRawScores({
  Clarity: 8,
  Context: 6,
  Goal: 7,
  Specificity: 9,
  Constraints: 5,
});

// ============================================================================
// Tests: SCORING_CONFIGS Structure
// ============================================================================

describe('SCORING_CONFIGS', () => {
  it('should have configs for all prompt types', () => {
    const expectedTypes: PromptType[] = [
      'initiating',
      'continuation',
      'selection',
      'correction',
      'confirmation',
      'clarification',
    ];

    for (const type of expectedTypes) {
      expect(SCORING_CONFIGS).toHaveProperty(type);
    }
  });

  it('should have initiating config with full weight', () => {
    const config = SCORING_CONFIGS.initiating;
    expect(config.promptType).toBe('initiating');
    expect(config.overallWeight).toBe(1.0);
    expect(config.skipScoring).toBe(false);
    expect(config.dimensionAdjustments).toEqual({});
  });

  it('should have continuation config with reduced weight and adjustments', () => {
    const config = SCORING_CONFIGS.continuation;
    expect(config.promptType).toBe('continuation');
    expect(config.overallWeight).toBe(0.7);
    expect(config.skipScoring).toBe(false);
    expect(config.dimensionAdjustments).toEqual({
      Context: -50,
      Goal: 20,
    });
  });

  it('should have selection config with skip', () => {
    const config = SCORING_CONFIGS.selection;
    expect(config.promptType).toBe('selection');
    expect(config.overallWeight).toBe(0);
    expect(config.skipScoring).toBe(true);
    expect(config.skipReason).toBeDefined();
    expect(config.skipReason).toContain('Selection');
  });

  it('should have correction config with Clarity boost', () => {
    const config = SCORING_CONFIGS.correction;
    expect(config.promptType).toBe('correction');
    expect(config.overallWeight).toBe(0.8);
    expect(config.skipScoring).toBe(false);
    expect(config.dimensionAdjustments).toEqual({
      Clarity: 30,
      Context: -20,
    });
  });

  it('should have confirmation config with skip', () => {
    const config = SCORING_CONFIGS.confirmation;
    expect(config.promptType).toBe('confirmation');
    expect(config.overallWeight).toBe(0);
    expect(config.skipScoring).toBe(true);
    expect(config.skipReason).toBeDefined();
    expect(config.skipReason).toContain('Confirmation');
  });

  it('should have clarification config with Specificity boost', () => {
    const config = SCORING_CONFIGS.clarification;
    expect(config.promptType).toBe('clarification');
    expect(config.overallWeight).toBe(0.6);
    expect(config.skipScoring).toBe(false);
    expect(config.dimensionAdjustments).toEqual({
      Specificity: 40,
      Constraints: -30,
    });
  });
});

// ============================================================================
// Tests: getScoringConfig
// ============================================================================

describe('getScoringConfig', () => {
  it('should return config for initiating', () => {
    const config = getScoringConfig('initiating');
    expect(config.promptType).toBe('initiating');
    expect(config.overallWeight).toBe(1.0);
  });

  it('should return config for continuation', () => {
    const config = getScoringConfig('continuation');
    expect(config.promptType).toBe('continuation');
    expect(config.overallWeight).toBe(0.7);
  });

  it('should return config for selection', () => {
    const config = getScoringConfig('selection');
    expect(config.skipScoring).toBe(true);
  });

  it('should return config for all prompt types', () => {
    const types: PromptType[] = [
      'initiating',
      'continuation',
      'selection',
      'correction',
      'confirmation',
      'clarification',
    ];

    for (const type of types) {
      const config = getScoringConfig(type);
      expect(config).toBeDefined();
      expect(config.promptType).toBe(type);
    }
  });
});

// ============================================================================
// Tests: shouldSkipScoringByType
// ============================================================================

describe('shouldSkipScoringByType', () => {
  it('should return true for selection', () => {
    expect(shouldSkipScoringByType('selection')).toBe(true);
  });

  it('should return true for confirmation', () => {
    expect(shouldSkipScoringByType('confirmation')).toBe(true);
  });

  it('should return false for initiating', () => {
    expect(shouldSkipScoringByType('initiating')).toBe(false);
  });

  it('should return false for continuation', () => {
    expect(shouldSkipScoringByType('continuation')).toBe(false);
  });

  it('should return false for correction', () => {
    expect(shouldSkipScoringByType('correction')).toBe(false);
  });

  it('should return false for clarification', () => {
    expect(shouldSkipScoringByType('clarification')).toBe(false);
  });
});

// ============================================================================
// Tests: getSkipReason
// ============================================================================

describe('getSkipReason', () => {
  it('should return reason for selection', () => {
    const reason = getSkipReason('selection');
    expect(reason).toBeDefined();
    expect(reason).toContain('Selection');
  });

  it('should return reason for confirmation', () => {
    const reason = getSkipReason('confirmation');
    expect(reason).toBeDefined();
    expect(reason).toContain('Confirmation');
  });

  it('should return undefined for initiating', () => {
    expect(getSkipReason('initiating')).toBeUndefined();
  });

  it('should return undefined for continuation', () => {
    expect(getSkipReason('continuation')).toBeUndefined();
  });

  it('should return undefined for correction', () => {
    expect(getSkipReason('correction')).toBeUndefined();
  });

  it('should return undefined for clarification', () => {
    expect(getSkipReason('clarification')).toBeUndefined();
  });
});

// ============================================================================
// Tests: getOverallWeight
// ============================================================================

describe('getOverallWeight', () => {
  it('should return 1.0 for initiating', () => {
    expect(getOverallWeight('initiating')).toBe(1.0);
  });

  it('should return 0.7 for continuation', () => {
    expect(getOverallWeight('continuation')).toBe(0.7);
  });

  it('should return 0 for selection', () => {
    expect(getOverallWeight('selection')).toBe(0);
  });

  it('should return 0.8 for correction', () => {
    expect(getOverallWeight('correction')).toBe(0.8);
  });

  it('should return 0 for confirmation', () => {
    expect(getOverallWeight('confirmation')).toBe(0);
  });

  it('should return 0.6 for clarification', () => {
    expect(getOverallWeight('clarification')).toBe(0.6);
  });
});

// ============================================================================
// Tests: getDimensionAdjustments
// ============================================================================

describe('getDimensionAdjustments', () => {
  it('should return empty object for initiating', () => {
    expect(getDimensionAdjustments('initiating')).toEqual({});
  });

  it('should return Context -50, Goal +20 for continuation', () => {
    const adjustments = getDimensionAdjustments('continuation');
    expect(adjustments.Context).toBe(-50);
    expect(adjustments.Goal).toBe(20);
  });

  it('should return empty object for selection', () => {
    expect(getDimensionAdjustments('selection')).toEqual({});
  });

  it('should return Clarity +30, Context -20 for correction', () => {
    const adjustments = getDimensionAdjustments('correction');
    expect(adjustments.Clarity).toBe(30);
    expect(adjustments.Context).toBe(-20);
  });

  it('should return empty object for confirmation', () => {
    expect(getDimensionAdjustments('confirmation')).toEqual({});
  });

  it('should return Specificity +40, Constraints -30 for clarification', () => {
    const adjustments = getDimensionAdjustments('clarification');
    expect(adjustments.Specificity).toBe(40);
    expect(adjustments.Constraints).toBe(-30);
  });
});

// ============================================================================
// Tests: calculateAdjustedWeights
// ============================================================================

describe('calculateAdjustedWeights', () => {
  it('should return equal weights with no adjustments', () => {
    const weights = calculateAdjustedWeights({});
    const dimensions = Object.keys(weights);

    expect(dimensions).toHaveLength(5);
    for (const dimension of dimensions) {
      expect(weights[dimension as DimensionName]).toBeCloseTo(0.2, 5);
    }

    // Sum should be 1.0
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should adjust Context -50% for continuation', () => {
    const weights = calculateAdjustedWeights({ Context: -50, Goal: 20 });

    // Context should be reduced (less than 0.2)
    expect(weights.Context).toBeLessThan(0.2);

    // Goal should be increased (more than 0.2)
    expect(weights.Goal).toBeGreaterThan(0.2);

    // Sum should still be 1.0
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should handle Clarity +30%, Context -20% for correction', () => {
    const weights = calculateAdjustedWeights({ Clarity: 30, Context: -20 });

    expect(weights.Clarity).toBeGreaterThan(0.2);
    expect(weights.Context).toBeLessThan(0.2);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should handle Specificity +40%, Constraints -30% for clarification', () => {
    const weights = calculateAdjustedWeights({ Specificity: 40, Constraints: -30 });

    expect(weights.Specificity).toBeGreaterThan(0.2);
    expect(weights.Constraints).toBeLessThan(0.2);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should clamp negative weights to 0', () => {
    // -100% should result in 0 weight (before normalization)
    const weights = calculateAdjustedWeights({ Context: -100 });

    // Context should be 0 (after applying -100%)
    // Other dimensions will be normalized to fill the gap
    expect(weights.Context).toBe(0);

    // Sum should still be 1.0
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should handle all dimensions adjusted', () => {
    const weights = calculateAdjustedWeights({
      Clarity: 10,
      Context: -20,
      Goal: 30,
      Specificity: -10,
      Constraints: 0,
    });

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should use custom dimension names when provided', () => {
    const customDimensions: DimensionName[] = ['Clarity', 'Context', 'Goal'];
    const weights = calculateAdjustedWeights({ Clarity: 50 }, customDimensions);

    expect(Object.keys(weights)).toHaveLength(3);
    expect(weights.Clarity).toBeDefined();
    expect(weights.Context).toBeDefined();
    expect(weights.Goal).toBeDefined();
    expect(weights.Specificity).toBeUndefined();
    expect(weights.Constraints).toBeUndefined();
  });
});

// ============================================================================
// Tests: applyDimensionAdjustments
// ============================================================================

describe('applyDimensionAdjustments', () => {
  it('should return adjusted scores for initiating (no adjustments)', () => {
    const adjusted = applyDimensionAdjustments(STANDARD_RAW_SCORES, 'initiating');

    expect(adjusted).toHaveLength(5);

    // All adjustments should be 0
    for (const dim of adjusted) {
      expect(dim.adjustmentPercent).toBe(0);
      expect(dim.adjustedWeight).toBeCloseTo(0.2, 5);
    }
  });

  it('should apply continuation adjustments correctly', () => {
    const adjusted = applyDimensionAdjustments(STANDARD_RAW_SCORES, 'continuation');

    const contextDim = adjusted.find((d) => d.dimension === 'Context');
    const goalDim = adjusted.find((d) => d.dimension === 'Goal');

    expect(contextDim?.adjustmentPercent).toBe(-50);
    expect(goalDim?.adjustmentPercent).toBe(20);

    // Context weight should be reduced
    expect(contextDim?.adjustedWeight).toBeLessThan(0.2);

    // Goal weight should be increased
    expect(goalDim?.adjustedWeight).toBeGreaterThan(0.2);
  });

  it('should apply correction adjustments correctly', () => {
    const adjusted = applyDimensionAdjustments(STANDARD_RAW_SCORES, 'correction');

    const clarityDim = adjusted.find((d) => d.dimension === 'Clarity');
    const contextDim = adjusted.find((d) => d.dimension === 'Context');

    expect(clarityDim?.adjustmentPercent).toBe(30);
    expect(contextDim?.adjustmentPercent).toBe(-20);
  });

  it('should apply clarification adjustments correctly', () => {
    const adjusted = applyDimensionAdjustments(STANDARD_RAW_SCORES, 'clarification');

    const specificityDim = adjusted.find((d) => d.dimension === 'Specificity');
    const constraintsDim = adjusted.find((d) => d.dimension === 'Constraints');

    expect(specificityDim?.adjustmentPercent).toBe(40);
    expect(constraintsDim?.adjustmentPercent).toBe(-30);
  });

  it('should calculate weighted contribution correctly', () => {
    const adjusted = applyDimensionAdjustments(STANDARD_RAW_SCORES, 'initiating');

    for (const dim of adjusted) {
      expect(dim.weightedContribution).toBeCloseTo(dim.rawScore * dim.adjustedWeight, 5);
    }
  });

  it('should preserve reasoning from raw scores', () => {
    const adjusted = applyDimensionAdjustments(STANDARD_RAW_SCORES, 'initiating');

    for (const dim of adjusted) {
      expect(dim.reasoning).toContain(dim.dimension);
    }
  });

  it('should handle empty raw scores', () => {
    const adjusted = applyDimensionAdjustments({}, 'initiating');
    expect(adjusted).toHaveLength(0);
  });

  it('should handle partial raw scores', () => {
    const partialScores = createRawScores({
      Clarity: 8,
      Goal: 7,
    });

    const adjusted = applyDimensionAdjustments(partialScores, 'initiating');
    expect(adjusted).toHaveLength(2);
  });
});

// ============================================================================
// Tests: calculateRawOverallScore
// ============================================================================

describe('calculateRawOverallScore', () => {
  it('should calculate simple average with equal weights', () => {
    const adjusted = applyDimensionAdjustments(STANDARD_RAW_SCORES, 'initiating');
    const score = calculateRawOverallScore(adjusted);

    // With equal weights, should be simple average: (8+6+7+9+5)/5 = 7
    expect(score).toBeCloseTo(7, 1);
  });

  it('should calculate weighted average with adjustments', () => {
    const adjusted = applyDimensionAdjustments(STANDARD_RAW_SCORES, 'continuation');
    const score = calculateRawOverallScore(adjusted);

    // Score should be slightly different due to weight adjustments
    expect(score).toBeGreaterThan(1);
    expect(score).toBeLessThanOrEqual(10);
  });

  it('should return 0 for empty adjusted dimensions', () => {
    const score = calculateRawOverallScore([]);
    expect(score).toBe(0);
  });

  it('should clamp score to valid range 1-10', () => {
    const highScores = createRawScores({
      Clarity: 10,
      Context: 10,
      Goal: 10,
      Specificity: 10,
      Constraints: 10,
    });

    const adjusted = applyDimensionAdjustments(highScores, 'initiating');
    const score = calculateRawOverallScore(adjusted);

    expect(score).toBeLessThanOrEqual(10);
  });

  it('should handle single dimension', () => {
    const singleScore = createRawScores({ Clarity: 8 });
    const adjusted = applyDimensionAdjustments(singleScore, 'initiating');
    const score = calculateRawOverallScore(adjusted);

    expect(score).toBeCloseTo(8, 1);
  });
});

// ============================================================================
// Tests: calculateWeightedOverallScore
// ============================================================================

describe('calculateWeightedOverallScore', () => {
  it('should return same score for initiating (weight 1.0)', () => {
    const rawScore = 7.5;
    const weighted = calculateWeightedOverallScore(rawScore, 'initiating');
    expect(weighted).toBe(7.5);
  });

  it('should reduce score for continuation (weight 0.7)', () => {
    const rawScore = 7.5;
    const weighted = calculateWeightedOverallScore(rawScore, 'continuation');
    expect(weighted).toBeCloseTo(5.25, 2);
  });

  it('should return 0 for selection (weight 0)', () => {
    const rawScore = 7.5;
    const weighted = calculateWeightedOverallScore(rawScore, 'selection');
    expect(weighted).toBe(0);
  });

  it('should reduce score for correction (weight 0.8)', () => {
    const rawScore = 7.5;
    const weighted = calculateWeightedOverallScore(rawScore, 'correction');
    expect(weighted).toBeCloseTo(6.0, 2);
  });

  it('should return 0 for confirmation (weight 0)', () => {
    const rawScore = 7.5;
    const weighted = calculateWeightedOverallScore(rawScore, 'confirmation');
    expect(weighted).toBe(0);
  });

  it('should reduce score for clarification (weight 0.6)', () => {
    const rawScore = 7.5;
    const weighted = calculateWeightedOverallScore(rawScore, 'clarification');
    expect(weighted).toBeCloseTo(4.5, 2);
  });

  it('should handle edge case scores', () => {
    expect(calculateWeightedOverallScore(10, 'continuation')).toBeCloseTo(7.0, 2);
    expect(calculateWeightedOverallScore(1, 'continuation')).toBeCloseTo(0.7, 2);
    expect(calculateWeightedOverallScore(0, 'continuation')).toBe(0);
  });
});

// ============================================================================
// Tests: isValidDimensionName
// ============================================================================

describe('isValidDimensionName', () => {
  it('should return true for valid dimension names', () => {
    expect(isValidDimensionName('Clarity')).toBe(true);
    expect(isValidDimensionName('Context')).toBe(true);
    expect(isValidDimensionName('Goal')).toBe(true);
    expect(isValidDimensionName('Specificity')).toBe(true);
    expect(isValidDimensionName('Constraints')).toBe(true);
  });

  it('should return false for invalid dimension names', () => {
    expect(isValidDimensionName('clarity')).toBe(false);
    expect(isValidDimensionName('CLARITY')).toBe(false);
    expect(isValidDimensionName('Unknown')).toBe(false);
    expect(isValidDimensionName('')).toBe(false);
    expect(isValidDimensionName('Quality')).toBe(false);
  });
});

// ============================================================================
// Tests: validateScoringConfig
// ============================================================================

describe('validateScoringConfig', () => {
  it('should validate correct config', () => {
    const config: ScoringConfig = {
      promptType: 'initiating',
      overallWeight: 1.0,
      skipScoring: false,
      dimensionAdjustments: {},
    };

    const result = validateScoringConfig(config);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for negative overall weight', () => {
    const config: ScoringConfig = {
      promptType: 'initiating',
      overallWeight: -0.5,
      skipScoring: false,
      dimensionAdjustments: {},
    };

    const result = validateScoringConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Overall weight'))).toBe(true);
  });

  it('should fail for overall weight > 1', () => {
    const config: ScoringConfig = {
      promptType: 'initiating',
      overallWeight: 1.5,
      skipScoring: false,
      dimensionAdjustments: {},
    };

    const result = validateScoringConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Overall weight'))).toBe(true);
  });

  it('should fail when skipScoring is true but no skipReason', () => {
    const config: ScoringConfig = {
      promptType: 'selection',
      overallWeight: 0,
      skipScoring: true,
      dimensionAdjustments: {},
    };

    const result = validateScoringConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Skip reason'))).toBe(true);
  });

  it('should fail when overallWeight is 0 but skipScoring is false', () => {
    const config: ScoringConfig = {
      promptType: 'selection',
      overallWeight: 0,
      skipScoring: false,
      dimensionAdjustments: {},
    };

    const result = validateScoringConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('skipScoring'))).toBe(true);
  });

  it('should fail for invalid dimension name in adjustments', () => {
    const config: ScoringConfig = {
      promptType: 'initiating',
      overallWeight: 1.0,
      skipScoring: false,
      dimensionAdjustments: {
        InvalidDimension: 10,
      } as unknown as Record<DimensionName, number>,
    };

    const result = validateScoringConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid dimension name'))).toBe(true);
  });

  it('should fail for adjustment out of range', () => {
    const config: ScoringConfig = {
      promptType: 'initiating',
      overallWeight: 1.0,
      skipScoring: false,
      dimensionAdjustments: {
        Clarity: 150,
      },
    };

    const result = validateScoringConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('-100 and 100'))).toBe(true);
  });

  it('should accept adjustment at boundary values', () => {
    const config: ScoringConfig = {
      promptType: 'initiating',
      overallWeight: 1.0,
      skipScoring: false,
      dimensionAdjustments: {
        Clarity: 100,
        Context: -100,
      },
    };

    const result = validateScoringConfig(config);
    expect(result.isValid).toBe(true);
  });
});

// ============================================================================
// Tests: validateAllConfigs
// ============================================================================

describe('validateAllConfigs', () => {
  it('should validate all built-in configs as valid', () => {
    const result = validateAllConfigs();
    expect(result.isValid).toBe(true);

    // Check each prompt type has empty errors
    for (const promptType of Object.keys(SCORING_CONFIGS) as PromptType[]) {
      expect(result.errors[promptType]).toHaveLength(0);
    }
  });

  it('should return errors organized by prompt type', () => {
    const result = validateAllConfigs();

    const expectedTypes: PromptType[] = [
      'initiating',
      'continuation',
      'selection',
      'correction',
      'confirmation',
      'clarification',
    ];

    for (const type of expectedTypes) {
      expect(result.errors).toHaveProperty(type);
    }
  });
});

// ============================================================================
// Tests: Constants
// ============================================================================

describe('Constants', () => {
  it('should have BASE_DIMENSION_WEIGHT of 0.2', () => {
    expect(BASE_DIMENSION_WEIGHT).toBe(0.2);
  });

  it('should have 5 default dimensions', () => {
    expect(DEFAULT_DIMENSION_NAMES).toHaveLength(5);
    expect(DEFAULT_DIMENSION_NAMES).toContain('Clarity');
    expect(DEFAULT_DIMENSION_NAMES).toContain('Context');
    expect(DEFAULT_DIMENSION_NAMES).toContain('Goal');
    expect(DEFAULT_DIMENSION_NAMES).toContain('Specificity');
    expect(DEFAULT_DIMENSION_NAMES).toContain('Constraints');
  });

  it('should have dimensions sum to 1.0 at base weight', () => {
    const sum = DEFAULT_DIMENSION_NAMES.length * BASE_DIMENSION_WEIGHT;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle all zero adjustments', () => {
    const weights = calculateAdjustedWeights({
      Clarity: 0,
      Context: 0,
      Goal: 0,
      Specificity: 0,
      Constraints: 0,
    });

    // All weights should be equal
    for (const dimension of DEFAULT_DIMENSION_NAMES) {
      expect(weights[dimension]).toBeCloseTo(0.2, 5);
    }
  });

  it('should handle extreme adjustments', () => {
    const weights = calculateAdjustedWeights({
      Clarity: 100, // +100%
      Context: -100, // -100% (becomes 0)
    });

    expect(weights.Clarity).toBeGreaterThan(0.2);
    expect(weights.Context).toBe(0);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should handle raw scores with decimal values', () => {
    const decimalScores = createRawScores({
      Clarity: 7.5,
      Context: 6.3,
      Goal: 8.7,
      Specificity: 5.2,
      Constraints: 9.1,
    });

    const adjusted = applyDimensionAdjustments(decimalScores, 'initiating');
    const score = calculateRawOverallScore(adjusted);

    expect(score).toBeGreaterThan(1);
    expect(score).toBeLessThanOrEqual(10);
  });

  it('should handle minimum valid scores', () => {
    const minScores = createRawScores({
      Clarity: 1,
      Context: 1,
      Goal: 1,
      Specificity: 1,
      Constraints: 1,
    });

    const adjusted = applyDimensionAdjustments(minScores, 'initiating');
    const score = calculateRawOverallScore(adjusted);

    expect(score).toBeCloseTo(1, 1);
  });

  it('should handle maximum valid scores', () => {
    const maxScores = createRawScores({
      Clarity: 10,
      Context: 10,
      Goal: 10,
      Specificity: 10,
      Constraints: 10,
    });

    const adjusted = applyDimensionAdjustments(maxScores, 'initiating');
    const score = calculateRawOverallScore(adjusted);

    expect(score).toBeCloseTo(10, 1);
  });
});
