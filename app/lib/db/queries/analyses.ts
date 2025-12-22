/**
 * Analysis Query Helpers
 * Story 5.4: Analysis Storage
 *
 * Dashboard query functions for prompt analyses.
 * Uses Supabase client with RLS (not service role).
 */

import { createClient } from "@/lib/supabase/server";
import type { PromptAnalysis, PromptAnalysisWithPrompt } from "@/lib/types/analysis";

/**
 * Get analysis for a specific prompt
 *
 * @param promptId - UUID of the prompt
 * @returns The analysis or null if not found
 * @throws Error if database query fails
 */
export async function getAnalysisByPromptId(
  promptId: string
): Promise<PromptAnalysis | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prompt_analyses")
    .select("*")
    .eq("prompt_id", promptId)
    .single();

  // PGRST116 = "JSON object requested, multiple (or no) rows returned"
  // This means no row found, which is a valid case
  if (error?.code === "PGRST116") {
    return null;
  }

  if (error) {
    throw error;
  }

  return data as PromptAnalysis;
}

/**
 * Get the most recent analyses across all prompts the user can access
 *
 * @param limit - Maximum number of analyses to return (default: 10)
 * @returns Array of analyses, empty if none found
 * @throws Error if database query fails
 */
export async function getLatestAnalyses(
  limit: number = 10
): Promise<PromptAnalysis[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prompt_analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as PromptAnalysis[]) ?? [];
}

/**
 * Get analyses with their related prompt data
 * Useful for dashboard views that need to show prompt text
 *
 * @param limit - Maximum number of analyses to return (default: 10)
 * @returns Array of analyses with prompt data, empty if none found
 * @throws Error if database query fails
 */
export async function getLatestAnalysesWithPrompts(
  limit: number = 10
): Promise<PromptAnalysisWithPrompt[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prompt_analyses")
    .select(`
      *,
      prompt:prompts (
        id,
        text,
        char_count,
        word_count,
        user_id,
        created_at
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as PromptAnalysisWithPrompt[]) ?? [];
}

/**
 * Get analyses filtered by score range
 * Useful for finding prompts that need improvement
 *
 * @param minScore - Minimum overall score (inclusive)
 * @param maxScore - Maximum overall score (inclusive)
 * @param limit - Maximum number of analyses to return (default: 10)
 * @returns Array of analyses within score range
 * @throws Error if database query fails
 */
export async function getAnalysesByScoreRange(
  minScore: number,
  maxScore: number,
  limit: number = 10
): Promise<PromptAnalysis[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prompt_analyses")
    .select("*")
    .gte("overall_score", minScore)
    .lte("overall_score", maxScore)
    .order("overall_score", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as PromptAnalysis[]) ?? [];
}

/**
 * Get analysis count for dashboard statistics
 *
 * @returns Total count of analyses the user can access
 * @throws Error if database query fails
 */
export async function getAnalysisCount(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("prompt_analyses")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

/**
 * Get average score for dashboard statistics
 *
 * @returns Average overall score, or null if no analyses exist
 * @throws Error if database query fails
 */
export async function getAverageScore(): Promise<number | null> {
  const supabase = await createClient();

  // Use RPC or compute from data - Supabase doesn't support AVG in select
  const { data, error } = await supabase
    .from("prompt_analyses")
    .select("overall_score");

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const sum = data.reduce((acc, row) => acc + Number(row.overall_score), 0);
  return Math.round((sum / data.length) * 10) / 10; // Round to 1 decimal
}
