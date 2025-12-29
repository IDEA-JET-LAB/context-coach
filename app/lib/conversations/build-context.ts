/**
 * Conversation Context Builder - Story 25-4
 *
 * Builds conversation context for LLM analysis from session prompts and responses.
 * Handles token budgeting to ensure context fits within model limits.
 *
 * The algorithm:
 * 1. Query messages DESC (newest first) with limit
 * 2. Iterate newest to oldest, tracking token usage
 * 3. When budget exceeded, stop adding (oldest get dropped)
 * 4. Reverse result for chronological order for LLM consumption
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { estimateTokens, truncateToTokens } from "@/lib/utils/token-estimation";
import { extractOptions } from "@/lib/analysis/option-extraction";
import { isValidUuid } from "@/lib/utils/uuid";
import { createScopedLogger } from "@/lib/utils/logger";

const logger = createScopedLogger("BUILD_CONTEXT");

/**
 * Valid prompt classification values for conversation role
 */
export type PromptClassification =
  | "initiating"
  | "continuation"
  | "selection"
  | "correction"
  | "confirmation"
  | "clarification"
  | "tool_result";

/**
 * Valid project stage values
 */
export type ProjectStage =
  | "architecture"
  | "specification"
  | "development"
  | "debugging"
  | "enhancement"
  | "planning"
  | "implementation"
  | "refactoring"
  | "testing"
  | "documentation"
  | "review"
  | "exploration"
  | "unknown";

/**
 * A message in the conversation context
 */
export interface ContextMessage {
  role: "user" | "assistant";
  content: string;
  promptType?: PromptClassification;
  tokenCount: number;
  truncated: boolean;
  promptId?: string;
  sequenceNumber?: number;
}

/**
 * Summary of the last assistant response
 */
export interface LastResponseSummary {
  content: string;
  thinkingSummary?: string;
  toolsUsed: string[];
  options?: string[];
  model?: string;
}

/**
 * Metadata about the conversation context
 */
export interface ContextMetadata {
  sessionStage: ProjectStage | null;
  hasDebuggingLoop: boolean;
  messageIndex: number;
  totalTokens: number;
  messageCount: number;
  truncated: boolean;
  tokenBudget: number;
}

/**
 * Result of building conversation context
 */
export interface ContextResult {
  messages: ContextMessage[];
  lastResponse?: LastResponseSummary;
  metadata: ContextMetadata;
}

/**
 * Options for building conversation context
 */
export interface ContextOptions {
  tokenBudget?: number;
  messageLimit?: number;
  promptId?: string;
}

/**
 * Default options for context building
 */
const DEFAULT_OPTIONS: Required<Omit<ContextOptions, "promptId">> = {
  tokenBudget: 10000,
  messageLimit: 50,
};

/**
 * Maximum content length for the last response summary
 */
const LAST_RESPONSE_SUMMARY_LENGTH = 500;

/**
 * Build conversation context for a session.
 *
 * Retrieves prompts and responses for a session, formats them for LLM consumption,
 * and enforces token budget constraints.
 *
 * @param sessionId - The session UUID to build context for
 * @param options - Context building options
 * @returns Context result with messages, last response, and metadata, or null if session not found
 *
 * @example
 * const context = await buildConversationContext(sessionId, {
 *   tokenBudget: 8000,
 *   messageLimit: 30
 * });
 *
 * if (context) {
 *   console.log(`Built context with ${context.metadata.messageCount} messages`);
 * }
 */
