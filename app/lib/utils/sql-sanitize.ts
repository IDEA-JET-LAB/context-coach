/**
 * SQL Sanitization Utilities
 *
 * Provides helper functions for sanitizing user input used in SQL queries.
 * These complement Supabase's built-in parameterization by handling
 * pattern-specific characters that have special meaning.
 */

/**
 * Escapes SQL LIKE/ILIKE pattern characters to prevent pattern injection.
 *
 * SQL LIKE patterns use special characters:
 * - % matches any sequence of zero or more characters
 * - _ matches any single character
 * - \ is the escape character
 *
 * Without escaping, a user searching for "50%" could match unintended rows,
 * or a search for "user_name" could match "username", "user1name", etc.
 *
 * @param input - The raw user input string
 * @returns The escaped string safe for use in LIKE/ILIKE patterns
 *
 * @example
 * // User searching for literal "50%"
 * const escaped = escapeSqlLikePattern("50%");
 * // Result: "50\\%"
 * query.ilike('text', `%${escaped}%`);
 *
 * @example
 * // User searching for literal "user_id"
 * const escaped = escapeSqlLikePattern("user_id");
 * // Result: "user\\_id"
 */
export function escapeSqlLikePattern(input: string): string {
  return input
    .replace(/\\/g, "\\\\") // Escape backslashes first (order matters!)
    .replace(/%/g, "\\%") // Escape percent signs
    .replace(/_/g, "\\_"); // Escape underscores
}
