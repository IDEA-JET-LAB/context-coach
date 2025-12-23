import { describe, it, expect } from 'vitest';
import {
  calculatePromptsPerHour,
  calculateAverageGapFromPrompts,
  calculateDensityFromPrompts,
  findPeakHourFromPrompts,
  calculateHourlyDistribution,
} from '../efficiency';

describe('calculatePromptsPerHour', () => {
  it('should calculate prompts per hour correctly', () => {
    expect(calculatePromptsPerHour(30, 60)).toBe(30);
    expect(calculatePromptsPerHour(15, 30)).toBe(30);
    expect(calculatePromptsPerHour(5, 120)).toBe(2.5);
  });

  it('should handle fractional results', () => {
    expect(calculatePromptsPerHour(10, 45)).toBeCloseTo(13.33, 1);
  });

  it('should return 0 for zero duration', () => {
    expect(calculatePromptsPerHour(10, 0)).toBe(0);
  });

  it('should return 0 for negative duration', () => {
    expect(calculatePromptsPerHour(10, -10)).toBe(0);
  });

  it('should handle large numbers', () => {
    expect(calculatePromptsPerHour(1000, 480)).toBeCloseTo(125, 1);
  });
});

describe('calculateAverageGapFromPrompts', () => {
  it('should calculate average gap between prompts', () => {
    const prompts = [
      { created_at: '2025-01-15T10:00:00Z', sequence_number: 1 },
      { created_at: '2025-01-15T10:05:00Z', sequence_number: 2 },
      { created_at: '2025-01-15T10:10:00Z', sequence_number: 3 },
    ];

    const result = calculateAverageGapFromPrompts(prompts);

    expect(result).toBe(5); // 5 minutes average gap
  });

  it('should exclude gaps longer than 30 minutes', () => {
    const prompts = [
      { created_at: '2025-01-15T10:00:00Z', sequence_number: 1 },
      { created_at: '2025-01-15T10:05:00Z', sequence_number: 2 },
      { created_at: '2025-01-15T11:00:00Z', sequence_number: 3 }, // 55 min gap - excluded
      { created_at: '2025-01-15T11:10:00Z', sequence_number: 4 },
    ];

    const result = calculateAverageGapFromPrompts(prompts);

    // Should average (5 + 10) / 2 = 7.5 (excluding the 55 min gap)
    expect(result).toBe(7.5);
  });

  it('should return 0 for single prompt', () => {
    const prompts = [{ created_at: '2025-01-15T10:00:00Z', sequence_number: 1 }];

    expect(calculateAverageGapFromPrompts(prompts)).toBe(0);
  });

  it('should return 0 for empty array', () => {
    expect(calculateAverageGapFromPrompts([])).toBe(0);
  });

  it('should sort prompts by timestamp', () => {
    // Prompts in wrong order
    const prompts = [
      { created_at: '2025-01-15T10:10:00Z', sequence_number: 3 },
      { created_at: '2025-01-15T10:00:00Z', sequence_number: 1 },
      { created_at: '2025-01-15T10:05:00Z', sequence_number: 2 },
    ];

    const result = calculateAverageGapFromPrompts(prompts);

    expect(result).toBe(5);
  });
});

