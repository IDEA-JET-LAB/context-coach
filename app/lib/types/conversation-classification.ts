/**
 * Conversation Classification Types
 * Story 27-2: Heuristic Classification
 *
 * Types for classifying prompts within a conversation context.
 * Used by the heuristic classifier to categorize prompts as
 * confirmation, selection, correction, initiating, clarification, or continuation.
 */

/**
 * The 6 conversation prompt types for classification.
 * These represent the user's intent within a conversation flow.
 */
export const CONVERSATION_PROMPT_TYPES = [
  'initiating',    // First message starting a new task
  'confirmation',  // Agreeing or approving (yes, proceed, ok)
  'selection',     // Choosing from options (Option 2, #1, B)
  'correction',    // Correcting the AI (no, instead, actually)
  'clarification', // Asking for explanation (why, how, explain)
  'continuation',  // Default/follow-up (low confidence triggers LLM)
] as const;

/**
 * Type for valid conversation prompt types.
 */
export type ConversationPromptType = (typeof CONVERSATION_PROMPT_TYPES)[number];

/**
 * Classification method indicator.
 */
export type ClassificationMethod = 'heuristic' | 'llm';

/**
 * Context information about the conversation.
 * Used by heuristic classifier to make context-aware decisions.
 */
export interface ConversationContext {
  /**
   * Zero-based index of this message in the conversation.
   * messageIndex === 0 means this is the first message (initiating).
   */
  messageIndex: number;

  /**
   * Options presented in the last AI response, if any.
   * Used to detect selection prompts.
   * Example: ["1", "2", "3"] or ["Option A", "Option B"]
   */
  lastResponseOptions?: string[];

  /**
   * The last AI response text (for context extraction).
   */
  lastResponseText?: string;

  /**
   * Session ID for tracking conversation state.
   */
  sessionId?: string;
}

/**
 * Result of classifying a conversation prompt.
 */
export interface ConversationClassificationResult {
  /**
   * The classified prompt type.
   */
  promptType: ConversationPromptType;

  /**
   * Confidence score from 0.0 to 1.0.
   * Lower confidence (< 0.7) may trigger LLM fallback.
   */
  confidence: number;

  /**
   * The method used for classification.
   */
  method: ClassificationMethod;

  /**
   * Optional scoring weight for this prompt type.
   * Set by the caller based on configuration.
   */
  scoringWeight?: number;

  /**
   * Debug info: which pattern matched (for heuristics).
   */
  matchedPattern?: string;
}

/**
 * Default scoring weights for each prompt type.
 * These represent how much each type contributes to overall session quality.
 */
export const DEFAULT_PROMPT_TYPE_WEIGHTS: Record<ConversationPromptType, number> = {
  initiating: 1.0,    // Full weight - starting prompts are important
  confirmation: 0.1,  // Low weight - simple approval
  selection: 0.2,     // Low weight - choosing from options
  correction: 0.8,    // High weight - indicates potential issues in communication
  clarification: 0.6, // Medium weight - seeking understanding
  continuation: 1.0,  // Full weight - regular follow-up prompts
};

/**
 * Confidence thresholds for classification.
 */
export const CLASSIFICATION_CONFIDENCE = {
  /** Threshold below which LLM fallback is triggered */
  LLM_FALLBACK_THRESHOLD: 0.7,

  /** Confidence for initiating (first message) */
  INITIATING: 0.95,

  /** Confidence for confirmation patterns */
  CONFIRMATION: 0.9,

  /** Confidence for selection patterns */
  SELECTION: 0.95,

  /** Confidence for correction patterns */
  CORRECTION: 0.85,

  /** Confidence for clarification patterns */
  CLARIFICATION: 0.8,

  /** Confidence for default continuation */
  CONTINUATION: 0.6,
} as const;
