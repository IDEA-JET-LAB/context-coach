/**
 * Dead Letter Queue Query Helpers
 * Story 5.5: Retry Logic and Error Handling
 *
 * Admin query functions for managing failed prompts.
 * Uses service role (admin) client to bypass RLS.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Represents a failed prompt in the dead letter queue
 */
export interface FailedPrompt {
  id: string;
  team_id: string;
  project_id: string;
  user_id: string;
  text: string;
  char_count: number;
  word_count: number;
  analysis_status: string;
  analysis_attempts: number;
  last_analysis_error: string | null;
  last_analysis_attempt_at: string | null;
  created_at: string;
}

/**
 * Get prompts that have failed analysis (dead letter queue).
 * These are prompts with analysis_status = 'failed'.
 *
 * @param limit - Maximum number of prompts to return (default: 50)
 * @returns Array of failed prompts, ordered by most recent failure
 * @throws Error if database query fails
 */
export async function getFailedPrompts(limit = 50): Promise<FailedPrompt[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("prompts")
    .select(`
      id,
      team_id,
      project_id,
      user_id,
      text,
      char_count,
      word_count,
      analysis_status,
      analysis_attempts,
      last_analysis_error,
      last_analysis_attempt_at,
      created_at
    `)
    .eq("analysis_status", "failed")
    .order("last_analysis_attempt_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as FailedPrompt[]) ?? [];
}

/**
 * Get failed prompts for a specific team.
 *
 * @param teamId - The team's UUID
 * @param limit - Maximum number of prompts to return (default: 50)
 * @returns Array of failed prompts for the team
 * @throws Error if database query fails
 */
export async function getFailedPromptsByTeam(
  teamId: string,
  limit = 50
): Promise<FailedPrompt[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("prompts")
    .select(`
      id,
      team_id,
      project_id,
      user_id,
      text,
      char_count,
      word_count,
      analysis_status,
      analysis_attempts,
      last_analysis_error,
      last_analysis_attempt_at,
      created_at
    `)
    .eq("analysis_status", "failed")
    .eq("team_id", teamId)
    .order("last_analysis_attempt_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as FailedPrompt[]) ?? [];
}

/**
 * Get count of failed prompts.
 *
 * @returns Total count of prompts in the dead letter queue
 * @throws Error if database query fails
 */
export async function getFailedPromptsCount(): Promise<number> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from("prompts")
    .select("*", { count: "exact", head: true })
    .eq("analysis_status", "failed");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

/**
 * Reset a failed prompt for retry.
 * Clears the error state and resets attempt count to 0.
 *
 * @param promptId - UUID of the prompt to retry
 * @returns true if prompt was found and updated
 * @throws Error if database operation fails
 */
export async function retryFailedPrompt(promptId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("prompts")
    .update({
      analysis_status: "pending",
      analysis_attempts: 0,
      last_analysis_error: null,
    })
    .eq("id", promptId)
    .eq("analysis_status", "failed")
    .select("id")
    .single();

  // PGRST116 means no row found/updated
  if (error?.code === "PGRST116") {
    return false;
  }

  if (error) {
    throw error;
  }

  return !!data;
}

/**
 * Retry all failed prompts (bulk operation).
 * Use with caution - may trigger many analysis jobs.
 *
 * @returns Number of prompts reset for retry
 * @throws Error if database operation fails
 */
export async function retryAllFailedPrompts(): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("prompts")
    .update({
      analysis_status: "pending",
      analysis_attempts: 0,
      last_analysis_error: null,
    })
    .eq("analysis_status", "failed")
    .select("id");

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}

/**
 * Get prompts that are stuck in processing (potential zombies).
 * These are prompts with analysis_status = 'processing' for too long.
 *
 * @param olderThanMinutes - Consider stuck if processing longer than this (default: 5)
 * @param limit - Maximum number of prompts to return (default: 50)
 * @returns Array of stuck prompts
 * @throws Error if database query fails
 */
export async function getStuckPrompts(
  olderThanMinutes = 5,
  limit = 50
): Promise<FailedPrompt[]> {
  const supabase = createAdminClient();

  // Calculate the cutoff time
  const cutoffTime = new Date(
    Date.now() - olderThanMinutes * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("prompts")
    .select(`
      id,
      team_id,
      project_id,
      user_id,
      text,
      char_count,
      word_count,
      analysis_status,
      analysis_attempts,
      last_analysis_error,
      last_analysis_attempt_at,
      created_at
    `)
    .eq("analysis_status", "processing")
    .lt("last_analysis_attempt_at", cutoffTime)
    .order("last_analysis_attempt_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as FailedPrompt[]) ?? [];
}

/**
 * Reset stuck prompts back to pending.
 * Use to recover from edge function crashes or timeouts.
 *
 * @param olderThanMinutes - Consider stuck if processing longer than this (default: 5)
 * @returns Number of prompts reset
 * @throws Error if database operation fails
 */
export async function resetStuckPrompts(olderThanMinutes = 5): Promise<number> {
  const supabase = createAdminClient();

  // Calculate the cutoff time
  const cutoffTime = new Date(
    Date.now() - olderThanMinutes * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("prompts")
    .update({
      analysis_status: "pending",
      last_analysis_error: "Reset from stuck processing state",
    })
    .eq("analysis_status", "processing")
    .lt("last_analysis_attempt_at", cutoffTime)
    .select("id");

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}
