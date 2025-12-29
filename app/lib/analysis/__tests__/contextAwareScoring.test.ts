/**
 * Context-Aware Scoring Tests
 * Story 27-4: Context-Aware Scoring
 *
 * Tests for the main scoring orchestrator including:
 * - Skip logic for selection/confirmation
 * - Dimension adjustments for different prompt types
 * - Weighted score calculations
 * - Batch scoring and statistics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSkippedResult,
  checkShouldSkip,
  createScoredResult,
  scorePromptWithContext,
  validateScoringInput,
  extractScoringSummary,
  formatScoringResult,
  scorePromptsWithContext,
  calculateScoringStats,
  type AnalyzeFunction,
  type AnalysisStepResult,
} from '../contextAwareScoring';
import type { PromptType } from '@/lib/types/classification';
import type { DimensionScores } from '@/lib/types/analysis';
import type { ScoringInput, ScoringOptions } from '@/lib/types/scoring';

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

function createMockAnalyzeFunction(scores: DimensionScores = STANDARD_RAW_SCORES): AnalyzeFunction {
  return vi.fn().mockResolvedValue({
    rawDimensionScores: scores,
    rawResponse: 'mock response',
  } as AnalysisStepResult);
}

function createScoringInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    promptId: 'test-prompt-id',
    content: 'Test prompt content',
    promptType: 'continuation',
    confidence: 0.85,
    ...overrides,
  };
}

// ============================================================================
// Tests: createSkippedResult
// ============================================================================

describe('createSkippedResult', () => {
  it('should create skipped result for selection', () => {
    const result = createSkippedResult('selection', 0.9);

    expect(result.skipped).toBe(true);
    expect(result.promptType).toBe('selection');
    expect(result.confidence).toBe(0.9);
    expect(result.skipReason).toContain('Selection');
  });

  it('should create skipped result for confirmation', () => {
    const result = createSkippedResult('confirmation', 0.95);

    expect(result.skipped).toBe(true);
    expect(result.promptType).toBe('confirmation');
    expect(result.confidence).toBe(0.95);
    expect(result.skipReason).toContain('Confirmation');
  });

  it('should provide fallback skip reason for non-skip types', () => {
    const result = createSkippedResult('initiating', 0.9);

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBeDefined();
  });
});

// ============================================================================
// Tests: checkShouldSkip
// ============================================================================

describe('checkShouldSkip', () => {
  it('should return skipped result for selection', () => {
    const result = checkShouldSkip('selection', 0.9);

    expect(result).not.toBeNull();
    expect(result?.skipped).toBe(true);
    expect(result?.promptType).toBe('selection');
  });

  it('should return skipped result for confirmation', () => {
    const result = checkShouldSkip('confirmation', 0.9);

    expect(result).not.toBeNull();
    expect(result?.skipped).toBe(true);
  });

  it('should return null for initiating', () => {
    const result = checkShouldSkip('initiating', 0.9);
    expect(result).toBeNull();
  });

  it('should return null for continuation', () => {
    const result = checkShouldSkip('continuation', 0.9);
    expect(result).toBeNull();
  });

  it('should return null for correction', () => {
    const result = checkShouldSkip('correction', 0.9);
    expect(result).toBeNull();
  });

  it('should return null for clarification', () => {
    const result = checkShouldSkip('clarification', 0.9);
    expect(result).toBeNull();
  });

  it('should return null when forceScore is true for selection', () => {
    const result = checkShouldSkip('selection', 0.9, true);
    expect(result).toBeNull();
  });

  it('should return null when forceScore is true for confirmation', () => {
    const result = checkShouldSkip('confirmation', 0.9, true);
    expect(result).toBeNull();
  });
});

// ============================================================================
// Tests: createScoredResult
// ============================================================================

describe('createScoredResult', () => {
  it('should create scored result for initiating', () => {
    const result = createScoredResult('initiating', 0.9, STANDARD_RAW_SCORES);

    expect(result.skipped).toBe(false);
    expect(result.promptType).toBe('initiating');
    expect(result.confidence).toBe(0.9);
    expect(result.overallWeight).toBe(1.0);
    expect(result.rawOverallScore).toBeCloseTo(7, 1);
    expect(result.weightedOverallScore).toBeCloseTo(7, 1);
  });

  it('should apply weight for continuation (0.7)', () => {
    const result = createScoredResult('continuation', 0.85, STANDARD_RAW_SCORES);

    expect(result.overallWeight).toBe(0.7);
    // Weighted should be 70% of raw
    expect(result.weightedOverallScore).toBeCloseTo(result.rawOverallScore * 0.7, 2);
  });

  it('should apply weight for correction (0.8)', () => {
    const result = createScoredResult('correction', 0.8, STANDARD_RAW_SCORES);

    expect(result.overallWeight).toBe(0.8);
    expect(result.weightedOverallScore).toBeCloseTo(result.rawOverallScore * 0.8, 2);
  });

  it('should apply weight for clarification (0.6)', () => {
    const result = createScoredResult('clarification', 0.75, STANDARD_RAW_SCORES);

    expect(result.overallWeight).toBe(0.6);
    expect(result.weightedOverallScore).toBeCloseTo(result.rawOverallScore * 0.6, 2);
  });

  it('should include adjusted dimensions', () => {
    const result = createScoredResult('continuation', 0.85, STANDARD_RAW_SCORES);

    expect(result.adjustedDimensions).toHaveLength(5);

    // Check Context has -50% adjustment
    const contextDim = result.adjustedDimensions.find((d) => d.dimension === 'Context');
    expect(contextDim?.adjustmentPercent).toBe(-50);

    // Check Goal has +20% adjustment
    const goalDim = result.adjustedDimensions.find((d) => d.dimension === 'Goal');
    expect(goalDim?.adjustmentPercent).toBe(20);
  });

  it('should include raw dimension scores', () => {
    const result = createScoredResult('initiating', 0.9, STANDARD_RAW_SCORES);

    expect(result.rawDimensionScores).toEqual(STANDARD_RAW_SCORES);
  });

  it('should include config used', () => {
    const result = createScoredResult('continuation', 0.85, STANDARD_RAW_SCORES);

    expect(result.configUsed).toBeDefined();
    expect(result.configUsed.promptType).toBe('continuation');
  });

  it('should handle empty scores', () => {
    const result = createScoredResult('initiating', 0.9, {});

    expect(result.adjustedDimensions).toHaveLength(0);
    expect(result.rawOverallScore).toBe(0);
    expect(result.weightedOverallScore).toBe(0);
  });

  it('should handle partial scores', () => {
    const partialScores = createRawScores({
      Clarity: 8,
      Goal: 7,
    });

    const result = createScoredResult('initiating', 0.9, partialScores);

    expect(result.adjustedDimensions).toHaveLength(2);
    expect(result.rawOverallScore).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tests: scorePromptWithContext - Skip Logic
// ============================================================================

describe('scorePromptWithContext - Skip Logic', () => {
  it('should skip scoring for selection', async () => {
    const input = createScoringInput({ promptType: 'selection' });
    const result = await scorePromptWithContext(input);

    expect(result.skipped).toBe(true);
    if (result.skipped) {
      expect(result.skipReason).toContain('Selection');
    }
  });

  it('should skip scoring for confirmation', async () => {
    const input = createScoringInput({ promptType: 'confirmation' });
    const result = await scorePromptWithContext(input);

    expect(result.skipped).toBe(true);
  });

  it('should not skip for initiating', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const input = createScoringInput({ promptType: 'initiating' });

    const result = await scorePromptWithContext(input, {}, mockAnalyze);

    expect(result.skipped).toBe(false);
  });

  it('should force score selection when forceScore is true', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const input = createScoringInput({ promptType: 'selection' });
    const options: ScoringOptions = { forceScore: true };

    const result = await scorePromptWithContext(input, options, mockAnalyze);

    expect(result.skipped).toBe(false);
    expect(mockAnalyze).toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: scorePromptWithContext - Scoring
// ============================================================================

describe('scorePromptWithContext - Scoring', () => {
  it('should call analyze function for scoreable prompts', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const input = createScoringInput({ promptType: 'continuation' });

    await scorePromptWithContext(input, {}, mockAnalyze);

    expect(mockAnalyze).toHaveBeenCalledWith(
      input.promptId,
      input.content,
      input.promptType,
      expect.any(Object)
    );
  });

  it('should return scored result with adjustments', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const input = createScoringInput({ promptType: 'continuation' });

    const result = await scorePromptWithContext(input, {}, mockAnalyze);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.promptType).toBe('continuation');
      expect(result.overallWeight).toBe(0.7);
      expect(result.adjustedDimensions.length).toBeGreaterThan(0);
    }
  });

  it('should use default confidence when not provided', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const input: ScoringInput = {
      promptId: 'test',
      content: 'test content',
      promptType: 'initiating',
    };

    const result = await scorePromptWithContext(input, {}, mockAnalyze);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.confidence).toBe(0.8); // Default
    }
  });

  it('should handle empty scores from analyze function', async () => {
    const mockAnalyze = createMockAnalyzeFunction({});
    const input = createScoringInput({ promptType: 'initiating' });

    const result = await scorePromptWithContext(input, {}, mockAnalyze);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.rawOverallScore).toBe(0);
    }
  });

  it('should return empty scores when no analyze function provided', async () => {
    const input = createScoringInput({ promptType: 'initiating' });

    const result = await scorePromptWithContext(input, {});

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.adjustedDimensions).toHaveLength(0);
    }
  });
});

// ============================================================================
// Tests: scorePromptWithContext - Error Handling
// ============================================================================

describe('scorePromptWithContext - Error Handling', () => {
  it('should throw when promptId is missing', async () => {
    const input = { ...createScoringInput(), promptId: '' };

    await expect(scorePromptWithContext(input)).rejects.toThrow('promptId is required');
  });

  it('should throw when content is missing', async () => {
    const input = { ...createScoringInput(), content: undefined as unknown as string };

    await expect(scorePromptWithContext(input)).rejects.toThrow('content is required');
  });

  it('should throw when promptType is missing', async () => {
    const input = { ...createScoringInput(), promptType: undefined as unknown as PromptType };

    await expect(scorePromptWithContext(input)).rejects.toThrow('promptType is required');
  });

  it('should throw when analyze function fails', async () => {
    const mockAnalyze = vi.fn().mockRejectedValue(new Error('API error'));
    const input = createScoringInput({ promptType: 'initiating' });

    await expect(scorePromptWithContext(input, {}, mockAnalyze)).rejects.toThrow(
      'Scoring failed: API error'
    );
  });

  it('should handle empty content', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const input = createScoringInput({ content: '' });

    const result = await scorePromptWithContext(input, {}, mockAnalyze);

    expect(result).toBeDefined();
  });
});

// ============================================================================
// Tests: validateScoringInput
// ============================================================================

describe('validateScoringInput', () => {
  it('should validate correct input', () => {
    const input = createScoringInput();
    const result = validateScoringInput(input);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when promptId is missing', () => {
    const result = validateScoringInput({
      content: 'test',
      promptType: 'initiating',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('promptId is required');
  });

  it('should fail when content is missing', () => {
    const result = validateScoringInput({
      promptId: 'test',
      promptType: 'initiating',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('content is required');
  });

  it('should fail for invalid promptType', () => {
    const result = validateScoringInput({
      promptId: 'test',
      content: 'test',
      promptType: 'invalid' as PromptType,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid promptType'))).toBe(true);
  });

  it('should fail for confidence out of range', () => {
    const result = validateScoringInput({
      promptId: 'test',
      content: 'test',
      confidence: 1.5,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('confidence'))).toBe(true);
  });

  it('should fail for negative messageIndex', () => {
    const result = validateScoringInput({
      promptId: 'test',
      content: 'test',
      messageIndex: -1,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('messageIndex'))).toBe(true);
  });

  it('should accept valid boundary values', () => {
    const result = validateScoringInput({
      promptId: 'test',
      content: '',
      promptType: 'initiating',
      confidence: 0,
      messageIndex: 0,
    });

    expect(result.isValid).toBe(true);
  });
});

// ============================================================================
// Tests: extractScoringSummary
// ============================================================================

describe('extractScoringSummary', () => {
  it('should extract summary for skipped result', () => {
    const result = createSkippedResult('selection', 0.9);
    const summary = extractScoringSummary(result);

    expect(summary.promptType).toBe('selection');
    expect(summary.skipped).toBe(true);
    expect(summary.skipReason).toBeDefined();
    expect(summary.rawScore).toBeUndefined();
    expect(summary.weightedScore).toBeUndefined();
  });

  it('should extract summary for scored result', () => {
    const result = createScoredResult('continuation', 0.85, STANDARD_RAW_SCORES);
    const summary = extractScoringSummary(result);

    expect(summary.promptType).toBe('continuation');
    expect(summary.skipped).toBe(false);
    expect(summary.rawScore).toBeDefined();
    expect(summary.weightedScore).toBeDefined();
    expect(summary.overallWeight).toBe(0.7);
  });
});

// ============================================================================
// Tests: formatScoringResult
// ============================================================================

describe('formatScoringResult', () => {
  it('should format skipped result', () => {
    const result = createSkippedResult('selection', 0.9);
    const formatted = formatScoringResult(result);

    expect(formatted).toContain('selection');
    expect(formatted).toContain('Skipped');
  });

  it('should format scored result', () => {
    const result = createScoredResult('continuation', 0.85, STANDARD_RAW_SCORES);
    const formatted = formatScoringResult(result);

    expect(formatted).toContain('continuation');
    expect(formatted).toContain('Raw:');
    expect(formatted).toContain('Weighted:');
    expect(formatted).toContain('Weight:');
    expect(formatted).toContain('Dimensions:');
  });

  it('should include dimension details in scored result', () => {
    const result = createScoredResult('initiating', 0.9, STANDARD_RAW_SCORES);
    const formatted = formatScoringResult(result);

    expect(formatted).toContain('Clarity');
    expect(formatted).toContain('Context');
  });
});

// ============================================================================
// Tests: scorePromptsWithContext
// ============================================================================

describe('scorePromptsWithContext', () => {
  it('should score multiple prompts', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const inputs = [
      createScoringInput({ promptId: '1', promptType: 'initiating' }),
      createScoringInput({ promptId: '2', promptType: 'continuation' }),
      createScoringInput({ promptId: '3', promptType: 'correction' }),
    ];

    const results = await scorePromptsWithContext(inputs, {}, mockAnalyze);

    expect(results).toHaveLength(3);
    expect(mockAnalyze).toHaveBeenCalledTimes(3);
  });

  it('should include skipped prompts in results', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const inputs = [
      createScoringInput({ promptId: '1', promptType: 'selection' }),
      createScoringInput({ promptId: '2', promptType: 'confirmation' }),
    ];

    const results = await scorePromptsWithContext(inputs, {}, mockAnalyze);

    expect(results).toHaveLength(2);
    expect(results[0].skipped).toBe(true);
    expect(results[1].skipped).toBe(true);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('should handle mixed prompt types', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const inputs = [
      createScoringInput({ promptId: '1', promptType: 'initiating' }),
      createScoringInput({ promptId: '2', promptType: 'selection' }),
      createScoringInput({ promptId: '3', promptType: 'continuation' }),
    ];

    const results = await scorePromptsWithContext(inputs, {}, mockAnalyze);

    expect(results[0].skipped).toBe(false);
    expect(results[1].skipped).toBe(true);
    expect(results[2].skipped).toBe(false);
    expect(mockAnalyze).toHaveBeenCalledTimes(2);
  });

  it('should handle analysis failures gracefully', async () => {
    const mockAnalyze = vi.fn()
      .mockResolvedValueOnce({ rawDimensionScores: STANDARD_RAW_SCORES })
      .mockRejectedValueOnce(new Error('API error'));

    const inputs = [
      createScoringInput({ promptId: '1', promptType: 'initiating' }),
      createScoringInput({ promptId: '2', promptType: 'continuation' }),
    ];

    const results = await scorePromptsWithContext(inputs, {}, mockAnalyze);

    expect(results).toHaveLength(2);
    expect(results[0].skipped).toBe(false);
    expect(results[1].skipped).toBe(true);
    if (results[1].skipped) {
      expect(results[1].skipReason).toContain('failed');
    }
  });

  it('should handle empty input array', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const results = await scorePromptsWithContext([], {}, mockAnalyze);

    expect(results).toHaveLength(0);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: calculateScoringStats
// ============================================================================

describe('calculateScoringStats', () => {
  it('should calculate stats for all scored results', () => {
    const results = [
      createScoredResult('initiating', 0.9, STANDARD_RAW_SCORES),
      createScoredResult('continuation', 0.85, STANDARD_RAW_SCORES),
      createScoredResult('correction', 0.8, STANDARD_RAW_SCORES),
    ];

    const stats = calculateScoringStats(results);

    expect(stats.total).toBe(3);
    expect(stats.scored).toBe(3);
    expect(stats.skipped).toBe(0);
    expect(stats.averageRawScore).toBeGreaterThan(0);
    expect(stats.averageWeightedScore).toBeGreaterThan(0);
  });

  it('should calculate stats for mixed results', () => {
    const results = [
      createScoredResult('initiating', 0.9, STANDARD_RAW_SCORES),
      createSkippedResult('selection', 0.9),
      createSkippedResult('confirmation', 0.95),
    ];

    const stats = calculateScoringStats(results);

    expect(stats.total).toBe(3);
    expect(stats.scored).toBe(1);
    expect(stats.skipped).toBe(2);
  });

  it('should calculate stats by prompt type', () => {
    const results = [
      createScoredResult('initiating', 0.9, STANDARD_RAW_SCORES),
      createScoredResult('initiating', 0.85, STANDARD_RAW_SCORES),
      createScoredResult('continuation', 0.8, STANDARD_RAW_SCORES),
    ];

    const stats = calculateScoringStats(results);

    expect(stats.byPromptType.initiating.count).toBe(2);
    expect(stats.byPromptType.continuation.count).toBe(1);
    expect(stats.byPromptType.correction.count).toBe(0);
  });

  it('should handle empty results', () => {
    const stats = calculateScoringStats([]);

    expect(stats.total).toBe(0);
    expect(stats.scored).toBe(0);
    expect(stats.skipped).toBe(0);
    expect(stats.averageRawScore).toBe(0);
    expect(stats.averageWeightedScore).toBe(0);
  });

  it('should handle all skipped results', () => {
    const results = [
      createSkippedResult('selection', 0.9),
      createSkippedResult('confirmation', 0.95),
    ];

    const stats = calculateScoringStats(results);

    expect(stats.total).toBe(2);
    expect(stats.scored).toBe(0);
    expect(stats.skipped).toBe(2);
    expect(stats.averageRawScore).toBe(0);
    expect(stats.averageWeightedScore).toBe(0);
  });

  it('should calculate correct average scores', () => {
    // Create scores that we can predict
    const scores1 = createRawScores({
      Clarity: 10,
      Context: 10,
      Goal: 10,
      Specificity: 10,
      Constraints: 10,
    });
    const scores2 = createRawScores({
      Clarity: 5,
      Context: 5,
      Goal: 5,
      Specificity: 5,
      Constraints: 5,
    });

    const results = [
      createScoredResult('initiating', 0.9, scores1), // Raw: 10
      createScoredResult('initiating', 0.85, scores2), // Raw: 5
    ];

    const stats = calculateScoringStats(results);

    expect(stats.averageRawScore).toBeCloseTo(7.5, 1);
    expect(stats.byPromptType.initiating.avgScore).toBeCloseTo(7.5, 1);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle very long content', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const input = createScoringInput({
      promptType: 'initiating',
      content: 'a'.repeat(100000),
    });

    const result = await scorePromptWithContext(input, {}, mockAnalyze);

    expect(result).toBeDefined();
    expect(mockAnalyze).toHaveBeenCalled();
  });

  it('should handle special characters in content', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const input = createScoringInput({
      promptType: 'initiating',
      content: 'Test with 特殊字符 and émojis 🚀',
    });

    const result = await scorePromptWithContext(input, {}, mockAnalyze);

    expect(result).toBeDefined();
  });

  it('should handle scores at boundary values', () => {
    const minScores = createRawScores({
      Clarity: 1,
      Context: 1,
      Goal: 1,
      Specificity: 1,
      Constraints: 1,
    });

    const result = createScoredResult('initiating', 0.9, minScores);

    expect(result.rawOverallScore).toBeCloseTo(1, 1);
    expect(result.weightedOverallScore).toBeCloseTo(1, 1);
  });

  it('should handle maximum scores', () => {
    const maxScores = createRawScores({
      Clarity: 10,
      Context: 10,
      Goal: 10,
      Specificity: 10,
      Constraints: 10,
    });

    const result = createScoredResult('initiating', 0.9, maxScores);

    expect(result.rawOverallScore).toBeCloseTo(10, 1);
    expect(result.weightedOverallScore).toBeCloseTo(10, 1);
  });

  it('should handle all prompt types in sequence', async () => {
    const mockAnalyze = createMockAnalyzeFunction();
    const types: PromptType[] = [
      'initiating',
      'continuation',
      'selection',
      'correction',
      'confirmation',
      'clarification',
    ];

    for (const promptType of types) {
      const input = createScoringInput({ promptType });
      const result = await scorePromptWithContext(input, {}, mockAnalyze);

      expect(result.promptType).toBe(promptType);

      if (promptType === 'selection' || promptType === 'confirmation') {
        expect(result.skipped).toBe(true);
      } else {
        expect(result.skipped).toBe(false);
      }
    }
  });
});
