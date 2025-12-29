/**
 * Get Conversations Service - Story 25-2: Conversations List Endpoint
 *
 * Database query function for fetching paginated conversation (session) lists.
 */

import { createClient } from '@/lib/supabase/server';
import { ConversationsQuery } from '@/lib/validations/conversations-query';
import {
  ConversationSummary,
  ProjectStage,
  StageBreakdown,
} from '@/lib/types/conversations';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('CONVERSATIONS');

/**
 * Result type for getConversations function.
 */
export interface ConversationsResult {
  conversations: ConversationSummary[];
  total: number;
}

/**
 * Type guard to extract project name from Supabase relation result.
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
 * Type guard to extract user name from Supabase relation result.
 * Handles null, single object, or array results.
 */
function extractUserName(users: unknown): string | undefined {
  if (!users) {
    return undefined;
  }
  if (Array.isArray(users)) {
    const first = users[0] as { name?: string | null } | undefined;
    return first?.name ?? undefined;
  }
  if (typeof users === 'object' && 'name' in users) {
    const name = (users as { name: string | null }).name;
    return name ?? undefined;
  }
  return undefined;
}

/**
 * Validate and cast stage breakdown from JSONB.
 */
function parseStageBreakdown(breakdown: unknown): StageBreakdown | null {
  if (!breakdown || typeof breakdown !== 'object') {
    return null;
  }
  return breakdown as StageBreakdown;
}

/**
 * Fetches paginated conversations for a team with filtering and sorting.
 *
 * @param teamId - The team's database UUID
 * @param query - Validated query parameters
 * @returns Paginated conversation list with total count
 *
 * @example
 * const { conversations, total } = await getConversations(teamId, {
 *   project_id: 'uuid-here',
 *   stage: 'debugging',
 *   limit: 20,
 *   offset: 0,
 *   sort_by: 'date',
 * });
 */
export async function getConversations(
  teamId: string,
  query: ConversationsQuery
): Promise<ConversationsResult> {
  const supabase = await createClient();

  // Build base query with joins to projects and users
  let dbQuery = supabase
    .from('sessions')
    .select(
      `
      id,
      session_id,
      slug,
      project_id,
      projects(name),
      user_id,
      users(name),
      started_at,
      ended_at,
      total_prompts,
      user_message_count,
      primary_stage,
      has_debugging_loop,
      conversation_score,
      stage_breakdown,
      git_branch,
      cwd,
      claude_code_version
    `,
      { count: 'exact' }
    )
    .eq('team_id', teamId);

  // Apply project_id filter
  if (query.project_id) {
    if (query.project_id === 'unlinked') {
      dbQuery = dbQuery.is('project_id', null);
    } else {
      dbQuery = dbQuery.eq('project_id', query.project_id);
    }
  }

  // Apply stage filter
  if (query.stage) {
    dbQuery = dbQuery.eq('primary_stage', query.stage);
  }

  // Apply has_loop filter
  if (query.has_loop !== undefined) {
    dbQuery = dbQuery.eq('has_debugging_loop', query.has_loop);
  }

  // Apply date range filters
  if (query.date_from) {
    dbQuery = dbQuery.gte('started_at', query.date_from);
  }

  if (query.date_to) {
    dbQuery = dbQuery.lte('started_at', query.date_to);
  }

  // Apply sorting
  const sortColumn = {
    date: 'started_at',
    messages: 'user_message_count',
    score: 'conversation_score',
  }[query.sort_by];

  dbQuery = dbQuery.order(sortColumn, { ascending: false, nullsFirst: false });

  // Apply pagination
  dbQuery = dbQuery.range(query.offset, query.offset + query.limit - 1);

  // Execute query
  const { data, error, count } = await dbQuery;

  if (error) {
    logger.error('Failed to fetch conversations', error, { teamId, query });
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  // Transform database rows to API response format
  const conversations: ConversationSummary[] = (data || []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    slug: row.slug,
    projectId: row.project_id,
    projectName: extractProjectName(row.projects),
    userId: row.user_id,
    userName: extractUserName(row.users),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    userMessageCount: row.user_message_count ?? 0,
    totalMessages: row.total_prompts ?? 0,
    primaryStage: row.primary_stage as ProjectStage | null,
    hasDebuggingLoop: row.has_debugging_loop ?? false,
    conversationScore: row.conversation_score,
    stageBreakdown: parseStageBreakdown(row.stage_breakdown),
    gitBranch: row.git_branch,
    cwd: row.cwd,
    claudeCodeVersion: row.claude_code_version,
  }));

  logger.debug('Fetched conversations', {
    teamId,
    count: conversations.length,
    total: count,
    filters: {
      project_id: query.project_id,
      stage: query.stage,
      has_loop: query.has_loop,
      date_from: query.date_from,
      date_to: query.date_to,
    },
  });

  return {
    conversations,
    total: count ?? 0,
  };
}
