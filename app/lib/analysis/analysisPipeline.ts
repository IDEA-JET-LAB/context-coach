/**
 * Analysis Pipeline Orchestration
 * Story 27-5: Update Analysis Pipeline
 *
 * Integrates Phase 3 classification and context-aware scoring into
 * the analysis pipeline. This module orchestrates:
 * 1. Prompt fetching
 * 2. Conversation context building
 * 3. Prompt classification
 * 4. Decision: skip or score
 * 5. Result storage
 */

import { createScopedLogger } from '@/lib/utils/logger';
import { buildAnalysisContext, type AnalysisContext } from './buildAnalysisContext';
import { classifyPrompt, shouldSkipScoring } from './promptClassifier';
import {
  scorePromptWithContext,
  type AnalyzeFunction,
} from './contextAwareScoring';
import { storeSkippedAnalysis } from './skippedStorage';
import { getSkipReason } from './dimensionAdjustments';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PromptType } from '@/lib/types/classification';
import type { ScoredResult, SkippedScoringResult, AdjustedDimensionScore } from '@/lib/types/scoring';

// Union type for scoring results
type ContextAwareScoringResult = ScoredResult | SkippedScoringResult;

const logger = createScopedLogger('PIPELINE');

// ============================================================================
// Types
// ============================================================================

/**
 * Result of running the analysis pipeline.
 */
export interface PipelineResult {
  /** The prompt ID that was analyzed */
  promptId: string;

  /** The classified prompt type */
  promptType: PromptType;

  /** Whether scoring was skipped */
  skipped: boolean;

  /** Reason for skipping (if skipped) */
  skipReason?: string;

  /** Dimension scores (if not skipped) */
  scores?: {
    clarity: number;
    context: number;
    specificity: number;
    goal: number;
    constraints: number;
    overall: number;
    weightedOverall: number;
  };

  /** Context information used */
  contextUsed: {
    messageCount: number;
    tokenCount: number;
  };

  /** Classification confidence (0-1) */
  confidence: number;

  /** Classification method used */
  classificationMethod: 'heuristic' | 'llm' | 'fallback';

  /** Total processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Options for running the pipeline.
 */
export interface PipelineOptions {
  /** Force scoring even for skip types */
  forceScore?: boolean;

  /** Custom analyze function for testing */
  analyzeFunction?: AnalyzeFunction;

