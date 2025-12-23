/**
 * Session Metadata Updates - Story 16-3: Session Metadata Capture
 *
 * Handles updating session metadata with:
 * - Conditional updates (only if current value is NULL)
 * - Full metadata updates
 * - Atomic operations
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';
import type { SessionMetadata } from './types';

const logger = createScopedLogger('SESSION-UPDATE');

/**
 * Update session metadata fields
 *
 * This updates ALL provided fields, overwriting existing values.
 * Use updateSessionMetadataIfNull for conditional updates.
 *
 * @param sessionUuid - The internal UUID of the session (sessions.id)
 * @param metadata - Partial metadata to update
 * @throws Error if database update fails
 *
 * @example
 * await updateSessionMetadata('uuid-here', {
 *   git_branch: 'feature/auth',
 *   cwd: '~/projects/my-app'
 * });
 */
export async function updateSessionMetadata(
  sessionUuid: string,
  metadata: Partial<SessionMetadata>
): Promise<void> {
  if (Object.keys(metadata).length === 0) {
    return; // Nothing to update
  }

  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Only include defined values
  if (metadata.cwd !== undefined) {
    updateData.cwd = metadata.cwd;
  }
  if (metadata.git_branch !== undefined) {
    updateData.git_branch = metadata.git_branch;
  }
  if (metadata.claude_code_version !== undefined) {
    updateData.claude_code_version = metadata.claude_code_version;
  }
  if (metadata.slug !== undefined) {
    updateData.slug = metadata.slug;
  }

  const { error } = await supabase
    .from('sessions')
    .update(updateData)
    .eq('id', sessionUuid);

  if (error) {
    logger.error('Failed to update session metadata', error, { sessionUuid });
    throw new Error(`Failed to update session metadata: ${error.message}`);
  }

  logger.debug('Session metadata updated', { sessionUuid, fields: Object.keys(metadata) });
}

/**
 * Update session metadata only if current values are NULL
 *
 * This preserves existing values and only fills in missing ones.
 * Uses COALESCE pattern to avoid overwriting non-null values.
 *
 * @param sessionUuid - The internal UUID of the session (sessions.id)
 * @param metadata - Partial metadata to conditionally update
 * @throws Error if database operation fails
 *
 * @example
 * // If session already has cwd set, this won't overwrite it
 * await updateSessionMetadataIfNull('uuid-here', {
 *   cwd: '~/projects/my-app',
 *   git_branch: 'main'
 * });
 */
export async function updateSessionMetadataIfNull(
  sessionUuid: string,
  metadata: Partial<SessionMetadata>
): Promise<void> {
  if (Object.keys(metadata).length === 0) {
    return; // Nothing to update
  }

  const supabase = createAdminClient();

  // First, fetch current values to check what's null
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('cwd, git_branch, claude_code_version, slug')
    .eq('id', sessionUuid)
    .single();

  if (fetchError) {
    logger.error('Failed to fetch session for conditional update', fetchError, { sessionUuid });
    throw new Error(`Failed to fetch session: ${fetchError.message}`);
  }

  if (!session) {
    logger.warn('Session not found for conditional update', { sessionUuid });
    return;
  }

  // Build update object with only NULL fields
  const updateData: Record<string, unknown> = {};

  if (metadata.cwd !== undefined && session.cwd === null) {
    updateData.cwd = metadata.cwd;
  }
  if (metadata.git_branch !== undefined && session.git_branch === null) {
    updateData.git_branch = metadata.git_branch;
  }
  if (metadata.claude_code_version !== undefined && session.claude_code_version === null) {
    updateData.claude_code_version = metadata.claude_code_version;
  }
  if (metadata.slug !== undefined && session.slug === null) {
    updateData.slug = metadata.slug;
  }

  if (Object.keys(updateData).length === 0) {
    logger.debug('No NULL fields to update', { sessionUuid });
    return; // All fields already have values
  }

  // Add updated_at
  updateData.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('sessions')
    .update(updateData)
    .eq('id', sessionUuid);

  if (updateError) {
    logger.error('Failed to conditionally update session metadata', updateError, { sessionUuid });
    throw new Error(`Failed to update session metadata: ${updateError.message}`);
  }

  logger.debug('Session metadata conditionally updated', {
    sessionUuid,
    updatedFields: Object.keys(updateData).filter((k) => k !== 'updated_at'),
    skippedFields: Object.keys(metadata).filter((k) => !(k in updateData)),
  });
}

