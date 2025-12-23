/**
 * Session Efficiency Metrics - Story 16-6: Session Duration Calculation
 *
 * Functions for calculating session efficiency metrics like prompts per hour,
 * average time between prompts, and session density.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { calculateSessionDuration, type SessionTimings } from './duration';

/**
 * Efficiency metrics for a session or set of sessions
 */
export interface EfficiencyMetrics {
  /** Average number of prompts per hour of session time */
  promptsPerHour: number;
  /** Average time between prompts in minutes */
  averageTimeBetweenPrompts: number;
  /** Session density - ratio of active time to total time (0-1) */
  sessionDensity: number;
  /** Most active hour of day (0-23) */
  peakHour: number;
  /** Distribution of prompts by hour (0-23) */
  hourlyDistribution: number[];
}

/**
 * Prompt with timing information
 */
interface PromptTiming {
  created_at: string;
  sequence_number: number | null;
}

/**
 * Calculate prompts per hour
 *
 * A measure of how intensively a session is being used.
 * Higher values indicate more back-and-forth conversation.
 *
 * @param totalPrompts - Number of prompts in the session
 * @param durationMinutes - Session duration in minutes
 * @returns Prompts per hour (rounded to 2 decimal places)
 *
 * @example
 * calculatePromptsPerHour(30, 60); // 30 prompts per hour
 * calculatePromptsPerHour(15, 30); // 30 prompts per hour
 * calculatePromptsPerHour(5, 120); // 2.5 prompts per hour
 */
export function calculatePromptsPerHour(
  totalPrompts: number,
  durationMinutes: number
): number {
  if (durationMinutes <= 0) {
    return 0;
  }

  const hours = durationMinutes / 60;
  return Number((totalPrompts / hours).toFixed(2));
}

/**
 * Calculate average time between prompts for a session
 *
 * Fetches prompt timestamps from the database and calculates
 * the average gap between consecutive prompts.
 *
 * @param sessionUuid - Internal UUID of the session
 * @returns Average time between prompts in minutes
 *
 * @example
 * const avgTime = await calculateAverageTimeBetweenPrompts('session-uuid');
 * // Returns: 5.2 (average 5.2 minutes between prompts)
 */
export async function calculateAverageTimeBetweenPrompts(
  sessionUuid: string
): Promise<number> {
  const supabase = createAdminClient();

  const { data: prompts, error } = await supabase
    .from('prompts')
    .select('created_at, sequence_number')
    .eq('session_uuid', sessionUuid)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch prompts: ${error.message}`);
  }

  return calculateAverageGapFromPrompts(prompts || []);
}

/**
 * Calculate average gap from a list of prompt timings
 *
 * Pure function for calculating the average time between prompts.
 *
 * @param prompts - List of prompts with timestamps
 * @returns Average gap in minutes
 */
export function calculateAverageGapFromPrompts(
  prompts: PromptTiming[]
): number {
  if (prompts.length < 2) {
    return 0;
  }

  // Sort by timestamp to ensure correct order
  const sorted = [...prompts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let totalGapMs = 0;
  let gapCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1]!.created_at).getTime();
    const currTime = new Date(sorted[i]!.created_at).getTime();
    const gapMs = currTime - prevTime;

    // Exclude gaps longer than 30 minutes (likely a break)
    if (gapMs <= 30 * 60 * 1000) {
      totalGapMs += gapMs;
      gapCount++;
    }
  }

  if (gapCount === 0) {
    return 0;
  }

  return Number((totalGapMs / gapCount / 60000).toFixed(2));
}

/**
 * Calculate session density
 *
 * Session density is a measure of how "active" a session is.
 * It's calculated as the ratio of time actually spent prompting
 * (sum of gaps < 30 min) to total session duration.
 *
 * A density of 1.0 means continuous activity.
 * Lower values indicate breaks or periods of inactivity.
 *
 * @param sessionUuid - Internal UUID of the session
 * @param session - Session timing information
 * @returns Density value between 0 and 1
 */
export async function calculateSessionDensity(
  sessionUuid: string,
  session: SessionTimings
): Promise<number> {
  const supabase = createAdminClient();

  const { data: prompts, error } = await supabase
    .from('prompts')
    .select('created_at, sequence_number')
    .eq('session_uuid', sessionUuid)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch prompts: ${error.message}`);
  }

  return calculateDensityFromPrompts(prompts || [], session);
}

