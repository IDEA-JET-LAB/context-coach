import { z } from "zod";
import {
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  ValidationErrorCodes,
} from "@/lib/capture/constants";

/**
 * Schema for validating prompt capture requests.
 *
 * Used by: POST /api/prompts/capture
 *
 * Validation rules:
 * - prompt: 10-100,000 characters, no null bytes
 * - user_id: non-empty string
 * - timestamp: valid ISO 8601 format
 * - metadata: optional object
 */
export const captureRequestSchema = z.object({
  prompt: z
    .string()
    .min(PROMPT_MIN_LENGTH, ValidationErrorCodes.PROMPT_TOO_SHORT)
    .max(PROMPT_MAX_LENGTH, ValidationErrorCodes.PROMPT_TOO_LONG)
    .refine((val) => !val.includes("\0"), {
      message: ValidationErrorCodes.INVALID_PROMPT,
    }),
  user_id: z.string().min(1, ValidationErrorCodes.USER_ID_REQUIRED),
  timestamp: z.string().datetime(ValidationErrorCodes.INVALID_TIMESTAMP),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CaptureRequest = z.infer<typeof captureRequestSchema>;

/**
 * Maps a Zod validation error to a standardized error response.
 *
 * Uses the first error's message as the error code, with human-readable
 * messages for known validation error codes.
 *
 * @param zodError - The Zod validation error
 * @returns Object with code and message for API response
 */
export function mapValidationError(zodError: z.ZodError): {
  code: string;
  message: string;
} {
  const issue = zodError.issues[0];
  const code = issue?.message || "VALIDATION_ERROR";

  const messages: Record<string, string> = {
    [ValidationErrorCodes.PROMPT_TOO_SHORT]: `Prompt must be at least ${PROMPT_MIN_LENGTH} characters`,
    [ValidationErrorCodes.PROMPT_TOO_LONG]: `Prompt exceeds maximum length of ${PROMPT_MAX_LENGTH.toLocaleString()} characters`,
    [ValidationErrorCodes.INVALID_PROMPT]: "Prompt contains invalid characters",
    [ValidationErrorCodes.USER_ID_REQUIRED]: "User ID is required",
    [ValidationErrorCodes.INVALID_TIMESTAMP]: "Invalid timestamp format (ISO 8601 required)",
  };

  return {
    code,
    message: messages[code] || issue?.message || "Validation failed",
  };
}

/**
 * Success response from capture endpoint.
 */
export interface CaptureSuccessResponse {
  data: {
    id: string;
    status: "pending";
  };
}

/**
 * Error response from capture endpoint.
 */
export interface CaptureErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export type CaptureResponse = CaptureSuccessResponse | CaptureErrorResponse;
