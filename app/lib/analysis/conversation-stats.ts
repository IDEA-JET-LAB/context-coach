/**
 * Conversation Statistics Service
 * Story 30-2: Deterministic Stats Service
 *
 * Calculates deterministic statistics for a conversation session.
 * Designed for <100ms response time for typical conversations.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidUuid } from "@/lib/utils/uuid";

const logger = createScopedLogger("CONVERSATION_STATS");

// ============================================================================
// Types
// ============================================================================

/**
 * Token usage breakdown
 */
export interface TokenStats {
  /** Total input tokens consumed */
  input: number;
  /** Total output tokens generated */
  output: number;
  /** Total tokens (input + output) */
  total: number;
}

/**
 * Tool usage statistics
 */
export interface ToolUsage {
  /** Tool name (e.g., "Read", "Edit", "Bash") */
  name: string;
  /** Number of times this tool was used */
  count: number;
}

/**
 * Agent usage (detected from Task tool calls)
 */
export interface AgentUsage {
  /** Agent type (e.g., "general-purpose", "research") */
  type: string;
  /** Number of times this agent was invoked */
  count: number;
}

/**
 * Context window usage metrics
 */
export interface ContextWindowStats {
  /** Peak percentage of context window used */
  peakPercentage: number;
  /** Turn number where peak occurred */
  peakTurn: number;
  /** Average context window percentage across conversation */
  avgPercentage: number;
}

/**
 * Session outcome classification
 */
export type OutcomeStatus =
  | "completed"
  | "abandoned"
  | "ongoing"
  | "error"
  | "unknown";

/**
 * Outcome detection result
 */
export interface OutcomeResult {
  /** Classified status of the session */
  status: OutcomeStatus;
  /** Indicators that led to this classification */
  indicators: string[];
}

/**
 * Complete conversation statistics
 */
export interface ConversationStats {
  /** Session database UUID */
  sessionId: string;
  /** Number of turns (prompt-response pairs) */
  turnCount: number;
  /** Session duration in minutes (null if ongoing/unknown) */
  durationMinutes: number | null;
  /** Whether the session is still ongoing */
  isOngoing: boolean;
  /** Token usage statistics */
  tokens: TokenStats;
  /** Tools used with counts, sorted by frequency */
  tools: ToolUsage[];
  /** Agents invoked (from Task tool), sorted by frequency */
  agents: AgentUsage[];
  /** Context window usage metrics */
  contextWindow: ContextWindowStats;
  /** Session outcome classification */
  outcome: OutcomeResult;
  /** Primary category/stage (if detected) */
  category: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Claude model context window size in tokens
 */
export const CONTEXT_WINDOW_SIZE = 200_000;

/**
 * Patterns that indicate an error occurred
 */
const ERROR_PATTERNS = [
  /error:/i,
  /failed:/i,
  /exception:/i,
  /fatal:/i,
  /cannot be completed/i,
  /unable to/i,
];

/**
 * Patterns that indicate a git commit was made
 */
const COMMIT_PATTERNS = [
  /git commit/i,
  /committed/i,
  /pushed to/i,
  /merged/i,
];

/**
 * Patterns that indicate tests were run
 */
const TEST_PATTERNS = [
  /tests? pass/i,
  /all tests/i,
  /test suite/i,
  /npm test/i,
  /vitest/i,
  /jest/i,
  /playwright/i,
];

/**
 * Agent type patterns detected from Task tool input
 */
const AGENT_TYPE_PATTERNS: Record<string, RegExp> = {
  "general-purpose": /general[-_]?purpose|subagent/i,
  research: /research|explore|investigate/i,
  code: /implement|code|develop|build/i,
  test: /test|verify|validate/i,
  review: /review|analyze|audit/i,
};

// ============================================================================
// Internal Query Types
// ============================================================================

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  total_prompts: number | null;
  primary_stage: string | null;
}

interface PromptRow {
  id: string;
  input_tokens: number | null;
  output_tokens: number | null;
  sequence_number: number | null;
}

