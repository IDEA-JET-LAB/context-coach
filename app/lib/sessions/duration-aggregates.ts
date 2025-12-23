/**
 * Session Duration Aggregates - Story 16-6: Session Duration Calculation
 *
 * Functions for aggregating session duration statistics across multiple sessions.
 * Provides statistical analysis including mean, median, and trimmed mean calculations.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  calculateSessionDuration,
  filterStaleSessions,
  MAX_SESSION_MINUTES,
  type SessionTimings,
} from './duration';

/**
 * Date range for filtering sessions
 */
export interface DateRange {
  /** Start date (inclusive) */
  startDate: Date;
  /** End date (inclusive) */
  endDate: Date;
}

/**
 * Statistics about session durations
 */
export interface DurationStats {
  /** Total duration across all sessions (minutes) */
  totalMinutes: number;
  /** Total duration in hours (decimal) */
  totalHours: number;
  /** Average session duration (minutes) */
  averageMinutes: number;
  /** Longest session duration (minutes) */
  longestMinutes: number;
  /** Shortest session duration (minutes) */
  shortestMinutes: number;
  /** Number of sessions included in stats */
  sessionCount: number;
  /** Number of currently active sessions */
  activeCount: number;
  /** Median session duration (minutes) */
  medianMinutes: number;
  /** Trimmed mean (excluding outliers) */
  trimmedMeanMinutes: number;
}

/**
 * Get duration statistics for a user's sessions
 *
 * Queries the database for the user's sessions and calculates comprehensive
 * duration statistics. Excludes stale sessions (> 24 hours) by default.
 *
 * @param userId - User ID to get stats for
 * @param dateRange - Optional date range to filter sessions
 * @returns Duration statistics
 *
 * @example
 * const stats = await getSessionDurationStats('user-123');
 * // Returns: {
 * //   totalMinutes: 1200,
 * //   totalHours: 20,
 * //   averageMinutes: 60,
 * //   longestMinutes: 120,
 * //   shortestMinutes: 15,
 * //   sessionCount: 20,
 * //   activeCount: 1,
 * //   medianMinutes: 55,
 * //   trimmedMeanMinutes: 58
 * // }
 */
