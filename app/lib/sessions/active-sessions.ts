/**
 * Active Sessions Service - Story 16-5: Multi-Terminal Awareness
 *
 * Functions to query and track active Claude Code sessions,
 * enabling multi-terminal awareness and concurrent session management.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/utils/uuid";
import { createScopedLogger } from "@/lib/utils/logger";

const logger = createScopedLogger("ACTIVE_SESSIONS");

/**
 * Type guard and extractor for project relation from Supabase query.
 * Handles null, single object, or array results.
 */
function extractProjectName(projects: unknown): string | null {
  if (!projects) {
    return null;
  }
  if (Array.isArray(projects)) {
    const first = projects[0] as { name?: string } | undefined;
    return first?.name ?? null;
  }
  if (typeof projects === 'object' && 'name' in projects) {
    return (projects as { name: string }).name;
  }
  return null;
}

/**
 * An active session with context and statistics.
 * Used for displaying multiple concurrent terminals.
 */
export interface ActiveSession {
  /** Database UUID of the session */
  id: string;
  /** Claude Code session identifier (session_<uuid>) */
  session_id: string;
  /** When the session started */
  started_at: string;
  /** Current working directory (sanitized) */
  cwd: string | null;
  /** Git branch active during session */
  git_branch: string | null;
  /** Associated project database ID */
  project_id: string | null;
  /** Associated project name */
  project_name: string | null;
  /** Total prompts in this session */
  total_prompts: number;
  /** Last activity timestamp (last prompt or session update) */
  last_activity: string;
  /** Human-readable session slug/name */
  slug: string | null;
}

/**
 * Options for querying user sessions.
 */
export interface GetUserSessionsOptions {
  /** Filter by start date (inclusive) */
  startDate?: Date;
  /** Filter by end date (inclusive) */
  endDate?: Date;
  /** Filter by project */
  projectId?: string;
  /** Only return active (not ended) sessions */
  activeOnly?: boolean;
  /** Maximum number of sessions to return (default: 50) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
}

/**
 * Result of getUserSessions query with pagination info.
 */
export interface GetUserSessionsResult {
  /** Sessions matching the query */
  sessions: ActiveSession[];
  /** Total count of matching sessions (for pagination) */
  total: number;
}

/**
 * Get all active (not ended) sessions for a user.
 *
 * Active sessions are those where ended_at IS NULL, indicating the session
 * is still in progress. Useful for showing concurrent terminals.
 *
 * @param userId - The user's database UUID
 * @returns List of active sessions with context and stats
 *
 * @example
 * const activeSessions = await getActiveSessions(userId);
 * if (activeSessions.length > 1) {
 *   console.log('Multiple terminals detected!');
 * }
 */
export async function getActiveSessions(userId: string): Promise<ActiveSession[]> {
  if (!isValidUuid(userId)) {
    throw new Error(`Invalid user ID: ${userId}`);
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("sessions")
    .select(
      `
      id,
      session_id,
      started_at,
      cwd,
      git_branch,
      project_id,
      total_prompts,
      updated_at,
      slug,
      projects (
        id,
        name
      )
    `
    )
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false });

  if (error) {
    logger.error("Failed to fetch active sessions", error, { userId });
    throw new Error(`Failed to fetch active sessions: ${error.message}`);
  }

  const sessions: ActiveSession[] = (data || []).map((session) => ({
    id: session.id,
    session_id: session.session_id,
    started_at: session.started_at,
    cwd: session.cwd,
    git_branch: session.git_branch,
    project_id: session.project_id,
    project_name: extractProjectName(session.projects),
    total_prompts: session.total_prompts ?? 0,
    last_activity: session.updated_at,
    slug: session.slug,
  }));

  logger.debug("Fetched active sessions", {
    userId,
    count: sessions.length,
  });

  return sessions;
}

/**
 * Get sessions for a user with filtering and pagination.
 *
 * Supports filtering by date range, project, and active status.
 * Returns total count for pagination.
 *
 * @param userId - The user's database UUID
 * @param options - Query options (filters, pagination)
 * @returns Sessions and total count
 *
 * @example
 * const { sessions, total } = await getUserSessions(userId, {
 *   activeOnly: true,
 *   projectId: 'proj-uuid',
 *   limit: 20,
 *   offset: 0
 * });
 */
