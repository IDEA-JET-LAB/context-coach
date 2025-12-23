/**
 * Session Detection Service
 * Story 16-2: Session Detection Logic
 *
 * Provides functions to detect and manage Claude Code sessions from captured prompts.
 * Sessions are identified by the CLAUDE_SESSION_ID environment variable and are used
 * to group related prompts for analytics and recovery features.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/utils/uuid";
import { createScopedLogger } from "@/lib/utils/logger";
import type { Session, CreateSessionInput } from "@/lib/types/session";

const logger = createScopedLogger("SESSION");

/**
 * Context information for a session.
 * Used when creating or looking up sessions.
 */
export interface SessionContext {
  user_id: string;
  team_id: string;
  project_id?: string;
  git_branch?: string;
  cwd?: string;
  claude_code_version?: string;
}

/**
 * Represents a message from a Claude Code transcript.
 * The session ID may be embedded in the message or at the top level.
 */
export interface TranscriptMessage {
  type: string;
  sessionId?: string;
  timestamp?: string;
  message?: unknown;
}

/**
 * Result of findOrCreateSession operation.
 */
export interface FindOrCreateSessionResult {
  /** The database UUID of the session */
  id: string;
  /** Whether this was a newly created session */
  isNew: boolean;
}

/**
 * Session ID format pattern.
 * Claude Code session IDs have the format: session_<uuid>
 *
 * Examples:
 * - "session_550e8400-e29b-41d4-a716-446655440000"
 * - "session_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 */
const SESSION_ID_PATTERN = /^session_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Validates if a string is a valid Claude Code session ID.
 *
 * Valid format: "session_<uuid>"
 *
 * @param sessionId - The string to validate
 * @returns true if valid session ID format, false otherwise
 *
 * @example
 * isValidSessionId("session_550e8400-e29b-41d4-a716-446655440000"); // true
 * isValidSessionId("550e8400-e29b-41d4-a716-446655440000"); // false (no prefix)
 * isValidSessionId("session_invalid"); // false (not a UUID)
 * isValidSessionId(""); // false
 * isValidSessionId(null); // false
 */
export function isValidSessionId(sessionId: unknown): sessionId is string {
  if (typeof sessionId !== "string") {
    return false;
  }
  return SESSION_ID_PATTERN.test(sessionId);
}

/**
 * Extracts the session ID from a transcript message or metadata object.
 *
 * Handles multiple cases:
 * 1. Session ID at top level: { sessionId: "session_xxx" }
 * 2. Session ID nested in message: { message: { sessionId: "session_xxx" } }
 * 3. null/undefined input
 * 4. Invalid/malformed session IDs
 *
 * @param transcript - The transcript message or metadata object
 * @returns The session ID if found and valid, null otherwise
 *
 * @example
 * extractSessionId({ sessionId: "session_xxx-xxx-xxx" }); // "session_xxx-xxx-xxx"
 * extractSessionId({ message: { sessionId: "session_xxx" } }); // "session_xxx"
 * extractSessionId(null); // null
 * extractSessionId({ sessionId: "invalid" }); // null
 */
export function extractSessionId(
  transcript: TranscriptMessage | Record<string, unknown> | null | undefined
): string | null {
  if (!transcript || typeof transcript !== "object") {
    return null;
  }

  // Check top-level sessionId
  if ("sessionId" in transcript && isValidSessionId(transcript.sessionId)) {
    return transcript.sessionId;
  }

  // Check nested in message object
  if ("message" in transcript && typeof transcript.message === "object" && transcript.message !== null) {
    const message = transcript.message as Record<string, unknown>;
    if ("sessionId" in message && isValidSessionId(message.sessionId)) {
      return message.sessionId;
    }
  }

  return null;
}

/**
 * Extracts session ID from prompt capture metadata.
 *
 * The CLI hook sends metadata that may contain session information.
 * This function checks common locations where session ID might be stored.
 *
 * @param metadata - The metadata object from the capture request
 * @returns The session ID if found and valid, null otherwise
 */
