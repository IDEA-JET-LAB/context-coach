/**
 * LLM Classification Service
 * Story 27-1: Prompt Classification Service
 *
 * Uses OpenAI (gpt-4o-mini) to classify prompts when heuristic
 * classification has low confidence. Fast, cheap, and accurate
 * for ambiguous cases.
 */

import type { ConversationContext } from '@/lib/types/conversation-classification';
import type {
  LLMClassificationResult,
  PromptType,
  PROMPT_TYPES,
} from '@/lib/types/classification';

// ============================================================================
// Constants
// ============================================================================

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 5000; // 5 seconds
const MAX_TOKENS = 150;

/**
 * Valid prompt types for validation.
 */
const VALID_PROMPT_TYPES: PromptType[] = [
  'initiating',
  'continuation',
  'selection',
  'correction',
  'confirmation',
  'clarification',
];

/**
 * System prompt for classification.
 */
const CLASSIFICATION_SYSTEM_PROMPT = `You are a conversation analyst classifying prompts in developer-AI interactions.

Given a prompt and its conversation context, classify it into one of these types:
- initiating: Starts a new task or introduces a new topic
- continuation: Provides information the AI requested or continues a task
- selection: Chooses from options the AI presented (e.g., "Option 2", "the second one")
- correction: Redirects or corrects the AI's approach
- confirmation: Approves the AI to proceed (e.g., "yes", "go ahead")
- clarification: Asks the AI to explain something

Respond with JSON only:
{
  "promptType": "<type>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;

// ============================================================================
// Types
// ============================================================================

/**
 * Raw response from OpenAI.
 */
interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Parsed classification response.
 */
interface ParsedClassificationResponse {
  promptType: string;
  confidence: number;
  reasoning?: string;
}

// ============================================================================
// LLM Classification Function
// ============================================================================

/**
 * Classifies a prompt using OpenAI's gpt-4o-mini model.
 *
 * @param prompt - The user's prompt text
 * @param context - Conversation context for classification
 * @returns Classification result with type, confidence, and reasoning
 * @throws Error if API call fails or response is invalid
 *
 * @example
 * ```ts
 * const result = await classifyByLLM('maybe add tests later', {
 *   messageIndex: 2,
 *   lastResponseText: 'Should I add tests now?'
 * });
 * // => { promptType: 'continuation', confidence: 0.85, reasoning: '...' }
 * ```
 */
export async function classifyByLLM(
  prompt: string,
  context: ConversationContext
): Promise<LLMClassificationResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not configured');
  }

  const userPrompt = buildClassificationPrompt(prompt, context);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0, // Deterministic
        max_tokens: MAX_TOKENS,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return parseClassificationResponse(content);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OpenAI API call timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }

    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds the user prompt for classification.
 *
 * @param prompt - The user's prompt text
 * @param context - Conversation context
 * @returns Formatted prompt for the LLM
 */
function buildClassificationPrompt(
  prompt: string,
  context: ConversationContext
): string {
  let contextSection = '';

  if (context.lastResponseText) {
    const truncatedResponse = context.lastResponseText.slice(0, 200);
    contextSection += `Previous AI response: "${truncatedResponse}${
      context.lastResponseText.length > 200 ? '...' : ''
    }"\n`;
  }

  if (context.lastResponseOptions && context.lastResponseOptions.length > 0) {
    contextSection += `Options presented: ${context.lastResponseOptions.join(', ')}\n`;
  }

  return `${contextSection}
Current prompt (message #${context.messageIndex + 1} in session):
"${prompt}"

Classify this prompt.`;
}

/**
 * Parses and validates the LLM response.
 *
 * @param content - Raw JSON string from OpenAI
 * @returns Validated classification result
 * @throws Error if response is invalid
 */
function parseClassificationResponse(content: string): LLMClassificationResult {
  let parsed: ParsedClassificationResponse;

  try {
    parsed = JSON.parse(content) as ParsedClassificationResponse;
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${content}`);
  }

  // Validate prompt type
  if (!parsed.promptType || typeof parsed.promptType !== 'string') {
    throw new Error('LLM response missing promptType');
  }

  const normalizedType = parsed.promptType.toLowerCase().trim() as PromptType;

  if (!VALID_PROMPT_TYPES.includes(normalizedType)) {
    // Map to closest valid type if possible
    const mappedType = mapToValidType(parsed.promptType);
    if (!mappedType) {
      throw new Error(`Invalid promptType from LLM: ${parsed.promptType}`);
    }
    parsed.promptType = mappedType;
  } else {
    parsed.promptType = normalizedType;
  }

  // Validate confidence
  let confidence = parsed.confidence;
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    confidence = 0.7; // Default confidence for LLM results
  }
  confidence = Math.max(0, Math.min(1, confidence)); // Clamp to 0-1

  return {
    promptType: parsed.promptType as PromptType,
    confidence,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
  };
}

/**
 * Maps invalid prompt types to valid ones.
 *
 * @param invalidType - The invalid type string
 * @returns Valid prompt type or undefined
 */
function mapToValidType(invalidType: string): PromptType | undefined {
  const normalized = invalidType.toLowerCase().trim();

  // Common variations
  const mappings: Record<string, PromptType> = {
    init: 'initiating',
    start: 'initiating',
    new: 'initiating',
    continue: 'continuation',
    followup: 'continuation',
    'follow-up': 'continuation',
    select: 'selection',
    choose: 'selection',
    pick: 'selection',
    correct: 'correction',
    fix: 'correction',
    redirect: 'correction',
    confirm: 'confirmation',
    approve: 'confirmation',
    agree: 'confirmation',
    clarify: 'clarification',
    explain: 'clarification',
    question: 'clarification',
  };

  return mappings[normalized];
}

// ============================================================================
// Exports for Testing
// ============================================================================

export { buildClassificationPrompt, parseClassificationResponse };
