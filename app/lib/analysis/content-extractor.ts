/**
 * Conversation Content Extraction Service
 * Story 30-5: Conversation Content Extraction
 *
 * Extracts conversation content from a session for analysis.
 * Supports selective extraction of prompts, responses, thinking, and tools.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidUuid } from "@/lib/utils/uuid";

const logger = createScopedLogger("CONTENT_EXTRACTOR");

// ============================================================================
// Types
// ============================================================================

/**
 * Options controlling what content to extract
 */
export interface ExtractionOptions {
  /** Include user prompts in the transcript */
  includePrompts: boolean;
  /** Include assistant responses in the transcript */
  includeResponses: boolean;
  /** Include thinking/reasoning content from responses */
  includeThinking: boolean;
  /** Include tool calls from responses */
  includeTools: boolean;
}

/**
 * A single message in the conversation
 */
export interface ConversationMessage {
  /** Database UUID of the prompt */
  id: string;
  /** Role of the message author */
  role: "user" | "assistant";
  /** ISO timestamp of the message */
  timestamp: string;
  /** Sequence number within the session */
  sequenceNumber: number;
  /** Main content text */
  content: string;
  /** Thinking/reasoning text (assistant only) */
  thinkingText?: string;
  /** Tool calls made in this message (assistant only) */
  toolCalls?: ToolCall[];
}

/**
 * A tool call with name and input parameters
 */
export interface ToolCall {
  /** Name of the tool (e.g., "Read", "Edit", "Bash") */
  name: string;
  /** Input parameters for the tool */
  input: Record<string, unknown>;
}

/**
 * Summary of a tool call for display purposes
 */
export interface ToolCallSummary {
  /** Name of the tool */
  name: string;
  /** Human-readable summary of the input */
  inputSummary: string;
}

/**
 * Result of content extraction
 */
export interface ExtractedContent {
  /** Formatted transcript string for analysis */
  transcript: string;
  /** Metadata about the extraction */
  metadata: {
    /** Session database UUID */
    sessionId: string;
    /** Number of prompts included */
    promptCount: number;
    /** Number of responses included */
    responseCount: number;
    /** Number of conversation turns (prompt-response pairs) */
    turnCount: number;
    /** Whether thinking content was included */
    includedThinking: boolean;
    /** Whether tool calls were included */
    includedTools: boolean;
    /** Time range of the conversation */
    timeRange: {
      /** ISO timestamp of first message */
      start: string;
      /** ISO timestamp of last message */
      end: string;
    };
  };
  /** Raw content arrays for further processing */
  rawContent: {
    /** Array of prompt texts */
    prompts: string[];
    /** Array of response texts */
    responses: string[];
    /** Array of thinking texts */
    thinking: string[];
    /** Array of tool call summaries */
    tools: ToolCallSummary[];
  };
}

// ============================================================================
// Internal Types (Database Rows)
// ============================================================================

interface PromptRow {
  id: string;
  text: string;
  sequence_number: number | null;
  created_at: string;
}

