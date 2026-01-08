/**
 * Conversation Thread Query - Story 25-3: Conversation Thread Endpoint
 *
 * Query functions for fetching full threaded conversation history.
 * Includes user prompts and assistant responses with all metadata.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidUuid } from "@/lib/utils/uuid";

const logger = createScopedLogger("CONVERSATION_THREAD");

// ============================================================================
// Types
// ============================================================================

/**
 * Project stage classification
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
 * Prompt classification types
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
 * Stage breakdown from session
 */
export interface StageBreakdown {
  [key: string]: number;
}

/**
 * Conversation detail with metadata
 */
export interface ConversationDetail {
  id: string;
  sessionId: string;
  slug: string | null;
  projectId: string | null;
  projectName: string | null;
  userId: string;
  userName?: string;
  startedAt: string;
  endedAt: string | null;
  duration: number;
  userMessageCount: number;
  totalMessages: number;
  primaryStage: ProjectStage | null;
  hasDebuggingLoop: boolean;
  conversationScore: number | null;
  stageBreakdown: StageBreakdown | null;
  gitBranch: string | null;
  cwd: string | null;
  claudeCodeVersion: string | null;
}

/**
 * Prompt analysis for a message
 */
export interface PromptAnalysis {
  overallScore: number;
  dimensions: Record<string, number>;
  feedback?: string;
}

/**
 * Tool execution record
 */
export interface ToolExecution {
  id: string;
  toolName: string;
  toolId?: string;
  inputSummary: string;
  outputSummary?: string;
  success?: boolean;
  executionOrder: number;
}

/**
 * Threaded message (user or assistant)
 */
export interface ThreadedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sequenceNumber: number;

  // User message fields (role === 'user')
  promptType?: PromptClassification;
  score?: number;
  detectedStage?: ProjectStage;
  isInDebuggingLoop?: boolean;
  analysis?: PromptAnalysis;

  // Assistant message fields (role === 'assistant')
  thinkingSummary?: string;
  thinkingWordCount?: number;
  thinkingText?: string; // Full thinking content (encrypted in DB)
  toolCount?: number;
  toolsUsed?: string[];
  toolExecutions?: ToolExecution[];
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  stopReason?: string;
}

/**
 * Thread result with conversation and messages
 */
export interface ThreadResult {
  conversation: ConversationDetail;
  messages: ThreadedMessage[];
}

/**
 * Query options for thread retrieval
 */
export interface ThreadOptions {
  includeResponses?: boolean;
  includeTools?: boolean;
}

// ============================================================================
// Internal Types for Query Results
// ============================================================================

interface SessionQueryResult {
  id: string;
  session_id: string;
  slug: string | null;
  project_id: string | null;
  projects: { name: string } | null;
  user_id: string;
  users: { name: string } | null;
  started_at: string;
  ended_at: string | null;
  total_prompts: number | null;
  user_message_count: number | null;
  primary_stage: string | null;
  has_debugging_loop: boolean | null;
  conversation_score: number | null;
  stage_breakdown: Record<string, number> | null;
  git_branch: string | null;
  cwd: string | null;
  claude_code_version: string | null;
}

interface ToolExecutionQueryResult {
  id: string;
  tool_name: string;
  tool_id: string | null;
  input_summary: string;
  output_summary: string | null;
  success: boolean | null;
  execution_order: number;
}

interface ResponseQueryResult {
  id: string;
  created_at: string;
  thinking_summary: string | null;
  thinking_word_count: number | null;
  tool_count: number | null;
  tools_used: string[] | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  stop_reason: string | null;
  tool_executions?: ToolExecutionQueryResult[];
}

interface AnalysisQueryResult {
  overall_score: number;
  dimension_scores: Record<string, number | { score: number }>;
  // feedback is not stored in DB - would come from suggestions if needed
}

interface PromptQueryResult {
  id: string;
  text: string;
  created_at: string;
  sequence_number: number | null;
  prompt_classification: string | null;
  detected_stage: string | null;
  is_in_debugging_loop: boolean | null;
  prompt_analyses: AnalysisQueryResult[];
}

// ============================================================================
// Session ID Validation
// ============================================================================

/**
 * Valid Claude Code session ID format: alphanumeric with dashes/underscores
 * Length: 1-100 characters (reasonable limit to prevent abuse)
 */
const VALID_SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

/**
 * Validates if a string is a valid Claude Code session ID format.
 * This is more permissive than UUID to support various session ID formats.
 *
 * @param value - The string to validate
 * @returns true if valid session ID format
 */
