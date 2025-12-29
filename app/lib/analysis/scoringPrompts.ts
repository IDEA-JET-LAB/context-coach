/**
 * Scoring Prompts Module
 * Story 27-4: Context-Aware Scoring
 *
 * Provides context-aware prompt templates for LLM scoring.
 * Templates include conversation context and prompt type information
 * to generate more accurate dimension scores.
 */

import type { PromptType } from '@/lib/types/classification';
import type { DimensionScores, DimensionScore } from '@/lib/types/analysis';
import type { AnalysisContext, ConversationMessage } from './buildAnalysisContext';
import { getScoringConfig, DEFAULT_DIMENSION_NAMES } from './dimensionAdjustments';

// ============================================================================
// Constants
// ============================================================================

/**
 * Dimension scoring criteria for the LLM.
 */
export const DIMENSION_CRITERIA: Record<string, string> = {
  Clarity: `
How clearly is the prompt written?
- Is the request unambiguous?
- Is the language precise and specific?
- Could the request be misunderstood?
Score 1-10: 1=very unclear, 10=crystal clear`,

  Context: `
How much relevant context is provided?
- Does it explain the current situation?
- Are relevant files, errors, or code mentioned?
- Does it reference previous conversation appropriately?
Score 1-10: 1=no context, 10=comprehensive context`,

  Goal: `
How well is the goal or outcome defined?
- Is there a clear objective?
- Are success criteria specified?
- Is the scope of work clear?
Score 1-10: 1=no goal, 10=clear measurable goal`,

  Specificity: `
How specific are the requirements?
- Are technical details provided where needed?
- Are constraints and limitations mentioned?
- Are examples or expected outputs given?
Score 1-10: 1=very vague, 10=very specific`,

  Constraints: `
How well are constraints and limitations communicated?
- Are time/resource constraints mentioned?
- Are technology constraints specified?
- Are scope boundaries clear?
Score 1-10: 1=no constraints, 10=well-defined constraints`,
};

/**
 * Prompt type descriptions for context-aware scoring.
 */
export const PROMPT_TYPE_DESCRIPTIONS: Record<PromptType, string> = {
  initiating: `This is an INITIATING prompt - the first message starting a new task or topic.
Evaluate it as a standalone request that should provide full context.`,

  continuation: `This is a CONTINUATION prompt - a follow-up to an ongoing conversation.
Some context may be implicit from prior messages. Evaluate in context of the conversation.
Note: Context dimension weight is reduced for continuation prompts.`,

  selection: `This is a SELECTION prompt - the user is choosing from options presented by the AI.
This prompt type should typically be skipped for scoring.`,

  correction: `This is a CORRECTION prompt - the user is redirecting or correcting the AI's approach.
Clarity is especially important here. Evaluate how well the correction is communicated.`,

  confirmation: `This is a CONFIRMATION prompt - the user is confirming or approving an action.
This prompt type should typically be skipped for scoring.`,

  clarification: `This is a CLARIFICATION prompt - the user is asking for explanation or understanding.
Specificity is especially important for questions. Evaluate how well the question is formulated.`,
};

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Builds the system prompt for context-aware scoring.
 *
 * @param promptType - The classified prompt type
 * @returns System prompt string
 */
