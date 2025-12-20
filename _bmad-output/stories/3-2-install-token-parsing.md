# Story 3.2: Install Token Parsing

Status: ready-for-dev
Dependencies: Story 3.1 (CLI Package Foundation)

## Story

**As a** developer,
**I want** the CLI to accept and validate my Install Token,
**So that** my project is securely linked to my Contextor account.

## Acceptance Criteria

1. **Given** I have an Install Token from the dashboard
   **When** I run `npx @contextor/cli init <TOKEN>`
   **Then** the CLI parses the base64-encoded token
   **And** extracts: project_id, team_id, user_id, api_key, api_endpoint

2. **Given** I provide an invalid or malformed token
   **When** the CLI attempts to parse it
   **Then** I see "Invalid install token. Please copy it again from the dashboard."
   **And** the CLI exits with error code 1

3. **Given** I provide an expired token
   **When** the CLI validates with the API
   **Then** I see "This install token has expired. Please generate a new one."

## Tasks / Subtasks

- [ ] **Task 1: Create token parsing module** (AC: #1, #2)
  - [ ] Create `packages/cli/src/lib/token.ts`
  - [ ] Define `InstallToken` TypeScript interface with all required fields
  - [ ] Implement `parseToken(tokenString: string): InstallToken` function
  - [ ] Validate token starts with `ctx_` prefix
  - [ ] Extract and decode base64 payload after prefix
  - [ ] Parse JSON from decoded payload
  - [ ] Validate all required fields are present using Zod

- [ ] **Task 2: Handle token parsing errors** (AC: #2)
  - [ ] Create custom `TokenParseError` class extending Error
  - [ ] Handle missing `ctx_` prefix
  - [ ] Handle invalid base64 encoding
  - [ ] Handle invalid JSON parsing
  - [ ] Handle missing required fields (Zod validation)
  - [ ] Return consistent user-friendly error message for all parse failures

- [ ] **Task 3: Create API client module** (AC: #3)
  - [ ] Create `packages/cli/src/lib/api-client.ts`
  - [ ] Implement `validateToken(token: InstallToken): Promise<TokenValidationResult>`
  - [ ] Make HTTP POST request to `${api_endpoint}/cli/validate-token`
  - [ ] Include 10-second timeout on fetch request
  - [ ] Send token data in request body with Authorization header
  - [ ] Handle successful validation response
  - [ ] Handle expired token response (HTTP 401 with TOKEN_EXPIRED code)
  - [ ] Handle network errors and timeouts gracefully

- [ ] **Task 4: Implement init command token flow** (AC: #1, #2, #3)
  - [ ] Update `packages/cli/src/commands/init.ts`
  - [ ] Register `init <token>` command with Commander
  - [ ] Add token as required positional argument
  - [ ] Call `parseToken()` to extract token data
  - [ ] Check local expiry before API call (if `expires_at` is present and past)
  - [ ] Call `validateToken()` to verify with API
  - [ ] Display appropriate success or error messages
  - [ ] Exit with code 1 on any validation failure, code 0 on success

- [ ] **Task 5: Add error handling and output formatting** (AC: #2, #3)
  - [ ] Use `chalk` for colored error output (red for errors, green for success)
  - [ ] Use `ora` spinner while validating with API
  - [ ] Display spinner text: "Validating install token..."
  - [ ] On error: stop spinner with failure state, show error message
  - [ ] On success: stop spinner with success state

- [ ] **Task 6: Add unit tests for token parsing** (AC: #1, #2)
  - [ ] Create `packages/cli/src/lib/__tests__/token.test.ts`
  - [ ] Test valid token parsing extracts all fields correctly
  - [ ] Test invalid prefix returns TokenParseError
  - [ ] Test invalid base64 returns TokenParseError
  - [ ] Test missing fields returns TokenParseError
  - [ ] Test malformed JSON returns TokenParseError
  - [ ] Use test helper to create valid/invalid test tokens

## Dev Notes

### Install Token Format

```
Token Format: ctx_<base64-encoded-payload>

Payload Structure (JSON):
{
  "project_id": "uuid",
  "project_name": "string",
  "team_id": "uuid",
  "team_name": "string",
  "user_id": "uuid",
  "user_name": "string",
  "api_key": "string",
  "api_endpoint": "https://api.contextor.co",
  "expires_at": "ISO-8601 timestamp"
}
```

### Token Interface & Parsing

```typescript
// packages/cli/src/lib/token.ts
import { z } from 'zod';

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

export class TokenParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenParseError';
  }
}

const GENERIC_ERROR = 'Invalid install token. Please copy it again from the dashboard.';

export function parseToken(tokenString: string): InstallToken {
  if (!tokenString.startsWith('ctx_')) {
    throw new TokenParseError(GENERIC_ERROR);
  }

  const base64Payload = tokenString.slice(4);

  let jsonString: string;
  try {
    jsonString = Buffer.from(base64Payload, 'base64').toString('utf-8');
  } catch {
    throw new TokenParseError(GENERIC_ERROR);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(jsonString);
  } catch {
    throw new TokenParseError(GENERIC_ERROR);
  }

  const result = installTokenSchema.safeParse(payload);
  if (!result.success) {
    throw new TokenParseError(GENERIC_ERROR);
  }

  return result.data;
}

// Test helper for creating tokens
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
  return 'ctx_' + Buffer.from(JSON.stringify(payload)).toString('base64');
}
```

### API Client

```typescript
// packages/cli/src/lib/api-client.ts
import type { InstallToken } from './token.js';

export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  error?: string;
}

const VALIDATION_TIMEOUT_MS = 10000;

export async function validateToken(
  token: InstallToken
): Promise<TokenValidationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

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
      const data = await response.json();
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
```

### Init Command

```typescript
// packages/cli/src/commands/init.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { parseToken, TokenParseError } from '../lib/token.js';
import { validateToken } from '../lib/api-client.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init <token>')
    .description('Initialize Contextor in this project')
    .option('-f, --force', 'Force installation, overwriting existing config')
    .action(async (tokenString: string, options: { force?: boolean }) => {
      // Parse token
      let token;
      try {
        token = parseToken(tokenString);
      } catch (error) {
        if (error instanceof TokenParseError) {
          console.error(chalk.red(error.message));
          process.exit(1);
        }
        throw error;
      }

      // Check local expiry before API call
      if (token.expires_at) {
        const expiryDate = new Date(token.expires_at);
        if (expiryDate < new Date()) {
          console.error(
            chalk.red('This install token has expired. Please generate a new one.')
          );
          process.exit(1);
        }
      }

      // Validate with API
      const spinner = ora('Validating install token...').start();

      const result = await validateToken(token);

      if (result.expired) {
        spinner.fail('Token validation failed');
        console.error(
          chalk.red('This install token has expired. Please generate a new one.')
        );
        process.exit(1);
      }

      if (!result.valid) {
        spinner.fail('Token validation failed');
        console.error(chalk.red(result.error || 'Invalid token'));
        process.exit(1);
      }

      spinner.succeed('Token validated');
      console.log(chalk.green('Token valid for project: ') + token.project_name);

      // Continue with installation (handled in subsequent stories 3.3-3.6)
    });
}
```

### Dependencies

```bash
cd packages/cli
npm install zod chalk ora commander
npm install -D @types/node
```

### Error Messages Reference

| Scenario | Error Message |
|----------|---------------|
| Invalid/malformed token | "Invalid install token. Please copy it again from the dashboard." |
| Expired token (local check) | "This install token has expired. Please generate a new one." |
| Expired token (API response) | "This install token has expired. Please generate a new one." |
| API connection failure | "Could not connect to Contextor API. Please check your internet connection." |
| API timeout | "Connection timed out. Please check your internet connection." |
| API validation failure | "Token validation failed. Please try generating a new token." |

### Directory Structure After This Story

```
packages/cli/
├── src/
│   ├── bin/
│   │   └── contextor.ts
│   ├── commands/
│   │   ├── init.ts              # UPDATED: Token parsing + validation
│   │   ├── status.ts
│   │   └── uninstall.ts
│   └── lib/
│       ├── token.ts             # NEW: Token parsing + Zod schema
│       ├── api-client.ts        # NEW: API communication
│       └── __tests__/
│           └── token.test.ts    # NEW: Token tests
├── package.json                  # UPDATED: zod, chalk, ora dependencies
└── tsconfig.json
```

### Critical Constraints

**From project-context.md:**
- Token format: `ctx_<base64-encoded-payload>`
- Payload must include: project_id, team_id, user_id, api_key, api_endpoint
- All IDs must be valid UUIDs
- API endpoint must be a valid URL

**Security:**
- DO NOT log the API key or token contents in error messages
- DO NOT expose internal parsing errors to users
- Always use the generic error message for parse failures

**Reliability:**
- Always validate token with server (don't trust client-side only)
- Include timeout on network requests (10 seconds)
- Handle network errors gracefully with user-friendly messages

### Verification Checklist

After completing this story, verify:
- [ ] Valid token is parsed correctly with all fields extracted
- [ ] Invalid prefix shows correct error message
- [ ] Invalid base64 shows correct error message
- [ ] Malformed JSON shows correct error message
- [ ] Missing fields show correct error message
- [ ] Locally expired token shows expiration error (no API call)
- [ ] API-expired token shows expiration error
- [ ] Network timeout shows timeout error
- [ ] Network failure shows connection error
- [ ] Spinner shows during validation
- [ ] Exit code is 1 for all error cases
- [ ] Exit code is 0 for successful validation
- [ ] All unit tests pass

### References

- Epic 3: CLI Installation Experience
- Story 3.1: CLI Package Foundation (prerequisite)
- [Zod Documentation](https://zod.dev/)
- [Commander.js Documentation](https://github.com/tj/commander.js)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
