/**
 * Thread Query - Story 16-4: Conversation Threading
 *
 * Query functions for fetching session prompts as threaded conversations.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidUuid } from "@/lib/utils/uuid";
import {
  buildConversationTree,
  type ConversationTree,
  type PromptRow,
} from "./conversation-tree";

const logger = createScopedLogger("THREAD_QUERY");

/**
 * Error thrown when session is not found
 */
export class SessionNotFoundError extends Error {
  constructor(sessionUuid: string) {
    super(`Session not found: ${sessionUuid}`);
    this.name = "SessionNotFoundError";
  }
}

/**
 * Error thrown when access is denied
 */
export class AccessDeniedError extends Error {
  constructor(message: string = "Access denied") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/**
 * Linear prompt for simple display
 */
export interface LinearPrompt {
  id: string;
  text: string;
  sequence_number: number;
  created_at: string;
}

/**
 * Linear thread result
 */
export interface LinearThread {
  prompts: LinearPrompt[];
  totalPrompts: number;
}

/**
 * Get session prompts as a threaded conversation tree.
 *
 * Returns a hierarchical structure with parent-child relationships
 * or a linear list if no threading information is available.
 *
 * @param sessionUuid - The session's database UUID
 * @returns Conversation tree structure
 * @throws SessionNotFoundError if session doesn't exist
 *
 * @example
 * try {
 *   const tree = await getSessionThread(sessionId);
 *   if (tree.type === 'threaded') {
 *     renderThreadedView(tree.roots);
 *   } else {
 *     renderLinearView(tree.roots);
 *   }
 * } catch (err) {
 *   if (err instanceof SessionNotFoundError) {
 *     return notFound();
 *   }
 *   throw err;
 * }
 */
export async function getSessionThread(
  sessionUuid: string
): Promise<ConversationTree> {
  if (!isValidUuid(sessionUuid)) {
    throw new Error(`Invalid session UUID: ${sessionUuid}`);
  }

  const supabase = createAdminClient();

  // Verify session exists
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, team_id")
    .eq("id", sessionUuid)
    .single();

  if (sessionError || !session) {
    logger.warn("Session not found", {
      sessionUuid,
      error: sessionError?.message,
    });
    throw new SessionNotFoundError(sessionUuid);
  }

  // Fetch prompts with analysis data
  const { data: prompts, error: promptsError } = await supabase
    .from("prompts")
    .select(
      `
      id,
      text,
      sequence_number,
      parent_prompt_id,
      created_at,
      prompt_analyses (
        overall_score,
        dimension_scores
      )
    `
    )
    .eq("session_uuid", sessionUuid)
    .order("sequence_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (promptsError) {
    logger.error("Failed to fetch session prompts", promptsError, {
      sessionUuid,
    });
    throw new Error(`Failed to fetch session prompts: ${promptsError.message}`);
  }

  if (!prompts || prompts.length === 0) {
    logger.debug("Session has no prompts", { sessionUuid });
    return {
      roots: [],
      type: "linear",
      totalPrompts: 0,
      maxDepth: 0,
    };
  }

  // Transform to PromptRow format
  const promptRows: PromptRow[] = prompts.map((p) => ({
    id: p.id,
    text: p.text,
    sequence_number: p.sequence_number,
    parent_prompt_id: p.parent_prompt_id,
    created_at: p.created_at,
    analysis: p.prompt_analyses?.[0]
      ? {
          overall_score: p.prompt_analyses[0].overall_score,
          dimension_scores: p.prompt_analyses[0].dimension_scores as Record<
            string,
            number
          >,
        }
      : null,
  }));

  const tree = buildConversationTree(promptRows);

  logger.debug("Session thread built", {
    sessionUuid,
    type: tree.type,
    totalPrompts: tree.totalPrompts,
    maxDepth: tree.maxDepth,
  });

  return tree;
}

/**
 * Get session prompts as a simple linear list.
 *
 * Use this when you just need prompts in order without tree structure.
 * More efficient than getSessionThread when threading isn't needed.
 *
 * @param sessionUuid - The session's database UUID
 * @returns Linear list of prompts
 * @throws SessionNotFoundError if session doesn't exist
 *
 * @example
 * const { prompts, totalPrompts } = await getSessionLinearThread(sessionId);
 * prompts.forEach(p => console.log(`${p.sequence_number}: ${p.text}`));
 */
export async function getSessionLinearThread(
  sessionUuid: string
): Promise<LinearThread> {
  if (!isValidUuid(sessionUuid)) {
    throw new Error(`Invalid session UUID: ${sessionUuid}`);
  }

  const supabase = createAdminClient();

  // Verify session exists
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionUuid)
    .single();

  if (sessionError || !session) {
    throw new SessionNotFoundError(sessionUuid);
  }

  // Fetch prompts in order
  const { data: prompts, error: promptsError } = await supabase
    .from("prompts")
    .select("id, text, sequence_number, created_at")
    .eq("session_uuid", sessionUuid)
    .order("sequence_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (promptsError) {
    throw new Error(`Failed to fetch session prompts: ${promptsError.message}`);
  }

  const linearPrompts: LinearPrompt[] = (prompts || []).map((p) => ({
    id: p.id,
    text: p.text,
    sequence_number: p.sequence_number ?? 0,
    created_at: p.created_at,
  }));

  return {
    prompts: linearPrompts,
    totalPrompts: linearPrompts.length,
  };
}

/**
 * Verify user has access to a session through team membership.
 *
 * @param sessionUuid - The session's database UUID
 * @param userId - The user's ID to check
 * @returns true if user has access
 * @throws SessionNotFoundError if session doesn't exist
 * @throws AccessDeniedError if user doesn't have access
 *
 * @example
 * // In API route
 * const user = await getAuthenticatedUser();
 * await verifySessionAccess(sessionId, user.id);
 * // If we get here, user has access
 */
export async function verifySessionAccess(
  sessionUuid: string,
  userId: string
): Promise<boolean> {
  if (!isValidUuid(sessionUuid)) {
    throw new Error(`Invalid session UUID: ${sessionUuid}`);
  }

  if (!isValidUuid(userId)) {
    throw new Error(`Invalid user ID: ${userId}`);
  }

  const supabase = createAdminClient();

  // Get session with team
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, team_id")
    .eq("id", sessionUuid)
    .single();

  if (sessionError || !session) {
    throw new SessionNotFoundError(sessionUuid);
  }

  // Check team membership
  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", session.team_id)
    .eq("user_id", userId)
    .single();

  if (membershipError || !membership) {
    throw new AccessDeniedError(
      "You are not a member of the team that owns this session"
    );
  }

  return true;
}

/**
 * Get the team ID for a session.
 *
 * Useful for authorization checks.
 *
 * @param sessionUuid - The session's database UUID
 * @returns The team ID
 * @throws SessionNotFoundError if session doesn't exist
 */
export async function getSessionTeamId(sessionUuid: string): Promise<string> {
  if (!isValidUuid(sessionUuid)) {
    throw new Error(`Invalid session UUID: ${sessionUuid}`);
  }

  const supabase = createAdminClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("team_id")
    .eq("id", sessionUuid)
    .single();

  if (error || !session) {
    throw new SessionNotFoundError(sessionUuid);
  }

  return session.team_id;
}