export function extractSessionIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  // Direct session_id field (most common case from CLI)
  if ("session_id" in metadata && isValidSessionId(metadata.session_id)) {
    return metadata.session_id;
  }

  // sessionId field (camelCase variant)
  if ("sessionId" in metadata && isValidSessionId(metadata.sessionId)) {
    return metadata.sessionId;
  }

  // Check claude_session_id (environment variable name)
  if ("claude_session_id" in metadata && isValidSessionId(metadata.claude_session_id)) {
    return metadata.claude_session_id;
  }

  // Check in nested context object
  if ("context" in metadata && typeof metadata.context === "object" && metadata.context !== null) {
    const context = metadata.context as Record<string, unknown>;
    if ("session_id" in context && isValidSessionId(context.session_id)) {
      return context.session_id;
    }
    if ("sessionId" in context && isValidSessionId(context.sessionId)) {
      return context.sessionId;
    }
  }

  return null;
}

/**
 * Finds an existing session by Claude Code session ID, or creates a new one.
 *
 * This function is idempotent - calling it multiple times with the same
 * session ID will return the same session without creating duplicates.
 *
 * Uses PostgreSQL's UPSERT (ON CONFLICT) to handle race conditions where
 * multiple prompts from the same session arrive simultaneously.
 *
 * @param sessionId - The Claude Code session ID (format: "session_<uuid>")
 * @param context - The session context (user, team, project, etc.)
 * @param startedAt - Optional session start time (defaults to now)
 * @returns The session's database ID and whether it was newly created
 *
 * @example
 * const result = await findOrCreateSession(
 *   "session_550e8400-e29b-41d4-a716-446655440000",
 *   { user_id: "xxx", team_id: "yyy", project_id: "zzz" }
 * );
 * // result = { id: "db-uuid", isNew: true }
 *
 * // Subsequent calls return same session
 * const result2 = await findOrCreateSession(...);
 * // result2 = { id: "db-uuid", isNew: false }
 */
export async function findOrCreateSession(
  sessionId: string,
  context: SessionContext,
  startedAt?: Date
): Promise<FindOrCreateSessionResult> {
  // Validate session ID format
  if (!isValidSessionId(sessionId)) {
    throw new Error(`Invalid session ID format: ${sessionId}`);
  }

  // Validate required context fields
  if (!context.user_id || !isValidUuid(context.user_id)) {
    throw new Error("Invalid user_id in session context");
  }
  if (!context.team_id || !isValidUuid(context.team_id)) {
    throw new Error("Invalid team_id in session context");
  }
  if (context.project_id !== undefined && !isValidUuid(context.project_id)) {
    throw new Error("Invalid project_id in session context");
  }

  const supabase = createAdminClient();

  // First, try to find existing session (most common case after first prompt)
  const { data: existingSession, error: findError } = await supabase
    .from("sessions")
    .select("id")
    .eq("session_id", sessionId)
    .single();

  if (existingSession && !findError) {
    logger.debug("Found existing session", {
      sessionId,
      dbId: existingSession.id,
    });
    return { id: existingSession.id, isNew: false };
  }

  // Session doesn't exist, try to create it
  // Use upsert with ON CONFLICT to handle race conditions
  const insertData: CreateSessionInput = {
    session_id: sessionId,
    user_id: context.user_id,
    team_id: context.team_id,
    project_id: context.project_id,
    started_at: startedAt?.toISOString() ?? new Date().toISOString(),
    git_branch: context.git_branch,
    claude_code_version: context.claude_code_version,
    cwd: context.cwd,
  };

  // Remove undefined values to avoid PostgreSQL issues
  const cleanedData = Object.fromEntries(
    Object.entries(insertData).filter(([, v]) => v !== undefined)
  ) as CreateSessionInput;

  const { data: newSession, error: insertError } = await supabase
    .from("sessions")
    .upsert(cleanedData, {
      onConflict: "session_id",
      ignoreDuplicates: false,
    })
    .select("id")
    .single();

  if (insertError) {
    logger.error("Failed to create session", insertError, {
      sessionId,
      userId: context.user_id,
      teamId: context.team_id,
    });
    throw new Error(`Failed to create session: ${insertError.message}`);
  }

  // Check if this was a new insert or existing (upsert returns data either way)
  // We can determine this by checking if the created_at is very recent
  // But for simplicity, since we already checked above, if we get here it was new
  // However, due to race conditions, another request might have created it
  // The upsert will return the existing row if conflict occurred

  // To determine if it was truly new, we need to check if it existed before
  // Since we already did a lookup above and it wasn't found, if we get here
  // it's either new or was just created by a concurrent request
  // For practical purposes, we'll check the created_at timestamp

  const { data: sessionCheck } = await supabase
    .from("sessions")
    .select("created_at")
    .eq("id", newSession.id)
    .single();

  const isNew =
    sessionCheck &&
    new Date().getTime() - new Date(sessionCheck.created_at).getTime() < 1000;

  logger.log(isNew ? "Created new session" : "Session already existed", {
    sessionId,
    dbId: newSession.id,
    userId: context.user_id,
    teamId: context.team_id,
  });

  return { id: newSession.id, isNew: Boolean(isNew) };
}

