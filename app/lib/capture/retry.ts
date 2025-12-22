/**
 * Retry Utility for Contextor Capture Pipeline
 *
 * Provides a generic retry wrapper with exponential backoff and jitter
 * for handling transient errors in database operations.
 */

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Delay in ms before each retry attempt (indexed by attempt number - 1) */
  delays: number[];
  /** Maximum random jitter in ms to add to each delay (prevents thundering herd) */
  jitterMs?: number;
}

/**
 * Default retry configuration.
 * - 3 retries with exponential backoff: 1s, 5s, 15s
 * - 500ms max jitter to prevent synchronized retries
 * - Total max wait: ~21-22 seconds
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  delays: [1000, 5000, 15000],
  jitterMs: 500,
};

/**
 * Error thrown when all retry attempts are exhausted.
 */
export class RetryError extends Error {
  /** The name of this error type */
  public readonly name = "RetryError";

  /**
   * Creates a new RetryError.
   *
   * @param message - Description of the failure
   * @param attempts - Total number of attempts made
   * @param lastError - The error from the final attempt
   * @param totalDurationMs - Total time spent on all attempts
   */
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
    public readonly totalDurationMs: number
  ) {
    super(message);
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, RetryError.prototype);
  }
}

/**
 * Result of a successful retry operation.
 */
export interface RetryResult<T> {
  /** The result value */
  result: T;
  /** Number of attempts made (1 = first attempt succeeded) */
  attempts: number;
  /** Total time spent including retries in ms */
  totalDurationMs: number;
}

/**
 * Wraps an async function with retry logic.
 *
 * Retries the function on transient errors with exponential backoff.
 * Returns immediately on success or permanent errors.
 *
 * @param fn - The async function to execute
 * @param isRetryable - Function to determine if an error should trigger a retry
 * @param config - Retry configuration (defaults to 3 retries with 1s, 5s, 15s delays)
 * @returns The function result if successful
 * @throws RetryError if all retries are exhausted
 * @throws The original error if it's not retryable
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => storePrompt(data),
 *   isTransientError,
 *   { maxRetries: 3, delays: [1000, 5000, 15000], jitterMs: 500 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < config.maxRetries) {
    attempt++;

    try {
      const result = await fn();
      return {
        result,
        attempts: attempt,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If error is not retryable, throw immediately
      if (!isRetryable(error)) {
        throw error;
      }

      // If this was the last attempt, don't wait - just break and throw
      if (attempt === config.maxRetries) {
        break;
      }

      // Calculate delay with jitter
      const baseDelay =
        config.delays[attempt - 1] ?? config.delays[config.delays.length - 1] ?? 1000;
      const jitter = config.jitterMs ? Math.random() * config.jitterMs : 0;
      const delay = baseDelay + jitter;

      // Log retry attempt (no PII - never log error message which might contain sensitive data)
      console.log(
        `[API] prompts/capture: retry attempt ${attempt}/${config.maxRetries} after ${Math.round(delay)}ms`
      );

      // Wait before next attempt
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw new RetryError(
    `All ${config.maxRetries} retry attempts failed`,
    config.maxRetries,
    lastError!,
    Date.now() - startTime
  );
}

/**
 * Promise-based sleep utility.
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
