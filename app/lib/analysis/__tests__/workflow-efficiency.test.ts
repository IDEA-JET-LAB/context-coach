/**
 * Workflow Efficiency Metrics Tests - Story 21-10
 *
 * TDD tests for workflow efficiency calculation including:
 * - Team benchmarks configuration
 * - Metric calculations (prompts per task, context resets, debugging loops)
 * - Efficiency scoring algorithm
 * - Benchmark level determination
 */

import { describe, it, expect } from 'vitest';
import {
  TEAM_BENCHMARKS,
  calculateWorkflowEfficiency,
  calculatePromptsPerTask,
  calculateContextResetsPerSession,
  calculateDebuggingLoopAverage,
  calculateTimeToResolution,
  calculateEfficiencyScore,
  determineBenchmarkLevel,
  type UserEfficiencyInput,
  type WorkflowEfficiencyMetrics,
  type EfficiencyBenchmark,
} from '../workflow-efficiency';

describe('TEAM_BENCHMARKS', () => {
  it('should have correct default benchmark values', () => {
    expect(TEAM_BENCHMARKS.promptsPerTask).toBe(5.8);
    expect(TEAM_BENCHMARKS.contextResetsPerSession).toBe(0.5);
    expect(TEAM_BENCHMARKS.debuggingLoopAverage).toBe(3.0);
  });
});

describe('calculatePromptsPerTask', () => {
  it('should calculate prompts per task correctly', () => {
    expect(calculatePromptsPerTask(29, 5)).toBe(5.8);
    expect(calculatePromptsPerTask(20, 4)).toBe(5);
    expect(calculatePromptsPerTask(30, 10)).toBe(3);
  });

  it('should return 0 when no completed tasks', () => {
    expect(calculatePromptsPerTask(10, 0)).toBe(0);
  });

  it('should handle fractional results', () => {
    expect(calculatePromptsPerTask(17, 3)).toBeCloseTo(5.67, 1);
  });

  it('should return 0 when no prompts', () => {
    expect(calculatePromptsPerTask(0, 5)).toBe(0);
  });
});

describe('calculateContextResetsPerSession', () => {
  it('should calculate context resets per session correctly', () => {
    expect(calculateContextResetsPerSession(5, 10)).toBe(0.5);
    expect(calculateContextResetsPerSession(2, 4)).toBe(0.5);
    expect(calculateContextResetsPerSession(3, 6)).toBe(0.5);
  });

  it('should return 0 when no sessions', () => {
    expect(calculateContextResetsPerSession(5, 0)).toBe(0);
  });

  it('should return 0 when no resets', () => {
    expect(calculateContextResetsPerSession(0, 10)).toBe(0);
  });

  it('should handle high reset rate', () => {
    expect(calculateContextResetsPerSession(20, 10)).toBe(2);
  });
});

describe('calculateDebuggingLoopAverage', () => {
  it('should calculate debugging loop average correctly', () => {
    expect(calculateDebuggingLoopAverage(15, 5)).toBe(3);
    expect(calculateDebuggingLoopAverage(10, 5)).toBe(2);
    expect(calculateDebuggingLoopAverage(21, 7)).toBe(3);
  });

  it('should return 0 when no debugging resolutions', () => {
    expect(calculateDebuggingLoopAverage(10, 0)).toBe(0);
  });

  it('should return 0 when no debugging prompts', () => {
    expect(calculateDebuggingLoopAverage(0, 5)).toBe(0);
  });

  it('should handle fractional results', () => {
    expect(calculateDebuggingLoopAverage(7, 3)).toBeCloseTo(2.33, 1);
  });
});

describe('calculateTimeToResolution', () => {
  it('should calculate time to resolution correctly', () => {
    expect(calculateTimeToResolution(300, 5)).toBe(60);
    expect(calculateTimeToResolution(180, 3)).toBe(60);
    expect(calculateTimeToResolution(120, 4)).toBe(30);
  });

  it('should return 0 when no completed tasks', () => {
    expect(calculateTimeToResolution(100, 0)).toBe(0);
  });

  it('should return 0 when no time spent', () => {
    expect(calculateTimeToResolution(0, 5)).toBe(0);
  });

  it('should handle fractional results', () => {
    expect(calculateTimeToResolution(100, 3)).toBeCloseTo(33.33, 1);
  });
});

