/**
 * Fingerprint Generator - Story 17-4
 *
 * Generates deterministic fingerprints for prompts to enable deduplication.
 * The fingerprint is used to detect and skip duplicate imports.
 *
 * CRITICAL: The same algorithm MUST be used in both:
 * - Historical import (this module)
 * - Real-time capture hook (via database trigger)
 *
 * Components of the fingerprint:
 * - user_id: Ensures user isolation (different users can have same prompts)
 * - timestamp: Minute precision (YYYYMMDDHHMM UTC) - allows same prompt at different times
 * - text: First 200 characters, normalized (lowercase, collapsed whitespace)
 *
 * Output: 16-character hex string (first 16 chars of MD5 hash)
 */

import { createHash } from 'crypto';

/**
 * Normalize text for consistent fingerprinting.
 *
 * Normalization rules:
 * - Trim leading/trailing whitespace
 * - Collapse multiple whitespace characters (spaces, tabs, newlines) to single space
 * - Convert to lowercase for case-insensitive comparison
 *
 * @param text - The text to normalize
 * @returns Normalized text
 *
 * @example
 * normalizeText('  Hello  World  ') // 'hello world'
 * normalizeText('Hello\n\tWorld') // 'hello world'
 */
export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Generates a deterministic fingerprint for a prompt.
 *
 * Used to detect and skip duplicate imports. The fingerprint is:
 * - Deterministic: Same inputs always produce same output
 * - User-scoped: Different users can have identical prompts
 * - Minute-precision: Same prompt in different minutes = different fingerprint
 * - Normalized: Whitespace and case differences are ignored
 *
 * @param userId - The user's UUID
 * @param timestamp - When the prompt was created (Date object or ISO string)
 * @param text - The prompt text
 * @returns 16-character hex string fingerprint
 *
 * @example
 * generatePromptFingerprint(
 *   '11111111-1111-1111-1111-111111111111',
 *   new Date('2025-01-15T10:30:00Z'),
 *   'Write a function that calculates fibonacci'
 * )
 * // Returns: 'a1b2c3d4e5f67890'
 */
export function generatePromptFingerprint(
  userId: string,
  timestamp: Date | string,
  text: string
): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  // Format: YYYYMMDDHHMM (minute precision, UTC)
  // Using UTC ensures consistency across timezones
  const timeComponent = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
  ].join('');

  // First 200 chars of text, normalized
  const textComponent = normalizeText(text).substring(0, 200);

  // Generate fingerprint using MD5 (fast, adequate for dedup)
  // Format: user_id:timestamp:text
  const input = `${userId}:${timeComponent}:${textComponent}`;
  return createHash('md5').update(input).digest('hex').substring(0, 16);
}