interface ResponseRow {
  id: string;
  prompt_id: string | null;
  response_text: string | null;
  tools_used: string[] | null;
  has_thinking: boolean | null;
  thinking_summary: string | null;
  created_at: string;
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extracts conversation content from a session.
 *
 * Fetches prompts and responses, then formats them into a readable transcript
 * suitable for AI analysis. Supports selective extraction based on options.
 *
 * @param supabase - Supabase client (admin or user-scoped)
 * @param sessionId - Database UUID of the session
 * @param options - Options controlling what to extract
 * @returns Extracted content with transcript and metadata
 * @throws Error if session not found or query fails
 *
 * @example
 * ```typescript
 * const content = await extractConversationContent(supabase, sessionId, {
 *   includePrompts: true,
 *   includeResponses: true,
 *   includeThinking: false,
 *   includeTools: true,
 * });
 *
 * console.log(content.transcript);
 * console.log(`Turns: ${content.metadata.turnCount}`);
 * ```
 */
export async function extractConversationContent(
  supabase: SupabaseClient,
  sessionId: string,
  options: ExtractionOptions
): Promise<ExtractedContent> {
  // Validate session ID format
  if (!isValidUuid(sessionId)) {
    throw new Error(`Invalid session ID format: ${sessionId}`);
  }

  // Fetch conversation messages
  const messages = await fetchConversationMessages(supabase, sessionId);

  // If no messages, return empty content
  if (messages.length === 0) {
    logger.debug("No messages found for session", { sessionId });
    return createEmptyContent(sessionId, options);
  }

  // Extract raw content based on options
  const rawContent = extractRawContent(messages, options);

  // Format into transcript
  const transcript = formatTranscript(messages, options);

  // Calculate metadata
  const promptCount = messages.filter((m) => m.role === "user").length;
  const responseCount = messages.filter((m) => m.role === "assistant").length;
  const turnCount = Math.min(promptCount, responseCount);

  // Get time range (messages array is guaranteed non-empty at this point)
  const timestamps = messages.map((m) => m.timestamp).sort();
  const timeRange = {
    start: timestamps[0]!,
    end: timestamps[timestamps.length - 1]!,
  };

  logger.debug("Content extracted", {
    sessionId,
    promptCount,
    responseCount,
    turnCount,
    transcriptLength: transcript.length,
  });

  return {
    transcript,
    metadata: {
      sessionId,
      promptCount,
      responseCount,
      turnCount,
      includedThinking: options.includeThinking,
      includedTools: options.includeTools,
      timeRange,
    },
    rawContent,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetches conversation messages from the database.
 *
 * Queries prompts and their associated responses, then merges them into
 * a chronologically ordered list of messages.
 *
 * @param supabase - Supabase client
 * @param sessionId - Database UUID of the session
 * @returns Array of conversation messages
 */
export async function fetchConversationMessages(
  supabase: SupabaseClient,
  sessionId: string
): Promise<ConversationMessage[]> {
  // Query prompts for this session
  const { data: prompts, error: promptsError } = await supabase
    .from("prompts")
    .select("id, text, sequence_number, created_at")
    .eq("session_uuid", sessionId)
    .order("sequence_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (promptsError) {
    logger.error("Failed to fetch prompts", promptsError, { sessionId });
    throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
  }

  const promptRows = (prompts || []) as PromptRow[];

  if (promptRows.length === 0) {
    return [];
  }

  // Query responses for these prompts using the RPC function for decryption
  const promptIds = promptRows.map((p) => p.id);
  const messages: ConversationMessage[] = [];

  for (const prompt of promptRows) {
    // Add user message
    messages.push({
      id: prompt.id,
      role: "user",
      timestamp: prompt.created_at,
      sequenceNumber: prompt.sequence_number ?? messages.length + 1,
      content: prompt.text || "",
    });

    // Fetch decrypted response for this prompt
    const { data: responseData, error: responseError } = await supabase.rpc(
      "get_decrypted_response_by_prompt",
      { p_prompt_id: prompt.id }
    );

    if (responseError) {
      logger.warn("Failed to fetch response for prompt", {
        promptId: prompt.id,
        error: responseError.message,
      });
      continue;
    }

    const response = responseData?.[0] as ResponseRow | undefined;
    if (!response) {
      continue;
    }

    // Parse tool calls from tools_used array
    const toolCalls: ToolCall[] = (response.tools_used || []).map((tool) => ({
      name: tool,
      input: {}, // Actual input not stored, just tool names
    }));

    // Add assistant message
    messages.push({
      id: response.id,
      role: "assistant",
      timestamp: response.created_at,
      sequenceNumber: prompt.sequence_number ?? messages.length,
      content: response.response_text || "",
      thinkingText:
        response.has_thinking && response.thinking_summary
          ? response.thinking_summary
          : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });
  }

  return messages;
}

/**
 * Extracts raw content arrays from messages based on options.
 *
 * @param messages - Array of conversation messages
 * @param options - Extraction options
 * @returns Raw content arrays
 */
export function extractRawContent(
  messages: ConversationMessage[],
  options: ExtractionOptions
): ExtractedContent["rawContent"] {
  const prompts: string[] = [];
  const responses: string[] = [];
  const thinking: string[] = [];
  const tools: ToolCallSummary[] = [];

  for (const message of messages) {
    if (message.role === "user" && options.includePrompts) {
      prompts.push(message.content);
    } else if (message.role === "assistant" && options.includeResponses) {
      responses.push(message.content);

      if (options.includeThinking && message.thinkingText) {
        thinking.push(message.thinkingText);
      }

      if (options.includeTools && message.toolCalls) {
        for (const tool of message.toolCalls) {
          tools.push(summarizeToolCall(tool));
        }
      }
    }
  }

  return { prompts, responses, thinking, tools };
}

/**
 * Formats messages into a readable transcript string.
 *
 * Format:
 * ```
 * [Turn 1 - 10:23 AM]
 * USER: prompt text here
 *
 * A: response text here
 * [Thinking]: truncated thinking...
 * [Used tools: Read, Edit, Bash]
 *
 * [Turn 2 - 10:25 AM]
 * ...
 * ```
 *
 * @param messages - Array of conversation messages
 * @param options - Extraction options
 * @returns Formatted transcript string
 */
export function formatTranscript(
  messages: ConversationMessage[],
  options: ExtractionOptions
): string {
  const lines: string[] = [];
  let turnNumber = 0;

  // Group messages by turn (user + assistant pairs)
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]!;

    if (message.role === "user") {
      turnNumber++;
      const formattedTime = formatTime(message.timestamp);
      lines.push(`[Turn ${turnNumber} - ${formattedTime}]`);

      if (options.includePrompts) {
        lines.push(`USER: ${message.content}`);
      }
      lines.push("");
    } else if (message.role === "assistant" && options.includeResponses) {
      lines.push(`A: ${message.content}`);

      if (options.includeThinking && message.thinkingText) {
        const truncatedThinking = truncateText(message.thinkingText, 200);
        lines.push(`[Thinking]: ${truncatedThinking}`);
      }

      if (options.includeTools && message.toolCalls && message.toolCalls.length > 0) {
        const toolNames = message.toolCalls.map((t) => t.name).join(", ");
        lines.push(`[Used tools: ${toolNames}]`);
      }

      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

/**
 * Truncates text to a maximum length with ellipsis.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default 200)
 * @returns Truncated text with "..." if needed
 *
 * @example
 * ```typescript
 * truncateText("Hello world", 5); // "Hello..."
 * truncateText("Hi", 5); // "Hi"
 * ```
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Formats an ISO timestamp to a readable time string.
 *
 * @param timestamp - ISO timestamp string
 * @returns Formatted time string (e.g., "10:23 AM")
 *
 * @example
 * ```typescript
 * formatTime("2025-01-09T10:23:45.000Z"); // "10:23 AM" (in local time)
 * ```
 */
export function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "Unknown time";
    }
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Unknown time";
  }
}

/**
 * Summarizes a tool call for display.
 *
 * Extracts key information from tool input based on tool type:
 * - Read: file_path
 * - Edit: file_path
 * - Bash: first 50 chars of command
 * - Grep: pattern
 * - Task: subagent_type
 * - Default: JSON.stringify first 50 chars
 *
 * @param tool - Tool call to summarize
 * @returns Summary with tool name and input description
 *
 * @example
 * ```typescript
 * summarizeToolCall({ name: "Read", input: { file_path: "/src/index.ts" } });
 * // { name: "Read", inputSummary: "/src/index.ts" }
 * ```
 */
export function summarizeToolCall(tool: ToolCall): ToolCallSummary {
  const { name, input } = tool;

  let inputSummary: string;

  switch (name.toLowerCase()) {
    case "read":
      inputSummary = extractString(input, "file_path") || "file";
      break;
    case "edit":
      inputSummary = extractString(input, "file_path") || "file";
      break;
    case "bash":
      const command = extractString(input, "command") || "";
      inputSummary = truncateText(command, 50);
      break;
    case "grep":
      inputSummary = extractString(input, "pattern") || "pattern";
      break;
    case "task":
      inputSummary =
        extractString(input, "subagent_type") ||
        extractString(input, "type") ||
        "subagent";
      break;
    case "glob":
      inputSummary = extractString(input, "pattern") || "pattern";
      break;
    case "write":
      inputSummary = extractString(input, "file_path") || "file";
      break;
    default:
      // Default: stringify and truncate
      try {
        const jsonStr = JSON.stringify(input);
        inputSummary = truncateText(jsonStr, 50);
      } catch {
        inputSummary = "parameters";
      }
  }

  return { name, inputSummary };
}

/**
 * Safely extracts a string value from an object.
 *
 * @param obj - Object to extract from
 * @param key - Key to extract
 * @returns String value or undefined
 */
function extractString(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const value = obj[key];
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

/**
 * Creates an empty ExtractedContent for sessions with no messages.
 *
 * @param sessionId - Session database UUID
 * @param options - Extraction options
 * @returns Empty ExtractedContent
 */
function createEmptyContent(
  sessionId: string,
  options: ExtractionOptions
): ExtractedContent {
  const now = new Date().toISOString();
  return {
    transcript: "",
    metadata: {
      sessionId,
      promptCount: 0,
      responseCount: 0,
      turnCount: 0,
      includedThinking: options.includeThinking,
      includedTools: options.includeTools,
      timeRange: {
        start: now,
        end: now,
      },
    },
    rawContent: {
      prompts: [],
      responses: [],
      thinking: [],
      tools: [],
    },
  };
}

// ============================================================================
// Session Lookup Helper
// ============================================================================

/**
 * Looks up a session by its Claude Code session_id (TEXT, not UUID).
 *
 * @param supabase - Supabase client
 * @param sessionId - Claude Code session identifier (session_xxx format)
 * @returns Database UUID of the session or null if not found
 */
export async function lookupSessionBySessionId(
  supabase: SupabaseClient,
  sessionId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("session_id", sessionId)
    .single();

  if (error || !data) {
    logger.debug("Session not found by session_id", {
      sessionId,
      error: error?.message,
    });
    return null;
  }

  return data.id;
}
