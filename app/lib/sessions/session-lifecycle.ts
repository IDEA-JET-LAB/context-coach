/**
 * Session Lifecycle Management - Story 16-3: Session Metadata Capture
 *
 * Handles session lifecycle including:
 * - Detecting when a session has ended
 * - Closing sessions with proper end timing
 * - Marking stale sessions as timed out
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';
import type {
  SessionEndInfo,
  SessionEndReason,
  SessionEndDetectionResult,
  TranscriptMessage,
  CloseStaleSessionsOptions,
  CloseStaleSessionsResult,
} from './types';
import { extractLastMessageTimestamp } from './metadata-extraction';

const logger = createScopedLogger('SESSION-LIFECYCLE');

/**
 * Default timeout in minutes for stale sessions
 * Sessions with no activity for this long are considered abandoned
 */
const DEFAULT_STALE_TIMEOUT_MINUTES = 120; // 2 hours

/**
 * Maximum sessions to close in a single batch
 */
const DEFAULT_BATCH_SIZE = 100;

/**
 * Patterns that indicate a session has completed normally
 */
const COMPLETION_PATTERNS = [
  /\bbye\b/i,
  /\bexit\b/i,
  /\bquit\b/i,
  /\bdone\b/i,
  /\bfinished\b/i,
  /\bthat's all\b/i,
  /\bthanks?\b.*\ball\b/i,
  /\bclosing\b.*\bsession\b/i,
];

/**
 * Patterns that indicate a session was interrupted (crash/error)
 */
const INTERRUPTION_PATTERNS = [
  /\berror\b.*\bfatal\b/i,
  /\bcrash\b/i,
  /\bunexpected\b.*\btermination\b/i,
  /\bsignal\b.*\bkilled\b/i,
  /\bsigkill\b/i,
  /\bsegmentation fault\b/i,
];

/**
 * Detect if a session has ended based on transcript messages
 *
 * Analyzes the last few messages to determine:
 * - If the session appears to have ended
 * - The end reason (completed, abandoned, interrupted, unknown)
 * - Confidence level in the detection
 *
 * @param messages - Array of transcript messages
 * @returns Detection result with end info if session ended
 *
 * @example
 * const result = detectSessionEnd([
 *   { role: 'user', content: "That's all, thanks!" },
 *   { role: 'assistant', content: 'Goodbye!' }
 * ]);
 * // Returns: { hasEnded: true, endInfo: { ended_at: Date, end_reason: 'completed' }, ... }
 */
export function detectSessionEnd(messages: TranscriptMessage[]): SessionEndDetectionResult {
  if (!messages || messages.length === 0) {
    return {
      hasEnded: false,
      endInfo: null,
      confidence: 'low',
      reason: 'No messages to analyze',
    };
  }

  // Get the last message timestamp for potential end time
  const lastTimestamp = extractLastMessageTimestamp(messages);
  const endedAt = lastTimestamp || new Date();

  // Analyze the last few messages (up to 5)
  const recentMessages = messages.slice(-5);
  const recentContent = recentMessages
    .map((m) => {
      if (typeof m.content === 'string') return m.content;
      if (m.content && typeof m.content === 'object') {
        return JSON.stringify(m.content);
      }
      return '';
    })
    .join(' ');

  // Check for completion patterns
  for (const pattern of COMPLETION_PATTERNS) {
    if (pattern.test(recentContent)) {
      return {
        hasEnded: true,
        endInfo: { ended_at: endedAt, end_reason: 'completed' },
        confidence: 'high',
        reason: `Completion pattern matched: ${pattern}`,
      };
    }
  }

  // Check for interruption patterns
  for (const pattern of INTERRUPTION_PATTERNS) {
    if (pattern.test(recentContent)) {
      return {
        hasEnded: true,
        endInfo: { ended_at: endedAt, end_reason: 'interrupted' },
        confidence: 'high',
        reason: `Interruption pattern matched: ${pattern}`,
      };
    }
  }

  // Check for assistant stop_reason indicating end
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  if (lastAssistantMessage?.stop_reason === 'end_turn') {
    // This alone doesn't indicate session end, just turn end
    // But combined with no following user message it might suggest abandonment
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.stop_reason === 'end_turn') {
      // Session might have ended - user didn't continue
      return {
        hasEnded: false,
        endInfo: null,
        confidence: 'low',
        reason: 'Session might be paused - assistant ended turn but no user follow-up',
      };
    }
  }

  // No clear end detected
  return {
    hasEnded: false,
    endInfo: null,
    confidence: 'medium',
    reason: 'No clear session end indicators found',
  };
}

/**
 * Detect end reason from circumstantial evidence
 *
 * Used when we don't have transcript content but know a session should be closed.
 *
 * @param lastActivityAt - When the session was last active
 * @param timeoutMinutes - Minutes of inactivity that triggered close
 * @returns Appropriate end reason
 */
