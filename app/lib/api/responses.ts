/**
 * Response Storage API
 * Story 15-6: Response Storage Schema
 *
 * API functions for storing and retrieving encrypted prompt responses.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  DecryptedPromptResponse,
  PromptWithResponse,
  StorePromptResponseInput,
  StorePromptResponseResult,
} from "@/lib/db/types";

/**
 * Store a prompt response with encrypted text.
 *
 * Uses the insert_encrypted_response RPC function which handles
 * encryption server-side using AES-256.
 *
 * @param input - The response data to store
 * @returns The ID of the stored response
 */
export async function storePromptResponse(
  input: StorePromptResponseInput
): Promise<StorePromptResponseResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("insert_encrypted_response", {
    p_prompt_id: input.prompt_id,
    p_response_text: input.response_text ?? null,
    p_tool_count: input.tool_count ?? 0,
    p_tools_used: input.tools_used ?? [],
    p_model: input.model ?? null,
    p_tokens_in: input.tokens_in ?? null,
    p_tokens_out: input.tokens_out ?? null,
    p_has_thinking: input.has_thinking ?? false,
  });

  if (error) {
    console.error("[API] storePromptResponse error:", error);
    throw new Error(`Failed to store prompt response: ${error.message}`);
  }

  return { id: data as string };
}

/**
 * Get a prompt response by ID with decrypted text.
 *
 * Uses the get_decrypted_response RPC function which handles
 * decryption server-side.
 *
 * @param responseId - The response ID to fetch
 * @returns The decrypted response or null if not found
 */
export async function getDecryptedResponse(
  responseId: string
): Promise<DecryptedPromptResponse | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_decrypted_response", {
    p_response_id: responseId,
  });

  if (error) {
    console.error("[API] getDecryptedResponse error:", error);
    throw new Error(`Failed to get response: ${error.message}`);
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  // RPC returns an array, get first result
  const response = Array.isArray(data) ? data[0] : data;
  return response as DecryptedPromptResponse;
}

/**
 * Get a prompt response by prompt ID with decrypted text.
 *
 * Uses the get_decrypted_response_by_prompt RPC function which handles
 * decryption server-side.
 *
 * @param promptId - The prompt ID to fetch response for
 * @returns The decrypted response or null if not found
 */
export async function getDecryptedResponseByPrompt(
  promptId: string
): Promise<DecryptedPromptResponse | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_decrypted_response_by_prompt", {
    p_prompt_id: promptId,
  });

  if (error) {
    console.error("[API] getDecryptedResponseByPrompt error:", error);
    throw new Error(`Failed to get response: ${error.message}`);
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  // RPC returns an array, get first result
  const response = Array.isArray(data) ? data[0] : data;
  return response as DecryptedPromptResponse;
}

/**
 * Get a prompt with its associated response (decrypted).
 *
 * Fetches the prompt and its response in a single operation.
 *
 * @param promptId - The prompt ID to fetch
 * @returns The prompt with its response or null if not found
 */
export async function getPromptWithResponse(
  promptId: string
): Promise<PromptWithResponse | null> {
  const supabase = await createClient();

  // First fetch the prompt
  const { data: prompt, error: promptError } = await supabase
    .from("prompts")
    .select(
      `
      id,
      team_id,
      project_id,
      user_id,
      text,
      analyzed_text,
      prompt_type,
      char_count,
      word_count,
      created_at,
      analysis_status,
      session_uuid,
      sequence_number,
      parent_prompt_id,
      model,
      input_tokens,
      output_tokens,
      has_thinking
    `
    )
    .eq("id", promptId)
    .single();

  if (promptError) {
    if (promptError.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[API] getPromptWithResponse prompt error:", promptError);
    throw new Error(`Failed to get prompt: ${promptError.message}`);
  }

  if (!prompt) {
    return null;
  }

  // Then fetch the decrypted response
  const response = await getDecryptedResponseByPrompt(promptId);

  return {
    ...prompt,
    response,
  } as PromptWithResponse;
}

/**
 * Get a prompt response by ID using admin client (for server-side operations).
 *
 * @param responseId - The response ID to fetch
 * @returns The decrypted response or null if not found
 */
export async function getDecryptedResponseAdmin(
  responseId: string
): Promise<DecryptedPromptResponse | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_decrypted_response", {
    p_response_id: responseId,
  });

  if (error) {
    console.error("[API] getDecryptedResponseAdmin error:", error);
    throw new Error(`Failed to get response: ${error.message}`);
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  // RPC returns an array, get first result
  const response = Array.isArray(data) ? data[0] : data;
  return response as DecryptedPromptResponse;
}

/**
 * Get a prompt response by prompt ID using admin client (for server-side operations).
 *
 * @param promptId - The prompt ID to fetch response for
 * @returns The decrypted response or null if not found
 */
export async function getDecryptedResponseByPromptAdmin(
  promptId: string
): Promise<DecryptedPromptResponse | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_decrypted_response_by_prompt", {
    p_prompt_id: promptId,
  });

  if (error) {
    console.error("[API] getDecryptedResponseByPromptAdmin error:", error);
    throw new Error(`Failed to get response: ${error.message}`);
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  // RPC returns an array, get first result
  const response = Array.isArray(data) ? data[0] : data;
  return response as DecryptedPromptResponse;
}
