/**
 * API Key Encryption Utilities
 *
 * Uses AES-256-GCM for authenticated encryption of API keys.
 * The encryption key must be set via API_KEY_ENCRYPTION_SECRET environment variable.
 *
 * Format: iv:authTag:ciphertext (all base64 encoded)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from environment variable.
 * Derives a 32-byte key from the secret using SHA-256.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET environment variable is not set');
  }
  // Derive a 32-byte key from the secret using SHA-256
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypts an API key using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all base64)
 */
export function encryptApiKey(apiKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts an encrypted API key.
 * Expects format: iv:authTag:ciphertext (all base64)
 * Returns null if decryption fails.
 */
export function decryptApiKey(encryptedKey: string): string | null {
  try {
    const key = getEncryptionKey();
    const parts = encryptedKey.split(':');

    if (parts.length !== 3) {
      console.error('[Encryption] Invalid encrypted key format');
      return null;
    }

    const ivBase64 = parts[0];
    const authTagBase64 = parts[1];
    const ciphertext = parts[2];

    if (!ivBase64 || !authTagBase64 || !ciphertext) {
      console.error('[Encryption] Missing encrypted key parts');
      return null;
    }

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    if (iv.length !== IV_LENGTH) {
      console.error('[Encryption] Invalid IV length');
      return null;
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      console.error('[Encryption] Invalid auth tag length');
      return null;
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error);
    return null;
  }
}