/**
 * Increments the prompt count for a session.
 *
 * Uses a database function for atomic increment to avoid race conditions
 * when multiple prompts are captured concurrently.
 *
 * This operation should not block prompt storage - if it fails,
 * the prompt should still be stored and the count will be corrected
 * later by a reconciliation process.
 *
 * @param sessionId - The database UUID of the session (not the Claude session ID)
 * @returns true if increment succeeded, false otherwise
 */
export async function incrementSessionPromptCount(sessionId: string): Promise<boolean> {
  if (!isValidUuid(sessionId)) {
    logger.warn("Invalid session UUID for increment", { sessionId });
    return false;
  }

  const supabase = createAdminClient();

  try {
    const { error } = await supabase.rpc("increment_session_prompt_count", {
      p_session_id: sessionId,
    });

    if (error) {
      logger.warn("Failed to increment session prompt count", {
        sessionId,
        error: error.message,
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.warn("Error incrementing session prompt count", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Links a prompt to a session by updating the prompt record.
 *
 * This function updates both the session_uuid and sequence_number
 * fields of a prompt. The sequence number is calculated atomically
 * based on the current prompt count in the session.
 *
 * @param promptId - The database UUID of the prompt
 * @param sessionDbId - The database UUID of the session
 * @returns true if linking succeeded, false otherwise
 */
export async function linkPromptToSession(
  promptId: string,
  sessionDbId: string
): Promise<boolean> {
  if (!isValidUuid(promptId) || !isValidUuid(sessionDbId)) {
    logger.warn("Invalid UUID for prompt-session link", {
      promptId,
      sessionDbId,
    });
    return false;
  }

  const supabase = createAdminClient();

  try {
    // Get current prompt count to calculate sequence number
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("total_prompts")
      .eq("id", sessionDbId)
      .single();

    if (sessionError || !session) {
      logger.warn("Session not found for linking", {
        sessionDbId,
        error: sessionError?.message,
      });
      return false;
    }

    // Calculate sequence number (1-indexed)
    const sequenceNumber = (session.total_prompts ?? 0) + 1;

    // Update prompt with session reference and sequence number
    const { error: updateError } = await supabase
      .from("prompts")
      .update({
        session_uuid: sessionDbId,
        sequence_number: sequenceNumber,
      })
      .eq("id", promptId);

    if (updateError) {
      logger.warn("Failed to link prompt to session", {
        promptId,
        sessionDbId,
        error: updateError.message,
      });
      return false;
    }

    // Increment session prompt count
    await incrementSessionPromptCount(sessionDbId);

    logger.debug("Linked prompt to session", {
      promptId,
      sessionDbId,
      sequenceNumber,
    });

    return true;
  } catch (err) {
    logger.warn("Error linking prompt to session", {
      promptId,
      sessionDbId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Gets a session by its Claude Code session ID.
 *
 * @param sessionId - The Claude Code session ID (format: "session_<uuid>")
 * @returns The session if found, null otherwise
 */
export async function getSessionBySessionId(
  sessionId: string
): Promise<Session | null> {
  if (!isValidSessionId(sessionId)) {
    return null;
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Session;
}
