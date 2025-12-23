/**
 * Story 21-9: Learning Progression Tracking - Unit Tests
 *
 * Tests for progression calculation, achievement generation, and suggestions.
 */

import { describe, it, expect } from 'vitest';
import {
  WeeklyMetrics,
  MetricImprovements,
  calculatePercentageChange,
  calculateImprovements,
  generateAchievements,
  generateSuggestions,
  calculateProgression,
  createEmptyWeeklyMetrics,
  getWeekStart,
  getPreviousWeekStart,
  isValidWeekStart,
  FIRST_WEEK_MESSAGE,
  DEFAULT_THRESHOLDS,
} from '../learning-progression';

// Helper to create test metrics
function createTestMetrics(overrides: Partial<WeeklyMetrics> = {}): WeeklyMetrics {
  return {
    weekStart: '2025-01-19',
    avgPromptScore: 7.0,
    frustrationRate: 0.15,
    promptsPerGoal: 5.0,
    contextExhaustionRate: 0.1,
    totalPrompts: 100,
    totalSessions: 20,
    ...overrides,
  };
}

describe('calculatePercentageChange', () => {
  it('should calculate positive percentage change', () => {
    expect(calculatePercentageChange(110, 100)).toBe(10);
    expect(calculatePercentageChange(150, 100)).toBe(50);
  });

  it('should calculate negative percentage change', () => {
    expect(calculatePercentageChange(90, 100)).toBe(-10);
    expect(calculatePercentageChange(50, 100)).toBe(-50);
  });

  it('should return 0 when previous is 0', () => {
    expect(calculatePercentageChange(100, 0)).toBe(0);
  });

  it('should return 0 when previous is negative', () => {
    expect(calculatePercentageChange(100, -10)).toBe(0);
  });

  it('should handle decimal values', () => {
    expect(calculatePercentageChange(7.5, 7.0)).toBeCloseTo(7.14, 1);
  });

  it('should handle zero current value', () => {
    expect(calculatePercentageChange(0, 100)).toBe(-100);
  });
});

describe('calculateImprovements', () => {
  it('should calculate all metric improvements', () => {
    const current = createTestMetrics({
      avgPromptScore: 7.5,
      frustrationRate: 0.12,
      promptsPerGoal: 4.0,
      contextExhaustionRate: 0.08,
    });
    const previous = createTestMetrics({
      avgPromptScore: 7.0,
      frustrationRate: 0.15,
      promptsPerGoal: 5.0,
      contextExhaustionRate: 0.10,
    });

    const improvements = calculateImprovements(current, previous);

    // Prompt score improved by ~7.14%
    expect(improvements.promptScore).toBeCloseTo(7.14, 1);
    // Frustration decreased by 20% (negative change)
    expect(improvements.frustration).toBe(-20);
    // Efficiency improved by 20% (fewer prompts per goal)
    expect(improvements.efficiency).toBeCloseTo(20, 5);
    // Context management improved by 20%
    expect(improvements.contextManagement).toBeCloseTo(20, 5);
  });

  it('should handle zero previous values', () => {
    const current = createTestMetrics();
    const previous = createTestMetrics({
      avgPromptScore: 0,
      frustrationRate: 0,
      promptsPerGoal: 0,
      contextExhaustionRate: 0,
    });

    const improvements = calculateImprovements(current, previous);

    expect(improvements.promptScore).toBe(0);
    expect(improvements.frustration).toBe(0);
    expect(improvements.efficiency).toBe(0);
    expect(improvements.contextManagement).toBe(0);
  });

  it('should handle declining metrics', () => {
    const current = createTestMetrics({
      avgPromptScore: 6.0,
      frustrationRate: 0.20,
      promptsPerGoal: 6.0,
      contextExhaustionRate: 0.15,
    });
    const previous = createTestMetrics({
      avgPromptScore: 7.0,
      frustrationRate: 0.15,
      promptsPerGoal: 5.0,
      contextExhaustionRate: 0.10,
    });

    const improvements = calculateImprovements(current, previous);

    // Score declined
    expect(improvements.promptScore).toBeCloseTo(-14.29, 1);
    // Frustration increased
    expect(improvements.frustration).toBeCloseTo(33.33, 1);
    // Efficiency declined (negative value)
    expect(improvements.efficiency).toBeCloseTo(-20, 5);
    // Context management declined (negative value)
    expect(improvements.contextManagement).toBeCloseTo(-50, 5);
  });
});