/**
 * Calculate density from a list of prompts
 *
 * @param prompts - List of prompts with timestamps
 * @param session - Session timing information
 * @returns Density value between 0 and 1
 */
export function calculateDensityFromPrompts(
  prompts: PromptTiming[],
  session: SessionTimings
): number {
  const { minutes: totalMinutes } = calculateSessionDuration(session);

  if (totalMinutes <= 0 || prompts.length < 2) {
    return prompts.length > 0 ? 1 : 0;
  }

  // Sort by timestamp
  const sorted = [...prompts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Sum gaps that are "active" (< 30 minutes)
  let activeTimeMs = 0;
  const maxGapMs = 30 * 60 * 1000; // 30 minutes

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1]!.created_at).getTime();
    const currTime = new Date(sorted[i]!.created_at).getTime();
    const gapMs = currTime - prevTime;

    // If gap is small, consider it active time
    activeTimeMs += Math.min(gapMs, maxGapMs);
  }

  const activeMinutes = activeTimeMs / 60000;
  const density = Math.min(1, activeMinutes / totalMinutes);

  return Number(density.toFixed(3));
}

/**
 * Find the peak hour (most prompts) for a session
 *
 * @param sessionUuid - Internal UUID of the session
 * @returns Hour of day (0-23) with the most prompts
 */
export async function findSessionPeakHour(sessionUuid: string): Promise<number> {
  const supabase = createAdminClient();

  const { data: prompts, error } = await supabase
    .from('prompts')
    .select('created_at')
    .eq('session_uuid', sessionUuid);

  if (error) {
    throw new Error(`Failed to fetch prompts: ${error.message}`);
  }

  return findPeakHourFromPrompts(prompts || []);
}

/**
 * Find peak hour from a list of prompts
 *
 * @param prompts - List of prompts with timestamps
 * @returns Hour of day (0-23) with the most prompts
 */
export function findPeakHourFromPrompts(
  prompts: { created_at: string }[]
): number {
  if (prompts.length === 0) {
    return 0;
  }

  // Count prompts by hour
  const hourCounts = new Array(24).fill(0) as number[];

  for (const prompt of prompts) {
    const hour = new Date(prompt.created_at).getHours();
    hourCounts[hour]!++;
  }

  // Find the hour with the most prompts
  let peakHour = 0;
  let maxCount = 0;

  for (let hour = 0; hour < 24; hour++) {
    if (hourCounts[hour]! > maxCount) {
      maxCount = hourCounts[hour]!;
      peakHour = hour;
    }
  }

  return peakHour;
}

/**
 * Calculate hourly distribution of prompts
 *
 * @param prompts - List of prompts with timestamps
 * @returns Array of 24 values representing prompt counts per hour
 */
export function calculateHourlyDistribution(
  prompts: { created_at: string }[]
): number[] {
  const distribution = new Array(24).fill(0) as number[];

  for (const prompt of prompts) {
    const hour = new Date(prompt.created_at).getHours();
    distribution[hour]!++;
  }

  return distribution;
}

/**
 * Get comprehensive efficiency metrics for a session
 *
 * @param sessionUuid - Internal UUID of the session
 * @param session - Session timing and prompt count information
 * @returns Complete efficiency metrics
 */
