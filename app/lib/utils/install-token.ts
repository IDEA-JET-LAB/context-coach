/**
 * Install Token Utilities
 *
 * Install tokens are base64-encoded payloads that contain all the information
 * needed to install Contextor in a project. They include the API key,
 * project info, and API endpoint.
 *
 * SECURITY WARNING: Install tokens contain the plaintext API key encoded in base64.
 * Base64 is NOT encryption - anyone with access to the token can decode it and
 * extract the API key. The token has a 1-hour expiration window to minimize exposure.
 *
 * Mitigations in place:
 * - Short expiration window (1 hour)
 * - Tokens are single-use (should be consumed immediately after generation)
 * - API keys can be regenerated if compromised
 *
 * Future improvements to consider:
 * - Use asymmetric encryption with a project-specific public key
 * - Implement one-time token exchange where the CLI receives a short-lived
 *   session token instead of the actual API key
 */

// Token expiration window in hours (reduced from 24h for security)
export const TOKEN_EXPIRATION_HOURS = 1;

interface InstallTokenPayload {
  project_id: string;
  project_name: string;
  team_id: string;
  team_name: string;
  user_id: string;
  user_name: string;
  api_key: string;
  api_endpoint: string;
  expires_at?: string;
}

/**
 * Generates an install token from the payload
 * Format: ctx_<base64url encoded JSON>
 *
 * SECURITY NOTE: The token contains sensitive data (API key) in base64 encoding.
 * Ensure tokens are transmitted securely and consumed promptly.
 */
export function generateInstallToken(payload: InstallTokenPayload): string {
  const jsonPayload = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonPayload).toString('base64url');
  return `ctx_${base64Payload}`;
}

/**
 * Parses an install token and returns the payload
 * Returns null if the token is invalid
 */
export function parseInstallToken(token: string): InstallTokenPayload | null {
  try {
    if (!token.startsWith('ctx_')) {
      return null;
    }

    const base64Payload = token.substring(4);
    const jsonPayload = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    const payload = JSON.parse(jsonPayload) as InstallTokenPayload;

    // Validate required fields
    if (!payload.project_id || !payload.team_id || !payload.api_key || !payload.api_endpoint) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Gets the API endpoint for the current environment
 */
export function getApiEndpoint(): string {
  // Use the public URL if available, otherwise construct from origin
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }

  // Server-side: use environment variable or default
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3050';
  return `${baseUrl}/api`;
}
