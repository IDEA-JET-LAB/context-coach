/**
 * Conversation Score Aggregator
 * Story 27-6: Conversation Score Aggregation
 *
 * Provides TypeScript wrappers for database functions that calculate
 * and update session-level conversation scores.
 *
 * The conversation score is a weighted average of individual prompt scores,
 * excluding selection and confirmation prompts (which have 0 weight).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';
import { isValidUuid } from '@/lib/utils/uuid';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = createScopedLogger('AGGREGATION');

// ============================================================================
// Types
// ============================================================================

/**
 * Session statistics from the database.
 */
export interface SessionStats {
  /** Session UUID */
  sessionId: string;

  /** Weighted average conversation score (null if no scorable prompts) */
  conversationScore: number | null;

  /** Total user messages in the session */
  userMessageCount: number;

  /** Number of prompts that were scored */
  scoredPromptCount: number;

  /** Number of prompts that were skipped */
  skippedPromptCount: number;

  /** Primary project stage detected */
  primaryStage: string | null;

  /** Whether a debugging loop was detected */
  hasDebuggingLoop: boolean;
}

/**
 * Score breakdown for a single prompt.
 */
export interface ScoreBreakdown {
  /** Prompt UUID */
  promptId: string;

  /** Classified prompt type */
  promptType: string | null;

  /** Overall score (null if skipped) */
  score: number | null;

  /** Scoring weight (0 for skipped types) */
  weight: number;

  /** Whether scoring was skipped */
  skipped: boolean;
}

/**
 * Options for aggregation functions.
 */
export interface AggregationOptions {
  /** Custom Supabase client (for testing) */
  supabase?: SupabaseClient;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Calculate conversation score for a session.
 *
 * This calls the database function `calculate_conversation_score` which:
 * 1. Calculates weighted average of prompt scores
 * 2. Excludes prompts with 0 weight (selection, confirmation, tool_result)
 * 3. Updates the sessions table with the new score
 * 4. Returns the calculated score
 *
 * @param sessionId - Session UUID
 * @param options - Optional configuration
 * @returns The calculated conversation score (null if no scorable prompts)
 *
 * @example
 * ```ts
 * const score = await calculateConversationScore('abc-123');
 * if (score === null) {
 *   console.log('No scorable prompts in session');
 * } else {
 *   console.log(`Conversation score: ${score}`);
 * }
 * ```
 */
export async function calculateConversationScore(
  sessionId: string,
  options: AggregationOptions = {}
): Promise<number | null> {
  if (!isValidUuid(sessionId)) {
    throw new Error(`Invalid session UUID: ${sessionId}`);
  }

  const supabase = options.supabase ?? createAdminClient();

  logger.log('Calculating conversation score', { sessionId });

  const { data, error } = await supabase.rpc('calculate_conversation_score', {
    p_session_uuid: sessionId,
  });

  if (error) {
    logger.error('Failed to calculate conversation score', {
      sessionId,
      error: error.message,
    });
    throw new Error(`Failed to calculate conversation score: ${error.message}`);
  }

  logger.log('Calculated conversation score', { sessionId, score: data });

  return data;
}

/**
 * Update all statistics for a session.
 *
 * This calls the database function `update_session_stats` which:
 * 1. Counts user messages (excludes tool_result)
 * 2. Builds stage breakdown from detected_stage
 * 3. Determines primary stage (most common)
 * 4. Checks for debugging loops
 * 5. Updates the sessions table
 *
 * Note: This does NOT calculate conversation_score. Use
 * `calculateConversationScore` for that.
 *
 * @param sessionId - Session UUID
 * @param options - Optional configuration
 *
 * @example
 * ```ts
 * await updateSessionStats('abc-123');
 * ```
 */
export async function updateSessionStats(
  sessionId: string,
  options: AggregationOptions = {}
): Promise<void> {
  if (!isValidUuid(sessionId)) {
    throw new Error(`Invalid session UUID: ${sessionId}`);
  }

  const supabase = options.supabase ?? createAdminClient();

  logger.log('Updating session stats', { sessionId });

  const { error } = await supabase.rpc('update_session_stats', {
    p_session_uuid: sessionId,
  });

  if (error) {
    logger.error('Failed to update session stats', {
      sessionId,
      error: error.message,
    });
    throw new Error(`Failed to update session stats: ${error.message}`);
  }

  logger.log('Updated session stats', { sessionId });
}

/**
 * Get full session statistics.
 *
 * Fetches the current stats from the sessions table without recalculating.
 * Use this for reading stats; use `calculateConversationScore` or
 * `updateSessionStats` to refresh.
 *
 * @param sessionId - Session UUID
 * @param options - Optional configuration
 * @returns Session statistics
 *
 * @example
 * ```ts
 * const stats = await getSessionStats('abc-123');
 * console.log(`Score: ${stats.conversationScore}, Messages: ${stats.userMessageCount}`);
 * ```
 */
export async function getSessionStats(
  sessionId: string,
  options: AggregationOptions = {}
): Promise<SessionStats> {
  if (!isValidUuid(sessionId)) {
    throw new Error(`Invalid session UUID: ${sessionId}`);
  }

  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, conversation_score, user_message_count, primary_stage, has_debugging_loop'
    )
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Count scored and skipped prompts
  const { data: counts, error: countError } = await supabase
    .from('prompts')
    .select(
      `
      id,
      prompt_analyses!inner (
        skipped
      )
    `
    )
    .eq('session_uuid', sessionId);

