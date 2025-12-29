/**
 * Prompt Classification Service
 * Story 27-1: Prompt Classification Service
 *
 * Main orchestrator for classifying prompts by conversational role.
 * Uses heuristics first (fast, free) and falls back to LLM for ambiguous cases.
 *
 * Classification determines:
 * - Prompt type (initiating, continuation, selection, correction, confirmation, clarification)
 * - Scoring weight (0-1.0, used for adjusted prompt scoring)
 */

import { classifyByHeuristics } from './classificationPatterns';
import { classifyByLLM } from './llmClassifier';
import type { ConversationContext } from '@/lib/types/conversation-classification';
import type {
  ClassificationResult,
  PromptType,
} from '@/lib/types/classification';

// ============================================================================
// Constants
// ============================================================================

/**
 * Scoring weights for each prompt type.
 * - 0: Skip scoring entirely (selection, confirmation)
 * - 0.6-0.8: Reduced weight (clarification, continuation, correction)
 * - 1.0: Full weight (initiating)
 */
export const SCORING_WEIGHTS: Record<PromptType, number> = {
  initiating: 1.0,
  continuation: 0.7,
  selection: 0,
  correction: 0.8,
  confirmation: 0,
  clarification: 0.6,
};

/**
 * Confidence threshold for heuristic classification.
 * If heuristic confidence > this threshold, skip LLM call.
 */
export const HEURISTIC_CONFIDENCE_THRESHOLD = 0.9;

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * Classifies a prompt by its conversational role using heuristics first,
 * falling back to LLM for ambiguous cases.
 *
 * @param prompt - The user's prompt text
 * @param context - Conversation context including message index and options
 * @returns Classification result with type, confidence, and scoring weight
 *
 * @example
 * ```ts
 * // High confidence heuristic (no LLM call)
 * const result = await classifyPrompt('yes', { messageIndex: 1 });
 * // => { promptType: 'confirmation', confidence: 0.9, scoringWeight: 0, method: 'heuristic' }
 *
 * // Low confidence triggers LLM
 * const result2 = await classifyPrompt('maybe add tests', { messageIndex: 2 });
 * // => { promptType: 'continuation', confidence: 0.85, scoringWeight: 0.7, method: 'llm', reasoning: '...' }
 * ```
 */
export async function classifyPrompt(
  prompt: string,
  context: ConversationContext
): Promise<ClassificationResult> {
  // 1. Try heuristic classification first (fast, free)
  const heuristicResult = classifyByHeuristics(prompt, context);

  if (heuristicResult.confidence > HEURISTIC_CONFIDENCE_THRESHOLD) {
    console.log(
      `[ANALYSIS] Heuristic classification: ${heuristicResult.promptType} (${heuristicResult.confidence})`
    );
    return {
      promptType: heuristicResult.promptType,
      confidence: heuristicResult.confidence,
      scoringWeight: SCORING_WEIGHTS[heuristicResult.promptType],
      method: 'heuristic',
      matchedPattern: heuristicResult.matchedPattern,
    };
  }

  // 2. Fall back to LLM classification
  console.log(
    `[ANALYSIS] Heuristic confidence low (${heuristicResult.confidence}), using LLM`
  );

  try {
    const llmResult = await classifyByLLM(prompt, context);

    return {
      promptType: llmResult.promptType,
      confidence: llmResult.confidence,
      scoringWeight: SCORING_WEIGHTS[llmResult.promptType],
      method: 'llm',
      reasoning: llmResult.reasoning,
    };
  } catch (error) {
    // 3. If LLM fails, fall back to heuristic result with reduced confidence
    console.log(
      `[ANALYSIS] LLM classification failed, using heuristic fallback: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );

    // Reduce confidence to indicate lower certainty
    const reducedConfidence = Math.max(0.3, heuristicResult.confidence * 0.8);

    return {
      promptType: heuristicResult.promptType,
      confidence: reducedConfidence,
      scoringWeight: SCORING_WEIGHTS[heuristicResult.promptType],
      method: 'heuristic',
      matchedPattern: heuristicResult.matchedPattern,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the scoring weight for a prompt type.
 *
 * @param promptType - The prompt type
 * @returns Scoring weight from 0 to 1.0
 */
export function getScoringWeight(promptType: PromptType): number {
  return SCORING_WEIGHTS[promptType];
}

/**
 * Determines if a prompt type should skip scoring entirely.
 *
 * @param promptType - The prompt type
 * @returns true if scoring should be skipped (selection, confirmation)
 */
export function shouldSkipScoring(promptType: PromptType): boolean {
  return SCORING_WEIGHTS[promptType] === 0;
}
