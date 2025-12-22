import crypto from 'crypto';

const API_KEY_PREFIX = 'ctx_live_';

/**
 * API Key Security Notice
 *
 * IMPORTANT: API keys are stored as SHA-256 hashes and CANNOT be recovered.
 * The plaintext key is only shown once at creation time.
 *
 * If a key is lost:
 * 1. Generate a new key via project settings
 * 2. The old key is immediately invalidated
 * 3. Update all CLI installations with the new key
 *
 * Security properties:
 * - Keys use cryptographically secure random bytes (192 bits of entropy)
 * - Stored as irreversible SHA-256 hashes
 * - Only the first 16 characters (prefix) are stored for identification
 * - Key regeneration is immediate (no grace period) to minimize exposure
 */

/**
 * Generates a new API key with the format: ctx_live_xxxx
 * Uses cryptographically secure random bytes
 *
 * WARNING: This key is shown only once and cannot be recovered.
 * Store it securely or regenerate if lost.
 */
export function generateApiKey(): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * Hashes an API key using SHA-256 for secure storage
 * NEVER store the plaintext API key in the database
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Gets the prefix of an API key for display purposes
 * Returns the first 16 characters (e.g., "ctx_live_abc123...")
 */
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 16);
}

/**
 * Masks an API key prefix for display in UI
 * Shows the prefix followed by asterisks
 */
export function maskApiKey(prefix: string): string {
  return `${prefix}${'*'.repeat(20)}`;
}

/**
 * Validates that a string is in the expected API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith(API_KEY_PREFIX) && apiKey.length > 16;
}
