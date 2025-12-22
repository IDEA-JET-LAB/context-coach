/**
 * UUID Validation Utilities
 *
 * Provides helper functions for validating UUID format before database queries.
 * This prevents SQL errors and potential injection attempts through malformed IDs.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID (v4 format).
 *
 * @param value - The string to validate
 * @returns true if the value is a valid UUID, false otherwise
 *
 * @example
 * isValidUuid("550e8400-e29b-41d4-a716-446655440000"); // true
 * isValidUuid("not-a-uuid"); // false
 * isValidUuid(""); // false
 * isValidUuid(null); // false
 */
export function isValidUuid(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return UUID_REGEX.test(value);
}

/**
 * Validates UUID and throws an error if invalid.
 * Useful for API routes that need to fail fast on invalid IDs.
 *
 * @param value - The value to validate
 * @param paramName - The parameter name for error messages (e.g., "teamId", "projectId")
 * @throws Error if the value is not a valid UUID
 *
 * @example
 * validateUuid(teamId, "teamId"); // throws if invalid
 */
export function validateUuid(value: unknown, paramName: string = "id"): asserts value is string {
  if (!isValidUuid(value)) {
    throw new Error(`Invalid ${paramName} format`);
  }
}
