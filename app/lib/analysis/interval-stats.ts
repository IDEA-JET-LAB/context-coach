/**
 * Interval Statistics Calculator
 * Story 21-5: Interaction Timing Analysis
 *
 * Calculates statistical measures for prompt interval timing:
 * - Average (mean) interval
 * - Median interval
 * - Min/Max intervals
 *
 * These functions work with arrays of intervals for client-side calculation.
 * Database-side aggregations use corresponding SQL functions.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Interval statistics for a user or session
 */
export interface IntervalStats {
  /** Average time between prompts in seconds (null if no data) */
  averageIntervalSeconds: number | null;
  /** Median time between prompts in seconds (null if no data) */
  medianIntervalSeconds: number | null;
  /** Minimum interval in seconds (null if no data) */
  minIntervalSeconds: number | null;
  /** Maximum interval in seconds (null if no data) */
  maxIntervalSeconds: number | null;
  /** Total number of prompts with timing data */
  totalPrompts: number;
}

// ============================================================================
// Statistical Functions
// ============================================================================

/**
 * Calculate the arithmetic mean of an array of numbers.
 *
 * @param values - Array of numeric values
 * @returns The mean, or null if array is empty
 */
export function calculateMean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate the median of an array of numbers.
 *
 * For even-length arrays, returns the average of the two middle values.
 * The input array is not modified.
 *
 * @param values - Array of numeric values
 * @returns The median, or null if array is empty
 */
export function calculateMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  // Create a sorted copy (don't mutate input)
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    // Even length - average of two middle values
    const left = sorted[mid - 1];
    const right = sorted[mid];
    // These are guaranteed to exist since we checked length > 0 and mid >= 1
    return (left! + right!) / 2;
  } else {
    // Odd length - middle value
    return sorted[mid]!;
  }
}

// ============================================================================
// Interval Statistics Calculator
// ============================================================================

/**
 * Calculate interval statistics from an array of interval values.
 *
 * This is used for client-side calculation when interval data is already
 * loaded. For database-side calculation, use the SQL functions.
 *
 * @param intervals - Array of interval values in seconds
 * @returns Complete interval statistics
 */
export function calculateIntervalStatsFromArray(
  intervals: number[]
): IntervalStats {
  if (intervals.length === 0) {
    return {
      averageIntervalSeconds: null,
      medianIntervalSeconds: null,
      minIntervalSeconds: null,
      maxIntervalSeconds: null,
      totalPrompts: 0,
    };
  }

  const average = calculateMean(intervals);
  const median = calculateMedian(intervals);
  const min = Math.min(...intervals);
  const max = Math.max(...intervals);

  return {
    averageIntervalSeconds: average,
    medianIntervalSeconds: median,
    minIntervalSeconds: min,
    maxIntervalSeconds: max,
    totalPrompts: intervals.length,
  };
}
