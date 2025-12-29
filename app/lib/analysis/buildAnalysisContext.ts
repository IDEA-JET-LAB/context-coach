/**
 * Analysis Context Builder
 * Story 27-3: Context Building for Analysis
 *
 * Builds conversation context from the database for AI analysis.
 * Retrieves preceding prompts and responses, applies token budgeting,
 * and formats context for the LLM analyzer.
 *
 * The algorithm:
 * 1. Query the target prompt to get session ID and sequence number
 * 2. Handle first message case (no prior context)
 * 3. Query preceding prompts with responses (newest first)
 * 4. Apply token budget by including messages from most recent backwards
 * 5. Reverse to chronological order for LLM consumption
 * 6. Build last response summary with question/options detection
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';
import { isValidUuid } from '@/lib/utils/uuid';
import { estimateTokens, truncateToFit } from './tokenEstimator';
import { summarizeResponse, detectQuestion, extractToolsUsed } from './responseSummarizer';
import { extractOptionsFromResponse } from './optionExtractor';

const logger = createScopedLogger('CONTEXT');

// ============================================================================
// Types
// ============================================================================

/**
 * Valid prompt classification values for conversation role.
 */
export type PromptType =
  | 'initiating'
  | 'continuation'
  | 'selection'
  | 'correction'
  | 'confirmation'
  | 'clarification'
  | 'tool_result';

/**
 * Valid project stage values.
 */
export type ProjectStage =
  | 'architecture'
  | 'specification'
  | 'development'
  | 'debugging'
  | 'enhancement'
  | 'planning'
  | 'implementation'
  | 'refactoring'
  | 'testing'
  | 'documentation'
  | 'review'
  | 'exploration'
  | 'unknown';

/**
 * Options for building analysis context.
 */
export interface AnalysisContextOptions {
  /** Maximum number of messages to include (default: 50) */
  maxMessages?: number;
  /** Token budget for context (default: 10000) */
  tokenBudget?: number;
  /** Include assistant responses in context (default: true) */
  includeResponses?: boolean;
  /** Maximum length for response summaries (default: 500) */
  summaryLength?: number;
}

/**
 * Default options for context building.
 */
export const DEFAULT_CONTEXT_OPTIONS: Required<AnalysisContextOptions> = {
  maxMessages: 50,
  tokenBudget: 10000,
  includeResponses: true,
  summaryLength: 500,
};

/**
 * A message in the conversation context.
 */
export interface ConversationMessage {
  /** Role of the message sender */
  role: 'user' | 'assistant';
  /** Message content (may be truncated) */
  content: string;
  /** Prompt type for user messages */
  promptType?: PromptType;
  /** Whether the content was truncated */
  truncated: boolean;
  /** Estimated token count */
  tokenCount: number;
  /** Timestamp of the message */
  timestamp?: string;
}

/**
 * Summary of the last AI response.
 */
export interface ResponseSummary {
  /** Summarized or truncated text */
  text: string;
  /** Original character count */
  fullLength: number;
  /** Whether the response asked a question */
  askedQuestion: boolean;
  /** Options extracted from the response */
  presentedOptions: string[];
  /** Tools used in the response */
  toolsUsed: string[];
}

/**
 * Metadata about the session.
 */
export interface SessionMetadata {
  /** Primary project stage for the session */
  primaryStage?: ProjectStage;
  /** Whether a debugging loop was detected */
  hasDebuggingLoop: boolean;
  /** Total prompt count in the session */
  promptCount: number;
}

/**
 * Result of building analysis context.
 */
export interface AnalysisContext {
  /** Session ID */
  sessionId: string;
  /** 0-based position of current prompt in conversation */
  messageIndex: number;
  /** Preceding messages in chronological order */
  messages: ConversationMessage[];
  /** Summary of the last AI response */
  lastResponse?: ResponseSummary;
  /** Options from the last response (convenience accessor) */
  lastResponseOptions?: string[];
  /** Token budget used for this context */
  tokenBudget: number;
  /** Total tokens used in context */
  totalTokens: number;
  /** Session metadata */
  sessionMetadata?: SessionMetadata;
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry {
  context: AnalysisContext;
  expiresAt: number;
}

/** In-memory cache for context results */
const contextCache = new Map<string, CacheEntry>();

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Generate cache key for a prompt context.
 */
function getCacheKey(promptId: string): string {
  return `context:${promptId}`;
}

/**
 * Get cached context if available and not expired.
 */
function getCachedContext(promptId: string): AnalysisContext | null {
  const key = getCacheKey(promptId);
  const entry = contextCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    contextCache.delete(key);
    return null;
  }