interface ResponseRow {
  id: string;
  prompt_id: string | null;
  tool_count: number | null;
  tools_used: string[] | null;
  tokens_in: number | null;
  tokens_out: number | null;
  model: string | null;
  stop_reason: string | null;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Calculates comprehensive statistics for a conversation session.
 *
 * Uses efficient database queries with joins to minimize round trips.
 * Designed for <100ms response time for typical conversations (< 100 prompts).
 *
 * @param supabase - Supabase client (admin or user-scoped)
 * @param sessionId - Database UUID of the session
 * @returns Conversation statistics
 * @throws Error if session not found or query fails
 *
 * @example
 * ```typescript
 * const stats = await calculateConversationStats(supabase, sessionId);
 * console.log(`Turn count: ${stats.turnCount}`);
 * console.log(`Total tokens: ${stats.tokens.total}`);
 * console.log(`Peak context: ${stats.contextWindow.peakPercentage}%`);
 * ```
 */
export async function calculateConversationStats(
  supabase: SupabaseClient,
  sessionId: string
): Promise<ConversationStats> {
  // Validate session ID format
  if (!isValidUuid(sessionId)) {
    throw new Error(`Invalid session ID format: ${sessionId}`);
  }

  // ========================================================================
  // Step 1: Query session with prompts and responses in a single query
  // ========================================================================
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(
      `
      id,
      started_at,
      ended_at,
      end_reason,
      total_prompts,
      primary_stage
    `
    )
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    logger.warn("Session not found", { sessionId, error: sessionError?.message });
    throw new Error(`Session not found: ${sessionId}`);
  }

  const sessionRow = session as SessionRow;

  // ========================================================================
  // Step 2: Query prompts for this session
  // ========================================================================
  const { data: prompts, error: promptsError } = await supabase
    .from("prompts")
    .select(
      `
      id,
      input_tokens,
      output_tokens,
      sequence_number
    `
    )
    .eq("session_uuid", sessionId)
    .order("sequence_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (promptsError) {
    logger.error("Failed to fetch prompts", promptsError, { sessionId });
    throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
  }

  const promptRows = (prompts || []) as PromptRow[];

  // ========================================================================
  // Step 3: Query responses for these prompts
  // ========================================================================
  const promptIds = promptRows.map((p) => p.id);
  let responseRows: ResponseRow[] = [];

  if (promptIds.length > 0) {
    // Query linked responses by prompt_id
    const { data: linkedResponses, error: linkedError } = await supabase
      .from("prompt_responses")
      .select(
        `
        id,
        prompt_id,
        tool_count,
        tools_used,
        tokens_in,
        tokens_out,
        model,
        stop_reason
      `
      )
      .in("prompt_id", promptIds);

    if (linkedError) {
      logger.warn("Failed to fetch linked responses", {
        sessionId,
        error: linkedError.message,
      });
    }

    // Also query by session_uuid (for unlinked responses)
    const { data: sessionResponses, error: sessionRespError } = await supabase
      .from("prompt_responses")
      .select(
        `
        id,
        prompt_id,
        tool_count,
        tools_used,
        tokens_in,
        tokens_out,
        model,
        stop_reason
      `
      )
      .eq("session_uuid", sessionId)
      .is("prompt_id", null);

    if (sessionRespError) {
      logger.warn("Failed to fetch session responses", {
        sessionId,
        error: sessionRespError.message,
      });
    }

    // Merge and dedupe
    const responseMap = new Map<string, ResponseRow>();
    for (const r of (linkedResponses || []) as ResponseRow[]) {
      responseMap.set(r.id, r);
    }
    for (const r of (sessionResponses || []) as ResponseRow[]) {
      if (!responseMap.has(r.id)) {
        responseMap.set(r.id, r);
      }
    }
    responseRows = Array.from(responseMap.values());
  }

  // ========================================================================
  // Step 4: Calculate statistics
  // ========================================================================

  // Turn count = number of prompts (each prompt + its response = 1 turn)
  const turnCount = promptRows.length;

  // Duration calculation
  const isOngoing = sessionRow.ended_at === null;
  const durationMinutes = calculateDuration(
    sessionRow.started_at,
    sessionRow.ended_at
  );

  // Token aggregation
  const tokens = aggregateTokens(promptRows, responseRows);

  // Tool usage aggregation
  const tools = aggregateToolUsage(responseRows);

  // Agent detection from Task tool calls
  const agents = detectAgents(responseRows);

  // Context window metrics
  const contextWindow = calculateContextWindow(promptRows, responseRows);

  // Outcome detection
  const outcome = detectOutcome(sessionRow, responseRows);

  // Category (from session's primary_stage)
  const category = sessionRow.primary_stage || null;

  logger.debug("Conversation stats calculated", {
    sessionId,
    turnCount,
    durationMinutes,
    isOngoing,
    totalTokens: tokens.total,
    toolCount: tools.length,
    agentCount: agents.length,
    outcomeStatus: outcome.status,
  });