export async function getSessionDurationStats(
  userId: string,
  dateRange?: DateRange
): Promise<DurationStats> {
  const supabase = createAdminClient();

  let query = supabase
    .from('sessions')
    .select('started_at, ended_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  // Apply date range filter if provided
  if (dateRange) {
    query = query
      .gte('started_at', dateRange.startDate.toISOString())
      .lte('started_at', dateRange.endDate.toISOString());
  }

  const { data: sessions, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return calculateDurationStats(sessions || []);
}

/**
 * Get duration statistics for a team's sessions
 *
 * @param teamId - Team ID to get stats for
 * @param dateRange - Optional date range to filter sessions
 * @returns Duration statistics
 */
export async function getTeamSessionDurationStats(
  teamId: string,
  dateRange?: DateRange
): Promise<DurationStats> {
  const supabase = createAdminClient();

  let query = supabase
    .from('sessions')
    .select('started_at, ended_at')
    .eq('team_id', teamId)
    .order('started_at', { ascending: false });

  if (dateRange) {
    query = query
      .gte('started_at', dateRange.startDate.toISOString())
      .lte('started_at', dateRange.endDate.toISOString());
  }

  const { data: sessions, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch team sessions: ${error.message}`);
  }

  return calculateDurationStats(sessions || []);
}

/**
 * Calculate duration statistics from a list of sessions
 *
 * This is a pure function that can be used for testing or when
 * sessions are already loaded.
 *
 * @param sessions - List of sessions with timing information
 * @param asOf - Reference time for calculating ongoing session durations
 * @returns Duration statistics
 */
export function calculateDurationStats(
  sessions: SessionTimings[],
  asOf?: Date
): DurationStats {
  // Filter out stale sessions
  const validSessions = filterStaleSessions(sessions, asOf);

  if (validSessions.length === 0) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      averageMinutes: 0,
      longestMinutes: 0,
      shortestMinutes: 0,
      sessionCount: 0,
      activeCount: 0,
      medianMinutes: 0,
      trimmedMeanMinutes: 0,
    };
  }

  // Calculate durations for each session
  const durations = validSessions.map(session => {
    const result = calculateSessionDuration(session, asOf);
    return {
      minutes: result.minutes,
      isOngoing: result.isOngoing,
    };
  });

  const minutesList = durations.map(d => d.minutes);
  const activeCount = durations.filter(d => d.isOngoing).length;

  // Calculate statistics
  const totalMinutes = minutesList.reduce((sum, m) => sum + m, 0);
  const averageMinutes = Math.round(totalMinutes / minutesList.length);
  const longestMinutes = Math.max(...minutesList);
  const shortestMinutes = Math.min(...minutesList);
  const medianMinutes = calculateMedian(minutesList);
  const trimmedMeanMinutes = calculateTrimmedMean(minutesList);

  return {
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    averageMinutes,
    longestMinutes,
    shortestMinutes,
    sessionCount: validSessions.length,
    activeCount,
    medianMinutes,
    trimmedMeanMinutes,
  };
}

/**
 * Calculate the median of a list of numbers
 *
 * @param values - List of numbers
 * @returns Median value
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }

  return sorted[mid]!;
}

/**
 * Calculate a trimmed mean, excluding outliers
 *
 * A trimmed mean removes the top and bottom percentages of values
 * before calculating the average. This provides a more robust
 * measure of central tendency that isn't skewed by extreme values.
 *
 * @param durations - List of duration values in minutes
 * @param trimPercent - Percentage to trim from each end (default: 10%)
 * @returns Trimmed mean value
 *
 * @example
 * // With outliers
 * calculateTrimmedMean([5, 30, 35, 40, 45, 50, 500]);
 * // Returns: ~40 (excludes 5 and 500)
 *
 * // Without trim
 * calculateTrimmedMean([30, 35, 40, 45, 50], 0);
 * // Returns: 40 (regular mean)
 */
export function calculateTrimmedMean(
  durations: number[],
  trimPercent: number = 10
): number {
  if (durations.length === 0) return 0;

  // Need at least 3 values to trim meaningfully
  if (durations.length < 3) {
    const sum = durations.reduce((a, b) => a + b, 0);
    return Math.round(sum / durations.length);
  }

  // Sort the durations
  const sorted = [...durations].sort((a, b) => a - b);

  // Calculate how many to trim from each end
  const trimCount = Math.floor((sorted.length * trimPercent) / 100);

  // Ensure we don't trim everything
  const effectiveTrimCount = Math.min(
    trimCount,
    Math.floor((sorted.length - 1) / 2)
  );

  // Get the middle portion
  const trimmed = sorted.slice(
    effectiveTrimCount,
    sorted.length - effectiveTrimCount
  );

  if (trimmed.length === 0) {
    // Fallback if trimming leaves nothing
    const sum = sorted.reduce((a, b) => a + b, 0);
    return Math.round(sum / sorted.length);
  }

  const sum = trimmed.reduce((a, b) => a + b, 0);
  return Math.round(sum / trimmed.length);
}

/**
 * Calculate percentile value from a list of durations
 *
 * @param durations - List of duration values
 * @param percentile - Percentile to calculate (0-100)
 * @returns Duration at the specified percentile
 */
export function calculatePercentile(
  durations: number[],
  percentile: number
): number {
  if (durations.length === 0) return 0;

  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  const clampedIndex = Math.max(0, Math.min(index, sorted.length - 1));

  return sorted[clampedIndex]!;
}

/**
 * Get duration distribution buckets
 *
 * Groups sessions into duration buckets for histogram display.
 *
 * @param sessions - List of sessions
 * @param bucketMinutes - Size of each bucket in minutes (default: 30)
 * @returns Array of bucket counts
 */
export function getDurationDistribution(
  sessions: SessionTimings[],
  bucketMinutes: number = 30
): { bucket: string; count: number; label: string }[] {
  const validSessions = filterStaleSessions(sessions);
  const durations = validSessions.map(s => calculateSessionDuration(s).minutes);

  // Define buckets up to MAX_SESSION_MINUTES
  const maxBuckets = Math.ceil(MAX_SESSION_MINUTES / bucketMinutes);
  const buckets: { bucket: string; count: number; label: string }[] = [];

  for (let i = 0; i < maxBuckets; i++) {
    const start = i * bucketMinutes;
    const end = (i + 1) * bucketMinutes;

    // Create human-readable label
    let label: string;
    if (start === 0) {
      label = `< ${end}m`;
    } else if (end >= MAX_SESSION_MINUTES) {
      label = `${Math.floor(start / 60)}h+`;
    } else if (start >= 60 && end >= 60) {
      const startHours = Math.floor(start / 60);
      const startMinutes = start % 60;
      const endHours = Math.floor(end / 60);
      const endMinutes = end % 60;

      const startStr = startMinutes === 0 ? `${startHours}h` : `${startHours}h ${startMinutes}m`;
      const endStr = endMinutes === 0 ? `${endHours}h` : `${endHours}h ${endMinutes}m`;
      label = `${startStr} - ${endStr}`;
    } else {
      label = `${start}m - ${end}m`;
    }

    const count = durations.filter(d => d >= start && d < end).length;

    buckets.push({
      bucket: `${start}-${end}`,
      count,
      label,
    });
  }

  return buckets;
}
