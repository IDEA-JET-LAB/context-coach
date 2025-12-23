/**
 * Session Duration Calculation - Story 16-6: Session Duration Calculation
 *
 * Core functions for calculating and formatting session durations.
 * Handles active sessions, stale session filtering, and inter-prompt timing.
 */

import type { Session } from '@/lib/types/session';

/**
 * Session timing information for duration calculations
 */
export interface SessionTimings {
  started_at: string | Date;
  ended_at: string | Date | null;
}

/**
 * Result of a duration calculation
 */
export interface DurationResult {
  /** Duration in minutes */
  minutes: number;
  /** Duration in hours (decimal) */
  hours: number;
  /** Human-readable formatted string (e.g., "1h 30m") */
  formatted: string;
  /** Whether the session is still active (no ended_at) */
  isOngoing: boolean;
}

/**
 * Maximum session duration in hours before considering it stale
 * Sessions longer than this are likely abandoned without proper end tracking
 */
export const MAX_SESSION_HOURS = 24;

/**
 * Maximum session duration in minutes
 */
export const MAX_SESSION_MINUTES = MAX_SESSION_HOURS * 60;

/**
 * Calculate session duration
 *
 * For active sessions (no ended_at), calculates duration up to the provided
 * reference time (defaults to now). Sessions exceeding MAX_SESSION_HOURS
 * are capped to prevent skewed analytics from stale sessions.
 *
 * @param session - Session with timing information
 * @param asOf - Reference time for calculating ongoing session duration (defaults to now)
 * @returns Duration result with minutes, hours, formatted string, and ongoing status
 *
 * @example
 * // Completed session
 * calculateSessionDuration({
 *   started_at: '2025-01-15T10:00:00Z',
 *   ended_at: '2025-01-15T11:30:00Z'
 * });
 * // Returns: { minutes: 90, hours: 1.5, formatted: "1h 30m", isOngoing: false }
 *
 * @example
 * // Active session
 * calculateSessionDuration({
 *   started_at: '2025-01-15T10:00:00Z',
 *   ended_at: null
 * }, new Date('2025-01-15T10:45:00Z'));
 * // Returns: { minutes: 45, hours: 0.75, formatted: "45m", isOngoing: true }
 */
export function calculateSessionDuration(
  session: SessionTimings,
  asOf?: Date
): DurationResult {
  const startedAt = typeof session.started_at === 'string'
    ? new Date(session.started_at)
    : session.started_at;

  const isOngoing = session.ended_at === null;

  let endedAt: Date;
  if (isOngoing) {
    endedAt = asOf ?? new Date();
  } else {
    // At this point, session.ended_at is guaranteed to not be null
    const endTime = session.ended_at!;
    endedAt = typeof endTime === 'string'
      ? new Date(endTime)
      : endTime;
  }

  // Calculate raw duration in minutes
  const durationMs = endedAt.getTime() - startedAt.getTime();
  let minutes = Math.max(0, Math.floor(durationMs / (1000 * 60)));

  // Cap at maximum to exclude stale sessions
  if (minutes > MAX_SESSION_MINUTES) {
    minutes = MAX_SESSION_MINUTES;
  }

  const hours = Number((minutes / 60).toFixed(2));

  return {
    minutes,
    hours,
    formatted: formatDuration(minutes),
    isOngoing,
  };
}

/**
 * Format minutes to a human-readable duration string
 *
 * Formatting rules:
 * - Less than 1 minute: "< 1 min"
 * - Less than 60 minutes: "Xm" (e.g., "45m")
 * - 60 or more minutes: "Xh Ym" (e.g., "1h 30m" or "2h" if no minutes)
 *
 * @param minutes - Duration in minutes
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(0);    // "< 1 min"
 * formatDuration(5);    // "5m"
 * formatDuration(45);   // "45m"
 * formatDuration(60);   // "1h"
 * formatDuration(90);   // "1h 30m"
 * formatDuration(125);  // "2h 5m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return '< 1 min';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format minutes to a longer human-readable duration string
 *
 * Uses full words instead of abbreviations for better readability.
 *
 * @param minutes - Duration in minutes
 * @returns Formatted duration string with full words
 *
 * @example
 * formatDurationLong(0);    // "less than 1 minute"
 * formatDurationLong(1);    // "1 minute"
 * formatDurationLong(45);   // "45 minutes"
 * formatDurationLong(60);   // "1 hour"
 * formatDurationLong(90);   // "1 hour 30 minutes"
 * formatDurationLong(120);  // "2 hours"
 */
