/**
 * Structured Logger for Cloud Logging Compatibility
 *
 * Outputs JSON-formatted logs that work well with Google Cloud Logging.
 * Follows the format: [CONTEXT] action: details
 *
 * Usage:
 *   import { log, warn, error } from '@/lib/utils/logger';
 *
 *   log('CAPTURE', 'Request received', { requestId: 'xxx' });
 *   warn('AUTH', 'Rate limit approaching', { userId: 'yyy' });
 *   error('API', 'Request failed', err, { endpoint: '/api/...' });
 */

type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

interface LogEntry {
  severity: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Creates a structured log entry compatible with Cloud Logging
 */
function createLogEntry(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>
): LogEntry {
  return {
    severity: level,
    message: `[${context}] ${message}`,
    timestamp: new Date().toISOString(),
    context,
    ...data,
  };
}

/**
 * Logs an informational message
 *
 * @param context - The component/module context (e.g., 'CAPTURE', 'AUTH', 'API')
 * @param message - Human-readable message describing the event
 * @param data - Optional additional structured data
 *
 * @example
 * log('CAPTURE', 'Prompt stored successfully', { promptId: 'xxx', projectId: 'yyy' });
 */
export function log(
  context: string,
  message: string,
  data?: Record<string, unknown>
): void {
  const entry = createLogEntry("INFO", context, message, data);
  console.log(JSON.stringify(entry));
}

/**
 * Logs a debug message (only in development)
 *
 * @param context - The component/module context
 * @param message - Debug message
 * @param data - Optional additional structured data
 */
export function debug(
  context: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== "production") {
    const entry = createLogEntry("DEBUG", context, message, data);
    console.debug(JSON.stringify(entry));
  }
}

/**
 * Logs a warning message
 *
 * @param context - The component/module context
 * @param message - Warning message
 * @param data - Optional additional structured data
 *
 * @example
 * warn('RATE_LIMIT', 'Approaching limit', { userId: 'xxx', remaining: 10 });
 */
export function warn(
  context: string,
  message: string,
  data?: Record<string, unknown>
): void {
  const entry = createLogEntry("WARNING", context, message, data);
  console.warn(JSON.stringify(entry));
}

/**
 * Logs an error message with optional error object
 *
 * @param context - The component/module context
 * @param message - Error message
 * @param err - Optional Error object (stack trace will be included)
 * @param data - Optional additional structured data
 *
 * @example
 * error('AUTH', 'Login failed', err, { email: 'user@...' });
 */
export function error(
  context: string,
  message: string,
  err?: Error | unknown,
  data?: Record<string, unknown>
): void {
  const errorData: Record<string, unknown> = { ...data };

  if (err instanceof Error) {
    errorData.error = err.message;
    errorData.stack = err.stack;
    errorData.errorName = err.name;
  } else if (err !== undefined) {
    errorData.error = String(err);
  }

  const entry = createLogEntry("ERROR", context, message, errorData);
  console.error(JSON.stringify(entry));
}

/**
 * Creates a scoped logger with a fixed context
 *
 * @param context - The fixed context for all log calls
 * @returns Object with log, warn, error methods pre-bound to the context
 *
 * @example
 * const captureLogger = createScopedLogger('CAPTURE');
 * captureLogger.log('Request received', { requestId: 'xxx' });
 */
export function createScopedLogger(context: string) {
  return {
    log: (message: string, data?: Record<string, unknown>) =>
      log(context, message, data),
    debug: (message: string, data?: Record<string, unknown>) =>
      debug(context, message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      warn(context, message, data),
    error: (
      message: string,
      err?: Error | unknown,
      data?: Record<string, unknown>
    ) => error(context, message, err, data),
  };
}
