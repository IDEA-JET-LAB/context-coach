/**
 * Heuristic Classification Patterns
 * Story 27-2: Heuristic Classification
 *
 * Fast pattern-matching classification for prompts to avoid LLM calls for common cases.
 * ~70% of prompts fall into clear patterns that can be detected with regex and simple rules.
 *
 * Performance Requirements:
 * - Average execution: <0.5ms per prompt
 * - No external dependencies or API calls
 *
 * Pattern Priority Order:
 * 1. First message -> initiating (100% deterministic)
 * 2. Confirmation patterns (high precision, short prompts)
 * 3. Selection patterns (requires context, short prompts)
 * 4. Correction patterns (medium precision, any length)
 * 5. Clarification patterns (requires question mark)
 * 6. Continuation (default fallback - triggers LLM)
 */

import type {
  ConversationContext,
  ConversationClassificationResult,
  ConversationPromptType,
} from '@/lib/types/conversation-classification';
import { CLASSIFICATION_CONFIDENCE } from '@/lib/types/conversation-classification';

// ============================================================================
// CONFIRMATION PATTERNS
// ============================================================================

/**
 * Exact matches for confirmation prompts (case-insensitive).
 * Using Set for O(1) lookup performance.
 */
const CONFIRMATION_EXACT_MATCHES = new Set([
  'yes',
  'y',
  'ok',
  'okay',
  'sure',
  'proceed',
  'go ahead',
  'do it',
  'sounds good',
  'looks good',
  'lgtm',
  'please',
  'continue',
  'go',
  'start',
  'yep',
  'yeah',
  'yup',
  'affirmative',
  'correct',
  'right',
  'approved',
  'confirm',
  'confirmed',
  'accept',
  'agreed',
  'fine',
  'perfect',
  'great',
  'awesome',
  'nice',
  'cool',
  'ship it',
  'absolutely',
  'definitely',
  'of course',
  'for sure',
]);

/**
 * Regex patterns for confirmation prompts.
 * These handle punctuation variations and common phrases.
 */
const CONFIRMATION_PATTERNS = [
  /^(yes|y|ok|okay|sure|proceed|go ahead|do it)[\.\!\,]?$/i,
  /^(please|plz)?\s*(continue|go|start|proceed)[\.\!\,]?$/i,
  /^(sounds?|looks?)\s+(good|great|fine|ok|okay)[\.\!\,]?$/i,
  /^(lgtm|ship\s*it)[\.\!\,]?$/i,
  /^(that'?s?\s+)?(correct|right|fine|perfect|great)[\.\!\,]?$/i,
  /^(absolutely|definitely|of course|for sure)[\.\!\,]?$/i,
  /^(yep|yeah|yup)[\.\!\,]?$/i,
  /^(approved|confirmed?|accept(ed)?)[\.\!\,]?$/i,
  // Compound confirmations: "sounds good, proceed", "yes please!"
  /^(sounds?|looks?)\s+(good|great|fine|ok|okay)[,\s]+(proceed|continue|go ahead)$/i,
  /^(yes|ok|okay|sure)[,\s]+(proceed|continue|go ahead|please)[\.\!]?$/i,
  /^(yes|ok)\s*please[\.\!]*$/i,
];

// ============================================================================
// SELECTION PATTERNS
// ============================================================================

/**
 * Regex patterns for selection prompts.
 * Match numbered, lettered, and ordinal selections.
 */
const SELECTION_PATTERNS = [
  // Numbered: "1", "#1", "Option 1", "Choice 1", "number 1"
  /^#?\d+[\.\)]?$/,
  /^(option|choice|number)\s*#?\d+$/i,

  // Lettered: "A", "a)", "(B)", "option A"
  /^[a-zA-Z][\.\)]?$/,
  /^\([a-zA-Z]\)$/,
  /^(option|choice)\s+[a-zA-Z]$/i,

  // Ordinal: "the first one", "second option", "third choice"
  /^(the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)(\s+one|\s+option|\s+choice)?$/i,

  // Descriptive short selections
  /^(that\s+one|this\s+one|the\s+last\s+one|the\s+top\s+one|the\s+bottom\s+one)$/i,
];

/**
 * Maximum length for selection prompts (selections are typically short).
 */
const SELECTION_MAX_LENGTH = 50;

// ============================================================================
// CORRECTION PATTERNS
// ============================================================================

/**
 * Regex patterns for correction prompts.
 * IMPORTANT: All patterns use word boundaries (\b) to prevent false matches.
 * For example, "economy" should NOT match the "no" pattern.
 */