describe('generateAchievements', () => {
  it('should generate prompt quality achievement for >5% improvement (AC #3)', () => {
    const improvements: MetricImprovements = {
      promptScore: 10,
      frustration: 0,
      efficiency: 0,
      contextManagement: 0,
    };

    const achievements = generateAchievements(improvements);

    expect(achievements).toHaveLength(1);
    expect(achievements[0]).toBe('Prompt quality improved 10%!');
  });

  it('should not generate prompt achievement for exactly 5%', () => {
    const improvements: MetricImprovements = {
      promptScore: 5,
      frustration: 0,
      efficiency: 0,
      contextManagement: 0,
    };

    const achievements = generateAchievements(improvements);

    expect(achievements).toHaveLength(0);
  });

  it('should generate frustration achievement for >10% decrease (AC #4)', () => {
    const improvements: MetricImprovements = {
      promptScore: 0,
      frustration: -15, // 15% decrease
      efficiency: 0,
      contextManagement: 0,
    };

    const achievements = generateAchievements(improvements);

    expect(achievements).toHaveLength(1);
    expect(achievements[0]).toBe('Frustration levels decreased - great communication!');
  });

  it('should not generate frustration achievement for exactly 10% decrease', () => {
    const improvements: MetricImprovements = {
      promptScore: 0,
      frustration: -10,
      efficiency: 0,
      contextManagement: 0,
    };

    const achievements = generateAchievements(improvements);

    expect(achievements).toHaveLength(0);
  });

  it('should generate efficiency achievement for >10% improvement (AC #5)', () => {
    const improvements: MetricImprovements = {
      promptScore: 0,
      frustration: 0,
      efficiency: 15,
      contextManagement: 0,
    };

    const achievements = generateAchievements(improvements);

    expect(achievements).toHaveLength(1);
    expect(achievements[0]).toBe('Workflow efficiency improved - fewer prompts per goal!');
  });

  it('should generate context management achievement for >20% improvement (AC #6)', () => {
    const improvements: MetricImprovements = {
      promptScore: 0,
      frustration: 0,
      efficiency: 0,
      contextManagement: 25,
    };

    const achievements = generateAchievements(improvements);

    expect(achievements).toHaveLength(1);
    expect(achievements[0]).toBe('Context management mastery - fewer resets!');
  });

  it('should not generate context achievement for exactly 20%', () => {
    const improvements: MetricImprovements = {
      promptScore: 0,
      frustration: 0,
      efficiency: 0,
      contextManagement: 20,
    };

    const achievements = generateAchievements(improvements);

    expect(achievements).toHaveLength(0);
  });

  it('should generate multiple achievements when multiple thresholds are met', () => {
    const improvements: MetricImprovements = {
      promptScore: 10,
      frustration: -15,
      efficiency: 20,
      contextManagement: 25,
    };

    const achievements = generateAchievements(improvements);

    expect(achievements).toHaveLength(4);
    expect(achievements).toContain('Prompt quality improved 10%!');
    expect(achievements).toContain('Frustration levels decreased - great communication!');
    expect(achievements).toContain('Workflow efficiency improved - fewer prompts per goal!');
    expect(achievements).toContain('Context management mastery - fewer resets!');
  });

  it('should use custom thresholds', () => {
    const improvements: MetricImprovements = {
      promptScore: 3,
      frustration: 0,
      efficiency: 0,
      contextManagement: 0,
    };

    const customThresholds = {
      ...DEFAULT_THRESHOLDS,
      promptScoreImprovement: 2,
    };

    const achievements = generateAchievements(improvements, customThresholds);

    expect(achievements).toHaveLength(1);
    expect(achievements[0]).toBe('Prompt quality improved 3%!');
  });

  it('should round percentage in achievement message', () => {
    const improvements: MetricImprovements = {
      promptScore: 7.143,
      frustration: 0,
      efficiency: 0,
      contextManagement: 0,
    };

    const achievements = generateAchievements(improvements);

    expect(achievements[0]).toBe('Prompt quality improved 7%!');
  });
});

