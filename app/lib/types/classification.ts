/**
 * Prompt Classification Types
 * Story 27-1: Prompt Classification Service
 *
 * Types for the main classification orchestrator that determines
 * prompt types and scoring weights for context-aware analysis.
 */

/**
 * Valid prompt types for classification.
 * Matches ConversationPromptType from conversation-classification.ts
 */
export type PromptType =
  | 'initiating'
  | 'continuation'
  | 'selection'
  | 'correction'
  | 'confirmation'
  | 'clarification';

/**
 * Classification method indicator.
 */
export type ClassificationMethod = 'heuristic' | 'llm';

/**
 * Result of classifying a prompt.
 * Includes the type, confidence score, and scoring weight.
 */
export interface ClassificationResult {
  /**
   * The classified prompt type.
   */
  promptType: PromptType;

  /**
   * Confidence score from 0.0 to 1.0.
   */
  confidence: number;

  /**
   * Scoring weight for this prompt type (0.0 to 1.0).
   * Used to adjust prompt scores based on conversational context.
   * - 0: Skip scoring (selection, confirmation)
   * - 0.6-0.8: Reduced weight (clarification, continuation, correction)
   * - 1.0: Full weight (initiating)
   */
  scoringWeight: number;

  /**
   * The method used for classification.
   */
  method: ClassificationMethod;

  /**
   * Optional explanation from LLM.
   */
  reasoning?: string;

  /**
   * Debug info: which pattern matched (for heuristics).
   */
  matchedPattern?: string;
}

/**
 * LLM classification result (before scoring weight is applied).
 */
export interface LLMClassificationResult {
  /**
   * The classified prompt type.
   */
  promptType: PromptType;

  /**
   * Confidence score from 0.0 to 1.0.
   */
  confidence: number;

  /**
   * Explanation from the LLM.
   */
  reasoning?: string;
}

/**
 * Scoring weights by prompt type.
 * Matches the table in Story 27-1.
 */
export const PROMPT_TYPE_SCORING_WEIGHTS: Record<PromptType, number> = {
  initiating: 1.0,    // 100% - Starting prompts are important
  continuation: 0.7,  // 70% - Follow-up prompts
  selection: 0,       // 0% - Skip scoring for option selection
  correction: 0.8,    // 80% - Redirections and corrections
  confirmation: 0,    // 0% - Skip scoring for confirmations
  clarification: 0.6, // 60% - Explanation requests
};

/**
 * All valid prompt types as an array.
 */
export const PROMPT_TYPES: PromptType[] = [
  'initiating',
  'continuation',
  'selection',
  'correction',
  'confirmation',
  'clarification',
];
