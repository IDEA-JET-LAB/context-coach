/**
 * Tool Executions API
 * Story 15-7: Tool Execution Capture
 *
 * API functions for storing and retrieving tool execution records.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ToolExecution } from "@/lib/transcript/extract-responses";
import type { ToolResult } from "@/lib/transcript/extract-tool-results";

// ============================================================================
// Types
// ============================================================================

/**
 * Tool execution record as stored in the database
 */
export interface StoredToolExecution {
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
 * Input for storing a single tool execution
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
 * Options for storing tool executions
 */
export interface StoreToolExecutionsOptions {
  /** Whether to store full input JSON (default: true) */
  storeFullInput?: boolean;
}

/**
 * Options for getting tool usage stats
 */
export interface GetToolUsageStatsOptions {
  /** Start of the time period (default: 30 days ago) */
  since?: Date;
  /** Maximum number of tools to return (default: 20) */
  limit?: number;
}

/**
 * Tool usage statistics returned from the database
 */
export interface ToolUsageStats {
  period_start: string;
  period_end: string;
  team_id: string;
  total_executions: number;
  tools: Array<{
    tool_name: string;
    execution_count: number;
    success_count: number;
    failure_count: number;
    unmatched_count: number;
    success_rate: number | null;
  }>;
}

/**
 * Result of storing tool executions
 */
export interface StoreToolExecutionsResult {
  stored: number;
  ids: string[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Store tool executions for a response.
 *
 * Takes extracted tool executions and tool results, matches them,
 * and stores the combined data.
 *
 * @param responseId - The prompt_response ID to link executions to
 * @param tools - Array of extracted tool executions
 * @param toolResults - Map of tool_use_id to ToolResult (for matching)
 * @param options - Storage options
 * @returns The IDs of stored executions
 *
 * @example
 * ```typescript
 * const { responses } = extractResponses(messages);
 * const toolResults = extractToolResults(messages);
 *
 * for (const response of responses) {
 *   const result = await storeToolExecutions(
 *     storedResponseId,
 *     response.toolsUsed,
 *     toolResults
 *   );
 *   console.log(`Stored ${result.stored} tool executions`);
 * }
 * ```
 */
export async function storeToolExecutions(
  responseId: string,
  tools: ToolExecution[],
  toolResults: Map<string, ToolResult>,
  options: StoreToolExecutionsOptions = {}
): Promise<StoreToolExecutionsResult> {
  const { storeFullInput = true } = options;
  const supabase = createAdminClient();

  if (tools.length === 0) {
    return { stored: 0, ids: [] };
  }

  // Build records to insert
  const records: StoreToolExecutionInput[] = tools.map((tool) => {
    const result = toolResults.get(tool.toolId);
    const hasResult = result !== undefined;

    return {
      response_id: responseId,
      tool_name: tool.name,
      tool_id: tool.toolId || null,
      input_summary: tool.inputSummary,
      input_full: storeFullInput ? tool.input : null,
      output_summary: hasResult ? result.content : null,
      result_matched: hasResult,
      success: hasResult ? !result.isError : null,
      execution_order: tool.order,
    };
  });

  const { data, error } = await supabase
    .from("tool_executions")
    .insert(records)
    .select("id");

  if (error) {
    console.error("[API] storeToolExecutions error:", error);
    throw new Error(`Failed to store tool executions: ${error.message}`);
  }

  const ids = (data || []).map((row: { id: string }) => row.id);

  return {
    stored: ids.length,
    ids,
  };
}

/**
 * Store a single tool execution.
 *
 * @param input - The tool execution data
 * @returns The ID of the stored execution
 */
export async function storeToolExecution(
  input: StoreToolExecutionInput
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tool_executions")
    .insert(input)
    .select("id")
    .single();

  if (error) {
    console.error("[API] storeToolExecution error:", error);
    throw new Error(`Failed to store tool execution: ${error.message}`);
  }

  return data.id;
}

/**
 * Get all tool executions for a response.
 *
 * @param responseId - The prompt_response ID
 * @returns Array of tool executions ordered by execution_order
 */
export async function getToolExecutionsForResponse(
  responseId: string
): Promise<StoredToolExecution[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tool_executions")
    .select("*")
    .eq("response_id", responseId)
    .order("execution_order", { ascending: true });

  if (error) {
    console.error("[API] getToolExecutionsForResponse error:", error);
    throw new Error(`Failed to get tool executions: ${error.message}`);
  }

  return (data || []) as StoredToolExecution[];
}

/**
 * Get all tool executions for a response using admin client.
 *
 * @param responseId - The prompt_response ID
 * @returns Array of tool executions ordered by execution_order
 */
export async function getToolExecutionsForResponseAdmin(
  responseId: string
): Promise<StoredToolExecution[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tool_executions")
    .select("*")
    .eq("response_id", responseId)
    .order("execution_order", { ascending: true });

  if (error) {
    console.error("[API] getToolExecutionsForResponseAdmin error:", error);
    throw new Error(`Failed to get tool executions: ${error.message}`);
  }

  return (data || []) as StoredToolExecution[];
}

/**
 * Get tool usage statistics for a team.
 *
 * Uses the get_tool_usage_stats RPC function which aggregates
 * tool execution data for analytics.
 *
 * @param teamId - The team ID to get stats for
 * @param options - Query options (since, limit)
 * @returns Tool usage statistics or null if no access
 */
export async function getToolUsageStats(
  teamId: string,
  options: GetToolUsageStatsOptions = {}
): Promise<ToolUsageStats | null> {
  const supabase = await createClient();

  const since = options.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const limit = options.limit || 20;

  const { data, error } = await supabase.rpc("get_tool_usage_stats", {
    p_team_id: teamId,
    p_since: since.toISOString(),
    p_limit: limit,
  });

  if (error) {
    console.error("[API] getToolUsageStats error:", error);
    throw new Error(`Failed to get tool usage stats: ${error.message}`);
  }

  return data as ToolUsageStats | null;
}

/**
 * Get tool usage statistics for a team using admin client.
 *
 * @param teamId - The team ID to get stats for
 * @param options - Query options (since, limit)
 * @returns Tool usage statistics
 */
export async function getToolUsageStatsAdmin(
  teamId: string,
  options: GetToolUsageStatsOptions = {}
): Promise<ToolUsageStats | null> {
  const supabase = createAdminClient();

  const since = options.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const limit = options.limit || 20;

  const { data, error } = await supabase.rpc("get_tool_usage_stats", {
    p_team_id: teamId,
    p_since: since.toISOString(),
    p_limit: limit,
  });

  if (error) {
    console.error("[API] getToolUsageStatsAdmin error:", error);
    throw new Error(`Failed to get tool usage stats: ${error.message}`);
  }

  return data as ToolUsageStats | null;
}

/**
 * Delete all tool executions for a response.
 *
 * @param responseId - The prompt_response ID
 * @returns Number of deleted records
 */
export async function deleteToolExecutionsForResponse(
  responseId: string
): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tool_executions")
    .delete()
    .eq("response_id", responseId)
    .select("id");

  if (error) {
    console.error("[API] deleteToolExecutionsForResponse error:", error);
    throw new Error(`Failed to delete tool executions: ${error.message}`);
  }

  return (data || []).length;
}

/**
 * Count tool executions for a response.
 *
 * @param responseId - The prompt_response ID
 * @returns Number of tool executions
 */
export async function countToolExecutionsForResponse(
  responseId: string
): Promise<number> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from("tool_executions")
    .select("id", { count: "exact", head: true })
    .eq("response_id", responseId);

  if (error) {
    console.error("[API] countToolExecutionsForResponse error:", error);
    throw new Error(`Failed to count tool executions: ${error.message}`);
  }

  return count || 0;
}