describe('generateSuggestions', () => {
  it('should generate suggestion for declining prompt score (AC #7)', () => {
    const improvements: MetricImprovements = {
      promptScore: -10,
      frustration: 0,
      efficiency: 0,
      contextManagement: 0,
    };

    const suggestions = generateSuggestions(improvements);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain('Focus on prompt clarity');
  });

  it('should generate suggestion for increasing frustration (AC #7)', () => {
    const improvements: MetricImprovements = {
      promptScore: 0,
      frustration: 15,
      efficiency: 0,
      contextManagement: 0,
    };

    const suggestions = generateSuggestions(improvements);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain('shorter sessions');
  });

  it('should generate suggestion for declining efficiency', () => {
    const improvements: MetricImprovements = {
      promptScore: 0,
      frustration: 0,
      efficiency: -15,
      contextManagement: 0,
    };

    const suggestions = generateSuggestions(improvements);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain('Break complex tasks');
  });

  it('should generate suggestion for declining context management', () => {
    const improvements: MetricImprovements = {
      promptScore: 0,
      frustration: 0,
      efficiency: 0,
      contextManagement: -25,
    };

    const suggestions = generateSuggestions(improvements);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain('summarizing context');
  });

  it('should generate multiple suggestions sorted by priority', () => {
    const improvements: MetricImprovements = {
      promptScore: -10,
      frustration: 15,
      efficiency: -15,
      contextManagement: -25,
    };

    const suggestions = generateSuggestions(improvements);

    expect(suggestions).toHaveLength(4);
    // First suggestion should be about prompt clarity (highest priority)
    expect(suggestions[0]).toContain('Focus on prompt clarity');
    // Second should be about frustration
    expect(suggestions[1]).toContain('shorter sessions');
  });

  it('should not generate suggestions for improvements', () => {
    const improvements: MetricImprovements = {
      promptScore: 10,
      frustration: -15,
      efficiency: 20,
      contextManagement: 25,
    };

    const suggestions = generateSuggestions(improvements);

    expect(suggestions).toHaveLength(0);
  });

  it('should not generate suggestions for minor declines', () => {
    const improvements: MetricImprovements = {
      promptScore: -2,
      frustration: 5,
      efficiency: -5,
      contextManagement: -10,
    };

    const suggestions = generateSuggestions(improvements);

    expect(suggestions).toHaveLength(0);
  });
});

describe('calculateProgression', () => {
  it('should return first week message when no previous week (AC #8)', () => {
    const current = createTestMetrics();

    const progression = calculateProgression(current, null);

    expect(progression.currentWeek).toEqual(current);
    expect(progression.previousWeek).toBeNull();
    expect(progression.improvements).toBeNull();
    expect(progression.achievements).toHaveLength(1);
    expect(progression.achievements[0]).toBe(FIRST_WEEK_MESSAGE);
    expect(progression.suggestions).toHaveLength(0);
  });

  it('should calculate full progression with improvements', () => {
    const current = createTestMetrics({
      avgPromptScore: 7.5,
      frustrationRate: 0.12,
    });
    const previous = createTestMetrics({
      avgPromptScore: 7.0,
      frustrationRate: 0.15,
    });

    const progression = calculateProgression(current, previous);

    expect(progression.currentWeek).toEqual(current);
    expect(progression.previousWeek).toEqual(previous);
    expect(progression.improvements).not.toBeNull();
    expect(progression.improvements?.promptScore).toBeCloseTo(7.14, 1);
    expect(progression.improvements?.frustration).toBe(-20);
  });

  it('should include achievements when thresholds are met', () => {
    const current = createTestMetrics({
      avgPromptScore: 8.0, // >5% improvement
    });
    const previous = createTestMetrics({
      avgPromptScore: 7.0,
    });

    const progression = calculateProgression(current, previous);

    expect(progression.achievements.length).toBeGreaterThan(0);
    expect(progression.achievements[0]).toContain('Prompt quality improved');
  });

  it('should include suggestions when metrics decline', () => {
    const current = createTestMetrics({
      avgPromptScore: 6.0, // >5% decline
    });
    const previous = createTestMetrics({
      avgPromptScore: 7.0,
    });

    const progression = calculateProgression(current, previous);

    expect(progression.suggestions.length).toBeGreaterThan(0);
    expect(progression.suggestions[0]).toContain('Focus on prompt clarity');
  });

  it('should handle no achievements or suggestions', () => {
    const current = createTestMetrics();
    const previous = createTestMetrics(); // Same values

    const progression = calculateProgression(current, previous);

    expect(progression.achievements).toHaveLength(0);
    expect(progression.suggestions).toHaveLength(0);
  });

  it('should use custom thresholds', () => {
    const current = createTestMetrics({
      avgPromptScore: 7.2, // 2.86% improvement - normally not enough
    });
    const previous = createTestMetrics({
      avgPromptScore: 7.0,
    });

    const customThresholds = {
      ...DEFAULT_THRESHOLDS,
      promptScoreImprovement: 2, // Lower threshold
    };

    const progression = calculateProgression(current, previous, customThresholds);

    expect(progression.achievements.length).toBeGreaterThan(0);
    expect(progression.achievements[0]).toContain('Prompt quality improved');
  });
});

