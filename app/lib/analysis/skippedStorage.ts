/**
 * Skipped Analysis Storage Module
 * Story 27-4: Context-Aware Scoring
 *
 * Provides functions for storing skipped analysis results when prompts
 * are classified as types that don't require scoring (selection, confirmation).
 */

import { createScopedLogger } from '@/lib/utils/logger';
import type { PromptType } from '@/lib/types/classification';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = createScopedLogger('SKIPPED_STORAGE');

// ============================================================================
// Types
// ============================================================================

/**
 * Input for storing a skipped analysis.
 */
export interface SkippedAnalysisInput {
  /**
   * The prompt ID to mark as skipped.
   */
  promptId: string;

  /**
   * The classified prompt type.
   */
  promptType: PromptType;

  /**
   * Reason why scoring was skipped.
   */
  skipReason: string;

  /**
   * Classification confidence (0-1).
   */
  confidence?: number;
}

/**
 * Result of storing a skipped analysis.
 */
export interface SkippedAnalysisResult {
  /**
   * The ID of the created prompt_analyses record.
   */
  analysisId: string;

  /**
   * Whether this was a new record or updated existing.
   */
  isNew: boolean;
}

/**
 * Options for the storage operation.
 */
export interface StoreSkippedOptions {
  /**
   * Supabase client to use (for dependency injection in tests).
   */
  supabase?: SupabaseClient;
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Stores a skipped analysis result for a prompt.
 *
 * This function:
 * 1. Creates a prompt_analyses record with skipped=true
 * 2. Updates the prompt's analysis_status to 'skipped'
 * 3. Updates the prompt's classification if not already set
 *
 * Uses the database function `store_skipped_analysis` for atomicity.
 *
 * @param input - The skipped analysis input
 * @param options - Storage options
 * @returns The result of the storage operation
 * @throws Error if storage fails
 *
 * @example
 * ```ts
 * const result = await storeSkippedAnalysis({
 *   promptId: 'abc123',
 *   promptType: 'selection',
 *   skipReason: 'Selection prompts do not require quality scoring',
 *   confidence: 0.95,
 * });
 * console.log('Stored:', result.analysisId);
 * ```
 */
export async function storeSkippedAnalysis(
  input: SkippedAnalysisInput,
  options: StoreSkippedOptions = {}
): Promise<SkippedAnalysisResult> {
  const { promptId, promptType, skipReason, confidence } = input;

  logger.log('Storing skipped analysis', {
    promptId,
    promptType,
    skipReason: skipReason.substring(0, 50) + (skipReason.length > 50 ? '...' : ''),
  });

  // Get Supabase client (from options or create new)
  const supabase = options.supabase || (await getSupabaseClient());

  try {
    // Call the database function
    const { data, error } = await supabase.rpc('store_skipped_analysis', {
      p_prompt_id: promptId,
      p_prompt_type: promptType,
      p_skip_reason: skipReason,
      p_confidence: confidence ?? null,
    });

    if (error) {
      logger.error('Failed to store skipped analysis', error);
      throw new Error(`Failed to store skipped analysis: ${error.message}`);
    }

    const analysisId = data as string;

    logger.log('Skipped analysis stored', {
      promptId,
      analysisId,
      promptType,
    });

    return {
      analysisId,
      isNew: true, // The function uses UPSERT, but we treat it as new for logging
    };
  } catch (error) {
    logger.error('Error storing skipped analysis', error);
    throw error instanceof Error
      ? error
      : new Error(`Unknown error storing skipped analysis: ${String(error)}`);
  }
}

/**
 * Batch stores multiple skipped analyses.
 *
 * @param inputs - Array of skipped analysis inputs
 * @param options - Storage options
 * @returns Array of results (including errors)
 */
export async function storeSkippedAnalysesBatch(
  inputs: SkippedAnalysisInput[],
  options: StoreSkippedOptions = {}
): Promise<(SkippedAnalysisResult | Error)[]> {
  const results: (SkippedAnalysisResult | Error)[] = [];

  for (const input of inputs) {
    try {
      const result = await storeSkippedAnalysis(input, options);
      results.push(result);
    } catch (error) {
      results.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  return results;
}

/**
 * Checks if a prompt already has a skipped analysis.
 *
 * @param promptId - The prompt ID to check
 * @param options - Storage options
 * @returns true if the prompt has a skipped analysis
 */
export async function hasSkippedAnalysis(
  promptId: string,
  options: StoreSkippedOptions = {}
): Promise<boolean> {
  const supabase = options.supabase || (await getSupabaseClient());

  const { data, error } = await supabase
    .from('prompt_analyses')
    .select('id, skipped')
    .eq('prompt_id', promptId)
    .eq('skipped', true)
    .maybeSingle();

  if (error) {
    logger.error('Failed to check skipped analysis', error);
    return false;
  }

  return data !== null;
}

/**
 * Gets the skip reason for a prompt if it was skipped.
 *
 * @param promptId - The prompt ID to check
 * @param options - Storage options
 * @returns The skip reason or null if not skipped
 */
export async function getSkipReason(
  promptId: string,
  options: StoreSkippedOptions = {}
): Promise<string | null> {
  const supabase = options.supabase || (await getSupabaseClient());

  const { data, error } = await supabase
    .from('prompt_analyses')
    .select('skip_reason')
    .eq('prompt_id', promptId)
    .eq('skipped', true)
    .maybeSingle();

  if (error) {
    logger.error('Failed to get skip reason', error);
    return null;
  }

  return data?.skip_reason ?? null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets or creates a Supabase client.
 * Uses the service role client for database operations.
 */
async function getSupabaseClient(): Promise<SupabaseClient> {
  // Dynamic import to avoid circular dependencies
  const { createClient } = await import('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================================================
// Statistics Functions
// ============================================================================

/**
 * Gets statistics about skipped analyses.
 *
 * @param options - Storage options with optional filters
 * @returns Statistics object
 */
export async function getSkippedAnalysisStats(
  options: StoreSkippedOptions & {
    teamId?: string;
    projectId?: string;
    since?: Date;
  } = {}
): Promise<{
  total: number;
  byPromptType: Record<PromptType, number>;
}> {
  const supabase = options.supabase || (await getSupabaseClient());

  let query = supabase
    .from('prompt_analyses')
    .select('prompt_type')
    .eq('skipped', true);

  if (options.since) {
    query = query.gte('created_at', options.since.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to get skipped analysis stats', error);
    return {
      total: 0,
      byPromptType: {} as Record<PromptType, number>,
    };
  }

  const byPromptType: Record<PromptType, number> = {
    initiating: 0,
    continuation: 0,
    selection: 0,
    correction: 0,
    confirmation: 0,
    clarification: 0,
  };

  for (const row of data || []) {
    const type = row.prompt_type as PromptType;
    if (type && type in byPromptType) {
      byPromptType[type]++;
    }
  }

  return {
    total: data?.length ?? 0,
    byPromptType,
  };
}