  return entry.context;
}

/**
 * Cache a context result.
 */
function setCachedContext(promptId: string, context: AnalysisContext): void {
  const key = getCacheKey(promptId);
  contextCache.set(key, {
    context,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Clear the context cache (useful for testing).
 */
export function clearContextCache(): void {
  contextCache.clear();
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build conversation context for a prompt to be analyzed.
 *
 * Retrieves preceding prompts and responses from the database,
 * applies token budget constraints, and formats for LLM consumption.
 *
 * @param promptId - The prompt ID to build context for
 * @param options - Context building options
 * @returns Analysis context, or throws if prompt not found
 *
 * @example
 * const context = await buildAnalysisContext(promptId, {
 *   tokenBudget: 8000,
 *   maxMessages: 30
 * });
 *
 * console.log(`Built context with ${context.messages.length} messages`);
 */
export async function buildAnalysisContext(
  promptId: string,
  options: AnalysisContextOptions = {}
): Promise<AnalysisContext> {
  // Validate input
  if (!isValidUuid(promptId)) {
    throw new Error(`Invalid prompt ID: ${promptId}`);
  }

  // Check cache first
  const cached = getCachedContext(promptId);
  if (cached) {
    logger.debug('Cache hit', { promptId });
    return cached;
  }

  const opts = { ...DEFAULT_CONTEXT_OPTIONS, ...options };
  const supabase = createAdminClient();

  // 1. Get the prompt and its session
  const { data: prompt, error: promptError } = await supabase
    .from('prompts')
    .select(
      `
      id,
      session_uuid,
      text,
      sequence_number,
      created_at
    `
    )
    .eq('id', promptId)
    .single();

  if (promptError || !prompt) {
    logger.error('Failed to fetch prompt', promptError, { promptId });
    throw new Error(`Prompt not found: ${promptId}`);
  }

  const sessionId = prompt.session_uuid;

  // 2. Handle first message case (no prior context)
  if (prompt.sequence_number === 1) {
    logger.debug('First message in session, no prior context', { promptId });

    const result: AnalysisContext = {
      sessionId,
      messageIndex: 0,
      messages: [],
      lastResponse: undefined,
      lastResponseOptions: undefined,
      tokenBudget: opts.tokenBudget,
      totalTokens: 0,
    };

    // Get session metadata
    const { data: session } = await supabase
      .from('sessions')
      .select('primary_stage, has_debugging_loop, user_message_count')
      .eq('id', sessionId)
      .single();

    if (session) {
      result.sessionMetadata = {
        primaryStage: session.primary_stage as ProjectStage | undefined,
        hasDebuggingLoop: session.has_debugging_loop ?? false,
        promptCount: session.user_message_count ?? 0,
      };
    }

    setCachedContext(promptId, result);
    logger.log('Built context for prompt', {
      promptId,
      messageCount: 0,
      tokenCount: 0,
    });

    return result;
  }

  // 3. Get preceding prompts with responses
  const { data: precedingData, error: precedingError } = await supabase
    .from('prompts')
    .select(
      `
      id,
      text,
      prompt_classification,
      sequence_number,
      created_at,
      prompt_responses (
        id,
        response_text_encrypted,
        thinking_summary,
        tools_used,
        model
      )
    `
    )
    .eq('session_uuid', sessionId)
    .lt('sequence_number', prompt.sequence_number)
    .order('sequence_number', { ascending: true })
    .limit(opts.maxMessages);

  if (precedingError) {
    logger.error('Failed to fetch preceding prompts', precedingError, {
      sessionId,
      promptId,
    });
    throw new Error(`Failed to fetch context: ${precedingError.message}`);
  }

  const precedingPrompts = precedingData || [];

  // 4. Build messages with token budget
  // Process from most recent to oldest (for token budget)
  const messages: ConversationMessage[] = [];
  let totalTokens = 0;
  let lastResponse: ResponseSummary | undefined;

  // Reverse to process newest first
  const reversed = [...precedingPrompts].reverse();

  for (const p of reversed) {
    // User message
    const userContent = p.text;
    const userTokens = estimateTokens(userContent);

    if (totalTokens + userTokens > opts.tokenBudget) {
      // Truncate and stop
      const truncated = truncateToFit(userContent, opts.tokenBudget - totalTokens);
      if (truncated) {
        messages.unshift({
          role: 'user',
          content: truncated,
          promptType: p.prompt_classification as PromptType | undefined,
          truncated: true,
          tokenCount: opts.tokenBudget - totalTokens,
          timestamp: p.created_at,
        });
        totalTokens = opts.tokenBudget;
      }
      break;
    }

    messages.unshift({
      role: 'user',
      content: userContent,
      promptType: p.prompt_classification as PromptType | undefined,
      truncated: false,
      tokenCount: userTokens,
      timestamp: p.created_at,
    });
    totalTokens += userTokens;

    // Assistant message (if responses enabled and exists)
    if (opts.includeResponses && p.prompt_responses?.length > 0) {
      const response = p.prompt_responses[0];

      // Get decrypted response text
      let responseText = '';
      if (response?.id) {
        const { data: decryptedResponse } = await supabase.rpc(
          'get_decrypted_response',
          { p_response_id: response.id }
        );

        if (decryptedResponse?.[0]?.response_text) {
          responseText = decryptedResponse[0].response_text;
        }
      }

      if (responseText) {
        const summarized = summarizeResponse(responseText, opts.summaryLength);
        const responseTokens = estimateTokens(summarized);

        if (totalTokens + responseTokens > opts.tokenBudget) {
          // Skip this response to stay in budget
          continue;
        }

        messages.unshift({
          role: 'assistant',
          content: summarized,
          truncated: responseText.length > opts.summaryLength,
          tokenCount: responseTokens,
        });
        totalTokens += responseTokens;

        // Capture last response (first one we process since going newest-first)
        if (!lastResponse) {
          lastResponse = {
            text: summarized,
            fullLength: responseText.length,
            askedQuestion: detectQuestion(responseText),
            presentedOptions: extractOptionsFromResponse(responseText),
            toolsUsed: extractToolsUsed(response?.tools_used) || [],
          };
        }
      }
    }
  }

  // Messages are already in chronological order due to unshift
  // (we processed newest first and unshifted each one)

  // 5. Get session metadata
  const { data: session } = await supabase
    .from('sessions')
    .select('primary_stage, has_debugging_loop, user_message_count')
    .eq('id', sessionId)
    .single();

  const result: AnalysisContext = {
    sessionId,
    messageIndex: prompt.sequence_number - 1, // 0-based
    messages,
    lastResponse,
    lastResponseOptions: lastResponse?.presentedOptions,
    tokenBudget: opts.tokenBudget,
    totalTokens,
    sessionMetadata: session
      ? {
          primaryStage: session.primary_stage as ProjectStage | undefined,
          hasDebuggingLoop: session.has_debugging_loop ?? false,
          promptCount: session.user_message_count ?? 0,
        }
      : undefined,
  };

  setCachedContext(promptId, result);

  logger.log('Built context for prompt', {
    promptId,
    messageCount: messages.length,
    tokenCount: totalTokens,
  });

  return result;
}

/**
 * Format analysis context as a string for LLM prompts.
 *
 * @param context - The analysis context to format
 * @returns Formatted string representation
 */
export function formatContextForAnalysis(context: AnalysisContext): string {
  const lines: string[] = [];

  for (const msg of context.messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const truncateNote = msg.truncated ? ' [truncated]' : '';
    lines.push(`${role}${truncateNote}: ${msg.content}`);
    lines.push(''); // Empty line between messages
  }

  // Add metadata summary
  if (context.messages.length === 0) {
    lines.push('[No prior context - this is the first message in the session]');
  } else if (context.totalTokens >= context.tokenBudget * 0.9) {
    lines.push(
      `[Context truncated: showing ${context.messages.length} most recent messages]`
    );
  }

  return lines.join('\n');
}
