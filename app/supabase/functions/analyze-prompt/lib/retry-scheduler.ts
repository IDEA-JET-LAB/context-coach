/**
 * Retry Scheduler Module
 * Story 5.5: Retry Logic and Error Handling
 *
 * Manages retry delays with exponential backoff and jitter.
 * Prevents thundering herd problems when many requests fail simultaneously.
 */

/**
 * Retry delays in milliseconds for each attempt.
 * Uses exponential backoff pattern: 1s, 5s, 15s
 */
export const RETRY_DELAYS_MS = [1000, 5000, 15000] as const;

/**
 * Maximum number of retry attempts before moving to dead letter queue.
 */
export const MAX_RETRIES = 3;

/**
 * Maximum jitter percentage (0.0 to 0.2 = 0% to 20%)
 */
const MAX_JITTER_PERCENTAGE = 0.2;

/**
 * Adds random jitter to a delay value.
 * Jitter is a random value between 0% and MAX_JITTER_PERCENTAGE of the base delay.
 * This prevents thundering herd when many retries happen at once.
 *
 * @param baseDelayMs - The base delay in milliseconds
 * @returns The delay with random jitter added
 */
function addJitter(baseDelayMs: number): number {
  const jitterFactor = Math.random() * MAX_JITTER_PERCENTAGE;
  const jitterMs = Math.floor(baseDelayMs * jitterFactor);
  return baseDelayMs + jitterMs;
}

/**
 * Gets the retry delay for a given attempt number.
 *
 * @param attemptNumber - The current attempt number (1-based: 1, 2, 3, ...)
 * @returns The delay in milliseconds with jitter, or null if max retries exceeded
 *
 * @example
 * getRetryDelay(1) // ~1000-1200ms (1s + 0-20% jitter)
 * getRetryDelay(2) // ~5000-6000ms (5s + 0-20% jitter)
 * getRetryDelay(3) // ~15000-18000ms (15s + 0-20% jitter)
 * getRetryDelay(4) // null (exceeded MAX_RETRIES)
 */
export function getRetryDelay(attemptNumber: number): number | null {
  // Validate input
  if (attemptNumber < 1 || !Number.isInteger(attemptNumber)) {
    return null;
  }

  // Check if max retries exceeded
  if (attemptNumber > MAX_RETRIES) {
    return null;
  }

  // Get base delay (0-indexed array)
  const delayIndex = attemptNumber - 1;
  const baseDelay = RETRY_DELAYS_MS[delayIndex];

  // Safety check (shouldn't happen if MAX_RETRIES matches array length)
  if (baseDelay === undefined) {
    return null;
  }

  return addJitter(baseDelay);
}

/**
 * Checks if an attempt number can still be retried.
 *
 * @param attemptNumber - The current attempt number (1-based)
 * @returns true if more retries are allowed, false if max exceeded
 */
export function canRetry(attemptNumber: number): boolean {
  return attemptNumber <= MAX_RETRIES;
}

/**
 * Checks if a prompt should be moved to the dead letter queue.
 * A prompt is "dead" when it has exceeded the maximum retry attempts.
 *
 * @param attemptNumber - The current attempt number (1-based)
 * @returns true if prompt should be marked as permanently failed
 */
export function shouldMoveToDeadLetter(attemptNumber: number): boolean {
  return attemptNumber > MAX_RETRIES;
}

/**
 * Creates a promise that resolves after the retry delay.
 * Useful for implementing retry waits in async code.
 *
 * @param attemptNumber - The current attempt number (1-based)
 * @returns Promise that resolves after the delay, or rejects if max retries exceeded
 */
export function waitForRetry(attemptNumber: number): Promise<void> {
  const delay = getRetryDelay(attemptNumber);

  if (delay === null) {
    return Promise.reject(
      new Error(`Max retries (${MAX_RETRIES}) exceeded at attempt ${attemptNumber}`)
    );
  }

  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Retry configuration for logging/debugging purposes.
 */
export interface RetryConfig {
  maxRetries: number;
  delays: readonly number[];
  maxJitterPercentage: number;
}

/**
 * Gets the current retry configuration.
 * Useful for logging or debugging retry behavior.
 */
export function getRetryConfig(): RetryConfig {
  return {
    maxRetries: MAX_RETRIES,
    delays: RETRY_DELAYS_MS,
    maxJitterPercentage: MAX_JITTER_PERCENTAGE,
  };
}