  /** Skip storing results (for dry runs) */
  dryRun?: boolean;
}

/**
 * Prompt data fetched from database.
 */
interface PromptData {
  id: string;
  text: string;
  analyzed_text: string | null;
  session_uuid: string | null;
  analysis_status: string;
  prompt_classification: string | null;
}

// ============================================================================
// Pipeline Implementation
// ============================================================================

/**
 * Runs the complete analysis pipeline for a prompt.
 *
 * Pipeline steps:
 * 1. Fetch prompt from database
 * 2. Build conversation context
 * 3. Classify the prompt
 * 4. Skip or score based on classification
 * 5. Store results
 *
 * @param supabase - Supabase client (must have service role for writes)
 * @param promptId - The prompt ID to analyze
 * @param options - Pipeline options
 * @returns Pipeline result with scores or skip info
 *
 * @example
 * ```ts
 * const result = await runAnalysisPipeline(supabase, 'prompt-123');
 * if (result.skipped) {
 *   console.log('Skipped:', result.skipReason);
 * } else {
 *   console.log('Score:', result.scores?.weightedOverall);
 * }
 * ```
 */
export async function runAnalysisPipeline(
  supabase: SupabaseClient,
  promptId: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();

  logger.log('Starting analysis', { promptId });

  // Step 1: Fetch prompt
  const prompt = await fetchPrompt(supabase, promptId);

  // Check if already processed
  if (prompt.analysis_status === 'complete' || prompt.analysis_status === 'skipped') {
    logger.log('Already processed', { promptId, status: prompt.analysis_status });
    return createAlreadyProcessedResult(promptId, prompt, startTime);
  }

  // Update status to processing
  await updatePromptStatus(supabase, promptId, 'processing');

  try {
    // Step 2: Build conversation context
    let context: AnalysisContext;
    try {
      context = await buildAnalysisContext(promptId);
    } catch (error) {
      logger.error('Context building failed, using empty context', error);
      context = createEmptyContext(prompt.session_uuid);
    }

    // Step 3: Classify the prompt
    const textToAnalyze = prompt.analyzed_text || prompt.text;
    let classification: {
      promptType: PromptType;
      confidence: number;
      method: 'heuristic' | 'llm' | 'fallback';
    };

    try {
      const result = await classifyPrompt(textToAnalyze, context);
      classification = {
        promptType: result.promptType,
        confidence: result.confidence,
        method: result.method,
      };
    } catch (error) {
      logger.error('Classification failed, using default', { promptId, error });
      classification = {
        promptType: 'continuation',
        confidence: 0.5,
        method: 'fallback',
      };
    }

    // Store classification in prompt
    await storeClassification(supabase, promptId, classification);

    // Step 4: Check if scoring should be skipped
    if (shouldSkipScoring(classification.promptType) && !options.forceScore) {
      const skipReason = getSkipReason(classification.promptType) || 'Prompt type excluded from scoring';
      logger.log('Skipping scoring', {
        promptId,
        promptType: classification.promptType,
        reason: skipReason,
      });

      // Store skipped analysis
      if (!options.dryRun) {
        await storeSkippedAnalysis(
          {
            promptId,
            promptType: classification.promptType,
            skipReason,
            confidence: classification.confidence,
          },
          { supabase }
        );
      }

      return {
        promptId,
        promptType: classification.promptType,
        skipped: true,
        skipReason,
        contextUsed: {
          messageCount: context.messages.length,
          tokenCount: context.totalTokens,
        },
        confidence: classification.confidence,
        classificationMethod: classification.method,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Step 5: Perform context-aware scoring
    // Note: conversationContext is not part of ScoringInput; context is used
    // internally by the scoring function when building analysis prompts
    const scoringResult = await scorePromptWithContext(
      {
        promptId,
        content: textToAnalyze,
        promptType: classification.promptType,
        confidence: classification.confidence,
        messageIndex: context.messageIndex,
        sessionId: context.sessionId,
      },
      { forceScore: options.forceScore },
      options.analyzeFunction
    );

    // Step 6: Store complete analysis
    if (!options.dryRun && !scoringResult.skipped) {
      await storeCompleteAnalysis(supabase, promptId, scoringResult, classification, context);
    }

    const processingTimeMs = Date.now() - startTime;
    logger.log('Completed analysis', {
      promptId,
      promptType: classification.promptType,
      score: scoringResult.skipped ? undefined : scoringResult.weightedOverallScore,
      processingTimeMs,
    });

    // Build result
    if (scoringResult.skipped) {
      return {
        promptId,
        promptType: classification.promptType,
        skipped: true,
        skipReason: scoringResult.skipReason,
        contextUsed: {
          messageCount: context.messages.length,
          tokenCount: context.totalTokens,
        },
        confidence: classification.confidence,
        classificationMethod: classification.method,
        processingTimeMs,
      };
    }

    return {
      promptId,
      promptType: classification.promptType,
      skipped: false,
      scores: extractScores(scoringResult),
      contextUsed: {
        messageCount: context.messages.length,
        tokenCount: context.totalTokens,
      },
      confidence: classification.confidence,
      classificationMethod: classification.method,
      processingTimeMs,
    };
  } catch (error) {
    // Reset status to pending on error (will be retried)
    await updatePromptStatus(supabase, promptId, 'pending', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetches a prompt from the database.
 */
async function fetchPrompt(supabase: SupabaseClient, promptId: string): Promise<PromptData> {
  const { data, error } = await supabase
    .from('prompts')
    .select('id, text, analyzed_text, session_uuid, analysis_status, prompt_classification')
    .eq('id', promptId)
    .single();

  if (error || !data) {
    throw new Error(`Prompt not found: ${promptId}`);
  }

  return data as PromptData;
}

/**
 * Updates the prompt analysis status.
 */
async function updatePromptStatus(
  supabase: SupabaseClient,
  promptId: string,
  status: string,
  error?: unknown
): Promise<void> {
  const update: Record<string, unknown> = { analysis_status: status };

  if (error) {
    update.last_analysis_error =
      error instanceof Error ? error.message.substring(0, 500) : String(error).substring(0, 500);
  }

  await supabase.from('prompts').update(update).eq('id', promptId);
}

/**
 * Stores the classification result in the prompt.
 */
async function storeClassification(
  supabase: SupabaseClient,
  promptId: string,
  classification: { promptType: PromptType; confidence: number; method: string }
): Promise<void> {
  await supabase
    .from('prompts')
    .update({
      prompt_classification: classification.promptType,
      prompt_type_confidence: classification.confidence,
    })
    .eq('id', promptId);
}

/**
 * Stores a complete analysis result.
 */
async function storeCompleteAnalysis(
  supabase: SupabaseClient,
  promptId: string,
  scoringResult: ContextAwareScoringResult,
  classification: { promptType: PromptType; confidence: number; method: string },
  context: AnalysisContext
): Promise<void> {
  if (scoringResult.skipped) return;

  // Get active config for config_id
  const { data: config } = await supabase
    .from('analysis_configs')
    .select('id')
    .eq('is_active', true)
    .single();

  if (!config) {
    throw new Error('No active analysis config found');
  }

  // Build dimension scores JSONB
  const dimensionScoresJsonb: Record<string, { score: number; reasoning: string }> = {};
  for (const dim of scoringResult.adjustedDimensions) {
    dimensionScoresJsonb[dim.dimension] = {
      score: dim.rawScore,
      reasoning: scoringResult.rawDimensionScores[dim.dimension]?.reasoning || '',
    };
  }

  // Use the updated store_analysis_result function
  const { error } = await supabase.rpc('store_analysis_result', {
    p_prompt_id: promptId,
    p_config_id: config.id,
    p_overall_score: scoringResult.weightedOverallScore,
    p_dimension_scores: dimensionScoresJsonb,
    p_suggestions: { byDimension: {}, prioritized: [], generatedAt: new Date().toISOString() },
    p_prompt_type: classification.promptType,
    p_conversation_context_used: context.messages.length > 0,
    p_context_message_count: context.messages.length,
  });

  if (error) {
    throw new Error(`Failed to store analysis: ${error.message}`);
  }
}

/**
 * Creates an empty context for fallback.
 */
function createEmptyContext(sessionUuid: string | null): AnalysisContext {
  return {
    sessionId: sessionUuid || '',
    messageIndex: 0,
    messages: [],
    lastResponse: undefined,
    tokenBudget: 10000,
    totalTokens: 0,
    sessionMetadata: undefined,
  };
}

/**
 * Creates a result for already-processed prompts.
 */
function createAlreadyProcessedResult(
  promptId: string,
  prompt: PromptData,
  startTime: number
): PipelineResult {
  const promptType = (prompt.prompt_classification as PromptType) || 'continuation';

  return {
    promptId,
    promptType,
    skipped: true,
    skipReason: `Already processed (${prompt.analysis_status})`,
    contextUsed: { messageCount: 0, tokenCount: 0 },
    confidence: 1.0,
    classificationMethod: 'fallback',
    processingTimeMs: Date.now() - startTime,
  };
}
/**
 * Extracts scores from a non-skipped result.
 */
function extractScores(result: ContextAwareScoringResult): PipelineResult['scores'] {
  if (result.skipped) return undefined;

  const dims = result.adjustedDimensions.reduce(
    (acc: Record<string, number>, d: AdjustedDimensionScore) => ({
      ...acc,
      [d.dimension.toLowerCase()]: d.rawScore,
    }),
    {} as Record<string, number>
  );

  return {
    clarity: dims['clarity'] || 0,
    context: dims['context'] || 0,
    specificity: dims['specificity'] || 0,
    goal: dims['goal'] || 0,
    constraints: dims['constraints'] || 0,
    overall: result.rawOverallScore,
    weightedOverall: result.weightedOverallScore,
  };
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Runs the pipeline for multiple prompts.
 *
 * @param supabase - Supabase client
 * @param promptIds - Array of prompt IDs to process
 * @param options - Pipeline options
 * @returns Array of results (including errors as Error objects)
 */
export async function runAnalysisPipelineBatch(
  supabase: SupabaseClient,
  promptIds: string[],
  options: PipelineOptions = {}
): Promise<(PipelineResult | Error)[]> {
  const results: (PipelineResult | Error)[] = [];

  for (const promptId of promptIds) {
    try {
      const result = await runAnalysisPipeline(supabase, promptId, options);
      results.push(result);
    } catch (error) {
      results.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  return results;
}

/**
 * Gets prompts pending analysis.
 *
 * @param supabase - Supabase client
 * @param limit - Maximum number of prompts to return
 * @returns Array of prompt IDs pending analysis
 */
export async function getPendingPrompts(
  supabase: SupabaseClient,
  limit = 100
): Promise<string[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('id')
    .eq('analysis_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch pending prompts', error);
    return [];
  }

  return (data || []).map((p) => p.id);
}