export async function getSessionEfficiencyMetrics(
  sessionUuid: string,
  session: SessionTimings & { total_prompts: number }
): Promise<EfficiencyMetrics> {
  const supabase = createAdminClient();

  const { data: prompts, error } = await supabase
    .from('prompts')
    .select('created_at, sequence_number')
    .eq('session_uuid', sessionUuid)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch prompts: ${error.message}`);
  }

  const promptList = prompts || [];
  const { minutes: durationMinutes } = calculateSessionDuration(session);

  return {
    promptsPerHour: calculatePromptsPerHour(session.total_prompts, durationMinutes),
    averageTimeBetweenPrompts: calculateAverageGapFromPrompts(promptList),
    sessionDensity: calculateDensityFromPrompts(promptList, session),
    peakHour: findPeakHourFromPrompts(promptList),
    hourlyDistribution: calculateHourlyDistribution(promptList),
  };
}

/**
 * Get efficiency metrics aggregated across multiple sessions
 *
 * @param userId - User ID to get metrics for
 * @param dateRange - Optional date range filter
 * @returns Aggregated efficiency metrics
 */
export async function getUserEfficiencyMetrics(
  userId: string,
  dateRange?: { startDate: Date; endDate: Date }
): Promise<EfficiencyMetrics> {
  const supabase = createAdminClient();

  // Get sessions
  let sessionQuery = supabase
    .from('sessions')
    .select('id, started_at, ended_at, total_prompts')
    .eq('user_id', userId);

  if (dateRange) {
    sessionQuery = sessionQuery
      .gte('started_at', dateRange.startDate.toISOString())
      .lte('started_at', dateRange.endDate.toISOString());
  }

  const { data: sessions, error: sessionError } = await sessionQuery;

  if (sessionError) {
    throw new Error(`Failed to fetch sessions: ${sessionError.message}`);
  }

  if (!sessions || sessions.length === 0) {
    return {
      promptsPerHour: 0,
      averageTimeBetweenPrompts: 0,
      sessionDensity: 0,
      peakHour: 0,
      hourlyDistribution: new Array(24).fill(0),
    };
  }

  // Get all prompts for these sessions
  const sessionIds = sessions.map(s => s.id);
  const { data: prompts, error: promptError } = await supabase
    .from('prompts')
    .select('created_at, sequence_number, session_uuid')
    .in('session_uuid', sessionIds)
    .order('created_at', { ascending: true });

  if (promptError) {
    throw new Error(`Failed to fetch prompts: ${promptError.message}`);
  }

  const promptList = prompts || [];

  // Calculate aggregate metrics
  let totalPrompts = 0;
  let totalMinutes = 0;

  for (const session of sessions) {
    const { minutes } = calculateSessionDuration(session);
    totalPrompts += session.total_prompts;
    totalMinutes += minutes;
  }

  // Calculate average gap across all sessions
  const sessionPromptGroups: Map<string, PromptTiming[]> = new Map();
  for (const prompt of promptList) {
    const sessionId = prompt.session_uuid as string;
    if (!sessionPromptGroups.has(sessionId)) {
      sessionPromptGroups.set(sessionId, []);
    }
    sessionPromptGroups.get(sessionId)!.push(prompt);
  }

  let totalGaps = 0;
  let gapCount = 0;
  for (const sessionPrompts of sessionPromptGroups.values()) {
    const avgGap = calculateAverageGapFromPrompts(sessionPrompts);
    if (avgGap > 0) {
      totalGaps += avgGap;
      gapCount++;
    }
  }

  // Calculate average density
  let totalDensity = 0;
  for (const session of sessions) {
    const sessionPrompts = sessionPromptGroups.get(session.id) || [];
    const density = calculateDensityFromPrompts(sessionPrompts, session);
    totalDensity += density;
  }

  return {
    promptsPerHour: calculatePromptsPerHour(totalPrompts, totalMinutes),
    averageTimeBetweenPrompts: gapCount > 0 ? Number((totalGaps / gapCount).toFixed(2)) : 0,
    sessionDensity: sessions.length > 0 ? Number((totalDensity / sessions.length).toFixed(3)) : 0,
    peakHour: findPeakHourFromPrompts(promptList),
    hourlyDistribution: calculateHourlyDistribution(promptList),
  };
}
