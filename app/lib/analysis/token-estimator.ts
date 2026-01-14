/**
 * Token Estimation Service
 * Story 30-4: Token Estimation Service
 *
 * Provides comprehensive token estimation and cost calculation
 * for conversation analysis using Anthropic models.
 *
 * Performance Requirements:
 * - <50ms for typical conversations
 * - No external dependencies (no tiktoken)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Summary of a tool call for token estimation.
 */
export interface ToolCallSummary {
  name: string;
  inputSummary: string;
}

/**
 * Content to estimate tokens for.
 */
export interface ContentForEstimation {
  prompts: string[];
  responses: string[];
  thinking: string[];
  tools: ToolCallSummary[];
}

/**
 * Token count breakdown by content type.
 */
export interface TokenEstimate {
  prompts: number;
  responses: number;
  thinking: number;
  tools: number;
  systemPrompt: number;
  total: number;
}

/**
 * Cost breakdown for a single model.
 */
export interface CostBreakdown {
  inputCents: number;
  outputCents: number;
  totalCents: number;
}

/**
 * Cost estimates across all model tiers.
 */
export interface CostEstimate {
  haiku: CostBreakdown;
  sonnet: CostBreakdown;
  opus: CostBreakdown;
}

/**
 * Options for conversation token estimation.
 */
