/**
 * Context-Aware Scoring Service
 * Story 27-4: Context-Aware Scoring
 *
 * Main orchestrator for scoring prompts with context-aware dimension adjustments.
 * Integrates classification, context building, and scoring with dimension weights.
 *
 * Flow:
 * 1. Classify prompt type (if not already classified)
 * 2. Check if scoring should be skipped (selection, confirmation)
 * 3. Build conversation context (if needed)
 * 4. Analyze prompt with LLM to get raw scores
 * 5. Apply dimension adjustments based on prompt type
 * 6. Calculate weighted overall score
 */

import { createScopedLogger } from '@/lib/utils/logger';
import type { PromptType } from '@/lib/types/classification';
import type { DimensionScores } from '@/lib/types/analysis';
import type {
  ScoringInput,
  ScoringOptions,
  ContextAwareScoringResult,
  SkippedScoringResult,
  ScoredResult,
} from '@/lib/types/scoring';
import {
  getScoringConfig,
  shouldSkipScoringByType,
  getSkipReason,
  applyDimensionAdjustments,
  calculateRawOverallScore,
  calculateWeightedOverallScore,
} from './dimensionAdjustments';

const logger = createScopedLogger('SCORING');

// ============================================================================
// Types
// ============================================================================

/**
 * Result from the analysis step (before dimension adjustments).
 */
export interface AnalysisStepResult {
  rawDimensionScores: DimensionScores;
  rawResponse?: string;
}

/**
 * Interface for the analysis function (allows mocking in tests).
 */
export type AnalyzeFunction = (
  promptId: string,
  content: string,
  promptType: PromptType,
  options?: ScoringOptions
) => Promise<AnalysisStepResult>;

// ============================================================================
// Skip Scoring Logic
// ============================================================================

/**
 * Creates a skipped scoring result.
 *
 * @param promptType - The prompt type
 * @param confidence - Classification confidence
 * @returns SkippedScoringResult
 */
export function createSkippedResult(
  promptType: PromptType,
  confidence: number
): SkippedScoringResult {
  const skipReason = getSkipReason(promptType) || 'Scoring skipped for this prompt type';

  return {
    skipped: true,
    skipReason,
    promptType,
    confidence,
  };
}

/**
 * Checks if scoring should be skipped and returns the result if so.
 *
 * @param promptType - The prompt type
 * @param confidence - Classification confidence
 * @param forceScore - Whether to force scoring even for skipped types
 * @returns SkippedScoringResult if skipping, null otherwise
 */
export function checkShouldSkip(
  promptType: PromptType,
  confidence: number,
  forceScore?: boolean
): SkippedScoringResult | null {
  if (forceScore) {
    logger.debug('Force scoring enabled, not skipping', { promptType });
    return null;
  }

  if (shouldSkipScoringByType(promptType)) {
    logger.log('Skipping scoring for prompt type', { promptType });
    return createSkippedResult(promptType, confidence);
  }

  return null;
}

// ============================================================================
// Scoring Logic
// ============================================================================

/**
 * Creates a scored result from raw dimension scores.
 *
 * @param promptType - The prompt type
 * @param confidence - Classification confidence
 * @param rawDimensionScores - Raw scores from analysis
 * @returns ScoredResult
 */
