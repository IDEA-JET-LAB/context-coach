import { z } from 'zod';

/**
 * Allowed API endpoint domains for security validation
 * Only these domains are accepted in install tokens
 */
export const ALLOWED_API_DOMAINS = [
  'contextor.co',
  'api.contextor.co',
  '127.0.0.1',
  'localhost',
] as const;

/**
 * Custom Zod refinement to validate API endpoint domain
 */
const apiEndpointSchema = z.string().url().refine((url) => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    // Check if hostname matches allowed domains
    return ALLOWED_API_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}, {
  message: 'API endpoint must be from an allowed Contextor domain'
});

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
  api_endpoint: apiEndpointSchema,
  expires_at: z.string().datetime().optional(),
});

export type InstallToken = z.infer<typeof installTokenSchema>;

/**
 * Custom error for token parsing failures
 */
export class TokenParseError extends Error {
  constructor(
    message: string,
    public readonly debugInfo?: string
  ) {
    super(message);
    this.name = 'TokenParseError';
  }
}

const GENERIC_ERROR = 'Invalid install token. Please copy it again from the dashboard.';
const TOKEN_PREFIX = 'ctx_';

/**
 * Enable debug mode for detailed error messages
 * Set via CONTEXTOR_DEBUG=1 environment variable
 */
export function isDebugMode(): boolean {
  return process.env.CONTEXTOR_DEBUG === '1';
}

/**
 * Helper to create error with optional debug info
 */
function createTokenError(debugMessage: string): TokenParseError {
  if (isDebugMode()) {
    return new TokenParseError(`${GENERIC_ERROR}\n\nDebug info: ${debugMessage}`, debugMessage);
  }
  return new TokenParseError(GENERIC_ERROR, debugMessage);
}

/**
 * Parse and validate an install token string
 * Token format: ctx_<base64-encoded-JSON-payload>
 *
 * Set CONTEXTOR_DEBUG=1 environment variable for detailed error messages
 */
export function parseToken(tokenString: string): InstallToken {
  // Validate prefix
  if (!tokenString.startsWith(TOKEN_PREFIX)) {
    throw createTokenError(`Token must start with '${TOKEN_PREFIX}' prefix`);
  }

  // Extract base64 payload
  const base64Payload = tokenString.slice(TOKEN_PREFIX.length);

  // Decode base64
  let jsonString: string;
  try {
    jsonString = Buffer.from(base64Payload, 'base64').toString('utf-8');
  } catch (e) {
    throw createTokenError(`Base64 decode failed: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // Parse JSON
  let payload: unknown;
  try {
    payload = JSON.parse(jsonString);
  } catch (e) {
    throw createTokenError(`JSON parse failed: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // Validate with Zod schema
  const result = installTokenSchema.safeParse(payload);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw createTokenError(`Schema validation failed: ${issues}`);
  }

  return result.data;
}

/**
 * Check if token is expired based on expires_at field
 *
 * SECURITY: Tokens without an expiration date are treated as expired.
 * All valid tokens MUST have a mandatory expiration to prevent indefinite
 * use of potentially compromised tokens.
 */
export function isTokenExpired(token: InstallToken): boolean {
  if (!token.expires_at) {
    // Treat missing expiration as expired for security - all tokens should have mandatory expiration
    return true;
  }
  const expiryDate = new Date(token.expires_at);
  return expiryDate < new Date();
}

/**
 * Test helper for creating valid/invalid test tokens
 * @internal - Only exported for test files
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