  return {
    sessionId,
    turnCount,
    durationMinutes,
    isOngoing,
    tokens,
    tools,
    agents,
    contextWindow,
    outcome,
    category,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate session duration in minutes
 */
function calculateDuration(
  startedAt: string,
  endedAt: string | null
): number | null {
  if (!endedAt) {
    return null;
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  if (isNaN(start) || isNaN(end) || end < start) {
    return null;
  }

  return Math.round((end - start) / 60000);
}

/**
 * Aggregate token counts from prompts and responses
 */
function aggregateTokens(
  prompts: PromptRow[],
  responses: ResponseRow[]
): TokenStats {
  let input = 0;
  let output = 0;

  // Sum from prompts (input_tokens is prompt's tokens, output_tokens is the response's)
  for (const p of prompts) {
    input += p.input_tokens || 0;
    output += p.output_tokens || 0;
  }

  // Sum from responses (more accurate if available)
  for (const r of responses) {
    // Only add if not already counted from prompts
    // The prompt table may have input/output tokens from capture
    // The response table has tokens_in/tokens_out from response capture
    // Use response data as supplementary if prompt data is missing
    if (r.tokens_in && r.tokens_in > 0) {
      // Check if this response has a prompt - if so, only add if prompt didn't have tokens
      const linkedPrompt = prompts.find((p) => p.id === r.prompt_id);
      if (!linkedPrompt || (linkedPrompt.input_tokens || 0) === 0) {
        input += r.tokens_in;
      }
    }
    if (r.tokens_out && r.tokens_out > 0) {
      const linkedPrompt = prompts.find((p) => p.id === r.prompt_id);
      if (!linkedPrompt || (linkedPrompt.output_tokens || 0) === 0) {
        output += r.tokens_out;
      }
    }
  }

  return {
    input,
    output,
    total: input + output,
  };
}

/**
 * Aggregate tool usage from responses
 */
function aggregateToolUsage(responses: ResponseRow[]): ToolUsage[] {
  const toolCounts = new Map<string, number>();

  for (const r of responses) {
    if (r.tools_used && Array.isArray(r.tools_used)) {
      for (const tool of r.tools_used) {
        if (typeof tool === "string" && tool.trim()) {
          const toolName = tool.trim();
          toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
        }
      }
    }
  }

  // Convert to array and sort by count (descending)
  const tools: ToolUsage[] = [];
  for (const [name, count] of toolCounts.entries()) {
    tools.push({ name, count });
  }
  tools.sort((a, b) => b.count - a.count);

  return tools;
}

/**
 * Detect agent invocations from Task tool calls
 */
function detectAgents(responses: ResponseRow[]): AgentUsage[] {
  const agentCounts = new Map<string, number>();

  for (const r of responses) {
    if (r.tools_used && Array.isArray(r.tools_used)) {
      // Look for "Task" tool which indicates subagent invocation
      const hasTask = r.tools_used.some(
        (t) => typeof t === "string" && t.toLowerCase() === "task"
      );

      if (hasTask) {
        // Try to determine agent type from stop_reason or other signals
        // Default to "general-purpose" if can't determine
        let agentType = "general-purpose";

        if (r.stop_reason) {
          for (const [type, pattern] of Object.entries(AGENT_TYPE_PATTERNS)) {
            if (pattern.test(r.stop_reason)) {
              agentType = type;
              break;
            }
          }
        }

        agentCounts.set(agentType, (agentCounts.get(agentType) || 0) + 1);
      }
    }
  }

  // Convert to array and sort by count (descending)
  const agents: AgentUsage[] = [];
  for (const [type, count] of agentCounts.entries()) {
    agents.push({ type, count });
  }
  agents.sort((a, b) => b.count - a.count);

  return agents;
}

/**
 * Calculate context window usage metrics
 */
function calculateContextWindow(
  prompts: PromptRow[],
  responses: ResponseRow[]
): ContextWindowStats {
  if (prompts.length === 0) {
    return {
      peakPercentage: 0,
      peakTurn: 0,
      avgPercentage: 0,
    };
  }

  // Build a map of prompt_id to response for quick lookup
  const responseByPrompt = new Map<string, ResponseRow>();
  for (const r of responses) {
    if (r.prompt_id) {
      responseByPrompt.set(r.prompt_id, r);
    }
  }

  // Calculate cumulative token usage at each turn
  let cumulativeTokens = 0;
  let peakTokens = 0;
  let peakTurn = 0;
  let totalPercentage = 0;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]!;
    const response = responseByPrompt.get(prompt.id);

    // Add tokens for this turn
    const turnInputTokens =
      prompt.input_tokens || response?.tokens_in || 0;
    const turnOutputTokens =
      prompt.output_tokens || response?.tokens_out || 0;
    cumulativeTokens += turnInputTokens + turnOutputTokens;

    // Track peak
    if (cumulativeTokens > peakTokens) {
      peakTokens = cumulativeTokens;
      peakTurn = i + 1; // 1-indexed turn number
    }

    // Add to average calculation
    const percentage = (cumulativeTokens / CONTEXT_WINDOW_SIZE) * 100;
    totalPercentage += percentage;
  }

  const peakPercentage = Math.round((peakTokens / CONTEXT_WINDOW_SIZE) * 100);
  const avgPercentage = Math.round(totalPercentage / prompts.length);

  return {
    peakPercentage,
    peakTurn,
    avgPercentage,
  };
}

/**
 * Detect session outcome based on signals
 */
function detectOutcome(
  session: SessionRow,
  responses: ResponseRow[]
): OutcomeResult {
  const indicators: string[] = [];

  // Check if session is ongoing
  if (!session.ended_at) {
    return {
      status: "ongoing",
      indicators: ["Session has not ended"],
    };
  }

  // Check end_reason from session
  if (session.end_reason) {
    indicators.push(`End reason: ${session.end_reason}`);

    if (session.end_reason === "completed") {
      return { status: "completed", indicators };
    }
    if (session.end_reason === "abandoned") {
      return { status: "abandoned", indicators };
    }
  }

  // Analyze responses for outcome signals
  let hasError = false;
  let hasCommit = false;
  let hasTests = false;

  for (const r of responses) {
    // Check tools for error indicators
    if (r.stop_reason) {
      for (const pattern of ERROR_PATTERNS) {
        if (pattern.test(r.stop_reason)) {
          hasError = true;
          indicators.push(`Error indicator in stop_reason: ${r.stop_reason}`);
          break;
        }
      }

      // Check for commit indicators
      for (const pattern of COMMIT_PATTERNS) {
        if (pattern.test(r.stop_reason)) {
          hasCommit = true;
          indicators.push("Git commit detected");
          break;
        }
      }

      // Check for test indicators
      for (const pattern of TEST_PATTERNS) {
        if (pattern.test(r.stop_reason)) {
          hasTests = true;
          indicators.push("Test execution detected");
          break;
        }
      }
    }

    // Check tools used for completion indicators
    if (r.tools_used && Array.isArray(r.tools_used)) {
      const toolsLower = r.tools_used.map((t) =>
        typeof t === "string" ? t.toLowerCase() : ""
      );
      if (toolsLower.includes("bash")) {
        indicators.push("Bash tool used");
      }
    }
  }

  // Determine status based on indicators
  if (hasError) {
    return { status: "error", indicators };
  }

  if (hasCommit || hasTests) {
    indicators.push("Successful work indicators found");
    return { status: "completed", indicators };
  }

  // Check if session has substantial work (indicates completion)
  if (session.total_prompts && session.total_prompts >= 5) {
    indicators.push(`Session has ${session.total_prompts} prompts`);
    return { status: "completed", indicators };
  }

  // Short session with no clear indicators
  if (session.total_prompts && session.total_prompts <= 2) {
    indicators.push("Short session with few prompts");
    return { status: "abandoned", indicators };
  }

  return {
    status: "unknown",
    indicators: indicators.length > 0 ? indicators : ["No clear outcome signals"],
  };
}

// ============================================================================
// Access Verification
// ============================================================================

/**
 * Verifies that a user has access to a session through team membership.
 *
 * @param supabase - Supabase client
 * @param sessionId - Session database UUID
 * @param userId - User ID to check
 * @returns Object with hasAccess boolean and optional error message
 */
export async function verifySessionAccess(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<{ hasAccess: boolean; error?: string }> {
  if (!isValidUuid(sessionId)) {
    return { hasAccess: false, error: "Invalid session ID format" };
  }

  if (!isValidUuid(userId)) {
    return { hasAccess: false, error: "Invalid user ID format" };
  }

  // Get session's team
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("team_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return { hasAccess: false, error: "Session not found" };
  }

  // Check team membership
  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", session.team_id)
    .eq("user_id", userId)
    .single();

  if (membershipError || !membership) {
    return { hasAccess: false, error: "User is not a member of the session's team" };
  }

  return { hasAccess: true };
}