export function buildSystemPrompt(promptType: PromptType): string {
  const config = getScoringConfig(promptType);
  const typeDescription = PROMPT_TYPE_DESCRIPTIONS[promptType];

  // Build dimension criteria section
  const dimensionCriteria = DEFAULT_DIMENSION_NAMES.map((dim) => {
    const adjustment = config.dimensionAdjustments[dim];
    const adjustmentNote = adjustment
      ? adjustment > 0
        ? ` (Weight INCREASED by ${adjustment}% for ${promptType} prompts)`
        : ` (Weight REDUCED by ${Math.abs(adjustment)}% for ${promptType} prompts)`
      : '';

    return `### ${dim}${adjustmentNote}\n${DIMENSION_CRITERIA[dim]}`;
  }).join('\n\n');

  return `You are an expert prompt quality analyst evaluating AI assistant prompts.

## Prompt Type Context
${typeDescription}

## Scoring Dimensions
Score each dimension from 1 to 10 with brief reasoning.

${dimensionCriteria}

## Response Format
Respond with a JSON object containing scores for each dimension:
{
  "Clarity": { "score": N, "reasoning": "..." },
  "Context": { "score": N, "reasoning": "..." },
  "Goal": { "score": N, "reasoning": "..." },
  "Specificity": { "score": N, "reasoning": "..." },
  "Constraints": { "score": N, "reasoning": "..." }
}

Important:
- Each score must be an integer from 1 to 10
- Reasoning should be 1-2 sentences explaining the score
- Consider the prompt type when scoring (some dimensions matter more for certain types)
- Output ONLY valid JSON, no additional text`;
}

/**
 * Formats conversation messages for the user prompt.
 *
 * @param messages - Conversation messages
 * @returns Formatted conversation string
 */
export function formatConversation(messages: ConversationMessage[]): string {
  if (messages.length === 0) {
    return '[No prior conversation - this is the first message]';
  }

  const formatted = messages.map((msg) => {
    const role = msg.role === 'user' ? 'USER' : 'ASSISTANT';
    const truncateNote = msg.truncated ? ' [truncated]' : '';
    return `${role}${truncateNote}: ${msg.content}`;
  });

  return formatted.join('\n\n');
}

/**
 * Builds the user prompt with context and prompt to score.
 *
 * @param promptContent - The prompt text to score
 * @param context - Optional conversation context
 * @returns User prompt string
 */
export function buildUserPrompt(
  promptContent: string,
  context?: AnalysisContext
): string {
  const parts: string[] = [];

  // Add conversation context if available
  if (context && context.messages.length > 0) {
    parts.push('## Prior Conversation');
    parts.push(formatConversation(context.messages));
    parts.push('');
  }

  // Add the prompt to score
  parts.push('## Prompt to Score');
  parts.push(promptContent);

  return parts.join('\n');
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parses the LLM response into dimension scores.
 *
 * @param response - Raw LLM response string
 * @returns Parsed dimension scores
 * @throws Error if parsing fails
 */
export function parseScoresResponse(response: string): DimensionScores {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Invalid JSON in response: ${e instanceof Error ? e.message : 'Parse error'}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Response is not a valid object');
  }

  const scores: DimensionScores = {};

  for (const dimension of DEFAULT_DIMENSION_NAMES) {
    const dimData = (parsed as Record<string, unknown>)[dimension];

    if (!dimData || typeof dimData !== 'object') {
      // Use default score if dimension missing
      scores[dimension] = {
        score: 5,
        reasoning: `${dimension} not provided in response`,
      };
      continue;
    }

    const dimObj = dimData as Record<string, unknown>;
    const score = typeof dimObj.score === 'number' ? dimObj.score : 5;
    const reasoning = typeof dimObj.reasoning === 'string' ? dimObj.reasoning : 'No reasoning provided';

    // Validate and clamp score
    const validScore = Math.max(1, Math.min(10, Math.round(score)));

    scores[dimension] = {
      score: validScore,
      reasoning,
    };
  }

  return scores;
}

/**
 * Validates dimension scores.
 *
 * @param scores - Dimension scores to validate
 * @returns Validation result
 */