export interface EstimationOptions {
  includeSystemPrompt?: boolean;
  estimatedOutputTokens?: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Pricing per 1M tokens (in dollars).
 * Source: Anthropic pricing as of 2024.
 */
export const MODEL_PRICING = {
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
} as const;

/**
 * Default estimated output tokens for cost calculation.
 */
const ESTIMATED_OUTPUT_TOKENS = 500;

/**
 * Characters per token ratio (approximate).
 * English text averages ~4 chars/token, but code is denser.
 * We use 3.5 as a reasonable middle ground.
 */
const CHARS_PER_TOKEN = 3.5;

/**
 * Code indicators that suggest denser tokenization.
 */
const CODE_INDICATORS = ['```', 'function', 'const ', 'import ', 'export ', 'class ', 'def ', 'return '];

/**
 * Adjustment factor for code content (more tokens per char).
 */
const CODE_ADJUSTMENT = 1.2;

/**
 * System prompt for conversation analysis.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing developer-AI conversations to provide feedback on context engineering effectiveness.

Analyze the provided conversation and answer the user's question. Focus on:
- How well the user communicated their intent
- Whether sufficient context was provided upfront
- Efficiency of the interaction (unnecessary back-and-forth)
- Opportunities for improvement

IMPORTANT: Recognize that prompts starting with "/" (slash commands) are intentional invocations of pre-configured tools, workflows, or agents. Examples include:
- /commit, /review-pr, /help - Built-in Claude Code commands
- /bmad:bmm:workflows:*, /bmad:bmm:agents:* - BMAD framework workflows and agents
- Any prompt pattern matching /[a-z-]+:* or /[a-z-]+

These slash commands do NOT require detailed context in the initial prompt because:
1. They activate pre-defined behaviors with their own instructions
2. The AI agent/workflow provides its own guidance and may ask follow-up questions
3. This is the intended way to invoke these tools

When analyzing conversations that start with slash commands:
- Do NOT criticize the lack of context in the initial prompt
- Focus on how well the user interacted AFTER the workflow/agent was activated
- Evaluate the quality of responses to any follow-up questions from the agent
- Assess whether the user's subsequent inputs were clear and relevant

Be specific and actionable in your feedback.`;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Estimates the token count for a given text.
 *
 * Uses a heuristic of ~3.5 characters per token for general text,
 * with an adjustment for code content (more tokens due to special chars).
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * estimateTokens("Hello world"); // ~3 tokens
 * estimateTokens(""); // 0 tokens
 * estimateTokens("const x = 1;"); // ~4 tokens (code adjustment)
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Base estimate using chars per token ratio
  const baseEstimate = text.length / CHARS_PER_TOKEN;

  // Check for code content and apply adjustment
  const hasCode = CODE_INDICATORS.some((indicator) => text.includes(indicator));

  if (hasCode) {
    return Math.ceil(baseEstimate * CODE_ADJUSTMENT);
  }

  return Math.ceil(baseEstimate);
}

/**
 * Estimates tokens for an array of strings.
 *
 * @param texts - Array of text strings
 * @returns Total estimated tokens
 */
function estimateArrayTokens(texts: string[]): number {
  return texts.reduce((total, text) => total + estimateTokens(text), 0);
}

/**
 * Estimates tokens for tool calls.
 *
 * Tool calls include the tool name and input summary.
 * Format: "Tool: {name}\nInput: {summary}"
 *
 * @param tools - Array of tool call summaries
 * @returns Total estimated tokens for all tools
 */
function estimateToolTokens(tools: ToolCallSummary[]): number {
  return tools.reduce((total, tool) => {
    const toolText = `Tool: ${tool.name}\nInput: ${tool.inputSummary}`;
    return total + estimateTokens(toolText);
  }, 0);
}

/**
 * Estimates token counts for a conversation.
 *
 * @param content - Content to estimate tokens for
 * @param options - Estimation options
 * @returns Token estimate breakdown
 *
 * @example
 * const estimate = estimateConversationTokens({
 *   prompts: ["Hello, can you help me?"],
 *   responses: ["Of course! What do you need?"],
 *   thinking: ["Let me consider the request..."],
 *   tools: [{ name: "read_file", inputSummary: "path: /src/index.ts" }]
 * });
 */
export function estimateConversationTokens(
  content: ContentForEstimation,
  options: EstimationOptions = {}
): TokenEstimate {
  const { includeSystemPrompt = true } = options;

  const promptTokens = estimateArrayTokens(content.prompts);
  const responseTokens = estimateArrayTokens(content.responses);
  const thinkingTokens = estimateArrayTokens(content.thinking);
  const toolTokens = estimateToolTokens(content.tools);
  const systemPromptTokens = includeSystemPrompt ? estimateTokens(ANALYSIS_SYSTEM_PROMPT) : 0;

  const total = promptTokens + responseTokens + thinkingTokens + toolTokens + systemPromptTokens;

  return {
    prompts: promptTokens,
    responses: responseTokens,
    thinking: thinkingTokens,
    tools: toolTokens,
    systemPrompt: systemPromptTokens,
    total,
  };
}

// ============================================================================
// Cost Calculation
// ============================================================================

/**
 * Calculates cost breakdown for a specific model.
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - Model tier (haiku, sonnet, opus)
 * @returns Cost breakdown in cents
 */
function calculateModelCost(
  inputTokens: number,
  outputTokens: number,
  model: keyof typeof MODEL_PRICING
): CostBreakdown {
  const pricing = MODEL_PRICING[model];

  // Convert from $/1M tokens to cents
  // Price is per 1M tokens, so we divide by 1M and multiply by 100 for cents
  const inputCents = (inputTokens / 1_000_000) * pricing.input * 100;
  const outputCents = (outputTokens / 1_000_000) * pricing.output * 100;
  const totalCents = inputCents + outputCents;

  return {
    inputCents,
    outputCents,
    totalCents,
  };
}

/**
 * Estimates cost for a conversation across all model tiers.
 *
 * @param inputTokens - Number of input tokens
 * @param estimatedOutputTokens - Estimated output tokens (default: 500)
 * @returns Cost estimates for haiku, sonnet, and opus
 *
 * @example
 * const cost = estimateCost(10000);
 * console.log(formatCost(cost.haiku.totalCents)); // "$0.01"
 */
export function estimateCost(inputTokens: number, estimatedOutputTokens: number = ESTIMATED_OUTPUT_TOKENS): CostEstimate {
  return {
    haiku: calculateModelCost(inputTokens, estimatedOutputTokens, 'haiku'),
    sonnet: calculateModelCost(inputTokens, estimatedOutputTokens, 'sonnet'),
    opus: calculateModelCost(inputTokens, estimatedOutputTokens, 'opus'),
  };
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Formats a cost value in cents for display.
 *
 * @param cents - Cost in cents
 * @returns Formatted cost string
 *
 * @example
 * formatCost(0.5);   // "<$0.01"
 * formatCost(1.5);   // "$0.02"
 * formatCost(150);   // "$1.50"
 */
export function formatCost(cents: number): string {
  if (cents < 1) {
    return '<$0.01';
  }

  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Formats a token count for display.
 *
 * @param tokens - Number of tokens
 * @returns Formatted token string
 *
 * @example
 * formatTokens(500);     // "500"
 * formatTokens(1500);    // "1.5k"
 * formatTokens(12000);   // "12.0k"
 * formatTokens(1500000); // "1500.0k"
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  }

  const thousands = tokens / 1000;
  return `${thousands.toFixed(1)}k`;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Checks if content fits within a token budget.
 *
 * @param content - Content to estimate
 * @param maxTokens - Maximum allowed tokens
 * @returns true if content fits within budget
 */
export function fitsInBudget(content: ContentForEstimation, maxTokens: number): boolean {
  const estimate = estimateConversationTokens(content);
  return estimate.total <= maxTokens;
}

/**
 * Gets a summary of token usage for display.
 *
 * @param estimate - Token estimate
 * @returns Human-readable summary string
 */
export function getTokenSummary(estimate: TokenEstimate): string {
  const parts: string[] = [];

  if (estimate.prompts > 0) {
    parts.push(`Prompts: ${formatTokens(estimate.prompts)}`);
  }
  if (estimate.responses > 0) {
    parts.push(`Responses: ${formatTokens(estimate.responses)}`);
  }
  if (estimate.thinking > 0) {
    parts.push(`Thinking: ${formatTokens(estimate.thinking)}`);
  }
  if (estimate.tools > 0) {
    parts.push(`Tools: ${formatTokens(estimate.tools)}`);
  }
  if (estimate.systemPrompt > 0) {
    parts.push(`System: ${formatTokens(estimate.systemPrompt)}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'No content';
}
