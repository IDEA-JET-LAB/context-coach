/**
 * Tool Usage Service
 * Story 21-6: Tool Usage Profiling
 *
 * Provides functions for recording and querying tool usage per session.
 * Integrates with the session management system to track Claude Code tool usage.
 */

import { createClient } from "@supabase/supabase-js";
import {
  extractToolUsage as extractTools,
  calculateToolDistribution,
  generateToolInsights,
  classifyUserProfile,
  type ToolDistribution,
  type ToolUsageProfile,
} from "@/lib/analysis/tool-usage-tracker";
import { createScopedLogger } from "@/lib/utils/logger";

const logger = createScopedLogger("TOOL_USAGE");

// ============================================================================
// Types
// ============================================================================

/**
 * Tool usage record as stored in the database.
 */
export interface SessionToolUsageRecord {
  id: string;
  session_id: string;
  tool_name: string;
  usage_count: number;
  created_at: string;
}

/**
 * Options for recording tool usage.
 */
export interface RecordToolUsageOptions {
  /** Whether to increment existing count or set absolute value */
  mode?: "increment" | "set";
}

/**
 * Options for getting user tool distribution.
 */
export interface GetUserToolDistributionOptions {
  /** Start of the time period (default: 30 days ago) */
  since?: Date;
  /** Team ID to filter by (optional) */
  teamId?: string;
}

/**
 * Result from getting team tool averages.
 */
export interface TeamToolAveragesResult {
  team_id: string;
  period_start: string;
  period_end: string;
  member_count: number;
  total_tool_calls: number;
  averages: Record<
    string,
    {
      total_count: number;
      avg_per_user: number;
      percentage: number;
    }
  >;
}

// ============================================================================
// Supabase Client Helper
// ============================================================================

/**
 * Gets a Supabase admin client for tool usage operations.
 */
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// ============================================================================
// Recording Tool Usage
// ============================================================================

/**
 * Records tool usage for a session.
 * Uses upsert to handle both new entries and increments.
 *
 * @param sessionId - The session database UUID
 * @param toolName - Name of the tool (e.g., "Bash", "Read")
 * @param count - Number of uses to record (default: 1)
 * @param options - Recording options
 * @returns The updated record or null on error
 */
export async function recordToolUsage(
  sessionId: string,
  toolName: string,
  count: number = 1,
  options: RecordToolUsageOptions = {}
): Promise<SessionToolUsageRecord | null> {
  const { mode = "increment" } = options;

  try {
    const supabase = getAdminClient();

    if (mode === "set") {
      // Direct insert/update with specific count
      const { data, error } = await supabase
        .from("session_tool_usage")
        .upsert(
          {
            session_id: sessionId,
            tool_name: toolName,
            usage_count: count,
          },
          { onConflict: "session_id,tool_name" }
        )
        .select()
        .single();

      if (error) {
        logger.error("Failed to set tool usage", error);
        return null;
      }

      return data;
    }

    // Use the increment function for atomic increment
    const { data, error } = await supabase.rpc("increment_session_tool_usage", {
      p_session_id: sessionId,
      p_tool_name: toolName,
      p_increment: count,
    });

    if (error) {
      logger.error("Failed to increment tool usage", error);
      return null;
    }

    return data;
  } catch (err) {
    logger.error("Error recording tool usage", err);
    return null;
  }
}

/**
 * Records multiple tool usages for a session in batch.
 *
 * @param sessionId - The session database UUID
 * @param toolCounts - Map of tool names to usage counts
 * @returns Number of successful records
 */
export async function recordBatchToolUsage(
  sessionId: string,
  toolCounts: ToolDistribution
): Promise<number> {
  let successCount = 0;

  for (const [toolName, count] of Object.entries(toolCounts)) {
    const result = await recordToolUsage(sessionId, toolName, count);
    if (result) {
      successCount++;
    }
  }

  return successCount;
}

/**
 * Extracts tool usage from response data and records it for a session.
 * This is the main integration point for the response capture flow.
 *
 * @param sessionId - The session database UUID
 * @param responseData - The response data containing tool_use blocks
 * @returns Number of tool usages recorded
 */