export function formatDurationLong(minutes: number): string {
  if (minutes < 1) {
    return 'less than 1 minute';
  }

  if (minutes === 1) {
    return '1 minute';
  }

  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hourWord = hours === 1 ? 'hour' : 'hours';
  const minuteWord = remainingMinutes === 1 ? 'minute' : 'minutes';

  if (remainingMinutes === 0) {
    return `${hours} ${hourWord}`;
  }

  return `${hours} ${hourWord} ${remainingMinutes} ${minuteWord}`;
}

/**
 * Calculate the time between two prompts in minutes
 *
 * Useful for analyzing prompt density and identifying gaps in sessions.
 *
 * @param prompt1Timestamp - ISO timestamp of the first prompt
 * @param prompt2Timestamp - ISO timestamp of the second prompt
 * @returns Duration in minutes between the two prompts (always positive)
 *
 * @example
 * calculateInterPromptDuration(
 *   '2025-01-15T10:00:00Z',
 *   '2025-01-15T10:15:00Z'
 * );
 * // Returns: 15
 */
export function calculateInterPromptDuration(
  prompt1Timestamp: string | Date,
  prompt2Timestamp: string | Date
): number {
  const date1 = typeof prompt1Timestamp === 'string'
    ? new Date(prompt1Timestamp)
    : prompt1Timestamp;

  const date2 = typeof prompt2Timestamp === 'string'
    ? new Date(prompt2Timestamp)
    : prompt2Timestamp;

  const durationMs = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(durationMs / (1000 * 60));
}

/**
 * Check if a session duration should be excluded from analytics
 *
 * Sessions exceeding 24 hours are considered stale and should be
 * excluded from duration-based analytics to prevent skewed results.
 *
 * @param session - Session to check
 * @param asOf - Reference time for checking (defaults to now)
 * @returns True if the session should be excluded
 */
export function isSessionStale(session: SessionTimings, asOf?: Date): boolean {
  const { minutes } = calculateSessionDuration(session, asOf);
  return minutes >= MAX_SESSION_MINUTES;
}

/**
 * Filter out stale sessions from a list
 *
 * @param sessions - List of sessions to filter
 * @param asOf - Reference time for checking (defaults to now)
 * @returns Sessions that are not stale
 */
export function filterStaleSessions<T extends SessionTimings>(
  sessions: T[],
  asOf?: Date
): T[] {
  return sessions.filter(session => !isSessionStale(session, asOf));
}

/**
 * Get total duration for multiple sessions
 *
 * Sums up the duration of all provided sessions, excluding stale sessions
 * by default.
 *
 * @param sessions - List of sessions
 * @param options - Options for calculation
 * @returns Total duration in minutes
 */
export function getTotalDuration(
  sessions: SessionTimings[],
  options: { excludeStale?: boolean; asOf?: Date } = {}
): number {
  const { excludeStale = true, asOf } = options;

  const sessionsToCount = excludeStale
    ? filterStaleSessions(sessions, asOf)
    : sessions;

  return sessionsToCount.reduce((total, session) => {
    const { minutes } = calculateSessionDuration(session, asOf);
    return total + minutes;
  }, 0);
}

/**
 * Extract duration-relevant fields from a full session object
 *
 * @param session - Full session object
 * @returns Minimal timing information needed for duration calculation
 */
export function extractTimings(session: Session): SessionTimings {
  return {
    started_at: session.started_at,
    ended_at: session.ended_at,
  };
}
