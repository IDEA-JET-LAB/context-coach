/**
 * Response Storage Service
 * Story 25-1: Response Capture Endpoint
 *
 * Stores Claude Code assistant responses with encrypted response text.
 * Uses database-level encryption via the insert_encrypted_response RPC function.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedLogger } from "@/lib/utils/logger";
import type { ResponseCaptureRequest } from "@/lib/validations/response-capture";

const logger = createScopedLogger("RESPONSE-STORE");

/**
 * Tool execution details for storage
 */
export interface ToolExecution {
  name: string;
  id: string;
  input_summary?: string;
  input_full?: Record<string, unknown>;
}

/**
 * Parameters for storing a response.
 */
export interface StoreResponseParams {
  /** Database UUID of the session (from sessions.id) */
  sessionUuid: string;
  /** Message UUID from the transcript */
  messageUuid: string;
  /** Full assistant response text (will be encrypted) */
  responseText: string;
  /** Compressed thinking summary (max 500 chars, stored plain) */
  thinkingSummary?: string;
  /** Original word count of thinking before compression */
  thinkingWordCount?: number;
  /** Full thinking text (will be encrypted) */
  thinkingText?: string;
  /** Tools used in this response with optional input details */
  toolsUsed: Array<ToolExecution>;
  /** Model that generated the response */
  model: string;
  /** Token usage metrics */
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  /** Reason why Claude stopped generating */
  stopReason: string;
}

/**
 * Result from storing a response.
 */
export interface StoreResponseResult {
  /** Database UUID of the stored response */
  id: string;
}

/**
 * Stores a Claude Code response with encrypted text.
 *
 * Uses the database-level insert_encrypted_response RPC function which:
 * 1. Encrypts response_text using AES-256 (via pgcrypto)
 * 2. Stores metadata in plain text
 * 3. Links to session via session_uuid
 * 4. Stores message_uuid for later prompt correlation
 * 5. Returns the new response ID
 *
 * Note: The prompt_id is NOT set at this point because:
 * - Response may arrive before its corresponding prompt
 * - Linking happens later via message_uuid matching
 *
 * @param params - Response data to store
 * @returns The ID of the stored response
 * @throws Error if database operation fails
 */
export async function storeResponse(
  params: StoreResponseParams
): Promise<StoreResponseResult> {
  const supabase = createAdminClient();

  // Build cache stats object if cache data is available
  const cacheStats =
    params.usage.cache_creation_input_tokens !== undefined
      ? {
          creation: params.usage.cache_creation_input_tokens,
          read: params.usage.cache_read_input_tokens || 0,
        }
      : null;

  // Extract tool names for storage (tools_used column stores names only)
  const toolNames = params.toolsUsed.map((t) => t.name);

  // Use the RPC function that handles encryption server-side
  // Updated signature includes session_uuid, message_uuid, and thinking_text
  const { data, error } = await supabase.rpc("insert_encrypted_response", {
    p_prompt_id: null, // Will be linked later when prompt arrives
    p_response_text: params.responseText || null,
    p_tool_count: params.toolsUsed.length,
    p_tools_used: toolNames,
    p_model: params.model,
    p_tokens_in: params.usage.input_tokens,
    p_tokens_out: params.usage.output_tokens,
    p_has_thinking: !!params.thinkingSummary || !!params.thinkingText,
    p_thinking_summary: params.thinkingSummary || null,
    p_thinking_word_count: params.thinkingWordCount || null,
    p_thinking_text: params.thinkingText || null,
    p_stop_reason: params.stopReason,
    p_cache_stats: cacheStats,
    p_session_uuid: params.sessionUuid,
    p_message_uuid: params.messageUuid,
  });

  if (error) {
    logger.error("Failed to store response", error, {
      sessionUuid: params.sessionUuid,
      messageUuid: params.messageUuid,
      model: params.model,
    });
    throw new Error(`Failed to store response: ${error.message}`);
  }

  const responseId = data as string;

  // Insert tool executions if there are tools with input details
  const toolsWithInput = params.toolsUsed.filter(t => t.input_summary || t.input_full);
  if (toolsWithInput.length > 0 || params.toolsUsed.length > 0) {
    const toolExecutions = params.toolsUsed.map((tool, idx) => ({
      response_id: responseId,
      tool_name: tool.name,
      tool_id: tool.id,
      input_summary: tool.input_summary || tool.name,
      input_full: tool.input_full || null,
      output_summary: null, // Not available from Stop hook
      success: null, // Not available from Stop hook
      execution_order: idx + 1,
    }));

    const { error: toolError } = await supabase
      .from("tool_executions")
      .insert(toolExecutions);

    if (toolError) {
      logger.warn("Failed to store tool executions", {
        responseId,
        error: toolError.message,
      });
      // Don't fail the whole operation if tool insertion fails
    }
  }

  logger.log("Response stored successfully", {
    responseId,
    sessionUuid: params.sessionUuid,
    messageUuid: params.messageUuid,
    toolCount: params.toolsUsed.length,
    tokensIn: params.usage.input_tokens,
    tokensOut: params.usage.output_tokens,
    hasThinking: !!params.thinkingSummary || !!params.thinkingText,
    stopReason: params.stopReason,
  });

  return { id: responseId };
}

/**
 * Converts ResponseCaptureRequest to StoreResponseParams.
 *
 * @param request - The validated request from the API
 * @param sessionUuid - The database UUID of the session
 * @returns Parameters ready for storeResponse
 */
export function requestToStoreParams(
  request: ResponseCaptureRequest,
  sessionUuid: string
): StoreResponseParams {
  return {
    sessionUuid,
    messageUuid: request.message_uuid,
    responseText: request.response_text,
    thinkingSummary: request.thinking_summary,
    thinkingWordCount: request.thinking_word_count,
    thinkingText: request.thinking_text,
    toolsUsed: request.tools_used.map((t) => ({
      name: t.name,
      id: t.id,
      input_summary: t.input_summary,
      input_full: t.input_full as Record<string, unknown> | undefined,
    })),
    model: request.model,
    usage: request.usage,
    stopReason: request.stop_reason,
  };
}

/**
 * Links a response to its prompt via prompt_id.
 *
 * Called when a prompt arrives after its response, or during
 * a background linking job.
 *
 * @param responseId - The database UUID of the response
 * @param promptId - The database UUID of the prompt
 * @returns true if link was made, false if response already had a prompt
 */
export async function linkResponseToPrompt(
  responseId: string,
  promptId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("link_response_to_prompt", {
    p_response_id: responseId,
    p_prompt_id: promptId,
  });

  if (error) {
    logger.warn("Failed to link response to prompt", {
      responseId,
      promptId,
      error: error.message,
    });
    return false;
  }

  if (data) {
    logger.log("Response linked to prompt", { responseId, promptId });
  }

  return data as boolean;
}

/**
 * Finds a response by message_uuid for linking.
 *
 * @param messageUuid - The message UUID to search for
 * @returns The response ID if found, null otherwise
 */
export async function findResponseByMessageUuid(
  messageUuid: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("prompt_responses")
    .select("id")
    .eq("message_uuid", messageUuid)
    .is("prompt_id", null)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}