export function validateScores(scores: DimensionScores): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const dimension of DEFAULT_DIMENSION_NAMES) {
    const score = scores[dimension];

    if (!score) {
      errors.push(`Missing score for ${dimension}`);
      continue;
    }

    if (typeof score.score !== 'number') {
      errors.push(`${dimension} score is not a number`);
    } else if (score.score < 1 || score.score > 10) {
      errors.push(`${dimension} score ${score.score} is out of range [1-10]`);
    }

    if (typeof score.reasoning !== 'string') {
      errors.push(`${dimension} reasoning is not a string`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Analysis Integration
// ============================================================================

/**
 * Options for analyzing a prompt with LLM.
 */
export interface AnalyzeWithContextOptions {
  /**
   * Token budget for context (default: 8000).
   */
  contextTokenBudget?: number;

  /**
   * Whether to include full reasoning in response.
   */
  includeReasoning?: boolean;
}

/**
 * Result of LLM analysis.
 */
export interface AnalysisResult {
  /**
   * Dimension scores from LLM.
   */
  scores: DimensionScores;

  /**
   * Raw LLM response (for debugging).
   */
  rawResponse?: string;

  /**
   * Number of tokens used in context.
   */
  contextTokens?: number;
}

/**
 * LLM client interface for analysis.
 */
export interface LLMClient {
  /**
   * Sends a prompt to the LLM and returns the response.
   */
  analyze: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

/**
 * Analyzes a prompt with conversation context using an LLM.
 *
 * @param promptContent - The prompt text to analyze
 * @param promptType - The classified prompt type
 * @param context - Optional conversation context
 * @param client - LLM client for analysis
 * @param options - Analysis options
 * @returns Analysis result with dimension scores
 *
 * @example
 * ```ts
 * const result = await analyzeWithContext(
 *   'Add error handling to the API',
 *   'continuation',
 *   context,
 *   openaiClient
 * );
 * console.log(result.scores.Clarity.score); // e.g., 7
 * ```
 */
export async function analyzeWithContext(
  promptContent: string,
  promptType: PromptType,
  context: AnalysisContext | undefined,
  client: LLMClient,
  options: AnalyzeWithContextOptions = {}
): Promise<AnalysisResult> {
  const systemPrompt = buildSystemPrompt(promptType);
  const userPrompt = buildUserPrompt(promptContent, context);

  const rawResponse = await client.analyze(systemPrompt, userPrompt);
  const scores = parseScoresResponse(rawResponse);

  return {
    scores,
    rawResponse: options.includeReasoning ? rawResponse : undefined,
    contextTokens: context?.totalTokens,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates an empty analysis result with default scores.
 *
 * @returns Empty analysis result
 */
export function createEmptyAnalysisResult(): AnalysisResult {
  const scores: DimensionScores = {};

  for (const dimension of DEFAULT_DIMENSION_NAMES) {
    scores[dimension] = {
      score: 5,
      reasoning: 'Analysis not performed',
    };
  }

  return { scores };
}

/**
 * Merges partial scores with defaults.
 *
 * @param partial - Partial scores from analysis
 * @returns Complete scores with defaults filled in
 */
export function mergeWithDefaults(partial: Partial<DimensionScores>): DimensionScores {
  const scores: DimensionScores = {};

  for (const dimension of DEFAULT_DIMENSION_NAMES) {
    const existing = partial[dimension];
    scores[dimension] = existing ?? {
      score: 5,
      reasoning: `${dimension} score not provided`,
    };
  }

  return scores;
}

/**
 * Extracts dimension names from scores.
 *
 * @param scores - Dimension scores
 * @returns Array of dimension names
 */
export function extractDimensionNames(scores: DimensionScores): string[] {
  return Object.keys(scores).filter((key) => {
    const score = scores[key];
    return score && typeof score.score === 'number';
  });
}

/**
 * Calculates simple average of all dimension scores.
 *
 * @param scores - Dimension scores
 * @returns Average score
 */
export function calculateSimpleAverage(scores: DimensionScores): number {
  const dimensions = extractDimensionNames(scores);
  if (dimensions.length === 0) return 0;

  const sum = dimensions.reduce((acc, dim) => acc + (scores[dim]?.score ?? 0), 0);
  return sum / dimensions.length;
}