/**
 * Update session timing information
 *
 * @param sessionUuid - The internal UUID of the session
 * @param startedAt - New started_at value (optional)
 * @throws Error if database update fails
 */
export async function updateSessionTiming(
  sessionUuid: string,
  startedAt: Date
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('sessions')
    .update({
      started_at: startedAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionUuid);

  if (error) {
    logger.error('Failed to update session timing', error, { sessionUuid });
    throw new Error(`Failed to update session timing: ${error.message}`);
  }

  logger.debug('Session timing updated', { sessionUuid, started_at: startedAt.toISOString() });
}

/**
 * Increment the total_tokens count for a session
 *
 * @param sessionUuid - The internal UUID of the session
 * @param tokenCount - Number of tokens to add
 * @throws Error if database update fails
 */
export async function incrementSessionTokens(
  sessionUuid: string,
  tokenCount: number
): Promise<void> {
  if (tokenCount <= 0) {
    return; // Nothing to increment
  }

  const supabase = createAdminClient();

  // Use RPC or raw SQL for atomic increment
  // For now, we'll do a read-then-write (not ideal but works for low concurrency)
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('total_tokens')
    .eq('id', sessionUuid)
    .single();

  if (fetchError) {
    logger.error('Failed to fetch session for token increment', fetchError, { sessionUuid });
    throw new Error(`Failed to fetch session: ${fetchError.message}`);
  }

  const newTotal = (session?.total_tokens || 0) + tokenCount;

  const { error: updateError } = await supabase
    .from('sessions')
    .update({
      total_tokens: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionUuid);

  if (updateError) {
    logger.error('Failed to increment session tokens', updateError, { sessionUuid });
    throw new Error(`Failed to increment session tokens: ${updateError.message}`);
  }

  logger.debug('Session tokens incremented', { sessionUuid, added: tokenCount, newTotal });
}

/**
 * Get or create a session by Claude Code session ID
 *
 * If a session with the given session_id exists, returns it.
 * Otherwise, creates a new session with the provided data.
 *
 * @param sessionId - Claude Code's session identifier (CLAUDE_SESSION_ID)
 * @param createData - Data for creating a new session if needed
 * @returns The session UUID (internal id)
 */
export async function getOrCreateSession(
  sessionId: string,
  createData: {
    user_id: string;
    team_id: string;
    project_id?: string;
    metadata?: Partial<SessionMetadata>;
  }
): Promise<string> {
  const supabase = createAdminClient();

  // Try to find existing session
  const { data: existing, error: fetchError } = await supabase
    .from('sessions')
    .select('id')
    .eq('session_id', sessionId)
    .single();

  if (existing && !fetchError) {
    // Update metadata if null (don't overwrite existing)
    if (createData.metadata) {
      await updateSessionMetadataIfNull(existing.id, createData.metadata);
    }
    return existing.id;
  }

  // Create new session
  const insertData: Record<string, unknown> = {
    session_id: sessionId,
    user_id: createData.user_id,
    team_id: createData.team_id,
    project_id: createData.project_id || null,
    started_at: new Date().toISOString(),
    total_prompts: 0,
    total_tokens: 0,
  };

  // Add metadata fields
  if (createData.metadata) {
    if (createData.metadata.cwd) {
      insertData.cwd = createData.metadata.cwd;
    }
    if (createData.metadata.git_branch) {
      insertData.git_branch = createData.metadata.git_branch;
    }
    if (createData.metadata.claude_code_version) {
      insertData.claude_code_version = createData.metadata.claude_code_version;
    }
    if (createData.metadata.slug) {
      insertData.slug = createData.metadata.slug;
    }
  }

  const { data: newSession, error: insertError } = await supabase
    .from('sessions')
    .insert(insertData)
    .select('id')
    .single();

  if (insertError) {
    // Race condition - session was created by another request
    if (insertError.code === '23505') {
      // Unique constraint violation
      const { data: raceSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      if (raceSession) {
        return raceSession.id;
      }
    }

    logger.error('Failed to create session', insertError, { sessionId });
    throw new Error(`Failed to create session: ${insertError.message}`);
  }

  logger.debug('Session created', { sessionId, uuid: newSession.id });
  return newSession.id;
}

// ============================================================================
// Story 21-1: Context Exhaustion Updates
// ============================================================================

/**
 * Update session to mark context exhaustion.
 *
 * This marks a session as context exhausted with the current timestamp.
 * Once marked, subsequent calls will not update the timestamp (first detection wins).
 *
 * @param sessionUuid - The internal UUID of the session
 * @throws Error if database update fails
 *
 * @example
 * await markContextExhausted('session-uuid');
 * // Sets context_exhausted = true and exhaustion_detected_at = now()
 */
export async function markContextExhausted(sessionUuid: string): Promise<void> {
  const supabase = createAdminClient();

  // Only update if not already marked (first detection wins)
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('context_exhausted')
    .eq('id', sessionUuid)
    .single();

  if (fetchError) {
    logger.error('Failed to fetch session for context exhaustion', fetchError, { sessionUuid });
    throw new Error(`Failed to fetch session: ${fetchError.message}`);
  }

  // Already marked - don't update timestamp
  if (session?.context_exhausted) {
    logger.debug('Session already marked as context exhausted', { sessionUuid });
    return;
  }

  const { error: updateError } = await supabase
    .from('sessions')
    .update({
      context_exhausted: true,
      exhaustion_detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionUuid);

  if (updateError) {
    logger.error('Failed to mark session as context exhausted', updateError, { sessionUuid });
    throw new Error(`Failed to mark context exhaustion: ${updateError.message}`);
  }

  logger.log('Session marked as context exhausted', { sessionUuid });
}

/**
 * Update the context usage estimate for a session.
 *
 * @param sessionUuid - The internal UUID of the session
 * @param usageEstimate - Estimated context usage (0.00 to 1.00)
 * @throws Error if value is out of range or database update fails
 */
export async function updateContextUsageEstimate(
  sessionUuid: string,
  usageEstimate: number
): Promise<void> {
  // Validate range
  if (usageEstimate < 0 || usageEstimate > 1) {
    throw new Error(`Context usage estimate must be between 0 and 1, got ${usageEstimate}`);
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('sessions')
    .update({
      context_usage_estimate: usageEstimate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionUuid);

  if (error) {
    logger.error('Failed to update context usage estimate', error, { sessionUuid, usageEstimate });
    throw new Error(`Failed to update context usage estimate: ${error.message}`);
  }

  logger.debug('Context usage estimate updated', { sessionUuid, usageEstimate });
}

/**
 * Get the session duration in minutes from started_at to now.
 *
 * @param sessionUuid - The internal UUID of the session
 * @returns Duration in minutes, or 0 if session not found
 */
export async function getSessionDurationMinutes(sessionUuid: string): Promise<number> {
  const supabase = createAdminClient();

  const { data: session, error } = await supabase
    .from('sessions')
    .select('started_at')
    .eq('id', sessionUuid)
    .single();

  if (error || !session) {
    logger.debug('Could not get session duration', { sessionUuid, error: error?.message });
    return 0;
  }

  const startedAt = new Date(session.started_at);
  const now = new Date();
  const durationMs = now.getTime() - startedAt.getTime();
  const durationMinutes = Math.floor(durationMs / (1000 * 60));

  return durationMinutes;
}