export async function buildConversationContext(
  sessionId: string,
  options: ContextOptions = {}
): Promise<ContextResult | null> {
  if (!isValidUuid(sessionId)) {
    logger.warn("Invalid session ID format", { sessionId });
    return null;
  }

  const { tokenBudget, messageLimit } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const { promptId } = options;

  const supabase = createAdminClient();

  // Get session metadata
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, primary_stage, has_debugging_loop")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    logger.debug("Session not found", { sessionId, error: sessionError?.message });
    return null;
  }

  // Build the prompts query
  // Query DESC (newest first) so we can apply token budget from newest
  let promptsQuery = supabase
    .from("prompts")
    .select(
      `
      id,
      text,
      sequence_number,
      prompt_classification,
      prompt_responses (
        id,
        response_text_encrypted,
        thinking_summary,
        tools_used,
        model
      )
    `
    )
    .eq("session_uuid", sessionId)
    .order("sequence_number", { ascending: false })
    .limit(messageLimit);

  // If promptId is specified, only include prompts up to that point
  if (promptId && isValidUuid(promptId)) {
    // Get sequence number of target prompt
    const { data: targetPrompt } = await supabase
      .from("prompts")
      .select("sequence_number")
      .eq("id", promptId)
      .single();

    if (targetPrompt?.sequence_number != null) {
      // Get prompts with sequence_number < target (context BEFORE the target prompt)
      promptsQuery = promptsQuery.lt("sequence_number", targetPrompt.sequence_number);
    }
  }

  const { data: prompts, error: promptsError } = await promptsQuery;

  if (promptsError) {
    logger.error("Failed to fetch prompts", promptsError, { sessionId });
    throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
  }

  // Build context with token budget
  // We iterate from newest to oldest, so when we hit budget,
  // we're dropping the oldest messages
  const tempMessages: ContextMessage[] = [];
  let totalTokens = 0;
  let truncated = false;
  let lastResponse: LastResponseSummary | undefined;

  // Iterate newest first (as returned by query)
  const promptsNewestFirst = prompts || [];

  for (const prompt of promptsNewestFirst) {
    const promptTokens = estimateTokens(prompt.text);

    // Check if adding this prompt would exceed budget
    if (totalTokens + promptTokens > tokenBudget) {
      truncated = true;
      break; // Stop adding - older messages are dropped
    }

    // Add user message
    tempMessages.push({
      role: "user",
      content: prompt.text,
      promptType: prompt.prompt_classification as PromptClassification | undefined,
      tokenCount: promptTokens,
      truncated: false,
      promptId: prompt.id,
      sequenceNumber: prompt.sequence_number,
    });
    totalTokens += promptTokens;

    // Add assistant response if exists
    const response = prompt.prompt_responses?.[0];
    if (response) {
      // Get decrypted response text using the RPC function
      let responseText = "";

      if (response.id) {
        const { data: decryptedResponse } = await supabase.rpc(
          "get_decrypted_response",
          { p_response_id: response.id }
        );

        if (decryptedResponse?.[0]?.response_text) {
          responseText = decryptedResponse[0].response_text;
        }
      }

      if (responseText) {
        const responseTokens = estimateTokens(responseText);

        if (totalTokens + responseTokens > tokenBudget) {
          // Truncate response to fit remaining budget
          const remainingBudget = tokenBudget - totalTokens;
          const {
            text: truncatedText,
            truncated: wasTruncated,
            tokenCount,
          } = truncateToTokens(responseText, remainingBudget);

          if (truncatedText) {
            tempMessages.push({
              role: "assistant",
              content: truncatedText,
              tokenCount,
              truncated: wasTruncated,
            });
            totalTokens += tokenCount;
          }
          truncated = true;
          break;
        }

        tempMessages.push({
          role: "assistant",
          content: responseText,
          tokenCount: responseTokens,
          truncated: false,
        });
        totalTokens += responseTokens;

        // Capture last response (first one we encounter since we're going newest-first)
        if (!lastResponse) {
          lastResponse = {
            content: responseText.substring(0, LAST_RESPONSE_SUMMARY_LENGTH),
            thinkingSummary: response.thinking_summary ?? undefined,
            toolsUsed: response.tools_used || [],
            options: extractOptions(responseText),
            model: response.model ?? undefined,
          };
        }
      }
    }
  }

  // Reverse to chronological order (oldest first) for LLM consumption
  // We iterated newest->oldest, now flip for oldest->newest output
  const chronologicalMessages = tempMessages.reverse();

  logger.debug("Context built", {
    sessionId,
    messageCount: chronologicalMessages.length,
    totalTokens,
    truncated,
    hasLastResponse: !!lastResponse,
  });

  return {
    messages: chronologicalMessages,
    lastResponse,
    metadata: {
      sessionStage: session.primary_stage as ProjectStage | null,
      hasDebuggingLoop: session.has_debugging_loop ?? false,
      messageIndex: promptsNewestFirst.length,
      totalTokens,
      messageCount: chronologicalMessages.length,
      truncated,
      tokenBudget,
    },
  };
}

/**
 * Format conversation context as a string for LLM prompts.
 *
 * Useful for including context directly in analysis prompts.
 *
 * @param context - The context result from buildConversationContext
 * @returns Formatted string representation of the conversation
 */
export function formatContextForLLM(context: ContextResult): string {
  const lines: string[] = [];

  for (const msg of context.messages) {
    const role = msg.role === "user" ? "User" : "Assistant";
    const truncateNote = msg.truncated ? " [truncated]" : "";
    lines.push(`${role}${truncateNote}: ${msg.content}`);
    lines.push(""); // Empty line between messages
  }

  // Add metadata summary
  if (context.metadata.truncated) {
    lines.push(
      `[Context truncated: showing ${context.metadata.messageCount} most recent messages]`
    );
  }

  return lines.join("\n");
}
