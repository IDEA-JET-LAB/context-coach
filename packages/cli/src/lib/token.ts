import { z } from 'zod';

/**
 * Zod schema for validating install token payload
 */
export const installTokenSchema = z.object({
  project_id: z.string().uuid(),
  project_name: z.string().min(1),
  team_id: z.string().uuid(),
  team_name: z.string().min(1),
  user_id: z.string().uuid(),
  user_name: z.string().min(1),
  api_key: z.string().min(1),
  api_endpoint: z.string().url(),
  expires_at: z.string().datetime().optional(),
});

export type InstallToken = z.infer<typeof installTokenSchema>;

/**
 * Custom error for token parsing failures
 */
export class TokenParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenParseError';
  }
}

const GENERIC_ERROR = 'Invalid install token. Please copy it again from the dashboard.';
const TOKEN_PREFIX = 'ctx_';

/**
 * Parse and validate an install token string
 * Token format: ctx_<base64-encoded-JSON-payload>
 */
export function parseToken(tokenString: string): InstallToken {
  // Validate prefix
  if (!tokenString.startsWith(TOKEN_PREFIX)) {
    throw new TokenParseError(GENERIC_ERROR);
  }

  // Extract base64 payload
  const base64Payload = tokenString.slice(TOKEN_PREFIX.length);

  // Decode base64
  let jsonString: string;
  try {
    jsonString = Buffer.from(base64Payload, 'base64').toString('utf-8');
  } catch {
    throw new TokenParseError(GENERIC_ERROR);
  }

  // Parse JSON
  let payload: unknown;
  try {
    payload = JSON.parse(jsonString);
  } catch {
    throw new TokenParseError(GENERIC_ERROR);
  }

  // Validate with Zod schema
  const result = installTokenSchema.safeParse(payload);
  if (!result.success) {
    throw new TokenParseError(GENERIC_ERROR);
  }

  return result.data;
}

/**
 * Check if token is expired based on expires_at field
 */
export function isTokenExpired(token: InstallToken): boolean {
  if (!token.expires_at) {
    return false;
  }
  const expiryDate = new Date(token.expires_at);
  return expiryDate < new Date();
}

/**
 * Test helper for creating valid/invalid test tokens
 */
export function createTestToken(overrides: Partial<InstallToken> = {}): string {
  const payload: InstallToken = {
    project_id: '550e8400-e29b-41d4-a716-446655440000',
    project_name: 'Test Project',
    team_id: '550e8400-e29b-41d4-a716-446655440001',
    team_name: 'Test Team',
    user_id: '550e8400-e29b-41d4-a716-446655440002',
    user_name: 'Test User',
    api_key: 'sk_test_xxxxx',
    api_endpoint: 'https://api.contextor.co',
    ...overrides,
  };
  return TOKEN_PREFIX + Buffer.from(JSON.stringify(payload)).toString('base64');
}
