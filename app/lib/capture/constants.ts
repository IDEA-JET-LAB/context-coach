/**
 * Validation Constants for Prompt Capture
 *
 * These constants define the validation limits for prompts submitted to the
 * capture API. They are used to protect against abuse and ensure data quality.
 */

/**
 * Minimum prompt length (inclusive).
 *
 * Prompts shorter than this are rejected with PROMPT_TOO_SHORT error.
 * This prevents empty or trivially short submissions.
 */
export const PROMPT_MIN_LENGTH = 10;

/**
 * Maximum prompt length (inclusive).
 *
 * Prompts longer than this are rejected with PROMPT_TOO_LONG error.
 * This limit protects against oversized payloads and potential DoS attacks.
 *
 * Note: Actual request body size limits are handled by the reverse proxy;
 * this validates character count after parsing.
 */
export const PROMPT_MAX_LENGTH = 100_000;

/**
 * Error codes for validation failures.
 */
export const ValidationErrorCodes = {
  PROMPT_TOO_SHORT: "PROMPT_TOO_SHORT",
  PROMPT_TOO_LONG: "PROMPT_TOO_LONG",
  INVALID_PROMPT: "INVALID_PROMPT",
  INVALID_REQUEST: "INVALID_REQUEST",
  USER_ID_REQUIRED: "USER_ID_REQUIRED",
  INVALID_TIMESTAMP: "INVALID_TIMESTAMP",
} as const;

export type ValidationErrorCode =
  (typeof ValidationErrorCodes)[keyof typeof ValidationErrorCodes];
