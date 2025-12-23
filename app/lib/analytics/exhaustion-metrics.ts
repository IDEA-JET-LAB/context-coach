/**
 * Exhaustion Metrics Calculator
 * Story 21-1: Context Window Management (AC #6, #7)
 *
 * Calculates context exhaustion metrics for users and teams:
 * - User exhaustion rate (sessions with exhaustion / total sessions)
 * - Average session duration before exhaustion
 * - Team-level aggregations
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('EXHAUSTION_METRICS');

// ============================================================================
// Types
// ============================================================================

/**
 * Exhaustion metrics for a user or team
 */
export interface ExhaustionMetrics {
  /** Rate of sessions with context exhaustion (0.0 to 1.0) */
  exhaustionRate: number;
  /** Total number of sessions */
  totalSessions: number;
  /** Number of sessions that hit context limits */
  exhaustedSessions: number;
  /** Average duration in minutes before exhaustion was detected */
  avgDurationBeforeExhaustion: number | null;
}

/**
 * Extended metrics including time-based breakdown
 */
export interface DetailedExhaustionMetrics extends ExhaustionMetrics {
  /** Exhaustion rate trend (positive = getting worse) */
  trendDirection: 'improving' | 'stable' | 'worsening';
  /** Median duration before exhaustion */
  medianDurationBeforeExhaustion: number | null;
  /** Most common hour when exhaustion occurs */
  peakExhaustionHour: number | null;
}

/**
 * Options for exhaustion rate calculation
 */
export interface ExhaustionRateOptions {
  /** Start date for the calculation period */
  startDate?: Date;
  /** End date for the calculation period */
  endDate?: Date;
  /** Project ID filter (optional) */
  projectId?: string;
}

// ============================================================================
// User-Level Metrics (AC #6)
// ============================================================================

/**
 * Calculate exhaustion metrics for a specific user.
 *
 * Formula: exhaustion_rate = sessions_with_exhaustion / total_sessions
 *
 * @param userId - The user's ID
 * @param options - Optional filters
 * @returns Exhaustion metrics for the user
 *
 * @example
 * ```typescript
 * const metrics = await calculateUserExhaustionRate('user-uuid');
 * console.log(`Exhaustion rate: ${metrics.exhaustionRate * 100}%`);
 * console.log(`Avg duration before exhaustion: ${metrics.avgDurationBeforeExhaustion} minutes`);
 * ```
 */
export async function calculateUserExhaustionRate(
  userId: string,
  options: ExhaustionRateOptions = {}
): Promise<ExhaustionMetrics> {
  const supabase = createAdminClient();
  const { startDate, endDate, projectId } = options;

  // Build query
  let query = supabase
    .from('sessions')
    .select('id, context_exhausted, started_at, exhaustion_detected_at')
    .eq('user_id', userId);

  // Apply optional filters
  if (startDate) {
    query = query.gte('started_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('started_at', endDate.toISOString());
  }
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch user sessions', error, { userId });
    throw new Error(`Failed to calculate exhaustion rate: ${error.message}`);
  }

  return calculateMetricsFromSessions(data || []);
}

/**
 * Calculate average duration before exhaustion for a user (AC #7).
 *
 * This calculates the average session duration for sessions where
 * context exhaustion was detected.
 *
 * @param userId - The user's ID
 * @param options - Optional filters
 * @returns Average duration in minutes, or null if no exhausted sessions
 */