export function createScoredResult(
  promptType: PromptType,
  confidence: number,
  rawDimensionScores: DimensionScores
): ScoredResult {
  const config = getScoringConfig(promptType);

  // Apply dimension adjustments
  const adjustedDimensions = applyDimensionAdjustments(rawDimensionScores, promptType);

  // Calculate overall scores
  const rawOverallScore = calculateRawOverallScore(adjustedDimensions);
  const weightedOverallScore = calculateWeightedOverallScore(rawOverallScore, promptType);

  return {
    skipped: false,
    promptType,
    confidence,
    overallWeight: config.overallWeight,
    rawOverallScore,
    weightedOverallScore,
    rawDimensionScores,
    adjustedDimensions,
    configUsed: config,
  };
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Scores a prompt with context-aware dimension adjustments.
 *
 * This is the main entry point for the scoring module. It:
 * 1. Determines if scoring should be skipped based on prompt type
 * 2. Analyzes the prompt to get raw dimension scores
 * 3. Applies dimension weight adjustments based on prompt type
 * 4. Calculates raw and weighted overall scores
 *
 * @param input - Scoring input with prompt details
 * @param options - Scoring options
 * @param analyzeFunction - Function to analyze the prompt (injected for testability)
 * @returns Scoring result (either skipped or scored)
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = await scorePromptWithContext({
 *   promptId: 'abc123',
 *   content: 'Add error handling to the API',
 *   promptType: 'continuation',
 *   confidence: 0.85,
 * });
 *
 * if (result.skipped) {
 *   console.log('Skipped:', result.skipReason);
 * } else {
 *   console.log('Score:', result.weightedOverallScore);
 * }
 * ```
 */
export async function scorePromptWithContext(
  input: ScoringInput,
  options: ScoringOptions = {},
  analyzeFunction?: AnalyzeFunction
): Promise<ContextAwareScoringResult> {
  const { promptId, content, promptType, confidence = 0.8 } = input;

  // Validate input
  if (!promptId) {
    throw new Error('promptId is required');
  }
  if (!content && content !== '') {
    throw new Error('content is required');
  }
  if (!promptType) {
    throw new Error('promptType is required (use classifyPrompt first)');
  }

  logger.log('Scoring prompt with context', {
    promptId,
    promptType,
    confidence,
    contentLength: content.length,
  });

  // Check if we should skip scoring
  const skipResult = checkShouldSkip(promptType, confidence, options.forceScore);
  if (skipResult) {
    return skipResult;
  }

  // If no analyze function provided, we can't score
  // This allows the module to be used without full LLM integration
  if (!analyzeFunction) {
    logger.warn('No analyze function provided, returning empty scores');

    return createScoredResult(promptType, confidence, {});
  }

  // Analyze the prompt to get raw scores
  try {
    const analysisResult = await analyzeFunction(promptId, content, promptType, options);

    // Create scored result with adjustments applied
    return createScoredResult(promptType, confidence, analysisResult.rawDimensionScores);
  } catch (error) {
    logger.error('Analysis failed', error);
    throw new Error(
      `Scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validates scoring input.
 *
 * @param input - The input to validate
 * @returns Object with isValid flag and any error messages
 */
export function validateScoringInput(input: Partial<ScoringInput>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.promptId) {
    errors.push('promptId is required');
  }

  if (input.content === undefined || input.content === null) {
    errors.push('content is required');
  }

  if (input.promptType && !isValidPromptType(input.promptType)) {
    errors.push(`Invalid promptType: ${input.promptType}`);
  }

  if (input.confidence !== undefined) {
    if (input.confidence < 0 || input.confidence > 1) {
      errors.push('confidence must be between 0 and 1');
    }
  }

  if (input.messageIndex !== undefined && input.messageIndex < 0) {
    errors.push('messageIndex must be non-negative');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if a value is a valid prompt type.
 */
function isValidPromptType(value: string): value is PromptType {
  const validTypes = [
    'initiating',
    'continuation',
    'selection',
    'correction',
    'confirmation',
    'clarification',
  ];
  return validTypes.includes(value);
}

/**
 * Extracts a summary from a scoring result for logging/storage.
 *
 * @param result - The scoring result
 * @returns Summary object
 */
export function extractScoringSummary(result: ContextAwareScoringResult): {
  promptType: PromptType;
  skipped: boolean;
  skipReason?: string;
  rawScore?: number;
  weightedScore?: number;
  overallWeight?: number;
} {
  if (result.skipped) {
    return {
      promptType: result.promptType,
      skipped: true,
      skipReason: result.skipReason,
    };
  }

  return {
    promptType: result.promptType,
    skipped: false,
    rawScore: result.rawOverallScore,
    weightedScore: result.weightedOverallScore,
    overallWeight: result.overallWeight,
  };
}

/**
 * Formats a scoring result for display.
 *
 * @param result - The scoring result
 * @returns Human-readable string
 */
export function formatScoringResult(result: ContextAwareScoringResult): string {
  if (result.skipped) {
    return `[${result.promptType}] Skipped: ${result.skipReason}`;
  }

  const dimensions = result.adjustedDimensions
    .map((d) => `${d.dimension}: ${d.rawScore.toFixed(1)} (weight: ${(d.adjustedWeight * 100).toFixed(0)}%)`)
    .join(', ');

  return [
    `[${result.promptType}] Raw: ${result.rawOverallScore.toFixed(2)}, Weighted: ${result.weightedOverallScore.toFixed(2)}`,
    `  Weight: ${(result.overallWeight * 100).toFixed(0)}%`,
    `  Dimensions: ${dimensions}`,
  ].join('\n');
}

// ============================================================================
// Batch Scoring
// ============================================================================

/**
 * Scores multiple prompts in sequence.
 *
 * @param inputs - Array of scoring inputs
 * @param options - Scoring options (applied to all)
 * @param analyzeFunction - Analysis function
 * @returns Array of scoring results
 */
export async function scorePromptsWithContext(
  inputs: ScoringInput[],
  options: ScoringOptions = {},
  analyzeFunction?: AnalyzeFunction
): Promise<ContextAwareScoringResult[]> {
  const results: ContextAwareScoringResult[] = [];

  for (const input of inputs) {
    try {
      const result = await scorePromptWithContext(input, options, analyzeFunction);
      results.push(result);
    } catch (error) {
      logger.error('Failed to score prompt', error, { promptId: input.promptId });
      // Return a skipped result for failed prompts
      results.push({
        skipped: true,
        skipReason: `Scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        promptType: input.promptType || 'continuation',
        confidence: input.confidence || 0,
      });
    }
  }

  return results;
}

/**
 * Calculates aggregate statistics from scoring results.
 *
 * @param results - Array of scoring results
 * @returns Aggregate statistics
 */
export function calculateScoringStats(results: ContextAwareScoringResult[]): {
  total: number;
  scored: number;
  skipped: number;
  averageRawScore: number;
  averageWeightedScore: number;
  byPromptType: Record<PromptType, { count: number; avgScore: number }>;
} {
  const scored = results.filter((r) => !r.skipped) as ScoredResult[];
  const skipped = results.filter((r) => r.skipped);

  // Calculate averages
  const totalRawScore = scored.reduce((sum, r) => sum + r.rawOverallScore, 0);
  const totalWeightedScore = scored.reduce((sum, r) => sum + r.weightedOverallScore, 0);

  // Group by prompt type
  const byPromptType: Record<PromptType, { count: number; totalScore: number }> = {
    initiating: { count: 0, totalScore: 0 },
    continuation: { count: 0, totalScore: 0 },
    selection: { count: 0, totalScore: 0 },
    correction: { count: 0, totalScore: 0 },
    confirmation: { count: 0, totalScore: 0 },
    clarification: { count: 0, totalScore: 0 },
  };

  for (const result of scored) {
    byPromptType[result.promptType].count++;
    byPromptType[result.promptType].totalScore += result.rawOverallScore;
  }

  // Calculate averages per type
  const byPromptTypeWithAvg = Object.fromEntries(
    Object.entries(byPromptType).map(([type, data]) => [
      type,
      {
        count: data.count,
        avgScore: data.count > 0 ? data.totalScore / data.count : 0,
      },
    ])
  ) as Record<PromptType, { count: number; avgScore: number }>;

  return {
    total: results.length,
    scored: scored.length,
    skipped: skipped.length,
    averageRawScore: scored.length > 0 ? totalRawScore / scored.length : 0,
    averageWeightedScore: scored.length > 0 ? totalWeightedScore / scored.length : 0,
    byPromptType: byPromptTypeWithAvg,
  };
}