  let scoredCount = 0;
  let skippedCount = 0;

  if (!countError && counts) {
    for (const prompt of counts) {
      const analysis = (prompt.prompt_analyses as { skipped: boolean }[])?.[0];
      if (analysis) {
        if (analysis.skipped) {
          skippedCount++;
        } else {
          scoredCount++;
        }
      }
    }
  }

  return {
    sessionId: data.id,
    conversationScore: data.conversation_score,
    userMessageCount: data.user_message_count ?? 0,
    scoredPromptCount: scoredCount,
    skippedPromptCount: skippedCount,
    primaryStage: data.primary_stage,
    hasDebuggingLoop: data.has_debugging_loop ?? false,
  };
}

/**
 * Get conversation score breakdown by prompt.
 *
 * Returns all prompts in a session with their individual scores and weights.
 * Useful for analytics views showing how the conversation score was calculated.
 *
 * @param sessionId - Session UUID
 * @param options - Optional configuration
 * @returns Array of score breakdowns for each prompt
 *
 * @example
 * ```ts
 * const breakdown = await getScoreBreakdown('abc-123');
 * breakdown.forEach(p => {
 *   if (p.skipped) {
 *     console.log(`${p.promptType}: skipped`);
 *   } else {
 *     console.log(`${p.promptType}: ${p.score} (weight: ${p.weight})`);
 *   }
 * });
 * ```
 */
export async function getScoreBreakdown(
  sessionId: string,
  options: AggregationOptions = {}
): Promise<ScoreBreakdown[]> {
  if (!isValidUuid(sessionId)) {
    throw new Error(`Invalid session UUID: ${sessionId}`);
  }

  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase
    .from('prompts')
    .select(
      `
      id,
      prompt_classification,
      sequence_number,
      prompt_analyses (
        overall_score,
        scoring_weight,
        skipped
      )
    `
    )
    .eq('session_uuid', sessionId)
    .order('sequence_number', { ascending: true });

  if (error) {
    logger.error('Failed to get score breakdown', {
      sessionId,
      error: error.message,
    });
    throw new Error(`Failed to get score breakdown: ${error.message}`);
  }

  return (data || []).map((p) => {
    const analysis = (
      p.prompt_analyses as Array<{
        overall_score: number | null;
        scoring_weight: number | null;
        skipped: boolean | null;
      }>
    )?.[0];

    return {
      promptId: p.id,
      promptType: p.prompt_classification,
      score: analysis?.overall_score ?? null,
      weight: analysis?.scoring_weight ?? 0,
      skipped: analysis?.skipped ?? false,
    };
  });
}

/**
 * Refresh all stats for a session including conversation score.
 *
 * Convenience function that calls both `updateSessionStats` and
 * `calculateConversationScore` to fully refresh a session's stats.
 *
 * @param sessionId - Session UUID
 * @param options - Optional configuration
 * @returns Updated session statistics
 *
 * @example
 * ```ts
 * const stats = await refreshSessionStats('abc-123');
 * console.log(`Refreshed - Score: ${stats.conversationScore}`);
 * ```
 */
export async function refreshSessionStats(
  sessionId: string,
  options: AggregationOptions = {}
): Promise<SessionStats> {
  // Update non-score stats first
  await updateSessionStats(sessionId, options);

  // Calculate and update conversation score
  await calculateConversationScore(sessionId, options);

  // Return fresh stats
  return getSessionStats(sessionId, options);
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Refresh stats for multiple sessions.
 *
 * @param sessionIds - Array of session UUIDs
 * @param options - Optional configuration
 * @returns Array of results (SessionStats or Error for each)
 */
export async function refreshSessionStatsBatch(
  sessionIds: string[],
  options: AggregationOptions = {}
): Promise<(SessionStats | Error)[]> {
  const results: (SessionStats | Error)[] = [];

  for (const sessionId of sessionIds) {
    try {
      const stats = await refreshSessionStats(sessionId, options);
      results.push(stats);
    } catch (error) {
      results.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  return results;
}

/**
 * Get sessions that need score recalculation.
 *
 * Returns sessions where prompts have been analyzed but the
 * conversation score hasn't been updated recently.
 *
 * @param limit - Maximum number of sessions to return
 * @param options - Optional configuration
 * @returns Array of session UUIDs
 */
export async function getSessionsNeedingRecalculation(
  limit = 100,
  options: AggregationOptions = {}
): Promise<string[]> {
  const supabase = options.supabase ?? createAdminClient();

  // Find sessions with analyzed prompts but outdated scores
  // This is a simplified query - in production you might want
  // to compare updated_at timestamps
  const { data, error } = await supabase
    .from('sessions')
    .select('id')
    .is('conversation_score', null)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to get sessions needing recalculation', {
      error: error.message,
    });
    return [];
  }

  return (data || []).map((s) => s.id);
}