describe('createEmptyWeeklyMetrics', () => {
  it('should create metrics with zero values', () => {
    const metrics = createEmptyWeeklyMetrics('2025-01-19');

    expect(metrics.weekStart).toBe('2025-01-19');
    expect(metrics.avgPromptScore).toBe(0);
    expect(metrics.frustrationRate).toBe(0);
    expect(metrics.promptsPerGoal).toBe(0);
    expect(metrics.contextExhaustionRate).toBe(0);
    expect(metrics.totalPrompts).toBe(0);
    expect(metrics.totalSessions).toBe(0);
  });
});

describe('getWeekStart', () => {
  it('should return Sunday for a given date', () => {
    // Wednesday Jan 22, 2025
    const date = new Date(2025, 0, 22);
    const weekStart = getWeekStart(date);

    expect(weekStart).toBe('2025-01-19'); // Sunday
  });

  it('should return same day if already Sunday', () => {
    // Sunday Jan 19, 2025
    const date = new Date(2025, 0, 19);
    const weekStart = getWeekStart(date);

    expect(weekStart).toBe('2025-01-19');
  });

  it('should return previous Sunday for Saturday', () => {
    // Saturday Jan 25, 2025
    const date = new Date(2025, 0, 25);
    const weekStart = getWeekStart(date);

    expect(weekStart).toBe('2025-01-19');
  });

  it('should return previous Sunday for Monday', () => {
    // Monday Jan 20, 2025
    const date = new Date(2025, 0, 20);
    const weekStart = getWeekStart(date);

    expect(weekStart).toBe('2025-01-19');
  });
});

describe('getPreviousWeekStart', () => {
  it('should return previous week start', () => {
    const previousWeek = getPreviousWeekStart('2025-01-19');

    expect(previousWeek).toBe('2025-01-12');
  });

  it('should handle year boundary', () => {
    const previousWeek = getPreviousWeekStart('2025-01-05');

    expect(previousWeek).toBe('2024-12-29');
  });
});

describe('isValidWeekStart', () => {
  it('should return true for Sunday', () => {
    expect(isValidWeekStart('2025-01-19')).toBe(true);
    expect(isValidWeekStart('2025-01-26')).toBe(true);
  });

  it('should return false for other days', () => {
    expect(isValidWeekStart('2025-01-20')).toBe(false); // Monday
    expect(isValidWeekStart('2025-01-21')).toBe(false); // Tuesday
    expect(isValidWeekStart('2025-01-22')).toBe(false); // Wednesday
    expect(isValidWeekStart('2025-01-23')).toBe(false); // Thursday
    expect(isValidWeekStart('2025-01-24')).toBe(false); // Friday
    expect(isValidWeekStart('2025-01-25')).toBe(false); // Saturday
  });
});

describe('Edge Cases', () => {
  it('should handle all zero current values', () => {
    const current = createEmptyWeeklyMetrics('2025-01-19');
    const previous = createTestMetrics({ weekStart: '2025-01-12' });

    const progression = calculateProgression(current, previous);

    expect(progression.improvements).not.toBeNull();
    expect(progression.improvements?.promptScore).toBe(-100);
  });

  it('should handle very large improvements', () => {
    const current = createTestMetrics({
      avgPromptScore: 10,
    });
    const previous = createTestMetrics({
      avgPromptScore: 1,
    });

    const progression = calculateProgression(current, previous);

    expect(progression.improvements?.promptScore).toBe(900);
    expect(progression.achievements.length).toBeGreaterThan(0);
  });

  it('should handle very small values', () => {
    const current = createTestMetrics({
      avgPromptScore: 0.01,
      frustrationRate: 0.001,
    });
    const previous = createTestMetrics({
      avgPromptScore: 0.009,
      frustrationRate: 0.002,
    });

    const improvements = calculateImprovements(current, previous);

    expect(improvements.promptScore).toBeCloseTo(11.11, 1);
    expect(improvements.frustration).toBe(-50);
  });
});
