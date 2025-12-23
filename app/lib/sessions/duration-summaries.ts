/**
 * Session Duration Summaries - Story 16-6: Session Duration Calculation
 *
 * Functions for generating time-based summaries of session durations.
 * Supports daily, weekly, and monthly aggregations.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  calculateSessionDuration,
  filterStaleSessions,
  type SessionTimings,
} from './duration';

/**
 * Summary for a time period
 */
export interface PeriodSummary {
  /** Period identifier (ISO date or week/month start) */
  period: string;
  /** Human-readable label (e.g., "Today", "Yesterday", "Mon, Dec 23") */
  periodLabel: string;
  /** Total session duration in minutes */
  totalMinutes: number;
  /** Number of sessions in this period */
  sessionCount: number;
  /** Average session duration in minutes */
  averageMinutes: number;
  /** Number of active sessions in this period */
  activeCount: number;
}

/**
 * Session row from database with timing info
 */
interface SessionRow extends SessionTimings {
  id: string;
}

/**
 * Get daily summaries for a user's sessions
 *
 * Returns summaries for the specified number of days, starting from today
 * and going backwards.
 *
 * @param userId - User ID to get summaries for
 * @param days - Number of days to include (default: 7)
 * @returns Array of daily summaries, most recent first
 *
 * @example
 * const summaries = await getDailySummary('user-123', 7);
 * // Returns: [
 * //   { period: '2025-01-15', periodLabel: 'Today', totalMinutes: 180, ... },
 * //   { period: '2025-01-14', periodLabel: 'Yesterday', totalMinutes: 120, ... },
 * //   ...
 * // ]
 */
export async function getDailySummary(
  userId: string,
  days: number = 7
): Promise<PeriodSummary[]> {
  const supabase = createAdminClient();

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, started_at, ended_at')
    .eq('user_id', userId)
    .gte('started_at', startDate.toISOString())
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return calculateDailySummaries(sessions || [], days);
}

/**
 * Get daily summaries for a team's sessions
 *
 * @param teamId - Team ID to get summaries for
 * @param days - Number of days to include (default: 7)
 * @returns Array of daily summaries, most recent first
 */
export async function getTeamDailySummary(
  teamId: string,
  days: number = 7
): Promise<PeriodSummary[]> {
  const supabase = createAdminClient();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, started_at, ended_at')
    .eq('team_id', teamId)
    .gte('started_at', startDate.toISOString())
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch team sessions: ${error.message}`);
  }

  return calculateDailySummaries(sessions || [], days);
}

/**
 * Get weekly summaries for a user's sessions
 *
 * Returns summaries for the specified number of weeks, starting from
 * the current week and going backwards. Weeks start on Monday.
 *
 * @param userId - User ID to get summaries for
 * @param weeks - Number of weeks to include (default: 4)
 * @returns Array of weekly summaries, most recent first
 */
export async function getWeeklySummary(
  userId: string,
  weeks: number = 4
): Promise<PeriodSummary[]> {
  const supabase = createAdminClient();

  // Calculate date range
  const endDate = new Date();
  const startDate = getWeekStart(new Date());
  startDate.setDate(startDate.getDate() - (weeks - 1) * 7);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, started_at, ended_at')
    .eq('user_id', userId)
    .gte('started_at', startDate.toISOString())
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return calculateWeeklySummaries(sessions || [], weeks);
}

/**
 * Get weekly summaries for a team's sessions
 *
 * @param teamId - Team ID to get summaries for
 * @param weeks - Number of weeks to include (default: 4)
 * @returns Array of weekly summaries, most recent first
 */
export async function getTeamWeeklySummary(
  teamId: string,
  weeks: number = 4
): Promise<PeriodSummary[]> {
  const supabase = createAdminClient();

  const endDate = new Date();
  const startDate = getWeekStart(new Date());
  startDate.setDate(startDate.getDate() - (weeks - 1) * 7);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, started_at, ended_at')
    .eq('team_id', teamId)
    .gte('started_at', startDate.toISOString())
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch team sessions: ${error.message}`);
  }

  return calculateWeeklySummaries(sessions || [], weeks);
}

/**
 * Get monthly summaries for a user's sessions
 *
 * Returns summaries for the specified number of months, starting from
 * the current month and going backwards.
 *
 * @param userId - User ID to get summaries for
 * @param months - Number of months to include (default: 6)
 * @returns Array of monthly summaries, most recent first
 */
export async function getMonthlySummary(
  userId: string,
  months: number = 6
): Promise<PeriodSummary[]> {
  const supabase = createAdminClient();

  // Calculate date range
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, started_at, ended_at')
    .eq('user_id', userId)
    .gte('started_at', startDate.toISOString())
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return calculateMonthlySummaries(sessions || [], months);
}

/**
 * Get monthly summaries for a team's sessions
 *
 * @param teamId - Team ID to get summaries for
 * @param months - Number of months to include (default: 6)
 * @returns Array of monthly summaries, most recent first
 */
