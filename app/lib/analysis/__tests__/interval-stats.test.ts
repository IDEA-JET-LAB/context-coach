/**
 * Interval Statistics Tests
 * Story 21-5: Interaction Timing Analysis
 *
 * Tests for:
 * - Average interval calculation
 * - Median interval calculation
 * - Statistics from arrays of intervals
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type IntervalStats,
  // Functions
  calculateMean,
  calculateMedian,
  calculateIntervalStatsFromArray,
} from '../interval-stats';

// ============================================================================
// Mean Calculation Tests
// ============================================================================

describe('calculateMean', () => {
  it('should return null for empty array', () => {
    expect(calculateMean([])).toBeNull();
  });

  it('should return the single value for array of one', () => {
    expect(calculateMean([42])).toBe(42);
  });

  it('should calculate mean of two values', () => {
    expect(calculateMean([10, 20])).toBe(15);
  });

  it('should calculate mean of multiple values', () => {
    expect(calculateMean([10, 20, 30, 40])).toBe(25);
  });

  it('should handle decimal results', () => {
    expect(calculateMean([1, 2, 3])).toBe(2);
    expect(calculateMean([1, 2])).toBe(1.5);
  });

  it('should handle large numbers', () => {
    expect(calculateMean([1000000, 2000000, 3000000])).toBe(2000000);
  });

  it('should handle zeros', () => {
    expect(calculateMean([0, 0, 0])).toBe(0);
    expect(calculateMean([0, 10, 20])).toBe(10);
  });
});

// ============================================================================
// Median Calculation Tests
// ============================================================================

describe('calculateMedian', () => {
  it('should return null for empty array', () => {
    expect(calculateMedian([])).toBeNull();
  });

  it('should return the single value for array of one', () => {
    expect(calculateMedian([42])).toBe(42);
  });

  it('should return mean of middle two for even count', () => {
    expect(calculateMedian([10, 20])).toBe(15);
    expect(calculateMedian([10, 20, 30, 40])).toBe(25);
  });

  it('should return middle value for odd count', () => {
    expect(calculateMedian([10, 20, 30])).toBe(20);
    expect(calculateMedian([10, 20, 30, 40, 50])).toBe(30);
  });

  it('should sort values before finding median', () => {
    expect(calculateMedian([30, 10, 20])).toBe(20);
    expect(calculateMedian([50, 30, 10, 40, 20])).toBe(30);
  });

  it('should handle duplicate values', () => {
    expect(calculateMedian([10, 10, 10])).toBe(10);
    expect(calculateMedian([10, 10, 20, 20])).toBe(15);
  });

  it('should handle large numbers', () => {
    expect(calculateMedian([1000000, 2000000, 3000000])).toBe(2000000);
  });
});

// ============================================================================
// Interval Stats from Array Tests
// ============================================================================

describe('calculateIntervalStatsFromArray', () => {
  it('should return zeros for empty array', () => {
    const result = calculateIntervalStatsFromArray([]);
    expect(result.averageIntervalSeconds).toBeNull();
    expect(result.medianIntervalSeconds).toBeNull();
    expect(result.minIntervalSeconds).toBeNull();
    expect(result.maxIntervalSeconds).toBeNull();
    expect(result.totalPrompts).toBe(0);
  });

  it('should calculate stats for single value', () => {
    const result = calculateIntervalStatsFromArray([60]);
    expect(result.averageIntervalSeconds).toBe(60);
    expect(result.medianIntervalSeconds).toBe(60);
    expect(result.minIntervalSeconds).toBe(60);
    expect(result.maxIntervalSeconds).toBe(60);
    expect(result.totalPrompts).toBe(1);
  });

  it('should calculate stats for multiple values', () => {
    const intervals = [30, 60, 90, 120];
    const result = calculateIntervalStatsFromArray(intervals);

    expect(result.averageIntervalSeconds).toBe(75); // (30+60+90+120)/4
    expect(result.medianIntervalSeconds).toBe(75); // (60+90)/2
    expect(result.minIntervalSeconds).toBe(30);
    expect(result.maxIntervalSeconds).toBe(120);
    expect(result.totalPrompts).toBe(4);
  });

  it('should handle unsorted input', () => {
    const intervals = [120, 30, 90, 60];
    const result = calculateIntervalStatsFromArray(intervals);

    expect(result.averageIntervalSeconds).toBe(75);
    expect(result.medianIntervalSeconds).toBe(75);
    expect(result.minIntervalSeconds).toBe(30);
    expect(result.maxIntervalSeconds).toBe(120);
  });

  it('should handle intervals with outliers', () => {
    const intervals = [10, 20, 30, 1000]; // 1000 is an outlier
    const result = calculateIntervalStatsFromArray(intervals);

    expect(result.averageIntervalSeconds).toBe(265); // (10+20+30+1000)/4
    expect(result.medianIntervalSeconds).toBe(25); // (20+30)/2 - not affected by outlier
    expect(result.minIntervalSeconds).toBe(10);
    expect(result.maxIntervalSeconds).toBe(1000);
  });

  it('should return correct types for all fields', () => {
    const result = calculateIntervalStatsFromArray([30, 60, 90]);

    expect(typeof result.averageIntervalSeconds).toBe('number');
    expect(typeof result.medianIntervalSeconds).toBe('number');
    expect(typeof result.minIntervalSeconds).toBe('number');
    expect(typeof result.maxIntervalSeconds).toBe('number');
    expect(typeof result.totalPrompts).toBe('number');
  });

  it('should handle very short intervals (rapid-fire)', () => {
    const intervals = [1, 2, 3, 5, 10]; // All under 30 seconds
    const result = calculateIntervalStatsFromArray(intervals);

    expect(result.averageIntervalSeconds).toBe(4.2); // (1+2+3+5+10)/5
    expect(result.medianIntervalSeconds).toBe(3);
    expect(result.minIntervalSeconds).toBe(1);
    expect(result.maxIntervalSeconds).toBe(10);
  });

  it('should handle long intervals (long pauses)', () => {
    const intervals = [400, 500, 600, 3600]; // All over 5 minutes
    const result = calculateIntervalStatsFromArray(intervals);

    expect(result.averageIntervalSeconds).toBe(1275);
    expect(result.medianIntervalSeconds).toBe(550);
    expect(result.minIntervalSeconds).toBe(400);
    expect(result.maxIntervalSeconds).toBe(3600);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle array with zeros', () => {
    const result = calculateIntervalStatsFromArray([0, 0, 0]);
    expect(result.averageIntervalSeconds).toBe(0);
    expect(result.medianIntervalSeconds).toBe(0);
    expect(result.minIntervalSeconds).toBe(0);
    expect(result.maxIntervalSeconds).toBe(0);
  });

  it('should handle large array efficiently', () => {
    const intervals = Array.from({ length: 10000 }, (_, i) => i + 1);

    const start = performance.now();
    const result = calculateIntervalStatsFromArray(intervals);
    const end = performance.now();

    expect(result.totalPrompts).toBe(10000);
    expect(result.averageIntervalSeconds).toBe(5000.5);
    expect(result.medianIntervalSeconds).toBe(5000.5);
    expect(end - start).toBeLessThan(100); // Should complete quickly
  });

  it('should handle identical values', () => {
    const intervals = [100, 100, 100, 100, 100];
    const result = calculateIntervalStatsFromArray(intervals);

    expect(result.averageIntervalSeconds).toBe(100);
    expect(result.medianIntervalSeconds).toBe(100);
    expect(result.minIntervalSeconds).toBe(100);
    expect(result.maxIntervalSeconds).toBe(100);
  });
});
