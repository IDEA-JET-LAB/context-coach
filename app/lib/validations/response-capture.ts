/**
 * Response Capture Validation Schema
 * Story 25-1: Response Capture Endpoint
 *
 * Validates request payload from the Stop hook for Claude Code response capture.
 */

import { z } from "zod";

/**
 * Schema for tool used in a response.
 * Captures both the tool name and its unique ID.
 */
export const toolUsedSchema = z.object({
  name: z.string().min(1, "Tool name is required"),
  id: z.string().min(1, "Tool ID is required"),
});

/**
 * Schema for token usage in a response.
 * Includes input/output tokens and optional cache statistics.
 */
export const usageSchema = z.object({
  input_tokens: z.number().int().min(0, "Input tokens must be non-negative"),
  output_tokens: z.number().int().min(0, "Output tokens must be non-negative"),
  cache_creation_input_tokens: z
    .number()
    .int()
    .min(0, "Cache creation tokens must be non-negative")
    .optional(),
  cache_read_input_tokens: z
    .number()
    .int()
    .min(0, "Cache read tokens must be non-negative")
    .optional(),
});

/**
 * Valid stop reasons from Claude's API.
 * - end_turn: Normal completion
 * - max_tokens: Hit token limit
 * - stop_sequence: Hit a stop sequence
 * - tool_use: Called a tool (stop_reason may be null in transcript)
 * - content_filter: Content was filtered
 */
export const VALID_STOP_REASONS = [
  "end_turn",
  "max_tokens",
  "stop_sequence",
  "tool_use",
  "content_filter",
  "unknown", // Default when null/missing
] as const;

/**
 * Main schema for response capture requests.
 *
 * Used by: POST /api/responses/capture
 *
 * Validation rules:
 * - session_id: required, Claude Code session identifier
 * - message_uuid: required, unique message ID from transcript
 * - response_text: full assistant response text
 * - thinking_summary: optional, max 500 chars
 * - tools_used: array of tool name/id pairs
 * - model: required, model identifier
 * - usage: required token usage metrics
 * - stop_reason: optional, defaults to "tool_use" (common when null in transcript)
 * - timestamp: optional, server generates if not provided
 */
export const responseCaptureSchema = z.object({
  session_id: z.string().min(1, "session_id is required"),
  message_uuid: z.string().min(1, "message_uuid is required"),
  response_text: z.string().default(""),
  thinking_summary: z
    .string()
    .max(500, "Thinking summary must be at most 500 characters")
    .optional(),
  thinking_word_count: z
    .number()
    .int()
    .min(0, "Thinking word count must be non-negative")
    .optional(),
  tools_used: z.array(toolUsedSchema).default([]),
  model: z.string().min(1, "model is required"),
  usage: usageSchema,
  // stop_reason can be null in Claude transcripts (especially for tool_use)
  // Default to "tool_use" since that's the most common case when null
  stop_reason: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val || "tool_use"),
  // timestamp is optional - server will use current time if not provided
  timestamp: z
    .string()
    .datetime("Timestamp must be valid ISO 8601 format")
    .optional(),
});

/**
 * TypeScript type inferred from the schema.
 */
export type ResponseCaptureRequest = z.infer<typeof responseCaptureSchema>;

/**
 * Type for a single tool used in a response.
 */
export type ToolUsed = z.infer<typeof toolUsedSchema>;

/**
 * Type for token usage metrics.
 */
export type Usage = z.infer<typeof usageSchema>;

/**
 * Validation error codes for response capture.
 */
export const ResponseCaptureErrorCodes = {
  SESSION_ID_REQUIRED: "session_id is required",
  MESSAGE_UUID_REQUIRED: "message_uuid is required",
  MODEL_REQUIRED: "model is required",
  STOP_REASON_REQUIRED: "stop_reason is required",
  INVALID_TIMESTAMP: "Timestamp must be valid ISO 8601 format",
  THINKING_SUMMARY_TOO_LONG: "Thinking summary must be at most 500 characters",
} as const;

/**
 * Maps a Zod validation error to a standardized error response.
 *
 * @param zodError - The Zod validation error
 * @returns Object with code and message for API response
 */
export function mapResponseValidationError(zodError: z.ZodError): {
  code: string;
  message: string;
} {
  const issue = zodError.issues[0];

  // Get the field path for more helpful error messages
  const path = issue?.path.join(".");
  const message = issue?.message || "Validation failed";

  return {
    code: "VALIDATION_ERROR",
    message: path ? `${path}: ${message}` : message,
  };
}