export function inferEndReason(
  lastActivityAt: Date,
  timeoutMinutes: number = DEFAULT_STALE_TIMEOUT_MINUTES
): SessionEndReason {
  const now = new Date();
  const inactiveMinutes = (now.getTime() - lastActivityAt.getTime()) / (1000 * 60);

  // If session has been inactive for a very long time (> 24 hours), likely abandoned
  if (inactiveMinutes > 24 * 60) {
    return 'abandoned';
  }

  // If session just hit the timeout threshold, might have been interrupted
  if (inactiveMinutes <= timeoutMinutes * 1.5) {
    return 'unknown';
  }

  // Otherwise, probably abandoned
  return 'abandoned';
}

/**
 * Close a session with end timing information
 *
 * Updates the session record with:
 * - ended_at timestamp
 * - end_reason
 * - updated_at
 *
 * @param sessionUuid - The internal UUID of the session (sessions.id)
 * @param endInfo - End timing and reason information
 * @throws Error if database update fails
 *
 * @example
 * await closeSession('uuid-here', {
 *   ended_at: new Date(),
 *   end_reason: 'completed'
 * });
 */
export async function closeSession(
  sessionUuid: string,
  endInfo: SessionEndInfo
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: endInfo.ended_at.toISOString(),
      end_reason: endInfo.end_reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionUuid)
    .is('ended_at', null); // Only update if not already closed

  if (error) {
    logger.error('Failed to close session', error, { sessionUuid });
    throw new Error(`Failed to close session: ${error.message}`);
  }

  logger.debug('Session closed', { sessionUuid, end_reason: endInfo.end_reason });
}

/**
 * Mark stale sessions as timed out
 *
 * Finds sessions that have been inactive (no new prompts) for longer than
 * the timeout period and closes them with 'abandoned' status.
 *
 * @param options - Configuration options
 * @returns Result containing count of closed sessions and any errors
 *
 * @example
 * const result = await closeStaleSession({ timeoutMinutes: 120 });
 * console.log(`Closed ${result.closedCount} stale sessions`);
 */
export async function closeStaleSession(
  options: CloseStaleSessionsOptions = {}
): Promise<CloseStaleSessionsResult> {
  const {
    timeoutMinutes = DEFAULT_STALE_TIMEOUT_MINUTES,
    batchSize = DEFAULT_BATCH_SIZE,
    teamId,
  } = options;

  const supabase = createAdminClient();
  const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  // Build query to find stale sessions
  let query = supabase
    .from('sessions')
    .select('id, updated_at')
    .is('ended_at', null)
    .lt('updated_at', cutoffTime.toISOString())
    .order('updated_at', { ascending: true })
    .limit(batchSize);

  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data: staleSessions, error: fetchError } = await query;

  if (fetchError) {
    logger.error('Failed to fetch stale sessions', fetchError);
    return {
      closedCount: 0,
      closedSessionIds: [],
      errors: [{ sessionId: 'fetch', error: fetchError.message }],
    };
  }

  if (!staleSessions || staleSessions.length === 0) {
    return {
      closedCount: 0,
      closedSessionIds: [],
      errors: [],
    };
  }

  const result: CloseStaleSessionsResult = {
    closedCount: 0,
    closedSessionIds: [],
    errors: [],
  };

  // Close each stale session
  for (const session of staleSessions) {
    try {
      const lastActivity = new Date(session.updated_at);
      const endReason = inferEndReason(lastActivity, timeoutMinutes);

      await closeSession(session.id, {
        ended_at: lastActivity, // Use last activity time, not now
        end_reason: endReason,
      });

      result.closedCount++;
      result.closedSessionIds.push(session.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({ sessionId: session.id, error: errorMessage });
    }
  }

  logger.log('Stale sessions cleanup complete', {
    found: staleSessions.length,
    closed: result.closedCount,
    errors: result.errors.length,
  });

  return result;
}

/**
 * Check if a session is active (not ended)
 *
 * @param sessionUuid - The internal UUID of the session
 * @returns true if session is active, false if ended or not found
 */
export async function isSessionActive(sessionUuid: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('sessions')
    .select('ended_at')
    .eq('id', sessionUuid)
    .single();

  if (error || !data) {
    return false;
  }

  return data.ended_at === null;
}

/**
 * Get the current prompt count for a session
 *
 * @param sessionUuid - The internal UUID of the session
 * @returns Current total_prompts value, or 0 if not found
 */
export async function getSessionPromptCount(sessionUuid: string): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('sessions')
    .select('total_prompts')
    .eq('id', sessionUuid)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.total_prompts || 0;
}
