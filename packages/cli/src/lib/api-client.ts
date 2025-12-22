import type { InstallToken } from './token.js';
import { TIMEOUTS } from './constants.js';

export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  error?: string;
}

export interface TestError {
  code: 'AUTH_FAILED' | 'PROJECT_NOT_FOUND' | 'FORBIDDEN' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR';
  message: string;
}

export interface TestResult {
  success: boolean;
  error?: TestError;
}

/**
 * Validate install token with the Contextor API
 */
export async function validateToken(
  token: InstallToken
): Promise<TokenValidationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.API_REQUEST_MS);

  try {
    const response = await fetch(`${token.api_endpoint}/cli/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.api_key}`,
      },
      body: JSON.stringify({
        project_id: token.project_id,
        team_id: token.team_id,
        user_id: token.user_id,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      const data = await response.json() as { error?: { code?: string; message?: string } };
      if (data.error?.code === 'TOKEN_EXPIRED') {
        return { valid: false, expired: true };
      }
      return { valid: false, expired: false, error: data.error?.message };
    }

    if (!response.ok) {
      return {
        valid: false,
        expired: false,
        error: 'Token validation failed. Please try generating a new token.',
      };
    }

    return { valid: true, expired: false };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        valid: false,
        expired: false,
        error: 'Connection timed out. Please check your internet connection.',
      };
    }
    return {
      valid: false,
      expired: false,
      error: 'Could not connect to Contextor API. Please check your internet connection.',
    };
  }
}

const ERROR_MAP: Record<number, TestError> = {
  401: { code: 'AUTH_FAILED', message: 'Authentication failed. Your API key may be invalid.' },
  403: { code: 'FORBIDDEN', message: 'Access denied. You may not have permission for this project.' },
  404: { code: 'PROJECT_NOT_FOUND', message: 'Project not found. It may have been deleted.' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
};

/**
 * Test capture connection with the Contextor API
 */
export async function testCapture(
  userConfig: { api_key: string; user_id: string },
  sharedConfig: { api_endpoint: string; project_id: string },
  cliVersion: string
): Promise<TestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUTS.API_REQUEST_MS);

  try {
    const response = await fetch(
      `${sharedConfig.api_endpoint}/cli/test-capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userConfig.api_key}`,
        },
        body: JSON.stringify({
          project_id: sharedConfig.project_id,
          user_id: userConfig.user_id,
          cli_version: cliVersion,
          test: true,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (response.ok) return { success: true };

    const knownError = ERROR_MAP[response.status];
    if (knownError) return { success: false, error: knownError };

    return {
      success: false,
      error: { code: 'SERVER_ERROR', message: `Server error (${response.status}). Please try again later.` },
    };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: { code: 'TIMEOUT', message: 'Connection timed out. Please check your internet connection.' } };
    }
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Could not connect to Contextor API. Please check your internet connection.' } };
  }
}

/**
 * Get last capture timestamp from API
 */
export async function getLastCapture(
  userConfig: { api_key: string; user_id: string },
  sharedConfig: { api_endpoint: string; project_id: string }
): Promise<Date | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.API_REQUEST_MS);

  try {
    const response = await fetch(
      `${sharedConfig.api_endpoint}/cli/last-capture?project_id=${sharedConfig.project_id}&user_id=${userConfig.user_id}`,
      {
        headers: { 'Authorization': `Bearer ${userConfig.api_key}` },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json() as { last_capture_at?: string };
    return data.last_capture_at ? new Date(data.last_capture_at) : null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