export async function extractAndRecordToolUsage(
  sessionId: string,
  responseData: unknown
): Promise<number> {
  try {
    // Extract tool names from response
    const tools = extractTools(responseData as Parameters<typeof extractTools>[0]);

    if (tools.length === 0) {
      return 0;
    }

    // Calculate distribution
    const distribution = calculateToolDistribution(tools);

    // Record each tool usage
    const successCount = await recordBatchToolUsage(sessionId, distribution);

    logger.log("Tool usage recorded", {
      sessionId,
      toolCount: tools.length,
      uniqueTools: Object.keys(distribution).length,
      successfulRecords: successCount,
    });

    return successCount;
  } catch (err) {
    logger.error("Error extracting and recording tool usage", err);
    return 0;
  }
}

// ============================================================================
// Querying Tool Usage
// ============================================================================

/**
 * Gets tool usage distribution for a session.
 *
 * @param sessionId - The session database UUID
 * @returns Tool distribution or null on error
 */
export async function getSessionToolUsage(
  sessionId: string
): Promise<ToolDistribution | null> {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("session_tool_usage")
      .select("tool_name, usage_count")
      .eq("session_id", sessionId);

    if (error) {
      logger.error("Failed to get session tool usage", error);
      return null;
    }

    // Convert to distribution format
    const distribution: ToolDistribution = {};
    for (const row of data || []) {
      distribution[row.tool_name] = row.usage_count;
    }

    return distribution;
  } catch (err) {
    logger.error("Error getting session tool usage", err);
    return null;
  }
}

/**
 * Gets aggregated tool usage for a user across all sessions.
 *
 * @param userId - The user's UUID
 * @param options - Query options
 * @returns Tool distribution or null on error
 */
export async function getUserToolDistribution(
  userId: string,
  options: GetUserToolDistributionOptions = {}
): Promise<ToolDistribution | null> {
  const { since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), teamId } = options;

  try {
    const supabase = getAdminClient();

    // Use the database function for efficient aggregation
    const { data, error } = await supabase.rpc("get_user_tool_distribution", {
      p_user_id: userId,
      p_since: since.toISOString(),
    });

    if (error) {
      logger.error("Failed to get user tool distribution", error);
      return null;
    }

    // Extract distribution from result
    return data?.distribution || {};
  } catch (err) {
    logger.error("Error getting user tool distribution", err);
    return null;
  }
}

/**
 * Gets tool usage averages for a team.
 *
 * @param teamId - The team's UUID
 * @param since - Start of the time period (default: 30 days ago)
 * @returns Team averages or null on error
 */
export async function getTeamToolAverages(
  teamId: string,
  since: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
): Promise<TeamToolAveragesResult | null> {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase.rpc("get_team_tool_averages", {
      p_team_id: teamId,
      p_since: since.toISOString(),
    });

    if (error) {
      logger.error("Failed to get team tool averages", error);
      return null;
    }

    return data;
  } catch (err) {
    logger.error("Error getting team tool averages", err);
    return null;
  }
}

// ============================================================================
// Profile Generation
// ============================================================================

/**
 * Generates a complete tool usage profile for a user.
 *
 * @param userId - The user's UUID
 * @param options - Query options
 * @returns Complete tool usage profile or null on error
 */
export async function getUserToolProfile(
  userId: string,
  options: GetUserToolDistributionOptions = {}
): Promise<ToolUsageProfile | null> {
  const distribution = await getUserToolDistribution(userId, options);

  if (!distribution) {
    return null;
  }

  return generateToolInsights(distribution);
}

/**
 * Gets the user profile classification for a user.
 *
 * @param userId - The user's UUID
 * @param options - Query options
 * @returns Profile type and confidence or null on error
 */
export async function getUserProfileClassification(
  userId: string,
  options: GetUserToolDistributionOptions = {}
): Promise<{ profile: string; confidence: number } | null> {
  const distribution = await getUserToolDistribution(userId, options);

  if (!distribution) {
    return null;
  }

  return classifyUserProfile(distribution);
}