export async function getUserSessions(
  userId: string,
  options: GetUserSessionsOptions = {}
): Promise<GetUserSessionsResult> {
  if (!isValidUuid(userId)) {
    throw new Error(`Invalid user ID: ${userId}`);
  }

  if (options.projectId !== undefined && !isValidUuid(options.projectId)) {
    throw new Error(`Invalid project ID: ${options.projectId}`);
  }

  const {
    startDate,
    endDate,
    projectId,
    activeOnly = false,
    limit = 50,
    offset = 0,
  } = options;

  const supabase = createAdminClient();

  // Build base query
  let query = supabase
    .from("sessions")
    .select(
      `
      id,
      session_id,
      started_at,
      cwd,
      git_branch,
      project_id,
      total_prompts,
      updated_at,
      slug,
      projects (
        id,
        name
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", userId);

  // Apply filters
  if (activeOnly) {
    query = query.is("ended_at", null);
  }

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  if (startDate) {
    query = query.gte("started_at", startDate.toISOString());
  }

  if (endDate) {
    query = query.lte("started_at", endDate.toISOString());
  }

  // Apply pagination and ordering
  query = query
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    logger.error("Failed to fetch user sessions", error, {
      userId,
      options,
    });
    throw new Error(`Failed to fetch user sessions: ${error.message}`);
  }

  const sessions: ActiveSession[] = (data || []).map((session) => ({
    id: session.id,
    session_id: session.session_id,
    started_at: session.started_at,
    cwd: session.cwd,
    git_branch: session.git_branch,
    project_id: session.project_id,
    project_name: extractProjectName(session.projects),
    total_prompts: session.total_prompts ?? 0,
    last_activity: session.updated_at,
    slug: session.slug,
  }));

  logger.debug("Fetched user sessions", {
    userId,
    count: sessions.length,
    total: count,
  });

  return {
    sessions,
    total: count ?? 0,
  };
}

/**
 * Get active sessions for a team.
 *
 * Useful for team dashboards showing concurrent work across team members.
 *
 * @param teamId - The team's database UUID
 * @returns List of active sessions with user info
 */
export async function getTeamActiveSessions(teamId: string): Promise<
  (ActiveSession & { user_id: string })[]
> {
  if (!isValidUuid(teamId)) {
    throw new Error(`Invalid team ID: ${teamId}`);
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("sessions")
    .select(
      `
      id,
      session_id,
      started_at,
      cwd,
      git_branch,
      project_id,
      total_prompts,
      updated_at,
      slug,
      user_id,
      projects (
        id,
        name
      )
    `
    )
    .eq("team_id", teamId)
    .is("ended_at", null)
    .order("started_at", { ascending: false });

  if (error) {
    logger.error("Failed to fetch team active sessions", error, { teamId });
    throw new Error(`Failed to fetch team active sessions: ${error.message}`);
  }

  return (data || []).map((session) => ({
    id: session.id,
    session_id: session.session_id,
    started_at: session.started_at,
    cwd: session.cwd,
    git_branch: session.git_branch,
    project_id: session.project_id,
    project_name: extractProjectName(session.projects),
    total_prompts: session.total_prompts ?? 0,
    last_activity: session.updated_at,
    slug: session.slug,
    user_id: session.user_id,
  }));
}

/**
 * Count active sessions for a user.
 *
 * Quick check for multi-terminal awareness without full session data.
 *
 * @param userId - The user's database UUID
 * @returns Number of currently active sessions
 */
export async function countActiveSessions(userId: string): Promise<number> {
  if (!isValidUuid(userId)) {
    throw new Error(`Invalid user ID: ${userId}`);
  }

  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("ended_at", null);

  if (error) {
    logger.error("Failed to count active sessions", error, { userId });
    throw new Error(`Failed to count active sessions: ${error.message}`);
  }

  return count ?? 0;
}
