import { describe, it, expect } from 'vitest';
import {
  calculateDurationStats,
  calculateMedian,
  calculateTrimmedMean,
  calculatePercentile,
  getDurationDistribution,
} from '../duration-aggregates';

describe('calculateDurationStats', () => {
  it('should calculate stats for a list of sessions', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' }, // 60 min
      { started_at: '2025-01-15T12:00:00Z', ended_at: '2025-01-15T13:30:00Z' }, // 90 min
      { started_at: '2025-01-15T14:00:00Z', ended_at: '2025-01-15T14:30:00Z' }, // 30 min
    ];

    const stats = calculateDurationStats(sessions);

    expect(stats.totalMinutes).toBe(180);
    expect(stats.totalHours).toBe(3);
    expect(stats.averageMinutes).toBe(60);
    expect(stats.longestMinutes).toBe(90);
    expect(stats.shortestMinutes).toBe(30);
    expect(stats.sessionCount).toBe(3);
    expect(stats.activeCount).toBe(0);
    expect(stats.medianMinutes).toBe(60);
  });

  it('should count active sessions', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' }, // completed
      { started_at: '2025-01-15T12:00:00Z', ended_at: null }, // active
      { started_at: '2025-01-15T14:00:00Z', ended_at: null }, // active
    ];

    const now = new Date('2025-01-15T14:30:00Z');
    const stats = calculateDurationStats(sessions, now);

    expect(stats.activeCount).toBe(2);
    expect(stats.sessionCount).toBe(3);
  });

  it('should exclude stale sessions', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' }, // 60 min
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-17T10:00:00Z' }, // 48 hours - stale
    ];

    const stats = calculateDurationStats(sessions);

    expect(stats.sessionCount).toBe(1);
    expect(stats.totalMinutes).toBe(60);
  });

  it('should return zero stats for empty array', () => {
    const stats = calculateDurationStats([]);

    expect(stats.totalMinutes).toBe(0);
    expect(stats.sessionCount).toBe(0);
    expect(stats.averageMinutes).toBe(0);
    expect(stats.longestMinutes).toBe(0);
    expect(stats.shortestMinutes).toBe(0);
    expect(stats.medianMinutes).toBe(0);
    expect(stats.trimmedMeanMinutes).toBe(0);
  });
});

describe('calculateMedian', () => {
  it('should calculate median for odd number of values', () => {
    expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
    expect(calculateMedian([10, 20, 30])).toBe(20);
    expect(calculateMedian([100])).toBe(100);
  });

  it('should calculate median for even number of values', () => {
    expect(calculateMedian([1, 2, 3, 4])).toBe(3); // (2 + 3) / 2 = 2.5, rounded to 3
    expect(calculateMedian([10, 20, 30, 40])).toBe(25);
  });

  it('should sort before calculating', () => {
    expect(calculateMedian([5, 1, 3, 2, 4])).toBe(3);
    expect(calculateMedian([100, 1, 50])).toBe(50);
  });

  it('should return 0 for empty array', () => {
    expect(calculateMedian([])).toBe(0);
  });
});

describe('calculateTrimmedMean', () => {
  it('should exclude outliers', () => {
    // With 10% trim on 10 values, should exclude 1 from each end
    const values = [5, 10, 20, 25, 30, 35, 40, 45, 50, 500];
    const result = calculateTrimmedMean(values, 10);

    // Should exclude 5 and 500, mean of [10,20,25,30,35,40,45,50] = 255/8 = 31.875 ≈ 32
    expect(result).toBeGreaterThan(25);
    expect(result).toBeLessThan(35);
  });

  it('should return regular mean when trimPercent is 0', () => {
    const values = [10, 20, 30, 40, 50];
    const result = calculateTrimmedMean(values, 0);

    expect(result).toBe(30); // (10+20+30+40+50)/5 = 30
  });

  it('should handle small arrays', () => {
    expect(calculateTrimmedMean([10, 20])).toBe(15);
    expect(calculateTrimmedMean([10])).toBe(10);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTrimmedMean([])).toBe(0);
  });
});

describe('calculatePercentile', () => {
  it('should calculate 50th percentile (median)', () => {
    const values = [10, 20, 30, 40, 50];
    expect(calculatePercentile(values, 50)).toBe(30);
  });

  it('should calculate 90th percentile', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(values, 90)).toBe(90);
  });

  it('should calculate 10th percentile', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(values, 10)).toBe(10);
  });

  it('should return 0 for empty array', () => {
    expect(calculatePercentile([], 50)).toBe(0);
  });

  it('should sort values before calculating', () => {
    const values = [50, 10, 40, 20, 30];
    expect(calculatePercentile(values, 50)).toBe(30);
  });
});

describe('getDurationDistribution', () => {
  it('should create distribution buckets', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T10:15:00Z' }, // 15 min
      { started_at: '2025-01-15T11:00:00Z', ended_at: '2025-01-15T11:20:00Z' }, // 20 min
      { started_at: '2025-01-15T12:00:00Z', ended_at: '2025-01-15T13:00:00Z' }, // 60 min
    ];

    const distribution = getDurationDistribution(sessions, 30);

    // First bucket (0-30) should have 2 sessions
    expect(distribution[0]?.count).toBe(2);
    expect(distribution[0]?.label).toBe('< 30m');

    // Third bucket (60-90) should have 1 session
    expect(distribution[2]?.count).toBe(1);
  });

  it('should use custom bucket size', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' }, // 60 min
    ];

    const distribution = getDurationDistribution(sessions, 60);

    // Second bucket (60-120) should have 1 session
    expect(distribution[1]?.count).toBe(1);
  });

  it('should handle empty sessions', () => {
    const distribution = getDurationDistribution([], 30);

    // Should have buckets but all with 0 count
    expect(distribution.length).toBeGreaterThan(0);
    expect(distribution.every(b => b.count === 0)).toBe(true);
  });

  it('should exclude stale sessions', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' }, // 60 min
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-17T10:00:00Z' }, // 48 hours - stale
    ];

    const distribution = getDurationDistribution(sessions, 30);

    // Total count should be 1 (stale session excluded)
    const totalCount = distribution.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(1);
  });
});
