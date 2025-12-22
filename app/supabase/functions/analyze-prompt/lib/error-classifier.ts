/**
 * Error Classifier Module
 * Story 5.5: Retry Logic and Error Handling
 *
 * Classifies errors into transient (retryable) and permanent (non-retryable).
 * Used by the retry scheduler to determine if an analysis should be retried.
 */

/**
 * Transient errors are temporary and can be retried.
 * Examples: timeouts, rate limits, temporary server errors
 */
export class TransientError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "TransientError";
  }
}

/**
 * Permanent errors cannot be resolved by retrying.
 * Examples: authentication failures, invalid configuration, malformed requests
 */
export class PermanentError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "PermanentError";
  }
}

/**
 * HTTP status codes that indicate transient errors
 */
const TRANSIENT_HTTP_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests (rate limited)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * HTTP status codes that indicate permanent errors
 */
const PERMANENT_HTTP_CODES = new Set([
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  405, // Method Not Allowed
  422, // Unprocessable Entity
]);

/**
 * Error message patterns that indicate transient errors
 */
const TRANSIENT_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /econnreset/i,
  /econnrefused/i,
  /socket hang up/i,
  /rate limit/i,
  /too many requests/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /network error/i,
  /failed to fetch/i,
  /network request failed/i,
  /connection reset/i,
  /connection refused/i,
];

/**
 * Error message patterns that indicate permanent errors
 */
const PERMANENT_PATTERNS = [
  /invalid api key/i,
  /unauthorized/i,
  /forbidden/i,
  /not found/i,
  /invalid configuration/i,
  /invalid request/i,
  /malformed/i,
  /invalid json/i,
  /missing required/i,
  /invalid model/i,
  /model not found/i,
  /content policy/i,
  /content filter/i,
];

/**
 * Extracts HTTP status code from an error if present
 */
function extractStatusCode(error: unknown): number | null {
  if (error && typeof error === "object") {
    // Check for status property (common in fetch errors)
    if ("status" in error && typeof error.status === "number") {
      return error.status;
    }
    // Check for statusCode property
    if ("statusCode" in error && typeof error.statusCode === "number") {
      return error.statusCode;
    }
    // Check for response.status (nested response object)
    if (
      "response" in error &&
      error.response &&
      typeof error.response === "object" &&
      "status" in error.response &&
      typeof error.response.status === "number"
    ) {
      return error.response.status;
    }
  }
  return null;
}

/**
 * Gets the error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

/**
 * Classifies an error as transient or permanent.
 *
 * Classification priority:
 * 1. HTTP status codes (if present)
 * 2. Error message patterns
 * 3. Default to transient (fail open for retries)
 *
 * @param error - The error to classify
 * @returns TransientError or PermanentError wrapping the original error
 */
export function classifyError(error: unknown): TransientError | PermanentError {
  const message = getErrorMessage(error);
  const statusCode = extractStatusCode(error);
  const originalError = error instanceof Error ? error : undefined;

  // Check HTTP status code first
  if (statusCode !== null) {
    if (TRANSIENT_HTTP_CODES.has(statusCode)) {
      return new TransientError(
        `HTTP ${statusCode}: ${message}`,
        originalError
      );
    }
    if (PERMANENT_HTTP_CODES.has(statusCode)) {
      return new PermanentError(
        `HTTP ${statusCode}: ${message}`,
        originalError
      );
    }
  }

  // Check for permanent error patterns first (more specific)
  for (const pattern of PERMANENT_PATTERNS) {
    if (pattern.test(message)) {
      return new PermanentError(message, originalError);
    }
  }

  // Check for transient error patterns
  for (const pattern of TRANSIENT_PATTERNS) {
    if (pattern.test(message)) {
      return new TransientError(message, originalError);
    }
  }

  // Default to transient (fail open - allow retry)
  // Better to retry unnecessarily than fail permanently
  return new TransientError(`Unknown error (defaulting to retryable): ${message}`, originalError);
}

/**
 * Type guard to check if an error is transient
 */
export function isTransientError(error: unknown): error is TransientError {
  return error instanceof TransientError;
}

/**
 * Type guard to check if an error is permanent
 */
export function isPermanentError(error: unknown): error is PermanentError {
  return error instanceof PermanentError;
}