export function isValidSessionIdFormat(value: string): boolean {
  return VALID_SESSION_ID_PATTERN.test(value);
}

// ============================================================================
// Main Query Function
// ============================================================================

/**
 * Gets the full threaded conversation for a session.
 *
 * SECURITY: Validates sessionId format before use in database queries.
 * Returns null for invalid format, not found, or no access (no info leak).
 *
 * @param sessionId - Session UUID or Claude Code session_id
 * @param teamId - Team ID for access control
 * @param options - Query options (includeResponses, includeTools)
 * @returns Conversation thread or null if not found/no access
 *
 * @example
 * const result = await getConversationThread(sessionId, teamId, {
 *   includeResponses: true,
 *   includeTools: true,
 * });
 *
 * if (!result) {
 *   return notFound();
 * }
 *
 * const { conversation, messages } = result;
 */
export async function getConversationThread(
  sessionId: string,
  teamId: string,
  options: ThreadOptions = {}
): Promise<ThreadResult | null> {
  const { includeResponses = true, includeTools = true } = options;

  // ========================================================================
  // SECURITY: Validate sessionId format before use in query
  // Prevents SQL injection through malformed IDs
  // ========================================================================
  const isUuid: boolean = isValidUuid(sessionId);
  const isValidClaudeSessionId: boolean = isValidSessionIdFormat(sessionId);

  if (!isUuid && !isValidClaudeSessionId) {
    logger.warn("Invalid sessionId format rejected", {
      sessionIdLength: String(sessionId).length,
      isUuid,
      isValidClaudeSessionId,
    });
    return null;
  }

  // Validate teamId is a valid UUID
  if (!isValidUuid(teamId)) {
    logger.warn("Invalid teamId format rejected", { teamId });
    return null;
  }

  const supabase = createAdminClient();

  // ========================================================================
  // Step 1: Query session with team check
  // Uses safe parameterized queries via Supabase SDK
  // ========================================================================
  let sessionQuery = supabase
    .from("sessions")
    .select(
      `
      id,
      session_id,
      slug,
      project_id,
      projects(name),
      user_id,
      users(name),
      started_at,
      ended_at,
      total_prompts,
      user_message_count,
      primary_stage,
      has_debugging_loop,
      conversation_score,
      stage_breakdown,
      git_branch,
      cwd,
      claude_code_version
    `
    )
    .eq("team_id", teamId);

  // Query by appropriate field based on format
  // Supabase SDK handles parameterization, preventing SQL injection
  if (isUuid) {
    // If it's a UUID, check both id and session_id columns
    sessionQuery = sessionQuery.or(`id.eq.${sessionId},session_id.eq.${sessionId}`);
  } else {
    // Not a UUID, only query by session_id column (Claude Code's format)
    sessionQuery = sessionQuery.eq("session_id", sessionId);
  }

  const { data: sessionData, error: sessionError } = await sessionQuery.single();

  if (sessionError || !sessionData) {
    logger.debug("Session not found or no access", {
      sessionId,
      teamId,
      error: sessionError?.message,
    });
    return null;
  }

  // Cast to typed result
  const session = sessionData as unknown as SessionQueryResult;

  // ========================================================================
  // Step 2: Calculate duration
  // ========================================================================
  const startedAt = new Date(session.started_at);
  const endedAt = session.ended_at ? new Date(session.ended_at) : new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();
  const duration = Math.round(durationMs / 60000); // Minutes

  // ========================================================================
  // Step 3: Query prompts (without responses - we'll query those separately)
  // ========================================================================
  const promptSelectParts = [
    `id`,
    `text`,
    `created_at`,
    `sequence_number`,
    `prompt_classification`,
    `detected_stage`,
    `is_in_debugging_loop`,
    `prompt_analyses(
      overall_score,
      dimension_scores
    )`,
  ];

  const { data: promptsData, error: promptsError } = await supabase
    .from("prompts")
    .select(promptSelectParts.join(","))
    .eq("session_uuid", session.id)
    .order("sequence_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (promptsError) {
    logger.error("Failed to fetch prompts", promptsError, {
      sessionId: session.id,
    });
    throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
  }

  // Cast to typed result
  const prompts = (promptsData || []) as unknown as PromptQueryResult[];

  // ========================================================================
  // Step 3b: Query responses by prompt_id OR session_uuid
  // Live capture: responses have session_uuid but NULL prompt_id
  // Import: responses have prompt_id linked
  // We need to fetch both and merge them
  // ========================================================================
  let sessionResponses: ResponseQueryResult[] = [];

  if (includeResponses && prompts.length > 0) {
    const promptIds = prompts.map((p) => p.id);

    const responseSelectParts = [
      `id`,
      `prompt_id`,
      `created_at`,
      `thinking_summary`,
      `thinking_word_count`,
      `tool_count`,
      `tools_used`,
      `model`,
      `tokens_in`,
      `tokens_out`,
      `stop_reason`,
    ];

    if (includeTools) {
      responseSelectParts.push(`
        tool_executions(
          id,
          tool_name,
          tool_id,
          input_summary,
          output_summary,
          success,
          execution_order
        )
      `);
    }

    // Query 1: Responses linked by prompt_id (from imports)
    const { data: linkedData, error: linkedError } = await supabase
      .from("prompt_responses")
      .select(responseSelectParts.join(","))
      .in("prompt_id", promptIds)
      .order("created_at", { ascending: true });

    if (linkedError) {
      logger.warn("Failed to fetch linked responses", {
        sessionId: session.id,
        error: linkedError.message,
      });
    }

    // Query 2: Responses by session_uuid with NULL prompt_id (from live capture)
    const { data: sessionData, error: sessionError } = await supabase
      .from("prompt_responses")
      .select(responseSelectParts.join(","))
      .eq("session_uuid", session.id)
      .is("prompt_id", null)
      .order("created_at", { ascending: true });

    if (sessionError) {
      logger.warn("Failed to fetch session responses", {
        sessionId: session.id,
        error: sessionError.message,
      });
    }

    // Merge both result sets (dedupe by ID)
    const responseMap = new Map<string, ResponseQueryResult>();
    const linkedResponses_ = (linkedData || []) as unknown as (ResponseQueryResult & { prompt_id: string | null })[];
    const sessionResponses_ = (sessionData || []) as unknown as (ResponseQueryResult & { prompt_id: string | null })[];

    for (const r of linkedResponses_) {
      responseMap.set(r.id, r);
    }
    for (const r of sessionResponses_) {
      if (!responseMap.has(r.id)) {
        responseMap.set(r.id, r);
      }
    }
    sessionResponses = Array.from(responseMap.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  // Create a map of prompt_id -> response for quick lookup
  // Also create an array of unlinked responses to match by timestamp
  const linkedResponses = new Map<string, ResponseQueryResult>();
  const unlinkedResponses: ResponseQueryResult[] = [];

  for (const resp of sessionResponses) {
    const respWithPromptId = resp as ResponseQueryResult & { prompt_id: string | null };
    if (respWithPromptId.prompt_id) {
      linkedResponses.set(respWithPromptId.prompt_id, resp);
    } else {
      unlinkedResponses.push(resp);
    }
  }

  // ========================================================================
  // Step 4: Build threaded messages array
  // ========================================================================
  const messages: ThreadedMessage[] = [];

  for (const prompt of prompts) {
    // Add user message
    // Handle both array and object formats from Supabase
    const analysisRaw = prompt.prompt_analyses;
    const analysis = Array.isArray(analysisRaw) ? analysisRaw[0] : analysisRaw;
    const dimensionScores = analysis?.dimension_scores;

    // Normalize dimension scores to flat number values
    const normalizedDimensions: Record<string, number> = {};
    if (dimensionScores) {
      for (const [key, value] of Object.entries(dimensionScores)) {
        if (typeof value === "number") {
          normalizedDimensions[key] = value;
        } else if (value && typeof value === "object" && "score" in value) {
          normalizedDimensions[key] = value.score;
        }
      }
    }

    const userMessage: ThreadedMessage = {
      id: prompt.id,
      role: "user",
      content: prompt.text || "",
      timestamp: prompt.created_at,
      sequenceNumber: prompt.sequence_number ?? 0,
      promptType: prompt.prompt_classification as PromptClassification | undefined,
      detectedStage: prompt.detected_stage as ProjectStage | undefined,
      isInDebuggingLoop: prompt.is_in_debugging_loop ?? false,
      score: analysis?.overall_score,
      analysis: analysis
        ? {
            overallScore: analysis.overall_score,
            dimensions: normalizedDimensions,
            feedback: undefined, // Not stored in DB
          }
        : undefined,
    };

    messages.push(userMessage);

    // Add assistant message if response exists
    // First check linked responses (by prompt_id), then try matching unlinked by timestamp
    if (includeResponses) {
      let response: ResponseQueryResult | undefined = linkedResponses.get(prompt.id);

      // If no linked response, try to find an unlinked response by timestamp
      // Response should come after the prompt's created_at
      if (!response && unlinkedResponses.length > 0) {
        const promptTime = new Date(prompt.created_at).getTime();
        const nextPromptIdx = prompts.indexOf(prompt) + 1;
        const nextPrompt = prompts[nextPromptIdx];
        const nextPromptTime = nextPrompt
          ? new Date(nextPrompt.created_at).getTime()
          : Infinity;

        // Find first unlinked response between this prompt and next prompt
        const matchIdx = unlinkedResponses.findIndex((r) => {
          const respTime = new Date(r.created_at).getTime();
          return respTime > promptTime && respTime < nextPromptTime;
        });

        if (matchIdx !== -1) {
          response = unlinkedResponses[matchIdx];
          // Remove from unlinked so it's not matched again
          unlinkedResponses.splice(matchIdx, 1);
        }
      }

      if (response) {
        // Note: response_text is now handled via RPC function (decryption)
        // For this implementation, we get metadata without the encrypted text
        // The full text would require calling get_decrypted_response_by_prompt

        const assistantMessage: ThreadedMessage = {
          id: response.id,
          role: "assistant",
          content: "", // Would need decryption RPC call for actual content
          timestamp: response.created_at || prompt.created_at,
          sequenceNumber: (prompt.sequence_number ?? 0) + 0.5, // Between prompts
          thinkingSummary: response.thinking_summary ?? undefined,
          thinkingWordCount: response.thinking_word_count ?? undefined,
          toolCount: response.tool_count ?? undefined,
          toolsUsed: response.tools_used ?? undefined,
          model: response.model ?? undefined,
          tokensIn: response.tokens_in ?? undefined,
          tokensOut: response.tokens_out ?? undefined,
          stopReason: response.stop_reason ?? undefined,
          toolExecutions:
            includeTools && response.tool_executions
              ? response.tool_executions.map((te) => ({
                  id: te.id,
                  toolName: te.tool_name,
                  toolId: te.tool_id ?? undefined,
                  inputSummary: te.input_summary,
                  outputSummary: te.output_summary ?? undefined,
                  success: te.success ?? undefined,
                  executionOrder: te.execution_order,
                }))
              : undefined,
        };

        messages.push(assistantMessage);
      }
    }
  }

  // ========================================================================
  // Step 5: Fetch decrypted response text if responses are included
  // ========================================================================
  if (includeResponses && messages.length > 0) {
    // Get all response IDs
    const responseMessages = messages.filter((m) => m.role === "assistant");

    for (const msg of responseMessages) {
      try {
        const { data: decryptedResponse } = await supabase.rpc(
          "get_decrypted_response",
          { p_response_id: msg.id }
        );

        if (
          decryptedResponse &&
          Array.isArray(decryptedResponse) &&
          decryptedResponse[0]
        ) {
          const decrypted = decryptedResponse[0] as {
            response_text?: string;
            thinking_text?: string;
          };
          msg.content = decrypted.response_text || "";
          if (decrypted.thinking_text) {
            msg.thinkingText = decrypted.thinking_text;
          }
        }
      } catch (decryptError) {
        logger.warn("Failed to decrypt response", {
          responseId: msg.id,
          error:
            decryptError instanceof Error
              ? decryptError.message
              : String(decryptError),
        });
        // Continue without content - better than failing entire request
      }
    }
  }

  // ========================================================================
  // Step 6: Build response
  // ========================================================================
  const conversation: ConversationDetail = {
    id: session.id,
    sessionId: session.session_id,
    slug: session.slug,
    projectId: session.project_id,
    projectName: session.projects?.name ?? null,
    userId: session.user_id,
    userName: session.users?.name,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    duration,
    userMessageCount: session.user_message_count ?? 0,
    totalMessages: session.total_prompts ?? 0,
    primaryStage: session.primary_stage as ProjectStage | null,
    hasDebuggingLoop: session.has_debugging_loop ?? false,
    conversationScore: session.conversation_score,
    stageBreakdown: session.stage_breakdown,
    gitBranch: session.git_branch,
    cwd: session.cwd,
    claudeCodeVersion: session.claude_code_version,
  };

  logger.debug("Conversation thread retrieved", {
    sessionId: session.id,
    messageCount: messages.length,
    includeResponses,
    includeTools,
  });

  return {
    conversation,
    messages,
  };
}
