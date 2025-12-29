/**
 * Session Upsert for Response Capture
 * Story 25-1: Response Capture Endpoint
 *
 * Handles session creation/lookup specifically for the response capture flow.
 * This differs from the prompt capture flow because:
 * 1. Response may arrive before prompt (edge case)
 * 2. Response endpoint doesn't receive user_id in the payload
 * 3. Must handle sessions without user_id gracefully
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidSessionId } from "./session-detection";

const logger = createScopedLogger("SESSION-UPSERT");

/**
 * Result from upserting a session for response capture.
 */
export interface UpsertSessionResult {
  /** The database UUID of the session */
  id: string;
  /** Whether this was a newly created session */
  isNew: boolean;
  /** The user_id from the session (if available) */
  userId: string | null;
}

/**
 * Session data when creating a new session from response capture.
 */
export interface ResponseSessionCreate {
  sessionId: string;
  projectId: string;
  teamId: string;
}

/**
 * Upserts a session for response capture.
 *
 * This function is used by the response capture endpoint to ensure a session
 * exists before storing the response. Unlike prompt capture, we may not have
 * a user_id available.
 *
 * Flow:
 * 1. Check if session exists by session_id
 * 2. If exists, return it with its user_id
 * 3. If not exists, create minimal session (will be populated when prompt arrives)
 *
 * @param data - Session creation data
 * @returns The session UUID and whether it was created
 * @throws Error if session_id is invalid or database operation fails
 */
export async function upsertSessionForResponse(
  data: ResponseSessionCreate
): Promise<UpsertSessionResult> {
  const { sessionId, projectId, teamId } = data;

  // Validate session ID format
  if (!isValidSessionId(sessionId)) {
    throw new Error(`Invalid session ID format: ${sessionId}`);
  }

  const supabase = createAdminClient();

  // First, try to find existing session (most common case - prompt arrived first)
  const { data: existingSession, error: findError } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("session_id", sessionId)
    .single();

  if (existingSession && !findError) {
    logger.debug("Found existing session for response", {
      sessionId,
      dbId: existingSession.id,
      hasUserId: !!existingSession.user_id,
    });
    return {
      id: existingSession.id,
      isNew: false,
      userId: existingSession.user_id,
    };
  }

  // Session doesn't exist - create it
  // This is an edge case where response arrives before prompt
  // We create a minimal session that will be populated when prompt arrives
  logger.log("Creating session from response (no prompt yet)", {
    sessionId,
    projectId,
    teamId,
  });

  // Try to get a default user for the team (first admin or member)
  const { data: teamMember } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("role", "admin")
    .limit(1)
    .single();

  const defaultUserId = teamMember?.user_id || null;

  const insertData: Record<string, unknown> = {
    session_id: sessionId,
    project_id: projectId,
    team_id: teamId,
    started_at: new Date().toISOString(),
    total_prompts: 0,
    total_tokens: 0,
  };

  // Only set user_id if we found a default
  if (defaultUserId) {
    insertData.user_id = defaultUserId;
  }

  const { data: newSession, error: insertError } = await supabase
    .from("sessions")
    .upsert(insertData, {
      onConflict: "session_id",
      ignoreDuplicates: false,
    })
    .select("id, user_id")
    .single();

  if (insertError) {
    logger.error("Failed to create session for response", insertError, {
      sessionId,
      projectId,
      teamId,
    });
    throw new Error(`Failed to create session: ${insertError.message}`);
  }

  logger.log("Session created from response capture", {
    sessionId,
    dbId: newSession.id,
    userId: newSession.user_id,
  });

  return {
    id: newSession.id,
    isNew: true,
    userId: newSession.user_id,
  };
}
