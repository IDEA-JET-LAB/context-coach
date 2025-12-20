# Story 4.1: Capture API Endpoint

Status: ready-for-dev

## Story

**As a** system,
**I want** to receive prompts from the CLI hook,
**So that** they can be stored and analyzed.

## Acceptance Criteria

1. **API Key Validation Success**
   - **Given** the capture endpoint at `POST /api/prompts/capture`
   - **When** a valid request arrives with API key header
   - **Then** the API key is validated against `projects.api_key_hash`
   - **And** the project_id and team_id are extracted
   - **And** the request proceeds to processing

2. **Invalid/Missing API Key Handling**
   - **Given** an invalid or missing API key
   - **When** the request arrives
   - **Then** HTTP 401 is returned with `{ error: { code: 'INVALID_API_KEY', message: '...' } }`

3. **Valid Request Body Structure**
   - **Given** a valid request body
   - **When** the prompt is received
   - **Then** the body contains: `prompt` (text), `user_id`, `timestamp`, `metadata` (optional)

4. **Success Response**
   - **Given** a valid request with valid API key and body
   - **When** processing completes
   - **Then** HTTP 201 is returned with `{ data: { id: string, status: 'pending' } }`

## Tasks / Subtasks

- [ ] **Task 1: Create API route structure** (AC: #1, #3, #4)
  - [ ] Create `app/api/prompts/capture/route.ts` with POST handler
  - [ ] Define request body type interface with `prompt`, `user_id`, `timestamp`, `metadata?`
  - [ ] Define response types following API format: `{ data: T }` or `{ error: { code, message } }`
  - [ ] Add proper TypeScript types (no `any`, use strict mode)

- [ ] **Task 2: Implement API key extraction** (AC: #1, #2)
  - [ ] Extract API key from `Authorization` header (Bearer token format)
  - [ ] Handle missing Authorization header with 401 response
  - [ ] Handle malformed Authorization header (not Bearer format)
  - [ ] Log API key validation attempts with `[API] prompts/capture` prefix

- [ ] **Task 3: Create API key validation logic** (AC: #1, #2)
  - [ ] Create `lib/api/validate-api-key.ts` utility
  - [ ] Hash incoming API key using SHA-256
  - [ ] Use `timingSafeEqual` for secure hash comparison (prevent timing attacks)
  - [ ] Query `projects` table for matching `api_key_hash`
  - [ ] Use Supabase admin client (service role) to bypass RLS for lookup
  - [ ] Extract `project_id` and `team_id` from matched project row

- [ ] **Task 4: Create Supabase admin client** (AC: #1)
  - [ ] Create `lib/supabase/admin.ts` with service role client
  - [ ] Use `SUPABASE_SERVICE_ROLE_KEY` environment variable
  - [ ] Ensure client is only used server-side

- [ ] **Task 5: Handle invalid API key response** (AC: #2)
  - [ ] Return HTTP 401 status code
  - [ ] Return body: `{ error: { code: 'INVALID_API_KEY', message: 'Invalid or missing API key' } }`
  - [ ] Do NOT reveal whether key format is wrong vs key doesn't exist (security)
  - [ ] Rate limiting for failed attempts handled by Story 4.2

- [ ] **Task 6: Parse and validate request body** (AC: #3)
  - [ ] Create Zod schema for request body validation in `lib/validations/capture.ts`
  - [ ] Validate `prompt` field exists and is string (min 1 char)
  - [ ] Validate `user_id` field exists and is string
  - [ ] Validate `timestamp` field exists and is ISO 8601 format
  - [ ] Validate `metadata` field is optional object if present
  - [ ] Handle JSON parse errors with 400 response
  - [ ] Return HTTP 400 for validation failures with specific error codes

- [ ] **Task 7: Create success response structure** (AC: #4)
  - [ ] Generate unique prompt ID (UUID)
  - [ ] Return HTTP 201 with `{ data: { id, status: 'pending' } }`
  - [ ] Log successful requests with timestamp and project_id (no PII)
  - [ ] Prepare data structure for handoff to validation pipeline (Story 4.3)

- [ ] **Task 8: Add error handling wrapper** (AC: #1, #2, #3)
  - [ ] Wrap handler in try/catch block
  - [ ] Handle JSON parse errors specifically with 400 response
  - [ ] Log errors with `[API] prompts/capture: error` format
  - [ ] Return HTTP 500 with generic error for unexpected failures
  - [ ] Never expose stack traces or internal details to client

## Dev Notes

### Technology Stack
- Next.js 15 with App Router
- TypeScript in strict mode
- Supabase with RLS (admin client for API key lookup)
- Zod for request validation

### Request Schema

```typescript
// lib/validations/capture.ts
import { z } from 'zod';

export const captureRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  user_id: z.string().min(1, 'User ID is required'),
  timestamp: z.string().datetime({ message: 'Invalid timestamp format' }),
  metadata: z.record(z.unknown()).optional(),
});

export type CaptureRequest = z.infer<typeof captureRequestSchema>;
```

### Supabase Admin Client

```typescript
// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';

// Server-only - never import in client components
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}
```

### API Key Validation

```typescript
// lib/api/validate-api-key.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { createHash, timingSafeEqual } from 'crypto';

export async function validateApiKey(apiKey: string): Promise<{
  valid: boolean;
  project_id?: string;
  team_id?: string;
}> {
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const supabase = createAdminClient();

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, team_id, api_key_hash')
    .eq('api_key_hash', keyHash)
    .single();

  if (error || !project) {
    return { valid: false };
  }

  // Constant-time comparison to prevent timing attacks
  const storedHash = Buffer.from(project.api_key_hash, 'hex');
  const providedHash = Buffer.from(keyHash, 'hex');

  if (!timingSafeEqual(storedHash, providedHash)) {
    return { valid: false };
  }

  return {
    valid: true,
    project_id: project.id,
    team_id: project.team_id,
  };
}
```

### API Route Implementation

```typescript
// app/api/prompts/capture/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/validate-api-key';
import { captureRequestSchema } from '@/lib/validations/capture';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[API] prompts/capture: missing or malformed auth header');
      return NextResponse.json(
        { error: { code: 'INVALID_API_KEY', message: 'Invalid or missing API key' } },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);

    // Validate API key
    const keyResult = await validateApiKey(apiKey);
    if (!keyResult.valid) {
      console.log('[API] prompts/capture: invalid API key');
      return NextResponse.json(
        { error: { code: 'INVALID_API_KEY', message: 'Invalid or missing API key' } },
        { status: 401 }
      );
    }

    // Parse request body with error handling
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      console.log('[API] prompts/capture: invalid JSON body');
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
        { status: 400 }
      );
    }

    // Validate body schema
    const parsed = captureRequestSchema.safeParse(body);
    if (!parsed.success) {
      console.log('[API] prompts/capture: validation error', parsed.error.issues[0]);
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
        { status: 400 }
      );
    }

    // Generate prompt ID for response
    const promptId = randomUUID();

    // Log successful capture (no PII)
    console.log('[API] prompts/capture: success', {
      project_id: keyResult.project_id,
      prompt_id: promptId,
      timestamp: new Date().toISOString()
    });

    // Return success - actual storage handled by Story 4.5
    return NextResponse.json(
      { data: { id: promptId, status: 'pending' } },
      { status: 201 }
    );

  } catch (error) {
    console.error('[API] prompts/capture: error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### File Locations

| Component | Path |
|-----------|------|
| Capture API Route | `app/api/prompts/capture/route.ts` |
| API Key Validation | `lib/api/validate-api-key.ts` |
| Request Schema | `lib/validations/capture.ts` |
| Supabase Admin Client | `lib/supabase/admin.ts` |

### Security Requirements

1. **Hash Comparison**: Use `timingSafeEqual` for constant-time hash comparison
2. **No Key Exposure**: Never log or return actual API keys
3. **Uniform Errors**: Same error response for missing, malformed, or invalid keys
4. **Admin Client**: Service role client server-side only
5. **Rate Limiting**: Handled by Story 4.2 (dependency)

### Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| API routes | kebab-case | `/api/prompts/capture` |
| TS variables | camelCase | `projectId`, `teamId` |
| Utility files | kebab-case | `validate-api-key.ts` |
| Error codes | SCREAMING_SNAKE | `INVALID_API_KEY` |

### Test Scenarios

| Scenario | Expected Response |
|----------|-------------------|
| Missing Authorization header | 401, `INVALID_API_KEY` |
| Authorization without Bearer | 401, `INVALID_API_KEY` |
| Invalid API key | 401, `INVALID_API_KEY` |
| Valid key, invalid JSON body | 400, `INVALID_JSON` |
| Valid key, missing prompt field | 400, `VALIDATION_ERROR` |
| Valid key, invalid timestamp format | 400, `VALIDATION_ERROR` |
| Valid request | 201, `{ data: { id, status: 'pending' } }` |

### Dependencies

- **Story 4.2 (Rate Limiting)**: Adds rate limit checks before processing
- **Story 4.3 (Input Validation)**: Adds prompt length validation
- **Story 4.5 (Prompt Storage)**: Receives validated data for storage

### Common Pitfalls

1. **DO NOT** use client Supabase for API key lookup - use admin/service role
2. **DO NOT** store API keys in plaintext - always hash with SHA-256
3. **DO NOT** reveal key validation details in error messages
4. **DO NOT** skip error logging with structured format
5. **DO NOT** expose internal errors to client responses
6. **DO NOT** use `any` type - use proper TypeScript interfaces

### Verification Checklist

- [ ] `POST /api/prompts/capture` endpoint responds
- [ ] Missing Authorization header returns 401
- [ ] Invalid API key returns 401 with correct error format
- [ ] Valid API key extracts project_id and team_id
- [ ] Invalid JSON body returns 400
- [ ] Invalid request body returns 400 with validation error
- [ ] Valid request returns 201 with id and status
- [ ] All errors logged with `[API] prompts/capture` prefix
- [ ] No API keys or sensitive data in logs

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
