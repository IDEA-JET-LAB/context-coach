# Story 4.3: Input Validation

Status: ✅ Done

## Story

**As a** system,
**I want** to validate prompt content before processing,
**So that** invalid or malicious input is rejected.

## Acceptance Criteria

1. **Given** a prompt shorter than 10 characters
   **When** it arrives at the capture endpoint
   **Then** HTTP 400 is returned with `{ error: { code: 'PROMPT_TOO_SHORT' } }`

2. **Given** a prompt longer than 100,000 characters
   **When** it arrives at the capture endpoint
   **Then** HTTP 400 is returned with `{ error: { code: 'PROMPT_TOO_LONG' } }`

3. **Given** a valid prompt length (10-100K chars)
   **When** validation passes
   **Then** processing continues

4. **Given** an invalid request body (non-JSON or malformed)
   **When** it arrives at the capture endpoint
   **Then** HTTP 400 is returned with `{ error: { code: 'INVALID_REQUEST' } }`

5. **Given** a prompt containing null bytes or control characters
   **When** it arrives at the capture endpoint
   **Then** HTTP 400 is returned with `{ error: { code: 'INVALID_PROMPT' } }`

## Tasks / Subtasks

- [x] **Task 1: Create validation constants** (AC: #1, #2, #3)
  - [x] Create `lib/capture/constants.ts` with validation limits
  - [x] Export `PROMPT_MIN_LENGTH = 10` and `PROMPT_MAX_LENGTH = 100_000`
  - [x] Add JSDoc comments explaining the limits

- [x] **Task 2: Create Zod validation schema** (AC: #1, #2, #3, #4, #5)
  - [x] Extend `lib/validations/capture.ts` with comprehensive schema
  - [x] Add `.min(10)` with custom error code `PROMPT_TOO_SHORT`
  - [x] Add `.max(100000)` with custom error code `PROMPT_TOO_LONG`
  - [x] Add `.refine()` for null byte detection with code `INVALID_PROMPT`
  - [x] Create `mapValidationError()` utility for error response formatting

- [x] **Task 3: Integrate validation into capture endpoint** (AC: #1, #2, #3, #4, #5)
  - [x] Parse JSON body with try/catch, return `INVALID_REQUEST` on failure
  - [x] Call Zod validation after rate limiting, before redaction
  - [x] Return HTTP 400 for validation failures with proper error codes
  - [x] Log validation failures: `[API] prompts/capture: validation failed - CODE, length: N`
  - [x] Continue processing for valid prompts

- [x] **Task 4: Validate supplementary fields** (AC: #4)
  - [x] Validate `user_id` is non-empty string
  - [x] Validate `timestamp` is valid ISO 8601 format
  - [x] Validate `metadata` is object if present

## Dev Notes

### Critical Architecture Constraints

**Validation Order in Capture Pipeline:**
```
Request → JSON Parse → Rate Limit → Input Validation → Redaction → Storage
```

**Validation Rules (DO NOT DEVIATE):**
- Minimum prompt length: 10 characters (inclusive)
- Maximum prompt length: 100,000 characters (inclusive)
- Whitespace-only prompts: Valid if 10+ chars after trim check is NOT applied (preserve whitespace)
- Null bytes: Reject with `INVALID_PROMPT`

**Location:** `lib/capture/` and `lib/validations/capture.ts`

### Validation Schema

```typescript
// lib/validations/capture.ts
import { z } from 'zod';

const PROMPT_MIN_LENGTH = 10;
const PROMPT_MAX_LENGTH = 100_000;

export const captureRequestSchema = z.object({
  prompt: z
    .string()
    .min(PROMPT_MIN_LENGTH, { message: 'PROMPT_TOO_SHORT' })
    .max(PROMPT_MAX_LENGTH, { message: 'PROMPT_TOO_LONG' })
    .refine((val) => !val.includes('\0'), { message: 'INVALID_PROMPT' }),
  user_id: z.string().min(1, { message: 'USER_ID_REQUIRED' }),
  timestamp: z.string().datetime({ message: 'INVALID_TIMESTAMP' }),
  metadata: z.record(z.unknown()).optional(),
});

export type CaptureRequest = z.infer<typeof captureRequestSchema>;

export function mapValidationError(zodError: z.ZodError): { code: string; message: string } {
  const issue = zodError.issues[0];
  const code = issue.message;
  const messages: Record<string, string> = {
    PROMPT_TOO_SHORT: `Prompt must be at least ${PROMPT_MIN_LENGTH} characters`,
    PROMPT_TOO_LONG: `Prompt exceeds maximum length of ${PROMPT_MAX_LENGTH.toLocaleString()} characters`,
    INVALID_PROMPT: 'Prompt contains invalid characters',
    USER_ID_REQUIRED: 'User ID is required',
    INVALID_TIMESTAMP: 'Invalid timestamp format',
  };
  return { code, message: messages[code] || issue.message };
}
```

### Integration Pattern

```typescript
// app/api/prompts/capture/route.ts
export async function POST(request: NextRequest) {
  // 1. Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  // 2. API key validation (Story 4.1)
  // 3. Rate limiting (Story 4.2)

  // 4. Input validation
  const result = captureRequestSchema.safeParse(body);
  if (!result.success) {
    const { code, message } = mapValidationError(result.error);
    const promptLength = typeof (body as any)?.prompt === 'string'
      ? (body as any).prompt.length
      : 0;
    console.log(`[API] prompts/capture: validation failed - ${code}, length: ${promptLength}`);
    return NextResponse.json({ error: { code, message } }, { status: 400 });
  }

  // 5. Continue to redaction (Story 4.4)
}
```

### File Locations

| Component | Path |
|-----------|------|
| Validation Schema | `lib/validations/capture.ts` |
| Capture API Route | `app/api/prompts/capture/route.ts` |

### Edge Cases

| Input | Expected Result |
|-------|-----------------|
| 9 characters | 400 `PROMPT_TOO_SHORT` |
| 10 characters | Valid |
| 100,000 characters | Valid |
| 100,001 characters | 400 `PROMPT_TOO_LONG` |
| Empty string | 400 `PROMPT_TOO_SHORT` |
| Contains `\0` | 400 `INVALID_PROMPT` |
| Only whitespace (10+ chars) | Valid |
| Non-string prompt | 400 (Zod type error) |
| Missing prompt field | 400 (Zod required error) |

### Security Notes

1. **Never log prompt content** - Only log the length on validation failure
2. **Null byte rejection** - Prevents potential injection attacks
3. **Request body size** - Handled by reverse proxy; application validates character count

### Error Response Format

All validation errors follow the standard API error format:

```json
{
  "error": {
    "code": "PROMPT_TOO_SHORT",
    "message": "Prompt must be at least 10 characters"
  }
}
```

### Verification Checklist

After implementation, verify:
- [x] 9-char prompt returns 400 with `PROMPT_TOO_SHORT`
- [x] 10-char prompt passes validation
- [x] 100,000-char prompt passes validation
- [x] 100,001-char prompt returns 400 with `PROMPT_TOO_LONG`
- [x] Empty string returns 400 with `PROMPT_TOO_SHORT`
- [x] Null byte in prompt returns 400 with `INVALID_PROMPT`
- [x] Invalid JSON returns 400 with `INVALID_REQUEST`
- [x] Validation errors logged without prompt content
- [x] Error responses use standard format

### References

- Epic 4: Prompt Capture Pipeline (FR72)
- Architecture: Input Validation section
- Project Context: Input Validation rules

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created validation constants in `lib/capture/constants.ts` with PROMPT_MIN_LENGTH (10) and PROMPT_MAX_LENGTH (100,000)
- Extended `lib/validations/capture.ts` with comprehensive Zod schema including length validation and null byte detection
- Added `mapValidationError()` utility to convert Zod errors to standardized API error codes
- Updated capture route to use the new validation with proper error codes and secure logging (length only, no content)
- Created comprehensive E2E tests covering all boundary cases and edge cases
- Updated existing capture-api.spec.ts tests to accommodate new validation rules
- All 23 tests passing (13 new input validation tests + 10 existing capture API tests)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-20 | Implemented Story 4.3: Input Validation | Claude Opus 4.5 |

### File List

**Created:**
- `app/lib/capture/constants.ts` - Validation constants (PROMPT_MIN_LENGTH, PROMPT_MAX_LENGTH, ValidationErrorCodes)
- `app/e2e/input-validation.spec.ts` - 13 E2E tests for input validation

**Modified:**
- `app/lib/validations/capture.ts` - Extended with length validation, null byte detection, and mapValidationError()
- `app/app/api/prompts/capture/route.ts` - Updated validation logic with proper error codes and logging
- `app/e2e/capture-api.spec.ts` - Updated tests to use prompts with minimum 10 characters