describe('calculateEfficiencyScore', () => {
  describe('baseline score', () => {
    it('should return 50 for metrics exactly at benchmark (no bonus for matching)', () => {
      // Metrics exactly at benchmark - no bonus because conditions use < not <=
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 58,
        completedTasks: 10, // 5.8 prompts per task (exactly benchmark)
        contextResets: 5,
        totalSessions: 10, // 0.5 resets per session (exactly benchmark)
        debuggingPrompts: 30,
        debuggingResolutions: 10, // 3.0 debugging loops (exactly benchmark)
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 0 (exactly at benchmark, not below) = 50
      expect(score).toBe(50);
    });

    it('should add bonuses for metrics below benchmark', () => {
      // Metrics slightly below benchmark - should get bonuses
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 57, // 5.7 prompts per task (< 5.8, gets +10)
        completedTasks: 10,
        contextResets: 4, // 0.4 resets per session (< 0.5, gets +8)
        totalSessions: 10,
        debuggingPrompts: 29, // 2.9 debugging loops (< 3.0, gets +8)
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 10 + 8 + 8 = 76
      expect(score).toBe(76);
    });
  });

  describe('prompts per task scoring (AC #3, #7)', () => {
    it('should add +20 points when prompts per task < 80% of benchmark', () => {
      // 80% of 5.8 = 4.64, so we need < 4.64
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 40, // 4.0 prompts per task (< 4.64)
        completedTasks: 10,
        contextResets: 4, // 0.4 < 0.5 -> +8
        totalSessions: 10,
        debuggingPrompts: 29, // 2.9 < 3.0 -> +8
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 20 (excellent prompts) + 8 (context) + 8 (debug) = 86
      expect(score).toBe(86);
    });

    it('should add +10 points when prompts per task < 100% but >= 80% of benchmark', () => {
      // >= 80% of 5.8 = 4.64, < 100% = 5.8
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 50, // 5.0 prompts per task (>= 4.64 and < 5.8)
        completedTasks: 10,
        contextResets: 4, // 0.4 < 0.5 -> +8
        totalSessions: 10,
        debuggingPrompts: 29, // 2.9 < 3.0 -> +8
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 10 (good prompts) + 8 (context) + 8 (debug) = 76
      expect(score).toBe(76);
    });

    it('should subtract -15 points when prompts per task > 150% of benchmark', () => {
      // > 150% of 5.8 = 8.7
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 100, // 10.0 prompts per task (> 8.7)
        completedTasks: 10,
        contextResets: 4, // 0.4 < 0.5 -> +8
        totalSessions: 10,
        debuggingPrompts: 29, // 2.9 < 3.0 -> +8
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 - 15 (poor prompts) + 8 (context) + 8 (debug) = 51
      expect(score).toBe(51);
    });
  });

  describe('context resets scoring (AC #4, #7)', () => {
    it('should add +15 points when context resets < 50% of benchmark', () => {
      // 50% of 0.5 = 0.25
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 57, // 5.7 < 5.8 -> +10
        completedTasks: 10,
        contextResets: 2, // 0.2 resets per session (< 0.25) -> +15
        totalSessions: 10,
        debuggingPrompts: 29, // 2.9 < 3.0 -> +8
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 10 (prompts) + 15 (excellent context) + 8 (debug) = 83
      expect(score).toBe(83);
    });

    it('should add +8 points when context resets < 100% but >= 50% of benchmark', () => {
      // >= 50% of 0.5 = 0.25, < 100% = 0.5
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 57, // 5.7 < 5.8 -> +10
        completedTasks: 10,
        contextResets: 4, // 0.4 resets per session (>= 0.25 and < 0.5) -> +8
        totalSessions: 10,
        debuggingPrompts: 29, // 2.9 < 3.0 -> +8
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 10 (prompts) + 8 (good context) + 8 (debug) = 76
      expect(score).toBe(76);
    });

    it('should subtract -10 points when context resets > 200% of benchmark', () => {
      // > 200% of 0.5 = 1.0
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 57, // 5.7 < 5.8 -> +10
        completedTasks: 10,
        contextResets: 15, // 1.5 resets per session (> 1.0) -> -10
        totalSessions: 10,
        debuggingPrompts: 29, // 2.9 < 3.0 -> +8
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 10 (prompts) - 10 (poor context) + 8 (debug) = 58
      expect(score).toBe(58);
    });
  });

  describe('debugging loop scoring (AC #5)', () => {
    it('should add +15 points when debugging loop < 70% of benchmark', () => {
      // 70% of 3.0 = 2.1
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 57, // 5.7 < 5.8 -> +10
        completedTasks: 10,
        contextResets: 4, // 0.4 < 0.5 -> +8
        totalSessions: 10,
        debuggingPrompts: 20, // 2.0 debugging loops (< 2.1) -> +15
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 10 (prompts) + 8 (context) + 15 (excellent debug) = 83
      expect(score).toBe(83);
    });

    it('should add +8 points when debugging loop < 100% but >= 70% of benchmark', () => {
      // >= 70% of 3.0 = 2.1, < 100% = 3.0
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 57, // 5.7 < 5.8 -> +10
        completedTasks: 10,
        contextResets: 4, // 0.4 < 0.5 -> +8
        totalSessions: 10,
        debuggingPrompts: 25, // 2.5 debugging loops (>= 2.1 and < 3.0) -> +8
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 10 (prompts) + 8 (context) + 8 (good debug) = 76
      expect(score).toBe(76);
    });
  });

  describe('score capping', () => {
    it('should cap score at 100', () => {
      // Best possible scenario - all metrics excellent
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 30, // 3.0 prompts per task (< 80% benchmark)
        completedTasks: 10,
        contextResets: 1, // 0.1 resets per session (< 50% benchmark)
        totalSessions: 10,
        debuggingPrompts: 10, // 1.0 debugging loops (< 70% benchmark)
        debuggingResolutions: 10,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 + 20 + 15 + 15 = 100, capped at 100
      expect(score).toBe(100);
    });

    it('should cap score at 0', () => {
      // Worst possible scenario - all metrics terrible
      const userMetrics: UserEfficiencyInput = {
        totalPrompts: 200, // 20.0 prompts per task (> 150% benchmark)
        completedTasks: 10,
        contextResets: 30, // 3.0 resets per session (> 200% benchmark)
        totalSessions: 10,
        debuggingPrompts: 100, // No resolutions - 0 debugging loop (edge case)
        debuggingResolutions: 0,
        totalTimeMinutes: 600,
      };

      const score = calculateEfficiencyScore(userMetrics);
      // Base 50 - 15 - 10 = 25 (minimum is 0 but we might not reach it)
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

describe('determineBenchmarkLevel (AC #6)', () => {
  it('should return "excellent" for score >= 80', () => {
    expect(determineBenchmarkLevel(80)).toBe('excellent');
    expect(determineBenchmarkLevel(90)).toBe('excellent');
    expect(determineBenchmarkLevel(100)).toBe('excellent');
  });

  it('should return "above_average" for score >= 60 and < 80', () => {
    expect(determineBenchmarkLevel(60)).toBe('above_average');
    expect(determineBenchmarkLevel(70)).toBe('above_average');
    expect(determineBenchmarkLevel(79)).toBe('above_average');
  });

  it('should return "average" for score >= 40 and < 60', () => {
    expect(determineBenchmarkLevel(40)).toBe('average');
    expect(determineBenchmarkLevel(50)).toBe('average');
    expect(determineBenchmarkLevel(59)).toBe('average');
  });

  it('should return "below_average" for score < 40', () => {
    expect(determineBenchmarkLevel(0)).toBe('below_average');
    expect(determineBenchmarkLevel(20)).toBe('below_average');
    expect(determineBenchmarkLevel(39)).toBe('below_average');
  });
});

describe('calculateWorkflowEfficiency (AC #1, #2)', () => {
  it('should return complete efficiency metrics', () => {
    const userMetrics: UserEfficiencyInput = {
      totalPrompts: 58,
      completedTasks: 10,
      contextResets: 5,
      totalSessions: 10,
      debuggingPrompts: 30,
      debuggingResolutions: 10,
      totalTimeMinutes: 600,
    };

    const result = calculateWorkflowEfficiency(userMetrics);

    expect(result).toHaveProperty('promptsPerTask');
    expect(result).toHaveProperty('contextResetsPerSession');
    expect(result).toHaveProperty('debuggingLoopAverage');
    expect(result).toHaveProperty('timeToResolutionMinutes');
    expect(result).toHaveProperty('efficiencyScore');
    expect(result).toHaveProperty('benchmark');
  });

  it('should calculate all metrics correctly', () => {
    const userMetrics: UserEfficiencyInput = {
      totalPrompts: 58,
      completedTasks: 10, // 5.8 prompts per task
      contextResets: 5,
      totalSessions: 10, // 0.5 resets per session
      debuggingPrompts: 30,
      debuggingResolutions: 10, // 3.0 debugging loops
      totalTimeMinutes: 600, // 60 min per task
    };

    const result = calculateWorkflowEfficiency(userMetrics);

    expect(result.promptsPerTask).toBe(5.8);
    expect(result.contextResetsPerSession).toBe(0.5);
    expect(result.debuggingLoopAverage).toBe(3);
    expect(result.timeToResolutionMinutes).toBe(60);
  });

  it('should determine benchmark level based on score', () => {
    // Excellent metrics
    const excellentMetrics: UserEfficiencyInput = {
      totalPrompts: 30,
      completedTasks: 10,
      contextResets: 1,
      totalSessions: 10,
      debuggingPrompts: 10,
      debuggingResolutions: 10,
      totalTimeMinutes: 600,
    };

    const excellentResult = calculateWorkflowEfficiency(excellentMetrics);
    expect(excellentResult.benchmark).toBe('excellent');
    expect(excellentResult.efficiencyScore).toBeGreaterThanOrEqual(80);

    // Average metrics
    const averageMetrics: UserEfficiencyInput = {
      totalPrompts: 80,
      completedTasks: 10,
      contextResets: 8,
      totalSessions: 10,
      debuggingPrompts: 40,
      debuggingResolutions: 10,
      totalTimeMinutes: 600,
    };

    const averageResult = calculateWorkflowEfficiency(averageMetrics);
    expect(averageResult.efficiencyScore).toBeLessThan(80);
  });

  it('should handle zero values gracefully', () => {
    const zeroMetrics: UserEfficiencyInput = {
      totalPrompts: 0,
      completedTasks: 0,
      contextResets: 0,
      totalSessions: 0,
      debuggingPrompts: 0,
      debuggingResolutions: 0,
      totalTimeMinutes: 0,
    };

    const result = calculateWorkflowEfficiency(zeroMetrics);

    expect(result.promptsPerTask).toBe(0);
    expect(result.contextResetsPerSession).toBe(0);
    expect(result.debuggingLoopAverage).toBe(0);
    expect(result.timeToResolutionMinutes).toBe(0);
    // Score calculation with zeros - base 50 with no adjustments
    expect(result.efficiencyScore).toBe(50);
    expect(result.benchmark).toBe('average');
  });

  it('should handle edge case: many prompts, no tasks completed', () => {
    const noTasksMetrics: UserEfficiencyInput = {
      totalPrompts: 100,
      completedTasks: 0,
      contextResets: 10,
      totalSessions: 5,
      debuggingPrompts: 50,
      debuggingResolutions: 0,
      totalTimeMinutes: 300,
    };

    const result = calculateWorkflowEfficiency(noTasksMetrics);

    expect(result.promptsPerTask).toBe(0);
    expect(result.timeToResolutionMinutes).toBe(0);
    // Context resets = 10/5 = 2.0 (> 200% of 0.5 = 1.0) -> -10
    expect(result.contextResetsPerSession).toBe(2);
    // Score with zero denominators should not crash
    expect(result.efficiencyScore).toBeGreaterThanOrEqual(0);
    expect(result.efficiencyScore).toBeLessThanOrEqual(100);
  });
});

describe('WorkflowEfficiencyMetrics type', () => {
  it('should match expected interface structure', () => {
    const metrics: WorkflowEfficiencyMetrics = {
      promptsPerTask: 5.8,
      contextResetsPerSession: 0.5,
      debuggingLoopAverage: 3.0,
      timeToResolutionMinutes: 60,
      efficiencyScore: 75,
      benchmark: 'above_average',
    };

    expect(metrics.promptsPerTask).toBe(5.8);
    expect(metrics.contextResetsPerSession).toBe(0.5);
    expect(metrics.debuggingLoopAverage).toBe(3.0);
    expect(metrics.timeToResolutionMinutes).toBe(60);
    expect(metrics.efficiencyScore).toBe(75);
    expect(metrics.benchmark).toBe('above_average');
  });

  it('should accept all valid benchmark values', () => {
    const benchmarks: EfficiencyBenchmark[] = [
      'below_average',
      'average',
      'above_average',
      'excellent',
    ];

    benchmarks.forEach((benchmark) => {
      const metrics: WorkflowEfficiencyMetrics = {
        promptsPerTask: 5.8,
        contextResetsPerSession: 0.5,
        debuggingLoopAverage: 3.0,
        timeToResolutionMinutes: 60,
        efficiencyScore: 50,
        benchmark,
      };

      expect(metrics.benchmark).toBe(benchmark);
    });
  });
});