export async function getTeamMonthlySummary(
  teamId: string,
  months: number = 6
): Promise<PeriodSummary[]> {
  const supabase = createAdminClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, started_at, ended_at')
    .eq('team_id', teamId)
    .gte('started_at', startDate.toISOString())
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch team sessions: ${error.message}`);
  }

  return calculateMonthlySummaries(sessions || [], months);
}

/**
 * Calculate daily summaries from a list of sessions
 *
 * @param sessions - List of sessions
 * @param days - Number of days to include
 * @returns Daily summaries
 */
export function calculateDailySummaries(
  sessions: SessionRow[],
  days: number
): PeriodSummary[] {
  const validSessions = filterStaleSessions(sessions);
  const summaries: PeriodSummary[] = [];

  // Generate dates for each day
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const period = date.toISOString().split('T')[0]!;
    const periodLabel = getDayLabel(date, i);

    // Filter sessions for this day
    const daySessions = validSessions.filter(session => {
      const sessionDate = new Date(session.started_at);
      return (
        sessionDate.getFullYear() === date.getFullYear() &&
        sessionDate.getMonth() === date.getMonth() &&
        sessionDate.getDate() === date.getDate()
      );
    });

    const summary = calculatePeriodSummary(period, periodLabel, daySessions);
    summaries.push(summary);
  }

  return summaries;
}

/**
 * Calculate weekly summaries from a list of sessions
 *
 * @param sessions - List of sessions
 * @param weeks - Number of weeks to include
 * @returns Weekly summaries
 */
export function calculateWeeklySummaries(
  sessions: SessionRow[],
  weeks: number
): PeriodSummary[] {
  const validSessions = filterStaleSessions(sessions);
  const summaries: PeriodSummary[] = [];

  // Get start of current week
  const currentWeekStart = getWeekStart(new Date());

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const period = weekStart.toISOString().split('T')[0]!;
    const periodLabel = getWeekLabel(weekStart, i);

    // Filter sessions for this week
    const weekSessions = validSessions.filter(session => {
      const sessionDate = new Date(session.started_at);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    });

    const summary = calculatePeriodSummary(period, periodLabel, weekSessions);
    summaries.push(summary);
  }

  return summaries;
}

/**
 * Calculate monthly summaries from a list of sessions
 *
 * @param sessions - List of sessions
 * @param months - Number of months to include
 * @returns Monthly summaries
 */
export function calculateMonthlySummaries(
  sessions: SessionRow[],
  months: number
): PeriodSummary[] {
  const validSessions = filterStaleSessions(sessions);
  const summaries: PeriodSummary[] = [];

  const now = new Date();

  for (let i = 0; i < months; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const period = monthStart.toISOString().split('T')[0]!;
    const periodLabel = getMonthLabel(monthStart, i);

    // Filter sessions for this month
    const monthSessions = validSessions.filter(session => {
      const sessionDate = new Date(session.started_at);
      return sessionDate >= monthStart && sessionDate <= monthEnd;
    });

    const summary = calculatePeriodSummary(period, periodLabel, monthSessions);
    summaries.push(summary);
  }

  return summaries;
}

/**
 * Calculate summary for a single period
 */
function calculatePeriodSummary(
  period: string,
  periodLabel: string,
  sessions: SessionTimings[]
): PeriodSummary {
  if (sessions.length === 0) {
    return {
      period,
      periodLabel,
      totalMinutes: 0,
      sessionCount: 0,
      averageMinutes: 0,
      activeCount: 0,
    };
  }

  let totalMinutes = 0;
  let activeCount = 0;

  for (const session of sessions) {
    const result = calculateSessionDuration(session);
    totalMinutes += result.minutes;
    if (result.isOngoing) {
      activeCount++;
    }
  }

  return {
    period,
    periodLabel,
    totalMinutes,
    sessionCount: sessions.length,
    averageMinutes: Math.round(totalMinutes / sessions.length),
    activeCount,
  };
}

/**
 * Get a human-readable label for a day
 */
function getDayLabel(date: Date, daysAgo: number): string {
  if (daysAgo === 0) {
    return 'Today';
  }
  if (daysAgo === 1) {
    return 'Yesterday';
  }

  // For dates within the last week, use day name
  if (daysAgo < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // For older dates, use full date format
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Get a human-readable label for a week
 */
function getWeekLabel(weekStart: Date, weeksAgo: number): string {
  if (weeksAgo === 0) {
    return 'This week';
  }
  if (weeksAgo === 1) {
    return 'Last week';
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return `${startStr} - ${endStr}`;
}

/**
 * Get a human-readable label for a month
 */
function getMonthLabel(monthStart: Date, monthsAgo: number): string {
  if (monthsAgo === 0) {
    return 'This month';
  }
  if (monthsAgo === 1) {
    return 'Last month';
  }

  return monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  // Adjust for Monday start (Sunday = 0, so Monday = 1)
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}
