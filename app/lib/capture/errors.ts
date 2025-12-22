/**
 * Error Classification Module for Contextor Capture Pipeline
 *
 * Classifies errors as transient (retryable) or permanent (non-retryable).
 * Used by the retry utility to determine whether to retry failed operations.
 */

/**
 * Transient error codes that indicate the request can be retried.
 * These are typically network or temporary service issues.
 */
export const TRANSIENT_ERROR_CODES = [
  "ECONNRESET", // Connection reset by peer
  "ETIMEDOUT", // Connection timed out
  "ECONNREFUSED", // Connection refused
  "EHOSTUNREACH", // Host unreachable
  "ENETUNREACH", // Network unreachable
] as const;

/**
 * HTTP status codes that indicate transient errors (can be retried).
 */
export const TRANSIENT_HTTP_CODES = [
  429, // Too Many Requests
  503, // Service Unavailable
  504, // Gateway Timeout
] as const;

/**
 * HTTP status codes that indicate permanent errors (should NOT retry).
 */
export const PERMANENT_HTTP_CODES = [
  400, // Bad Request
  401, // Unauthorized
  404, // Not Found
] as const;

/**
 * Error classification result.
 */
export interface ErrorClassification {
  /** Whether the error is transient (retryable) */
  isTransient: boolean;
  /** The error code if available */
  code: string | null;
  /** Human-readable category for logging */
  category: "network" | "http" | "unknown";
  /** Whether retry is recommended */
  shouldRetry: boolean;
}

/**
 * Determines if an error is transient (retryable).
 *
 * Transient errors include:
 * - Network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED, EHOSTUNREACH, ENETUNREACH)
 * - HTTP status codes 429 (rate limited), 503 (service unavailable), 504 (gateway timeout)
 *
 * @param error - The error to check
 * @returns true if the error is transient and should be retried
 *
 * @example
 * ```ts
 * try {
 *   await storePrompt(data);
 * } catch (error) {
 *   if (isTransientError(error)) {
 *     // Retry the operation
 *   } else {
 *     // Fail immediately
 *   }
 * }
 * ```
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // Check for Node.js network error codes
  const nodeError = error as NodeJS.ErrnoException;
  if (
    nodeError.code &&
    TRANSIENT_ERROR_CODES.includes(
      nodeError.code as (typeof TRANSIENT_ERROR_CODES)[number]
    )
  ) {
    return true;
  }

  // Check if error message contains transient error codes
  for (const code of TRANSIENT_ERROR_CODES) {
    if (error.message.includes(code)) {
      return true;
    }
  }

  // Check for HTTP status codes in error message or properties
  const httpError = error as Error & { status?: number; statusCode?: number };
  const statusCode = httpError.status ?? httpError.statusCode;

  if (
    statusCode !== undefined &&
    TRANSIENT_HTTP_CODES.includes(
      statusCode as (typeof TRANSIENT_HTTP_CODES)[number]
    )
  ) {
    return true;
  }

  // Check for HTTP status codes in error message
  for (const code of TRANSIENT_HTTP_CODES) {
    if (error.message.includes(String(code))) {
      return true;
    }
  }

  return false;
}

/**
 * Classifies an error for logging and metrics purposes.
 *
 * Returns structured information about the error without exposing
 * sensitive details like prompt content or user data.
 *
 * @param error - The error to classify
 * @returns Error classification with category and retry recommendation
 *
 * @example
 * ```ts
 * const classification = classifyError(error);
 * console.log(`[API] error: ${classification.category}, code: ${classification.code}`);
 * ```
 */
export function classifyError(error: unknown): ErrorClassification {
  if (!(error instanceof Error)) {
    return {
      isTransient: false,
      code: null,
      category: "unknown",
      shouldRetry: false,
    };
  }

  // Check for Node.js network error codes
  const nodeError = error as NodeJS.ErrnoException;
  if (nodeError.code) {
    const isNetworkTransient = TRANSIENT_ERROR_CODES.includes(
      nodeError.code as (typeof TRANSIENT_ERROR_CODES)[number]
    );
    return {
      isTransient: isNetworkTransient,
      code: nodeError.code,
      category: "network",
      shouldRetry: isNetworkTransient,
    };
  }

  // Check for HTTP status codes
  const httpError = error as Error & { status?: number; statusCode?: number };
  const statusCode = httpError.status ?? httpError.statusCode;

  if (statusCode !== undefined) {
    const isHttpTransient = TRANSIENT_HTTP_CODES.includes(
      statusCode as (typeof TRANSIENT_HTTP_CODES)[number]
    );
    const isPermanent = PERMANENT_HTTP_CODES.includes(
      statusCode as (typeof PERMANENT_HTTP_CODES)[number]
    );

    return {
      isTransient: isHttpTransient,
      code: String(statusCode),
      category: "http",
      shouldRetry: isHttpTransient && !isPermanent,
    };
  }

  // Check message for clues
  for (const code of TRANSIENT_ERROR_CODES) {
    if (error.message.includes(code)) {
      return {
        isTransient: true,
        code: code,
        category: "network",
        shouldRetry: true,
      };
    }
  }

  for (const code of TRANSIENT_HTTP_CODES) {
    if (error.message.includes(String(code))) {
      return {
        isTransient: true,
        code: String(code),
        category: "http",
        shouldRetry: true,
      };
    }
  }

  // Unknown error
  return {
    isTransient: false,
    code: null,
    category: "unknown",
    shouldRetry: false,
  };
}
