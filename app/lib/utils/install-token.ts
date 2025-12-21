/**
 * Install Token Utilities
 *
 * Install tokens are base64-encoded payloads that contain all the information
 * needed to install Contextor in a project. They include the API key,
 * project info, and API endpoint.
 */

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
