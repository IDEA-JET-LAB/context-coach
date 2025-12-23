/**
 * Productivity Patterns Analyzer
 * Story 21-5: Interaction Timing Analysis
 *
 * Analyzes prompts for time-of-day patterns:
 * - Morning (6am-12pm)
 * - Afternoon (12pm-6pm)
 * - Evening (6pm-12am)
 * - Night (12am-6am)
 *
 * Also identifies peak productivity hours.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Time of day bucket categories
 */
export type TimeOfDayBucket = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Complete time-of-day distribution analysis
 */
export interface TimeOfDayDistribution {
  /** Count of prompts in morning (6am-12pm) */
  morning: number;
  /** Count of prompts in afternoon (12pm-6pm) */
  afternoon: number;
  /** Count of prompts in evening (6pm-12am) */
  evening: number;
  /** Count of prompts at night (12am-6am) */
  night: number;
  /** Hour with most prompts (0-23) */
  peakHour: number;
  /** Percentage of prompts in morning */
  morningPct: number;
  /** Percentage of prompts in afternoon */
  afternoonPct: number;
  /** Percentage of prompts in evening */
  eveningPct: number;
  /** Percentage of prompts at night */
  nightPct: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Hour ranges for each time-of-day bucket.
 * Format: [startHour, endHour) - start inclusive, end exclusive
 */
export const TIME_BUCKETS: Record<TimeOfDayBucket, [number, number]> = {
  morning: [6, 12],   // 6:00 - 11:59
  afternoon: [12, 18], // 12:00 - 17:59
  evening: [18, 24],   // 18:00 - 23:59
  night: [0, 6],       // 00:00 - 05:59
} as const;

// ============================================================================
// Classification Functions
// ============================================================================

/**
 * Classify an hour (0-23) into a time-of-day bucket.
 *
 * @param hour - Hour of the day (0-23)
 * @returns The time-of-day bucket
 */
export function getTimeOfDayBucket(hour: number): TimeOfDayBucket {
  // Handle edge cases (negative or > 23)
  const normalizedHour = ((hour % 24) + 24) % 24;

  if (normalizedHour >= 6 && normalizedHour < 12) {
    return 'morning';
  }
  if (normalizedHour >= 12 && normalizedHour < 18) {
    return 'afternoon';
  }
  if (normalizedHour >= 18 && normalizedHour < 24) {
    return 'evening';
  }
  return 'night';
}

// ============================================================================
// Peak Hour Detection
// ============================================================================

/**
 * Find the hour with the most prompt activity.
 *
 * @param timestamps - Array of prompt timestamps
 * @returns Peak hour (0-23), or 12 as default if no data
 */
export function findPeakHour(timestamps: Date[]): number {
  if (timestamps.length === 0) {
    return 12; // Default to noon if no data
  }

  // Count occurrences per hour (using object instead of Map for compatibility)
  const hourCounts: Record<number, number> = {};

  for (const timestamp of timestamps) {
    const hour = timestamp.getUTCHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  // Find hour with maximum count
  let peakHour = 12;
  let maxCount = 0;

  for (const hourStr of Object.keys(hourCounts)) {
    const hour = parseInt(hourStr, 10);
    const count = hourCounts[hour]!;
    if (count > maxCount) {
      maxCount = count;
      peakHour = hour;
    }
  }

  return peakHour;
}

// ============================================================================
// Distribution Calculator
// ============================================================================

/**
 * Calculate the time-of-day distribution from an array of timestamps.
 *
 * This function provides client-side calculation. For database-side
 * calculation, use the corresponding SQL function.
 *
 * @param timestamps - Array of prompt timestamps
 * @returns Complete time-of-day distribution
 */
export function calculateTimeOfDayDistribution(
  timestamps: Date[]
): TimeOfDayDistribution {
  const counts = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };

  // Count prompts by time-of-day bucket
  for (const timestamp of timestamps) {
    const hour = timestamp.getUTCHours();
    const bucket = getTimeOfDayBucket(hour);
    counts[bucket]++;
  }

  const total = timestamps.length;
  const peakHour = findPeakHour(timestamps);

  // Calculate percentages
  const calculatePct = (count: number): number => {
    if (total === 0) return 0;
    return Math.round((count / total) * 10000) / 100; // Round to 2 decimal places
  };

  return {
    morning: counts.morning,
    afternoon: counts.afternoon,
    evening: counts.evening,
    night: counts.night,
    peakHour,
    morningPct: calculatePct(counts.morning),
    afternoonPct: calculatePct(counts.afternoon),
    eveningPct: calculatePct(counts.evening),
    nightPct: calculatePct(counts.night),
  };
}