export async function calculateAvgDurationBeforeExhaustion(
  userId: string,
  options: ExhaustionRateOptions = {}
): Promise<number | null> {
  const supabase = createAdminClient();
  const { startDate, endDate, projectId } = options;

  // Build query for exhausted sessions only
  let query = supabase
    .from('sessions')
    .select('started_at, exhaustion_detected_at')
    .eq('user_id', userId)
    .eq('context_exhausted', true);

  // Apply optional filters
  if (startDate) {
    query = query.gte('started_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('started_at', endDate.toISOString());
  }
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch exhausted sessions', error, { userId });
    throw new Error(`Failed to calculate avg duration: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Calculate durations
  const durations: number[] = [];
  for (const session of data) {
    if (session.exhaustion_detected_at) {
      const startedAt = new Date(session.started_at);
      const exhaustedAt = new Date(session.exhaustion_detected_at);
      const durationMs = exhaustedAt.getTime() - startedAt.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      durations.push(durationMinutes);
    }
  }

  if (durations.length === 0) {
    return null;
  }

  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  return Math.round(avgDuration);
}

// ============================================================================
// Team-Level Metrics (AC #8)
// ============================================================================

/**
 * Calculate aggregated exhaustion metrics for a team.
 *
 * Aggregates exhaustion data across all team members.
 *
 * @param teamId - The team's ID
 * @param options - Optional filters
 * @returns Aggregated exhaustion metrics for the team
 *
 * @example
 * ```typescript
 * const teamMetrics = await calculateTeamExhaustionRate('team-uuid');
 * console.log(`Team exhaustion rate: ${teamMetrics.exhaustionRate * 100}%`);
 * ```
 */
export async function calculateTeamExhaustionRate(
  teamId: string,
  options: ExhaustionRateOptions = {}
): Promise<ExhaustionMetrics> {
  const supabase = createAdminClient();
  const { startDate, endDate, projectId } = options;

  // Build query for all team sessions
  let query = supabase
    .from('sessions')
    .select('id, context_exhausted, started_at, exhaustion_detected_at, user_id')
    .eq('team_id', teamId);

  // Apply optional filters
  if (startDate) {
    query = query.gte('started_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('started_at', endDate.toISOString());
  }
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch team sessions', error, { teamId });
    throw new Error(`Failed to calculate team exhaustion rate: ${error.message}`);
  }

  return calculateMetricsFromSessions(data || []);
}

/**
 * Calculate average duration before exhaustion for a team (AC #8).
 *
 * @param teamId - The team's ID
 * @param options - Optional filters
 * @returns Average duration in minutes, or null if no exhausted sessions
 */
export async function calculateTeamAvgDurationBeforeExhaustion(
  teamId: string,
  options: ExhaustionRateOptions = {}
): Promise<number | null> {
  const supabase = createAdminClient();
  const { startDate, endDate, projectId } = options;

  // Build query for exhausted sessions only
  let query = supabase
    .from('sessions')
    .select('started_at, exhaustion_detected_at')
    .eq('team_id', teamId)
    .eq('context_exhausted', true);

  // Apply optional filters
  if (startDate) {
    query = query.gte('started_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('started_at', endDate.toISOString());
  }
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch team exhausted sessions', error, { teamId });
    throw new Error(`Failed to calculate team avg duration: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Calculate durations
  const durations: number[] = [];
  for (const session of data) {
    if (session.exhaustion_detected_at) {
      const startedAt = new Date(session.started_at);
      const exhaustedAt = new Date(session.exhaustion_detected_at);
      const durationMs = exhaustedAt.getTime() - startedAt.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      durations.push(durationMinutes);
    }
  }

  if (durations.length === 0) {
    return null;
  }

  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  return Math.round(avgDuration);
}

/**
 * Get exhaustion metrics for all members of a team.
 *
 * Returns per-user breakdown of exhaustion metrics.
 *
 * @param teamId - The team's ID
 * @param options - Optional filters
 * @returns Map of user ID to their exhaustion metrics
 */
export async function getTeamMemberExhaustionBreakdown(
  teamId: string,
  options: ExhaustionRateOptions = {}
): Promise<Map<string, ExhaustionMetrics>> {
  const supabase = createAdminClient();
  const { startDate, endDate, projectId } = options;

  // Build query for all team sessions
  let query = supabase
    .from('sessions')
    .select('id, context_exhausted, started_at, exhaustion_detected_at, user_id')
    .eq('team_id', teamId);

  // Apply optional filters
  if (startDate) {
    query = query.gte('started_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('started_at', endDate.toISOString());
  }
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch team sessions for breakdown', error, { teamId });
    throw new Error(`Failed to get member breakdown: ${error.message}`);
  }

  // Group sessions by user
  const sessionsByUser = new Map<string, typeof data>();
  for (const session of data || []) {
    const userId = session.user_id;
    if (!sessionsByUser.has(userId)) {
      sessionsByUser.set(userId, []);
    }
    sessionsByUser.get(userId)!.push(session);
  }

  // Calculate metrics for each user
  const result = new Map<string, ExhaustionMetrics>();
  for (const [userId, sessions] of sessionsByUser) {
    result.set(userId, calculateMetricsFromSessions(sessions));
  }

  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate exhaustion metrics from a list of sessions.
 *
 * @param sessions - Array of session records
 * @returns Calculated metrics
 */
function calculateMetricsFromSessions(
  sessions: Array<{
    id: string;
    context_exhausted: boolean | null;
    started_at: string;
    exhaustion_detected_at: string | null;
  }>
): ExhaustionMetrics {
  const totalSessions = sessions.length;

  if (totalSessions === 0) {
    return {
      exhaustionRate: 0,
      totalSessions: 0,
      exhaustedSessions: 0,
      avgDurationBeforeExhaustion: null,
    };
  }

  // Count exhausted sessions
  const exhaustedSessions = sessions.filter(s => s.context_exhausted).length;
  const exhaustionRate = exhaustedSessions / totalSessions;

  // Calculate average duration before exhaustion
  const durations: number[] = [];
  for (const session of sessions) {
    if (session.context_exhausted && session.exhaustion_detected_at) {
      const startedAt = new Date(session.started_at);
      const exhaustedAt = new Date(session.exhaustion_detected_at);
      const durationMs = exhaustedAt.getTime() - startedAt.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      if (durationMinutes >= 0) {
        durations.push(durationMinutes);
      }
    }
  }

  const avgDurationBeforeExhaustion = durations.length > 0
    ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
    : null;

  return {
    exhaustionRate: Math.round(exhaustionRate * 1000) / 1000, // 3 decimal places
    totalSessions,
    exhaustedSessions,
    avgDurationBeforeExhaustion,
  };
}
