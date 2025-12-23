/**
 * Session Context Resolver
 * Story 16-2: Session Detection Logic
 *
 * Resolves the complete session context from partial information.
 * This is used when creating sessions from prompt capture requests
 * where we may only have a project_id or user_id.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/utils/uuid";
import { createScopedLogger } from "@/lib/utils/logger";
import type { SessionContext } from "./session-detection";

const logger = createScopedLogger("SESSION_CONTEXT");

/**
 * Input for resolving session context.
 */
export interface ResolveContextInput {
  /** The project ID (if known from API key) */
  project_id?: string;
  /** The user ID (from capture request) */
  user_id: string;
  /** Additional metadata from the capture request */
  metadata?: {
    git_branch?: string;
    cwd?: string;
    claude_code_version?: string;
    [key: string]: unknown;
  };
}

/**
 * Error thrown when session context cannot be resolved.
 */
export class SessionContextError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "SessionContextError";
  }
}

/**
 * Resolves the complete session context from partial input.
 *
 * Resolution strategy:
 * 1. If project_id is provided, look up team_id from the project
 * 2. If no project_id, look up user's default team
 * 3. Extract additional context from metadata (git_branch, cwd, etc.)
 *
 * @param input - The partial context information
 * @returns The complete session context
 * @throws SessionContextError if context cannot be resolved
 *
 * @example
 * // With project_id (from validated API key)
 * const context = await resolveSessionContext({
 *   project_id: "project-uuid",
 *   user_id: "user-uuid",
 *   metadata: { git_branch: "main" }
 * });
 * // context = { user_id, team_id, project_id, git_branch: "main" }
 *
 * @example
 * // Without project_id (fallback to user's default team)
 * const context = await resolveSessionContext({
 *   user_id: "user-uuid"
 * });
 * // context = { user_id, team_id } // team_id from user's first team
 */
export async function resolveSessionContext(
  input: ResolveContextInput
): Promise<SessionContext> {
  // Validate user_id is a valid UUID
  if (!input.user_id || !isValidUuid(input.user_id)) {
    throw new SessionContextError(
      "Invalid or missing user_id",
      "INVALID_USER_ID"
    );
  }

  const supabase = createAdminClient();
  let team_id: string;
  let project_id: string | undefined = input.project_id;

  // If project_id is provided, get team_id from the project
  if (input.project_id) {
    if (!isValidUuid(input.project_id)) {
      throw new SessionContextError(
        "Invalid project_id format",
        "INVALID_PROJECT_ID"
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("team_id")
      .eq("id", input.project_id)
      .single();

    if (projectError || !project) {
      logger.warn("Project not found for context resolution", {
        projectId: input.project_id,
        error: projectError?.message,
      });
      throw new SessionContextError(
        "Project not found",
        "PROJECT_NOT_FOUND"
      );
    }

    team_id = project.team_id;
  } else {
    // No project_id, resolve team from user's memberships
    // Get the user's first team (or primary team if marked)
    const { data: teamMembership, error: teamError } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", input.user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (teamError || !teamMembership) {
      logger.warn("No team found for user", {
        userId: input.user_id,
        error: teamError?.message,
      });
      throw new SessionContextError(
        "User has no team membership",
        "NO_TEAM_MEMBERSHIP"
      );
    }

    team_id = teamMembership.team_id;
    project_id = undefined; // Explicitly unset since we don't know the project
  }

  // Build the session context
  const context: SessionContext = {
    user_id: input.user_id,
    team_id,
    project_id,
  };

  // Extract additional context from metadata
  if (input.metadata) {
    if (typeof input.metadata.git_branch === "string" && input.metadata.git_branch.trim()) {
      context.git_branch = input.metadata.git_branch.trim();
    }
    if (typeof input.metadata.cwd === "string" && input.metadata.cwd.trim()) {
      context.cwd = input.metadata.cwd.trim();
    }
    if (typeof input.metadata.claude_code_version === "string" && input.metadata.claude_code_version.trim()) {
      context.claude_code_version = input.metadata.claude_code_version.trim();
    }
  }

  logger.debug("Resolved session context", {
    userId: context.user_id,
    teamId: context.team_id,
    projectId: context.project_id ?? "none",
    hasGitBranch: !!context.git_branch,
    hasCwd: !!context.cwd,
  });

  return context;
}

/**
 * Resolves session context from a validated API key result.
 *
 * This is a convenience wrapper for the common case where we have
 * a validated API key with team_id and project_id already known.
 *
 * @param keyResult - The result from validateApiKey
 * @param userId - The user ID from the capture request
 * @param metadata - Additional metadata from the capture request
 * @returns The session context
 */
export function buildSessionContextFromKeyResult(
  keyResult: { team_id: string; project_id: string },
  userId: string,
  metadata?: Record<string, unknown>
): SessionContext {
  const context: SessionContext = {
    user_id: userId,
    team_id: keyResult.team_id,
    project_id: keyResult.project_id,
  };

  // Extract additional context from metadata
  if (metadata) {
    if (typeof metadata.git_branch === "string" && metadata.git_branch.trim()) {
      context.git_branch = metadata.git_branch.trim();
    }
    if (typeof metadata.cwd === "string" && metadata.cwd.trim()) {
      context.cwd = metadata.cwd.trim();
    }
    if (typeof metadata.claude_code_version === "string" && metadata.claude_code_version.trim()) {
      context.claude_code_version = metadata.claude_code_version.trim();
    }
  }

  return context;
}
