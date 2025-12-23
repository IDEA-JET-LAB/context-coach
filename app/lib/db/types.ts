/**
 * Database Types
 * Story 15-6: Response Storage Schema
 * Story 15-7: Tool Execution Capture
 *
 * TypeScript interfaces for prompt_responses and tool_executions tables.
 */

import type { Prompt } from "@/lib/types/prompt";

/**
 * Prompt response record from the database (encrypted form)
 */
export interface PromptResponse {
  id: string;
  prompt_id: string;
  response_text_encrypted: Uint8Array | null;
  tool_count: number;
  tools_used: string[];
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  has_thinking: boolean;
  created_at: string;
}

/**
 * Prompt response with decrypted text (from RPC functions)
 */
export interface DecryptedPromptResponse {
  id: string;
  prompt_id: string;
  response_text: string | null;
  tool_count: number;
  tools_used: string[];
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  has_thinking: boolean;
  created_at: string;
}

/**
 * Extended prompt with session and model information
 */
export interface PromptWithSession extends Prompt {
  session_uuid: string | null;
  sequence_number: number | null;
  parent_prompt_id: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  has_thinking: boolean;
}

/**
 * Prompt with its associated response (decrypted)
 */
export interface PromptWithResponse extends PromptWithSession {
  response: DecryptedPromptResponse | null;
}

/**
 * Input for storing a new prompt response
 */
export interface StorePromptResponseInput {
  prompt_id: string;
  response_text?: string | null;
  tool_count?: number;
  tools_used?: string[];
  model?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  has_thinking?: boolean;
}

/**
 * Result of storing a prompt response
 */
export interface StorePromptResponseResult {
  id: string;
}

// ============================================================================
// Tool Execution Types (Story 15-7)
// ============================================================================

/**
 * Tool execution record from the database
 */
export interface ToolExecution {
  id: string;
  response_id: string;
  tool_name: string;
  tool_id: string | null;
  input_summary: string;
  input_full: Record<string, unknown> | null;
  output_summary: string | null;
  result_matched: boolean;
  success: boolean | null;
  execution_order: number;
  created_at: string;
}

/**
 * Input for storing a new tool execution
 */
export interface StoreToolExecutionInput {
  response_id: string;
  tool_name: string;
  tool_id?: string | null;
  input_summary: string;
  input_full?: Record<string, unknown> | null;
  output_summary?: string | null;
  result_matched?: boolean;
  success?: boolean | null;
  execution_order: number;
}

/**
 * Tool usage statistics from get_tool_usage_stats RPC
 */
export interface ToolUsageStats {
  period_start: string;
  period_end: string;
  team_id: string;
  total_executions: number;
  tools: ToolStatItem[];
}

/**
 * Individual tool statistics item
 */
export interface ToolStatItem {
  tool_name: string;
  execution_count: number;
  success_count: number;
  failure_count: number;
  unmatched_count: number;
  success_rate: number | null;
}

/**
 * Prompt response with tool executions
 */
export interface PromptResponseWithTools extends DecryptedPromptResponse {
  tool_executions: ToolExecution[];
}
