/**
 * Session Health Score Tests - Story 21-7
 *
 * Comprehensive tests for session health scoring including:
 * - Individual factor scoring functions
 * - Health level classification
 * - Warning and suggestion generation
 * - Main calculator function
 * - Edge cases and input validation
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type HealthLevel,
  type SessionHealthInput,
  type HealthFactors,
  type HealthWarning,
  type SessionHealthMetrics,
  type HealthTrendPoint,
  // Constants
  FACTOR_MAX_POINTS,
  TOTAL_MAX_POINTS,
  HEALTH_THRESHOLDS,
  WARNING_THRESHOLDS,
  // Score calculators
  calculateDurationScore,
  calculateContextScore,
  calculateFrustrationScore,
  calculateFrustrationRate,
  calculateRetryScore,
  calculateRetryRate,
  calculateToolErrorScore,
  calculateToolErrorRate,
  // Health level
  determineHealthLevel,
  // Warnings
  determineSeverity,
  generateWarnings,
  extractSuggestions,
  // Main calculator
  calculateSessionHealth,
  // Factory functions
  createDefaultHealthInput,
  createHealthTrendPoint,
  factorsToJson,
} from '../session-health';

// ============================================================================
// Constants Tests
// ============================================================================

describe('FACTOR_MAX_POINTS', () => {
  it('should have correct maximum points for duration (25)', () => {
    expect(FACTOR_MAX_POINTS.duration).toBe(25);
  });

  it('should have correct maximum points for context (25)', () => {
    expect(FACTOR_MAX_POINTS.context).toBe(25);
  });

  it('should have correct maximum points for frustration (25)', () => {
    expect(FACTOR_MAX_POINTS.frustration).toBe(25);
  });

  it('should have correct maximum points for retry (20)', () => {
    expect(FACTOR_MAX_POINTS.retry).toBe(20);
  });

  it('should have correct maximum points for toolError (20)', () => {
    expect(FACTOR_MAX_POINTS.toolError).toBe(20);
  });
});

describe('TOTAL_MAX_POINTS', () => {
  it('should equal 115 (sum of all factor max points)', () => {
    expect(TOTAL_MAX_POINTS).toBe(115);
  });
});

describe('HEALTH_THRESHOLDS', () => {
  it('should have healthy threshold at 75', () => {
    expect(HEALTH_THRESHOLDS.healthy).toBe(75);
  });

  it('should have warning threshold at 50', () => {
    expect(HEALTH_THRESHOLDS.warning).toBe(50);
  });
});

describe('WARNING_THRESHOLDS', () => {
  it('should have correct thresholds for 25-point factors (15)', () => {
    expect(WARNING_THRESHOLDS.duration).toBe(15);
    expect(WARNING_THRESHOLDS.context).toBe(15);
    expect(WARNING_THRESHOLDS.frustration).toBe(15);
  });

  it('should have correct thresholds for 20-point factors (12)', () => {
    expect(WARNING_THRESHOLDS.retry).toBe(12);
    expect(WARNING_THRESHOLDS.toolError).toBe(12);
  });
});

// ============================================================================
// Duration Score Tests (AC #3)
// ============================================================================

describe('calculateDurationScore', () => {
  describe('scoring tiers', () => {
    it('should return 25 for duration <= 60 minutes', () => {
      expect(calculateDurationScore(0)).toBe(25);
      expect(calculateDurationScore(30)).toBe(25);
      expect(calculateDurationScore(60)).toBe(25);
    });

    it('should return 20 for duration <= 90 minutes (but > 60)', () => {
      expect(calculateDurationScore(61)).toBe(20);
      expect(calculateDurationScore(75)).toBe(20);
      expect(calculateDurationScore(90)).toBe(20);
    });

    it('should return 15 for duration <= 120 minutes (but > 90)', () => {
      expect(calculateDurationScore(91)).toBe(15);
      expect(calculateDurationScore(105)).toBe(15);
      expect(calculateDurationScore(120)).toBe(15);
    });

    it('should return 10 for duration <= 180 minutes (but > 120)', () => {
      expect(calculateDurationScore(121)).toBe(10);
      expect(calculateDurationScore(150)).toBe(10);
      expect(calculateDurationScore(180)).toBe(10);
    });

    it('should return 5 for duration > 180 minutes', () => {
      expect(calculateDurationScore(181)).toBe(5);
      expect(calculateDurationScore(240)).toBe(5);
      expect(calculateDurationScore(500)).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should return max score for negative duration', () => {
      expect(calculateDurationScore(-10)).toBe(25);
    });

    it('should return max score for NaN', () => {
      expect(calculateDurationScore(NaN)).toBe(25);
    });

    it('should return max score for non-number input', () => {
      expect(calculateDurationScore(undefined as unknown as number)).toBe(25);
    });
  });
});

// ============================================================================
// Context Score Tests (AC #4)
// ============================================================================

describe('calculateContextScore', () => {
  describe('scoring tiers', () => {
    it('should return 25 for context usage <= 50%', () => {
      expect(calculateContextScore(0)).toBe(25);
      expect(calculateContextScore(0.25)).toBe(25);
      expect(calculateContextScore(0.5)).toBe(25);
    });

    it('should return 20 for context usage <= 70% (but > 50%)', () => {
      expect(calculateContextScore(0.51)).toBe(20);
      expect(calculateContextScore(0.6)).toBe(20);
      expect(calculateContextScore(0.7)).toBe(20);
    });

    it('should return 15 for context usage <= 80% (but > 70%)', () => {
      expect(calculateContextScore(0.71)).toBe(15);
      expect(calculateContextScore(0.75)).toBe(15);
      expect(calculateContextScore(0.8)).toBe(15);
    });

    it('should return 10 for context usage <= 90% (but > 80%)', () => {
      expect(calculateContextScore(0.81)).toBe(10);
      expect(calculateContextScore(0.85)).toBe(10);
      expect(calculateContextScore(0.9)).toBe(10);
    });

    it('should return 5 for context usage > 90%', () => {
      expect(calculateContextScore(0.91)).toBe(5);
      expect(calculateContextScore(0.95)).toBe(5);
      expect(calculateContextScore(1.0)).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should clamp values above 1.0', () => {
      expect(calculateContextScore(1.5)).toBe(5);
    });

    it('should clamp negative values to 0', () => {
      expect(calculateContextScore(-0.5)).toBe(25);
    });

    it('should return max score for NaN', () => {
      expect(calculateContextScore(NaN)).toBe(25);
    });
  });
});

// ============================================================================
// Frustration Score Tests (AC #5)
// ============================================================================

describe('calculateFrustrationScore', () => {
  describe('scoring tiers', () => {
    it('should return 25 for frustration rate <= 2%', () => {
      expect(calculateFrustrationScore(0, 100)).toBe(25);
      expect(calculateFrustrationScore(1, 100)).toBe(25);
      expect(calculateFrustrationScore(2, 100)).toBe(25);
    });

    it('should return 20 for frustration rate <= 5% (but > 2%)', () => {
      expect(calculateFrustrationScore(3, 100)).toBe(20);
      expect(calculateFrustrationScore(4, 100)).toBe(20);
      expect(calculateFrustrationScore(5, 100)).toBe(20);
    });

    it('should return 15 for frustration rate <= 10% (but > 5%)', () => {
      expect(calculateFrustrationScore(6, 100)).toBe(15);
      expect(calculateFrustrationScore(8, 100)).toBe(15);
      expect(calculateFrustrationScore(10, 100)).toBe(15);
    });

    it('should return 10 for frustration rate <= 15% (but > 10%)', () => {
      expect(calculateFrustrationScore(11, 100)).toBe(10);
      expect(calculateFrustrationScore(13, 100)).toBe(10);
      expect(calculateFrustrationScore(15, 100)).toBe(10);
    });

    it('should return 5 for frustration rate > 15%', () => {
      expect(calculateFrustrationScore(16, 100)).toBe(5);
      expect(calculateFrustrationScore(25, 100)).toBe(5);
      expect(calculateFrustrationScore(50, 100)).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should return max score for zero total prompts', () => {
      expect(calculateFrustrationScore(5, 0)).toBe(25);
    });

    it('should return max score for negative total prompts', () => {
      expect(calculateFrustrationScore(5, -10)).toBe(25);
    });

    it('should return max score for negative frustration count', () => {
      expect(calculateFrustrationScore(-5, 100)).toBe(25);
    });
  });
});

describe('calculateFrustrationRate', () => {
  it('should calculate correct rate', () => {
    expect(calculateFrustrationRate(10, 100)).toBe(0.1);
    expect(calculateFrustrationRate(5, 50)).toBe(0.1);
  });

  it('should return 0 for zero total prompts', () => {
    expect(calculateFrustrationRate(5, 0)).toBe(0);
  });

  it('should return 0 for negative frustration count', () => {
    expect(calculateFrustrationRate(-5, 100)).toBe(0);
  });
});

// ============================================================================
// Retry Score Tests (AC #6)
// ============================================================================

describe('calculateRetryScore', () => {
  describe('scoring tiers', () => {
    it('should return 20 for retry rate <= 5%', () => {
      expect(calculateRetryScore(0, 100)).toBe(20);
      expect(calculateRetryScore(3, 100)).toBe(20);
      expect(calculateRetryScore(5, 100)).toBe(20);
    });

    it('should return 16 for retry rate <= 10% (but > 5%)', () => {
      expect(calculateRetryScore(6, 100)).toBe(16);
      expect(calculateRetryScore(8, 100)).toBe(16);
      expect(calculateRetryScore(10, 100)).toBe(16);
    });

    it('should return 12 for retry rate <= 15% (but > 10%)', () => {
      expect(calculateRetryScore(11, 100)).toBe(12);
      expect(calculateRetryScore(13, 100)).toBe(12);
      expect(calculateRetryScore(15, 100)).toBe(12);
    });

    it('should return 8 for retry rate <= 20% (but > 15%)', () => {
      expect(calculateRetryScore(16, 100)).toBe(8);
      expect(calculateRetryScore(18, 100)).toBe(8);
      expect(calculateRetryScore(20, 100)).toBe(8);
    });

    it('should return 4 for retry rate > 20%', () => {
      expect(calculateRetryScore(21, 100)).toBe(4);
      expect(calculateRetryScore(30, 100)).toBe(4);
      expect(calculateRetryScore(50, 100)).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('should return max score for zero total prompts', () => {
      expect(calculateRetryScore(5, 0)).toBe(20);
    });

    it('should return max score for negative retry count', () => {
      expect(calculateRetryScore(-5, 100)).toBe(20);
    });
  });
});

describe('calculateRetryRate', () => {
  it('should calculate correct rate', () => {
    expect(calculateRetryRate(15, 100)).toBe(0.15);
  });

  it('should return 0 for zero total prompts', () => {
    expect(calculateRetryRate(5, 0)).toBe(0);
  });
});

// ============================================================================
// Tool Error Score Tests (AC #7)
// ============================================================================

describe('calculateToolErrorScore', () => {
  describe('scoring tiers', () => {
    it('should return 20 for tool error rate <= 2%', () => {
      expect(calculateToolErrorScore(0, 100)).toBe(20);
      expect(calculateToolErrorScore(1, 100)).toBe(20);
      expect(calculateToolErrorScore(2, 100)).toBe(20);
    });

    it('should return 16 for tool error rate <= 5% (but > 2%)', () => {
      expect(calculateToolErrorScore(3, 100)).toBe(16);
      expect(calculateToolErrorScore(4, 100)).toBe(16);
      expect(calculateToolErrorScore(5, 100)).toBe(16);
    });

    it('should return 12 for tool error rate <= 10% (but > 5%)', () => {
      expect(calculateToolErrorScore(6, 100)).toBe(12);
      expect(calculateToolErrorScore(8, 100)).toBe(12);
      expect(calculateToolErrorScore(10, 100)).toBe(12);
    });

    it('should return 8 for tool error rate <= 20% (but > 10%)', () => {
      expect(calculateToolErrorScore(11, 100)).toBe(8);
      expect(calculateToolErrorScore(15, 100)).toBe(8);
      expect(calculateToolErrorScore(20, 100)).toBe(8);
    });

    it('should return 4 for tool error rate > 20%', () => {
      expect(calculateToolErrorScore(21, 100)).toBe(4);
      expect(calculateToolErrorScore(30, 100)).toBe(4);
      expect(calculateToolErrorScore(50, 100)).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('should return max score for zero tool calls (no errors possible)', () => {
      expect(calculateToolErrorScore(0, 0)).toBe(20);
    });

    it('should return max score for negative tool call count', () => {
      expect(calculateToolErrorScore(5, -10)).toBe(20);
    });

    it('should return max score for negative error count', () => {
      expect(calculateToolErrorScore(-5, 100)).toBe(20);
    });
  });
});

describe('calculateToolErrorRate', () => {
  it('should calculate correct rate', () => {
    expect(calculateToolErrorRate(10, 100)).toBe(0.1);
  });

  it('should return 0 for zero tool calls', () => {
    expect(calculateToolErrorRate(5, 0)).toBe(0);
  });
});

// ============================================================================
// Health Level Classification Tests (AC #2)
// ============================================================================

describe('determineHealthLevel', () => {
  it('should return "healthy" for score >= 75', () => {
    expect(determineHealthLevel(75)).toBe('healthy');
    expect(determineHealthLevel(85)).toBe('healthy');
    expect(determineHealthLevel(100)).toBe('healthy');
  });

  it('should return "warning" for score >= 50 and < 75', () => {
    expect(determineHealthLevel(50)).toBe('warning');
    expect(determineHealthLevel(60)).toBe('warning');
    expect(determineHealthLevel(74)).toBe('warning');
  });

  it('should return "critical" for score < 50', () => {
    expect(determineHealthLevel(0)).toBe('critical');
    expect(determineHealthLevel(25)).toBe('critical');
    expect(determineHealthLevel(49)).toBe('critical');
  });

  it('should handle boundary values correctly', () => {
    expect(determineHealthLevel(74.9)).toBe('warning');
    expect(determineHealthLevel(49.9)).toBe('critical');
  });
});

// ============================================================================
// Warning and Suggestion Tests (AC #8)
// ============================================================================

describe('determineSeverity', () => {
  it('should return "high" when score <= 25% of max', () => {
    expect(determineSeverity(5, 25)).toBe('high');
    expect(determineSeverity(4, 20)).toBe('high');
  });

  it('should return "medium" when score <= 50% of max (but > 25%)', () => {
    expect(determineSeverity(10, 25)).toBe('medium');
    expect(determineSeverity(8, 20)).toBe('medium');
  });

  it('should return "low" when score > 50% of max', () => {
    expect(determineSeverity(14, 25)).toBe('low');
    expect(determineSeverity(11, 20)).toBe('low');
  });
});

describe('generateWarnings', () => {
  it('should generate no warnings when all factors are above threshold', () => {
    const factors: HealthFactors = {
      durationScore: 25,
      contextScore: 25,
      frustrationScore: 25,
      retryScore: 20,
      toolErrorScore: 20,
    };

    const warnings = generateWarnings(factors);
    expect(warnings).toHaveLength(0);
  });

  it('should generate warning for low duration score', () => {
    const factors: HealthFactors = {
      durationScore: 10, // Below 15 threshold
      contextScore: 25,
      frustrationScore: 25,
      retryScore: 20,
      toolErrorScore: 20,
    };

    const warnings = generateWarnings(factors);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].factor).toBe('durationScore');
    expect(warnings[0].warning).toContain('duration');
    expect(warnings[0].suggestion).toContain('fresh session');
  });

  it('should generate warning for low context score', () => {
    const factors: HealthFactors = {
      durationScore: 25,
      contextScore: 10, // Below 15 threshold
      frustrationScore: 25,
      retryScore: 20,
      toolErrorScore: 20,
    };

    const warnings = generateWarnings(factors);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].factor).toBe('contextScore');
    expect(warnings[0].warning).toContain('Context');
  });

  it('should generate warning for low frustration score', () => {
    const factors: HealthFactors = {
      durationScore: 25,
      contextScore: 25,
      frustrationScore: 10, // Below 15 threshold
      retryScore: 20,
      toolErrorScore: 20,
    };

    const warnings = generateWarnings(factors);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].factor).toBe('frustrationScore');
    expect(warnings[0].warning).toContain('Frustration');
  });

  it('should generate warning for low retry score', () => {
    const factors: HealthFactors = {
      durationScore: 25,
      contextScore: 25,
      frustrationScore: 25,
      retryScore: 8, // Below 12 threshold
      toolErrorScore: 20,
    };

    const warnings = generateWarnings(factors);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].factor).toBe('retryScore');
    expect(warnings[0].warning).toContain('retry');
  });

  it('should generate warning for low tool error score', () => {
    const factors: HealthFactors = {
      durationScore: 25,
      contextScore: 25,
      frustrationScore: 25,
      retryScore: 20,
      toolErrorScore: 8, // Below 12 threshold
    };

    const warnings = generateWarnings(factors);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].factor).toBe('toolErrorScore');
    expect(warnings[0].warning).toContain('tool');
  });

  it('should generate multiple warnings for multiple low factors', () => {
    const factors: HealthFactors = {
      durationScore: 10,
      contextScore: 10,
      frustrationScore: 10,
      retryScore: 8,
      toolErrorScore: 8,
    };

    const warnings = generateWarnings(factors);
    expect(warnings).toHaveLength(5);
  });

  it('should sort warnings by severity (high first)', () => {
    const factors: HealthFactors = {
      durationScore: 14, // low severity (56%)
      contextScore: 5, // high severity (20%)
      frustrationScore: 10, // medium severity (40%)
      retryScore: 20,
      toolErrorScore: 20,
    };

    const warnings = generateWarnings(factors);
    expect(warnings[0].severity).toBe('high');
    expect(warnings[1].severity).toBe('medium');
    expect(warnings[2].severity).toBe('low');
  });
});

describe('extractSuggestions', () => {
  it('should extract suggestions from warnings', () => {
    const warnings: HealthWarning[] = [
      {
        factor: 'durationScore',
        warning: 'Duration warning',
        suggestion: 'Suggestion 1',
        severity: 'high',
      },
      {
        factor: 'contextScore',
        warning: 'Context warning',
        suggestion: 'Suggestion 2',
        severity: 'medium',
      },
    ];

    const suggestions = extractSuggestions(warnings);
    expect(suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);
  });

  it('should return empty array for no warnings', () => {
    const suggestions = extractSuggestions([]);
    expect(suggestions).toEqual([]);
  });
});

// ============================================================================
// Main Calculator Tests (AC #1)
// ============================================================================

describe('calculateSessionHealth', () => {
  describe('healthy session scenarios', () => {
    it('should return healthy score for optimal session', () => {
      const input: SessionHealthInput = {
        durationMinutes: 30, // 25 pts
        contextUsageEstimate: 0.3, // 25 pts
        frustrationCount: 1,
        totalPrompts: 100, // 1% = 25 pts
        retryCount: 3, // 3% = 20 pts
        toolErrorCount: 1,
        toolCallCount: 100, // 1% = 20 pts
      };

      const result = calculateSessionHealth(input);

      expect(result.healthScore).toBe(100); // 115/115 = 100%
      expect(result.healthLevel).toBe('healthy');
      expect(result.warnings).toHaveLength(0);
    });

    it('should return healthy score for good session', () => {
      const input: SessionHealthInput = {
        durationMinutes: 75, // 20 pts
        contextUsageEstimate: 0.6, // 20 pts
        frustrationCount: 4,
        totalPrompts: 100, // 4% = 20 pts
        retryCount: 8, // 8% = 16 pts
        toolErrorCount: 4,
        toolCallCount: 100, // 4% = 16 pts
      };

      const result = calculateSessionHealth(input);

      // (20+20+20+16+16)/115 = 92/115 = 80%
      expect(result.healthScore).toBe(80);
      expect(result.healthLevel).toBe('healthy');
    });
  });

  describe('warning session scenarios', () => {
    it('should return warning score for moderate session', () => {
      const input: SessionHealthInput = {
        durationMinutes: 100, // 15 pts
        contextUsageEstimate: 0.75, // 15 pts
        frustrationCount: 8,
        totalPrompts: 100, // 8% = 15 pts
        retryCount: 12, // 12% = 12 pts
        toolErrorCount: 8,
        toolCallCount: 100, // 8% = 12 pts
      };

      const result = calculateSessionHealth(input);

      // (15+15+15+12+12)/115 = 69/115 = 60%
      expect(result.healthScore).toBe(60);
      expect(result.healthLevel).toBe('warning');
    });
  });

  describe('critical session scenarios', () => {
    it('should return critical score for poor session', () => {
      const input: SessionHealthInput = {
        durationMinutes: 200, // 5 pts
        contextUsageEstimate: 0.95, // 5 pts
        frustrationCount: 20,
        totalPrompts: 100, // 20% = 5 pts
        retryCount: 25, // 25% = 4 pts
        toolErrorCount: 25,
        toolCallCount: 100, // 25% = 4 pts
      };

      const result = calculateSessionHealth(input);

      // (5+5+5+4+4)/115 = 23/115 = 20%
      expect(result.healthScore).toBe(20);
      expect(result.healthLevel).toBe('critical');
    });
  });

  describe('factor breakdown', () => {
    it('should include all factor scores', () => {
      const input = createDefaultHealthInput();
      const result = calculateSessionHealth(input);

      expect(result.factors).toHaveProperty('durationScore');
      expect(result.factors).toHaveProperty('contextScore');
      expect(result.factors).toHaveProperty('frustrationScore');
      expect(result.factors).toHaveProperty('retryScore');
      expect(result.factors).toHaveProperty('toolErrorScore');
    });
  });

  describe('edge cases', () => {
    it('should handle new/empty session gracefully', () => {
      const input: SessionHealthInput = {
        durationMinutes: 0,
        contextUsageEstimate: 0,
        frustrationCount: 0,
        totalPrompts: 0,
        retryCount: 0,
        toolErrorCount: 0,
        toolCallCount: 0,
      };

      const result = calculateSessionHealth(input);

      expect(result.healthScore).toBe(100);
      expect(result.healthLevel).toBe('healthy');
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle session with only one prompt', () => {
      const input: SessionHealthInput = {
        durationMinutes: 1,
        contextUsageEstimate: 0.01,
        frustrationCount: 0,
        totalPrompts: 1,
        retryCount: 0,
        toolErrorCount: 0,
        toolCallCount: 0,
      };

      const result = calculateSessionHealth(input);

      expect(result.healthScore).toBe(100);
      expect(result.healthLevel).toBe('healthy');
    });

    it('should cap score at 100', () => {
      const input: SessionHealthInput = {
        durationMinutes: -100, // invalid -> 25
        contextUsageEstimate: -0.5, // invalid -> 25
        frustrationCount: -5, // invalid -> 25
        totalPrompts: 100,
        retryCount: -5, // invalid -> 20
        toolErrorCount: -5,
        toolCallCount: 100, // invalid -> 20
      };

      const result = calculateSessionHealth(input);
      expect(result.healthScore).toBeLessThanOrEqual(100);
    });

    it('should cap score at 0', () => {
      // Even worst case should not go below 0
      const input: SessionHealthInput = {
        durationMinutes: 1000,
        contextUsageEstimate: 1.0,
        frustrationCount: 100,
        totalPrompts: 100,
        retryCount: 100,
        toolErrorCount: 100,
        toolCallCount: 100,
      };

      const result = calculateSessionHealth(input);
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('warnings and suggestions', () => {
    it('should include warnings for low-scoring factors', () => {
      const input: SessionHealthInput = {
        durationMinutes: 200, // 5 pts - below 15 threshold
        contextUsageEstimate: 0.95, // 5 pts - below 15 threshold
        frustrationCount: 0,
        totalPrompts: 100,
        retryCount: 0,
        toolErrorCount: 0,
        toolCallCount: 0,
      };

      const result = calculateSessionHealth(input);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should include suggestions matching warnings', () => {
      const input: SessionHealthInput = {
        durationMinutes: 200,
        contextUsageEstimate: 0.3,
        frustrationCount: 0,
        totalPrompts: 100,
        retryCount: 0,
        toolErrorCount: 0,
        toolCallCount: 0,
      };

      const result = calculateSessionHealth(input);

      expect(result.warnings.length).toBe(result.suggestions.length);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createDefaultHealthInput', () => {
  it('should create input with all zeros', () => {
    const input = createDefaultHealthInput();

    expect(input.durationMinutes).toBe(0);
    expect(input.contextUsageEstimate).toBe(0);
    expect(input.frustrationCount).toBe(0);
    expect(input.totalPrompts).toBe(0);
    expect(input.retryCount).toBe(0);
    expect(input.toolErrorCount).toBe(0);
    expect(input.toolCallCount).toBe(0);
  });

  it('should produce healthy score when used', () => {
    const input = createDefaultHealthInput();
    const result = calculateSessionHealth(input);

    expect(result.healthLevel).toBe('healthy');
  });
});

describe('createHealthTrendPoint', () => {
  it('should create trend point from metrics', () => {
    const metrics: SessionHealthMetrics = {
      healthScore: 85,
      healthLevel: 'healthy',
      factors: {
        durationScore: 25,
        contextScore: 25,
        frustrationScore: 25,
        retryScore: 16,
        toolErrorScore: 16,
      },
      warnings: [],
      suggestions: [],
    };

    const point = createHealthTrendPoint(metrics);

    expect(point.healthScore).toBe(85);
    expect(point.healthLevel).toBe('healthy');
    expect(point.timestamp).toBeDefined();
  });

  it('should use provided timestamp', () => {
    const metrics: SessionHealthMetrics = {
      healthScore: 85,
      healthLevel: 'healthy',
      factors: {
        durationScore: 25,
        contextScore: 25,
        frustrationScore: 25,
        retryScore: 16,
        toolErrorScore: 16,
      },
      warnings: [],
      suggestions: [],
    };

    const customTimestamp = '2025-12-23T12:00:00.000Z';
    const point = createHealthTrendPoint(metrics, customTimestamp);

    expect(point.timestamp).toBe(customTimestamp);
  });
});

describe('factorsToJson', () => {
  it('should convert factors to JSON object', () => {
    const factors: HealthFactors = {
      durationScore: 25,
      contextScore: 20,
      frustrationScore: 15,
      retryScore: 16,
      toolErrorScore: 12,
    };

    const json = factorsToJson(factors);

    expect(json.durationScore).toBe(25);
    expect(json.contextScore).toBe(20);
    expect(json.frustrationScore).toBe(15);
    expect(json.retryScore).toBe(16);
    expect(json.toolErrorScore).toBe(12);
  });
});

// ============================================================================
// Type Tests
// ============================================================================

describe('Type definitions', () => {
  it('should accept valid HealthLevel values', () => {
    const levels: HealthLevel[] = ['healthy', 'warning', 'critical'];
    levels.forEach((level) => {
      expect(['healthy', 'warning', 'critical']).toContain(level);
    });
  });

  it('should match SessionHealthInput interface', () => {
    const input: SessionHealthInput = {
      durationMinutes: 60,
      contextUsageEstimate: 0.5,
      frustrationCount: 2,
      totalPrompts: 50,
      retryCount: 3,
      toolErrorCount: 1,
      toolCallCount: 20,
    };

    expect(input).toHaveProperty('durationMinutes');
    expect(input).toHaveProperty('contextUsageEstimate');
    expect(input).toHaveProperty('frustrationCount');
    expect(input).toHaveProperty('totalPrompts');
    expect(input).toHaveProperty('retryCount');
    expect(input).toHaveProperty('toolErrorCount');
    expect(input).toHaveProperty('toolCallCount');
  });

  it('should match HealthTrendPoint interface', () => {
    const point: HealthTrendPoint = {
      timestamp: '2025-12-23T12:00:00.000Z',
      healthScore: 85,
      healthLevel: 'healthy',
    };

    expect(point).toHaveProperty('timestamp');
    expect(point).toHaveProperty('healthScore');
    expect(point).toHaveProperty('healthLevel');
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should calculate health in under 1ms', () => {
    const input: SessionHealthInput = {
      durationMinutes: 60,
      contextUsageEstimate: 0.5,
      frustrationCount: 5,
      totalPrompts: 100,
      retryCount: 10,
      toolErrorCount: 5,
      toolCallCount: 50,
    };

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      calculateSessionHealth(input);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    expect(avgTime).toBeLessThan(1);
  });
});