describe('calculateDensityFromPrompts', () => {
  it('should calculate density for a fully active session', () => {
    const prompts = [
      { created_at: '2025-01-15T10:00:00Z', sequence_number: 1 },
      { created_at: '2025-01-15T10:05:00Z', sequence_number: 2 },
      { created_at: '2025-01-15T10:10:00Z', sequence_number: 3 },
    ];
    const session = {
      started_at: '2025-01-15T10:00:00Z',
      ended_at: '2025-01-15T10:10:00Z', // 10 minutes
    };

    const density = calculateDensityFromPrompts(prompts, session);

    // 10 minutes of active time / 10 minutes total = 1.0
    expect(density).toBe(1);
  });

  it('should calculate density with gaps', () => {
    const prompts = [
      { created_at: '2025-01-15T10:00:00Z', sequence_number: 1 },
      { created_at: '2025-01-15T11:00:00Z', sequence_number: 2 }, // 60 min gap (capped to 30)
      { created_at: '2025-01-15T11:10:00Z', sequence_number: 3 },
    ];
    const session = {
      started_at: '2025-01-15T10:00:00Z',
      ended_at: '2025-01-15T11:10:00Z', // 70 minutes total
    };

    const density = calculateDensityFromPrompts(prompts, session);

    // Active time = 30 (capped) + 10 = 40 minutes
    // Density = 40/70 ≈ 0.571
    expect(density).toBeCloseTo(0.571, 2);
  });

  it('should return 1 for single prompt session', () => {
    const prompts = [{ created_at: '2025-01-15T10:00:00Z', sequence_number: 1 }];
    const session = {
      started_at: '2025-01-15T10:00:00Z',
      ended_at: '2025-01-15T10:30:00Z',
    };

    const density = calculateDensityFromPrompts(prompts, session);

    expect(density).toBe(1);
  });

  it('should return 0 for empty prompts', () => {
    const session = {
      started_at: '2025-01-15T10:00:00Z',
      ended_at: '2025-01-15T10:30:00Z',
    };

    const density = calculateDensityFromPrompts([], session);

    expect(density).toBe(0);
  });
});

describe('findPeakHourFromPrompts', () => {
  it('should find the hour with most prompts', () => {
    // Use local time construction to avoid timezone issues
    const baseDate = new Date(2025, 0, 15, 10, 0, 0); // Jan 15, 2025, 10:00 local
    const prompts = [
      { created_at: new Date(baseDate.getTime()).toISOString() },
      { created_at: new Date(baseDate.getTime() + 15 * 60000).toISOString() }, // 10:15
      { created_at: new Date(baseDate.getTime() + 30 * 60000).toISOString() }, // 10:30
      { created_at: new Date(2025, 0, 15, 14, 0, 0).toISOString() }, // 14:00
      { created_at: new Date(2025, 0, 15, 14, 15, 0).toISOString() }, // 14:15
    ];

    const peakHour = findPeakHourFromPrompts(prompts);

    expect(peakHour).toBe(10); // 3 prompts at 10:00
  });

  it('should return first peak if multiple hours tie', () => {
    const prompts = [
      { created_at: new Date(2025, 0, 15, 10, 0, 0).toISOString() },
      { created_at: new Date(2025, 0, 15, 14, 0, 0).toISOString() },
    ];

    const peakHour = findPeakHourFromPrompts(prompts);

    expect(peakHour).toBe(10); // First peak found
  });

  it('should return 0 for empty prompts', () => {
    expect(findPeakHourFromPrompts([])).toBe(0);
  });

  it('should handle all hours', () => {
    // Prompt at 23:00 local time
    const prompts = [{ created_at: new Date(2025, 0, 15, 23, 30, 0).toISOString() }];

    const peakHour = findPeakHourFromPrompts(prompts);

    expect(peakHour).toBe(23);
  });
});

describe('calculateHourlyDistribution', () => {
  it('should create distribution for 24 hours', () => {
    // Use local time construction to avoid timezone issues
    const prompts = [
      { created_at: new Date(2025, 0, 15, 10, 0, 0).toISOString() },
      { created_at: new Date(2025, 0, 15, 10, 15, 0).toISOString() },
      { created_at: new Date(2025, 0, 15, 14, 0, 0).toISOString() },
    ];

    const distribution = calculateHourlyDistribution(prompts);

    expect(distribution.length).toBe(24);
    expect(distribution[10]).toBe(2);
    expect(distribution[14]).toBe(1);
    expect(distribution[0]).toBe(0);
    expect(distribution[23]).toBe(0);
  });

  it('should handle empty prompts', () => {
    const distribution = calculateHourlyDistribution([]);

    expect(distribution.length).toBe(24);
    expect(distribution.every(count => count === 0)).toBe(true);
  });

  it('should count prompts in each hour', () => {
    // Use local time construction to avoid timezone issues
    const prompts = [
      { created_at: new Date(2025, 0, 15, 0, 0, 0).toISOString() },
      { created_at: new Date(2025, 0, 15, 0, 30, 0).toISOString() },
      { created_at: new Date(2025, 0, 15, 23, 59, 59).toISOString() },
    ];

    const distribution = calculateHourlyDistribution(prompts);

    expect(distribution[0]).toBe(2);
    expect(distribution[23]).toBe(1);
  });
});