const CORRECTION_INDICATORS = [
  // "no, " at the start - the comma/punctuation is key
  /^no[,\.\!]\s/i,

  // "instead" as a standalone word
  /\binstead\b/i,

  // "actually" as a standalone word (often signals correction)
  /\bactually\b/i,

  // "wrong" as a standalone word
  /\bwrong\b/i,

  // "that's not", "thats not", "that is not"
  /\bthat'?s?\s+(not|incorrect|wrong)\b/i,

  // "not what I wanted/meant/asked"
  /\bnot\s+what\s+i\s*(meant|wanted|asked)\b/i,

  // "I meant", "I wanted" (followed by something)
  /\bi\s+(meant|wanted)\s+\w/i,

  // "don't do", "dont do"
  /\bdon'?t\s+do\b/i,

  // Imperative corrections
  /\bstop\b/i,
  /\bundo\b/i,
  /\brevert\b/i,
  /\bcancel\b/i,

  // "nope" as standalone
  /\bnope\b/i,

  // "not like that", "not that way"
  /\bnot\s+(like\s+that|that\s+way)\b/i,

  // "I said" (correction of misunderstanding)
  /\bi\s+said\b/i,

  // "try again", "start over"
  /\b(try\s+again|start\s+over)\b/i,
];

// ============================================================================
// CLARIFICATION PATTERNS
// ============================================================================

/**
 * Regex patterns for clarification prompts.
 * These typically end with "?" and ask about the AI's previous response.
 */
