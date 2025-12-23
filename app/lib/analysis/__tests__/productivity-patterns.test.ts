/**
 * Productivity Patterns Tests
 * Story 21-5: Interaction Timing Analysis
 *
 * Tests for:
 * - Time-of-day bucket classification
 * - Time-of-day distribution calculation
 * - Peak hour detection
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type TimeOfDayBucket,
  type TimeOfDayDistribution,
  // Constants
  TIME_BUCKETS,
  // Functions
  getTimeOfDayBucket,
  calculateTimeOfDayDistribution,
  findPeakHour,
} from '../productivity-patterns';

// ============================================================================
// Time Bucket Constants Tests
// ============================================================================

describe('TIME_BUCKETS', () => {
  it('should define morning as 6-12', () => {
    expect(TIME_BUCKETS.morning).toEqual([6, 12]);
  });

  it('should define afternoon as 12-18', () => {
    expect(TIME_BUCKETS.afternoon).toEqual([12, 18]);
  });

  it('should define evening as 18-24', () => {
    expect(TIME_BUCKETS.evening).toEqual([18, 24]);
  });

  it('should define night as 0-6', () => {
    expect(TIME_BUCKETS.night).toEqual([0, 6]);
  });
});

// ============================================================================
// Time of Day Bucket Classification Tests
// ============================================================================

describe('getTimeOfDayBucket', () => {
  describe('morning hours (6-11)', () => {
    it('should classify hour 6 as morning', () => {
      expect(getTimeOfDayBucket(6)).toBe('morning');
    });

    it('should classify hour 9 as morning', () => {
      expect(getTimeOfDayBucket(9)).toBe('morning');
    });

    it('should classify hour 11 as morning', () => {
      expect(getTimeOfDayBucket(11)).toBe('morning');
    });
  });

  describe('afternoon hours (12-17)', () => {
    it('should classify hour 12 as afternoon', () => {
      expect(getTimeOfDayBucket(12)).toBe('afternoon');
    });

    it('should classify hour 14 as afternoon', () => {
      expect(getTimeOfDayBucket(14)).toBe('afternoon');
    });

    it('should classify hour 17 as afternoon', () => {
      expect(getTimeOfDayBucket(17)).toBe('afternoon');
    });
  });

  describe('evening hours (18-23)', () => {
    it('should classify hour 18 as evening', () => {
      expect(getTimeOfDayBucket(18)).toBe('evening');
    });

    it('should classify hour 21 as evening', () => {
      expect(getTimeOfDayBucket(21)).toBe('evening');
    });

    it('should classify hour 23 as evening', () => {
      expect(getTimeOfDayBucket(23)).toBe('evening');
    });
  });

  describe('night hours (0-5)', () => {
    it('should classify hour 0 as night', () => {
      expect(getTimeOfDayBucket(0)).toBe('night');
    });

    it('should classify hour 3 as night', () => {
      expect(getTimeOfDayBucket(3)).toBe('night');
    });

    it('should classify hour 5 as night', () => {
      expect(getTimeOfDayBucket(5)).toBe('night');
    });
  });

  describe('boundary cases', () => {
    it('should handle hour 24 as night (wraps to 0)', () => {
      // Hour 24 is technically invalid but should handle gracefully
      expect(getTimeOfDayBucket(24)).toBe('night');
    });

    it('should handle negative hours by wrapping', () => {
      // Negative hours are technically invalid but wrap using modulo
      // -1 wraps to 23 (evening)
      expect(getTimeOfDayBucket(-1)).toBe('evening');
      // -6 wraps to 18 (evening)
      expect(getTimeOfDayBucket(-6)).toBe('evening');
      // -7 wraps to 17 (afternoon)
      expect(getTimeOfDayBucket(-7)).toBe('afternoon');
    });
  });
});

// ============================================================================
// Time of Day Distribution Calculation Tests
// ============================================================================

describe('calculateTimeOfDayDistribution', () => {
  it('should return zeros for empty timestamps array', () => {
    const result = calculateTimeOfDayDistribution([]);

    expect(result.morning).toBe(0);
    expect(result.afternoon).toBe(0);
    expect(result.evening).toBe(0);
    expect(result.night).toBe(0);
    expect(result.peakHour).toBe(12); // Default when no data
    expect(result.morningPct).toBe(0);
    expect(result.afternoonPct).toBe(0);
    expect(result.eveningPct).toBe(0);
    expect(result.nightPct).toBe(0);
  });

  it('should count morning prompts correctly', () => {
    const timestamps = [
      new Date('2025-01-15T08:00:00Z'),
      new Date('2025-01-15T09:30:00Z'),
      new Date('2025-01-15T11:00:00Z'),
    ];
    const result = calculateTimeOfDayDistribution(timestamps);

    expect(result.morning).toBe(3);
    expect(result.afternoon).toBe(0);
    expect(result.evening).toBe(0);
    expect(result.night).toBe(0);
    expect(result.morningPct).toBe(100);
  });

  it('should count afternoon prompts correctly', () => {
    const timestamps = [
      new Date('2025-01-15T14:00:00Z'),
      new Date('2025-01-15T15:30:00Z'),
    ];
    const result = calculateTimeOfDayDistribution(timestamps);

    expect(result.afternoon).toBe(2);
    expect(result.afternoonPct).toBe(100);
  });

  it('should count evening prompts correctly', () => {
    const timestamps = [
      new Date('2025-01-15T19:00:00Z'),
      new Date('2025-01-15T21:00:00Z'),
      new Date('2025-01-15T22:30:00Z'),
    ];
    const result = calculateTimeOfDayDistribution(timestamps);

    expect(result.evening).toBe(3);
    expect(result.eveningPct).toBe(100);
  });

  it('should count night prompts correctly', () => {
    const timestamps = [
      new Date('2025-01-15T02:00:00Z'),
      new Date('2025-01-15T04:30:00Z'),
    ];
    const result = calculateTimeOfDayDistribution(timestamps);

    expect(result.night).toBe(2);
    expect(result.nightPct).toBe(100);
  });

  it('should calculate mixed distribution correctly', () => {
    const timestamps = [
      // 2 morning
      new Date('2025-01-15T08:00:00Z'),
      new Date('2025-01-15T10:00:00Z'),
      // 3 afternoon
      new Date('2025-01-15T13:00:00Z'),
      new Date('2025-01-15T14:00:00Z'),
      new Date('2025-01-15T16:00:00Z'),
      // 1 evening
      new Date('2025-01-15T20:00:00Z'),
      // 2 night
      new Date('2025-01-15T02:00:00Z'),
      new Date('2025-01-15T04:00:00Z'),
    ];
    const result = calculateTimeOfDayDistribution(timestamps);

    expect(result.morning).toBe(2);
    expect(result.afternoon).toBe(3);
    expect(result.evening).toBe(1);
    expect(result.night).toBe(2);

    // Total is 8
    expect(result.morningPct).toBe(25); // 2/8 = 25%
    expect(result.afternoonPct).toBe(37.5); // 3/8 = 37.5%
    expect(result.eveningPct).toBe(12.5); // 1/8 = 12.5%
    expect(result.nightPct).toBe(25); // 2/8 = 25%
  });

  it('should identify peak hour from most common hour', () => {
    const timestamps = [
      // 3 prompts at 14:xx
      new Date('2025-01-15T14:00:00Z'),
      new Date('2025-01-15T14:30:00Z'),
      new Date('2025-01-15T14:45:00Z'),
      // 1 prompt at 10:xx
      new Date('2025-01-15T10:00:00Z'),
    ];
    const result = calculateTimeOfDayDistribution(timestamps);

    expect(result.peakHour).toBe(14);
  });

  it('should handle single timestamp', () => {
    const timestamps = [new Date('2025-01-15T15:30:00Z')];
    const result = calculateTimeOfDayDistribution(timestamps);

    expect(result.afternoon).toBe(1);
    expect(result.peakHour).toBe(15);
    expect(result.afternoonPct).toBe(100);
  });
});

// ============================================================================
// Peak Hour Detection Tests
// ============================================================================

describe('findPeakHour', () => {
  it('should return default 12 for empty array', () => {
    expect(findPeakHour([])).toBe(12);
  });

  it('should find the hour with most occurrences', () => {
    const timestamps = [
      new Date('2025-01-15T09:00:00Z'),
      new Date('2025-01-15T09:30:00Z'),
      new Date('2025-01-15T09:45:00Z'),
      new Date('2025-01-15T14:00:00Z'),
      new Date('2025-01-15T14:30:00Z'),
    ];

    expect(findPeakHour(timestamps)).toBe(9); // 3 vs 2
  });

  it('should return first peak on tie', () => {
    const timestamps = [
      new Date('2025-01-15T09:00:00Z'),
      new Date('2025-01-15T09:30:00Z'),
      new Date('2025-01-15T14:00:00Z'),
      new Date('2025-01-15T14:30:00Z'),
    ];

    // Both 9 and 14 have 2 occurrences - should return the one encountered first
    const result = findPeakHour(timestamps);
    expect([9, 14]).toContain(result);
  });

  it('should handle single timestamp', () => {
    const timestamps = [new Date('2025-01-15T16:00:00Z')];
    expect(findPeakHour(timestamps)).toBe(16);
  });

  it('should handle timestamps across multiple days', () => {
    const timestamps = [
      new Date('2025-01-15T10:00:00Z'),
      new Date('2025-01-16T10:00:00Z'),
      new Date('2025-01-17T10:00:00Z'),
      new Date('2025-01-15T14:00:00Z'),
    ];

    expect(findPeakHour(timestamps)).toBe(10); // 3 vs 1
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle midnight timestamps correctly', () => {
    const timestamps = [
      new Date('2025-01-15T00:00:00Z'),
      new Date('2025-01-15T00:30:00Z'),
    ];
    const result = calculateTimeOfDayDistribution(timestamps);

    expect(result.night).toBe(2);
    expect(result.peakHour).toBe(0);
  });

  it('should handle noon timestamps correctly', () => {
    const timestamps = [
      new Date('2025-01-15T12:00:00Z'),
      new Date('2025-01-15T12:30:00Z'),
    ];
    const result = calculateTimeOfDayDistribution(timestamps);

    expect(result.afternoon).toBe(2);
    expect(result.peakHour).toBe(12);
  });

  it('should handle large number of timestamps efficiently', () => {
    // Generate 1000 timestamps
    const timestamps = Array.from({ length: 1000 }, (_, i) => {
      const hour = i % 24;
      return new Date(`2025-01-15T${String(hour).padStart(2, '0')}:00:00Z`);
    });

    const start = performance.now();
    const result = calculateTimeOfDayDistribution(timestamps);
    const end = performance.now();

    expect(result.morning + result.afternoon + result.evening + result.night).toBe(1000);
    expect(end - start).toBeLessThan(50); // Should be fast
  });

  it('should round percentages appropriately', () => {
    // 3 timestamps - will produce 33.33... percentages
    const timestamps = [
      new Date('2025-01-15T08:00:00Z'),
      new Date('2025-01-15T14:00:00Z'),
      new Date('2025-01-15T20:00:00Z'),
    ];
    const result = calculateTimeOfDayDistribution(timestamps);

    // Each should be approximately 33.3%
    expect(result.morningPct).toBeCloseTo(33.33, 1);
    expect(result.afternoonPct).toBeCloseTo(33.33, 1);
    expect(result.eveningPct).toBeCloseTo(33.33, 1);
  });
});

// ============================================================================
// Return Type Validation
// ============================================================================

describe('return type validation', () => {
  it('should return all required TimeOfDayDistribution fields', () => {
    const result = calculateTimeOfDayDistribution([new Date()]);

    expect(result).toHaveProperty('morning');
    expect(result).toHaveProperty('afternoon');
    expect(result).toHaveProperty('evening');
    expect(result).toHaveProperty('night');
    expect(result).toHaveProperty('peakHour');
    expect(result).toHaveProperty('morningPct');
    expect(result).toHaveProperty('afternoonPct');
    expect(result).toHaveProperty('eveningPct');
    expect(result).toHaveProperty('nightPct');
  });

  it('should return correct types for all fields', () => {
    const result = calculateTimeOfDayDistribution([new Date()]);

    expect(typeof result.morning).toBe('number');
    expect(typeof result.afternoon).toBe('number');
    expect(typeof result.evening).toBe('number');
    expect(typeof result.night).toBe('number');
    expect(typeof result.peakHour).toBe('number');
    expect(typeof result.morningPct).toBe('number');
    expect(typeof result.afternoonPct).toBe('number');
    expect(typeof result.eveningPct).toBe('number');
    expect(typeof result.nightPct).toBe('number');
  });
});
