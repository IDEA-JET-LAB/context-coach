/**
 * Conversation Analysis Repository
 * Story 30-3: Analysis Storage Schema
 *
 * Data access layer for conversation analyses.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ConversationAnalysis,
  ConversationAnalysisRow,
  CreateAnalysisInput,
  AnalysisModel,
  QuestionType,
} from '@/lib/types/conversation-analysis';

/**
 * Maps a database row (snake_case) to the domain model (camelCase).
 */
export function mapToConversationAnalysis(
  row: ConversationAnalysisRow
): ConversationAnalysis {
  return {
    id: row.id,
    sessionId: row.session_id,
    teamId: row.team_id,
    userId: row.user_id,
    question: row.question,
    questionType: row.question_type as QuestionType | null,
    response: row.response,
    model: row.model as AnalysisModel,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostCents:
      typeof row.estimated_cost_cents === 'string'
        ? parseFloat(row.estimated_cost_cents)
        : row.estimated_cost_cents,
    includedPrompts: row.included_prompts,
    includedResponses: row.included_responses,
    includedThinking: row.included_thinking,
    includedTools: row.included_tools,
    createdAt: row.created_at,
  };
}

/**
 * Creates a new conversation analysis record.
 *
 * @param supabase - Supabase client (with authenticated user context)
 * @param userId - The authenticated user's ID
 * @param input - Analysis data to store
 * @returns The created analysis record
 * @throws Error if insert fails
 */
export async function createAnalysis(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAnalysisInput
): Promise<ConversationAnalysis> {
  const { data, error } = await supabase
    .from('conversation_analyses')
    .insert({
      session_id: input.sessionId,
      team_id: input.teamId,
      user_id: userId,
      question: input.question,
      question_type: input.questionType ?? null,
      response: input.response,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      estimated_cost_cents: input.estimatedCostCents,
      included_prompts: input.includedPrompts,
      included_responses: input.includedResponses,
      included_thinking: input.includedThinking,
      included_tools: input.includedTools,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create analysis: ${error.message}`);
  }

  return mapToConversationAnalysis(data as ConversationAnalysisRow);
}

/**
 * Retrieves all analyses for a session, ordered by created_at descending.
 *
 * @param supabase - Supabase client (with authenticated user context)
 * @param sessionId - The Claude Code session identifier
 * @returns Array of analysis records, most recent first
 * @throws Error if query fails
 */
export async function getAnalysesForSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<ConversationAnalysis[]> {
  const { data, error } = await supabase
    .from('conversation_analyses')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get analyses for session: ${error.message}`);
  }

  return (data as ConversationAnalysisRow[]).map(mapToConversationAnalysis);
}

/**
 * Retrieves a single analysis by ID.
 *
 * @param supabase - Supabase client (with authenticated user context)
 * @param id - The analysis UUID
 * @returns The analysis record, or null if not found
 * @throws Error if query fails (other than not found)
 */
export async function getAnalysisById(
  supabase: SupabaseClient,
  id: string
): Promise<ConversationAnalysis | null> {
  const { data, error } = await supabase
    .from('conversation_analyses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    // PGRST116 = "The result contains 0 rows" (not found)
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get analysis: ${error.message}`);
  }

  return mapToConversationAnalysis(data as ConversationAnalysisRow);
}

/**
 * Deletes an analysis by ID.
 * Only the owner can delete (enforced by RLS).
 *
 * @param supabase - Supabase client (with authenticated user context)
 * @param id - The analysis UUID to delete
 * @throws Error if delete fails
 */
export async function deleteAnalysis(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_analyses')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete analysis: ${error.message}`);
  }
}

/**
 * Gets analyses for a user across all sessions.
 *
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param limit - Maximum number of results
 * @returns Array of analysis records
 */
export async function getAnalysesForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<ConversationAnalysis[]> {
  const { data, error } = await supabase
    .from('conversation_analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get analyses for user: ${error.message}`);
  }

  return (data as ConversationAnalysisRow[]).map(mapToConversationAnalysis);
}

/**
 * Gets total usage stats for a team.
 *
 * @param supabase - Supabase client
 * @param teamId - Team ID
 * @returns Usage statistics
 */
export async function getTeamUsageStats(
  supabase: SupabaseClient,
  teamId: string
): Promise<{
  totalAnalyses: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
}> {
  const { data, error } = await supabase
    .from('conversation_analyses')
    .select('input_tokens, output_tokens, estimated_cost_cents')
    .eq('team_id', teamId);

  if (error) {
    throw new Error(`Failed to get team usage stats: ${error.message}`);
  }

  const rows = data as Pick<
    ConversationAnalysisRow,
    'input_tokens' | 'output_tokens' | 'estimated_cost_cents'
  >[];

  return {
    totalAnalyses: rows.length,
    totalInputTokens: rows.reduce((sum, r) => sum + r.input_tokens, 0),
    totalOutputTokens: rows.reduce((sum, r) => sum + r.output_tokens, 0),
    totalCostCents: rows.reduce(
      (sum, r) =>
        sum +
        (typeof r.estimated_cost_cents === 'string'
          ? parseFloat(r.estimated_cost_cents)
          : r.estimated_cost_cents),
      0
    ),
  };
}