const CLARIFICATION_PATTERNS = [
  // "why...?"
  /\bwhy\b.*\?$/i,

  // "how does/do/did/would/will...?"
  /\bhow\s+(does|do|did|would|will|can|could)\b.*\?$/i,

  // "what does/do/is/are/was/were...?"
  /\bwhat\s+(does|do|is|are|was|were|did)\b.*\?$/i,

  // Explicit clarification requests
  /\bexplain\b/i,
  /\bclarify\b/i,
  /\belaborate\b/i,

  // "can you explain", "could you explain"
  /\b(can|could|would)\s+you\s+(explain|clarify|elaborate)\b/i,

  // "what do you mean"
  /\bwhat\s+do\s+you\s+mean\b/i,

  // "I don't understand"
  /\bi\s+don'?t\s+understand\b/i,

  // "could you elaborate/expand"
  /\b(could|can|would)\s+you\s+(elaborate|expand)\b/i,

  // "what is that", "what's that"
  /\bwhat'?s?\s+that\b.*\?$/i,

  // "I'm confused", "I'm not sure"
  /\bi'?m\s+(confused|not\s+sure)\b/i,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize prompt text for consistent matching.
 * - Convert to lowercase
 * - Trim whitespace
 * - Normalize internal whitespace
 */
function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Create a classification result with consistent structure.
 */
function makeResult(
  promptType: ConversationPromptType,
  confidence: number,
  matchedPattern?: string
): ConversationClassificationResult {
  return {
    promptType,
    confidence,
    method: 'heuristic',
    matchedPattern,
  };
}

/**
 * Check if prompt is a confirmation.
 * Uses exact match (fast path) then pattern matching.
 */
function isConfirmation(normalized: string): { matched: boolean; pattern?: string } {
  // Remove punctuation for exact match check
  const words = normalized.replace(/[^\w\s]/g, '').trim();
  if (CONFIRMATION_EXACT_MATCHES.has(words)) {
    return { matched: true, pattern: `exact:${words}` };
  }

  // Check patterns
  for (let i = 0; i < CONFIRMATION_PATTERNS.length; i++) {
    const pattern = CONFIRMATION_PATTERNS[i]!;
    if (pattern.test(normalized)) {
      return { matched: true, pattern: `regex:confirmation[${i}]` };
    }
  }

  return { matched: false };
}

/**
 * Check if prompt is a selection.
 * Considers prompt length and context about available options.
 */
function isSelection(
  normalized: string,
  context: ConversationContext
): { matched: boolean; pattern?: string } {
  // Selection prompts are typically short
  if (normalized.length > SELECTION_MAX_LENGTH) {
    return { matched: false };
  }

  const hasContextOptions =
    context.lastResponseOptions && context.lastResponseOptions.length > 0;

  // Check selection patterns
  for (let i = 0; i < SELECTION_PATTERNS.length; i++) {
    const pattern = SELECTION_PATTERNS[i]!;
    if (pattern.test(normalized)) {
      // Pattern 5 (ordinals) and 6 (descriptive) are self-contained selections
      // Other short patterns need context or be very short
      const isSelfContainedPattern = i >= 5; // ordinal and descriptive patterns
      if (isSelfContainedPattern || normalized.length <= 15 || hasContextOptions) {
        return { matched: true, pattern: `regex:selection[${i}]` };
      }
    }
  }

  // If context has options, check if prompt matches any option text
  if (hasContextOptions) {
    for (const opt of context.lastResponseOptions!) {
      const optLower = opt.toLowerCase();
      // Prompt closely matches an option
      if (
        normalized === optLower ||
        normalized.includes(optLower) ||
        optLower.includes(normalized)
      ) {
        return { matched: true, pattern: `context:option_match(${opt})` };
      }
    }
  }

  return { matched: false };
}

/**
 * Check if prompt is a correction.
 * Uses word boundary patterns to avoid false positives (e.g., "economy" != "no").
 */
function isCorrection(normalized: string): { matched: boolean; pattern?: string } {
  for (let i = 0; i < CORRECTION_INDICATORS.length; i++) {
    const pattern = CORRECTION_INDICATORS[i]!;
    if (pattern.test(normalized)) {
      return { matched: true, pattern: `regex:correction[${i}]` };
    }
  }
  return { matched: false };
}

/**
 * Check if prompt is a clarification.
 * Requires question mark or explicit clarification keywords.
 */
function isClarification(normalized: string): { matched: boolean; pattern?: string } {
  const isQuestion = normalized.endsWith('?');

  for (let i = 0; i < CLARIFICATION_PATTERNS.length; i++) {
    const pattern = CLARIFICATION_PATTERNS[i]!;
    if (pattern.test(normalized)) {
      // First 3 patterns require "?" (why?, how does?, what does?)
      // Patterns 3-5 are keyword patterns (explain, clarify, elaborate)
      // Other patterns have built-in question requirements or are clear clarification requests
      const requiresQuestion = i < 3;
      if (!requiresQuestion || isQuestion) {
        return { matched: true, pattern: `regex:clarification[${i}]` };
      }
    }
  }

  return { matched: false };
}

// ============================================================================
// MAIN CLASSIFICATION FUNCTION
// ============================================================================

/**
 * Classify a prompt using heuristic pattern matching.
 *
 * Pattern priority order:
 * 1. First message in session -> initiating (100% deterministic)
 * 2. Confirmation patterns -> confirmation (0.9 confidence)
 * 3. Selection patterns -> selection (0.95 confidence)
 * 4. Correction patterns -> correction (0.85 confidence)
 * 5. Clarification patterns -> clarification (0.8 confidence)
 * 6. Default -> continuation (0.6 confidence, triggers LLM fallback)
 *
 * @param prompt - The user's prompt text
 * @param context - Conversation context including message index and previous options
 * @returns Classification result with prompt type, confidence, and method
 *
 * @example
 * ```ts
 * // First message in session
 * classifyByHeuristics('Help me build an API', { messageIndex: 0 })
 * // => { promptType: 'initiating', confidence: 0.95, method: 'heuristic' }
 *
 * // Confirmation
 * classifyByHeuristics('yes, proceed', { messageIndex: 1 })
 * // => { promptType: 'confirmation', confidence: 0.9, method: 'heuristic' }
 *
 * // Selection with context
 * classifyByHeuristics('Option 2', { messageIndex: 2, lastResponseOptions: ['1', '2', '3'] })
 * // => { promptType: 'selection', confidence: 0.95, method: 'heuristic' }
 *
 * // Correction
 * classifyByHeuristics('No, I meant the other file', { messageIndex: 1 })
 * // => { promptType: 'correction', confidence: 0.85, method: 'heuristic' }
 * ```
 */
export function classifyByHeuristics(
  prompt: string,
  context: ConversationContext
): ConversationClassificationResult {
  const normalized = normalizePrompt(prompt);

  // 1. First message in session is always initiating
  if (context.messageIndex === 0) {
    return makeResult('initiating', CLASSIFICATION_CONFIDENCE.INITIATING, 'first_message');
  }

  // 2. Check for confirmation (highest priority after initiating)
  const confirmationMatch = isConfirmation(normalized);
  if (confirmationMatch.matched) {
    return makeResult(
      'confirmation',
      CLASSIFICATION_CONFIDENCE.CONFIRMATION,
      confirmationMatch.pattern
    );
  }

  // 3. Check for selection (requires context about options)
  const selectionMatch = isSelection(normalized, context);
  if (selectionMatch.matched) {
    return makeResult(
      'selection',
      CLASSIFICATION_CONFIDENCE.SELECTION,
      selectionMatch.pattern
    );
  }

  // 4. Check for correction
  const correctionMatch = isCorrection(normalized);
  if (correctionMatch.matched) {
    return makeResult(
      'correction',
      CLASSIFICATION_CONFIDENCE.CORRECTION,
      correctionMatch.pattern
    );
  }

  // 5. Check for clarification
  const clarificationMatch = isClarification(normalized);
  if (clarificationMatch.matched) {
    return makeResult(
      'clarification',
      CLASSIFICATION_CONFIDENCE.CLARIFICATION,
      clarificationMatch.pattern
    );
  }

  // 6. Default to continuation with low confidence (triggers LLM fallback)
  return makeResult('continuation', CLASSIFICATION_CONFIDENCE.CONTINUATION, 'default');
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Pattern sets (for testing/debugging)
  CONFIRMATION_EXACT_MATCHES,
  CONFIRMATION_PATTERNS,
  SELECTION_PATTERNS,
  SELECTION_MAX_LENGTH,
  CORRECTION_INDICATORS,
  CLARIFICATION_PATTERNS,
  // Helper functions (for testing)
  normalizePrompt,
  isConfirmation,
  isSelection,
  isCorrection,
  isClarification,
};
