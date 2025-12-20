# Story 4.6: Capture Error Handling

Status: ready-for-dev

**Depends on:** Story 4.5 (Prompt Storage & Queue) - requires `storePrompt()` function

## Story

**As a** system,
**I want** to handle capture failures gracefully,
**So that** prompts aren't lost due to transient errors.

## Acceptance Criteria

1. **Given** a database write fails
   **When** the error is transient (connection, timeout)
   **Then** the request is retried up to 3 times with backoff
   **And** if all retries fail, HTTP 503 is returned

2. **Given** the CLI receives a 5xx error
   **When** the capture fails
   **Then** the CLI logs the error locally
   **And** a retry can be attempted later

3. **Given** the capture succeeds
   **When** HTTP 201 is returned
   **Then** the CLI silently continues (no user interruption)

## Tasks / Subtasks

- [ ] **Task 1: Create retry utility** (AC: #1)
  - [ ] Create `lib/capture/retry.ts` module
  - [ ] Implement `withRetry<T>()` generic wrapper function
  - [ ] Configure MAX_RETRIES = 3
  - [ ] Configure delays: [1000ms, 5000ms, 15000ms] (exponential backoff)
  - [ ] Add jitter (0-500ms) to prevent thundering herd
  - [ ] Return result on success, throw RetryError after all retries exhausted

- [ ] **Task 2: Define transient vs permanent errors** (AC: #1)
  - [ ] Create `lib/capture/errors.ts` with error classification
  - [ ] Define transient errors: ECONNRESET, ETIMEDOUT, ECONNREFUSED, EHOSTUNREACH, ENETUNREACH, 503, 504, 429
  - [ ] Define permanent errors: 400, 401, 404 (don't retry)
  - [ ] Create `isTransientError()` function
  - [ ] Create `classifyError()` for logging context

- [ ] **Task 3: Integrate retry logic in capture endpoint** (AC: #1)
  - [ ] Import `withRetry` and `isTransientError` in `app/api/prompts/capture/route.ts`
  - [ ] Wrap `storePrompt()` call with `withRetry()`
  - [ ] Only retry on transient errors (abort immediately on permanent)
  - [ ] Log each retry attempt: `[API] prompts/capture: retry attempt N/3`
  - [ ] Track total retry duration for metrics

- [ ] **Task 4: Implement 503 response handling** (AC: #1)
  - [ ] Return HTTP 503 when all retries exhausted
  - [ ] Response body: `{ error: { code: 'SERVICE_UNAVAILABLE', message: 'Please retry later' } }`
  - [ ] Include `Retry-After: 60` header
  - [ ] Log final failure with attempt count and duration (no PII)

- [ ] **Task 5: Create error logging structure** (AC: #1, #2)
  - [ ] Use consistent log format: `[API] prompts/capture: <action>`
  - [ ] Log includes: timestamp, error code, attempt count, total duration
  - [ ] Exclude from logs: prompt content, API keys, user PII
  - [ ] Log stack traces only when `NODE_ENV === 'development'`

- [ ] **Task 6: Implement CLI error handling** (AC: #2, #3)
  - [ ] Handle 5xx errors in capture script (`.claude/hooks/contextor-capture.sh`)
  - [ ] Log failed captures to `.contextor/.failed-captures.jsonl`
  - [ ] Failed capture log format: `{ timestamp, error_code, prompt_hash, retryable }`
  - [ ] On HTTP 201: exit silently (code 0, no output)
  - [ ] On HTTP 503: log locally, exit code 0 (non-blocking)

- [ ] **Task 7: Add error metrics** (AC: #1)
  - [ ] Track error counts by type (transient vs permanent)
  - [ ] Track retry success rate (succeeded after N retries)
  - [ ] Track average retry count before success
  - [ ] Log metrics: `[METRICS] capture: { errors_transient: N, errors_permanent: N, retries_succeeded: N }`

- [ ] **Task 8: Handle edge cases** (AC: #1, #2, #3)
  - [ ] Handle partial failures (insert succeeded but trigger failed) - return 201
  - [ ] Handle request timeout during retry - count as failed attempt
  - [ ] Total timeout cap: 25 seconds (3 retries + jitter buffer)
  - [ ] On graceful shutdown: complete current retry, don't start new ones

## Dev Notes

### Architecture Constraints (DO NOT DEVIATE)

**Retry Configuration:**
- MAX_RETRIES: 3
- Backoff delays: [1s, 5s, 15s]
- Jitter: 0-500ms random
- Total max wait: ~21-22 seconds before final failure
- Only retry transient errors, never permanent

**Error Classification:**
| Error Type | Examples | Action |
|------------|----------|--------|
| Transient | ECONNRESET, ETIMEDOUT, 503, 504, 429 | Retry with backoff |
| Permanent | 400, 401, 404 | Fail immediately |

### File Locations

| Component | Path |
|-----------|------|
| Retry Utility | `lib/capture/retry.ts` |
| Error Classification | `lib/capture/errors.ts` |
| Store Prompt (from 4.5) | `lib/capture/store-prompt.ts` |
| Capture API Route | `app/api/prompts/capture/route.ts` |
| CLI Capture Script | `.claude/hooks/contextor-capture.sh` |
| Failed Captures Log | `.contextor/.failed-captures.jsonl` |

### Implementation Reference

**Retry Utility (`lib/capture/retry.ts`):**

```typescript
export interface RetryConfig {
  maxRetries: number;
  delays: number[];
  jitterMs?: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  delays: [1000, 5000, 15000],
  jitterMs: 500,
};

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  config: RetryConfig = DEFAULT_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryable(error)) throw error;
      if (attempt === config.maxRetries) break;

      const baseDelay = config.delays[attempt - 1] ?? config.delays[config.delays.length - 1];
      const jitter = config.jitterMs ? Math.random() * config.jitterMs : 0;
      console.log(`[API] prompts/capture: retry attempt ${attempt}/${config.maxRetries} after ${baseDelay + jitter}ms`);
      await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
    }
  }

  throw new RetryError(`All ${config.maxRetries} retry attempts failed`, config.maxRetries, lastError!);
}
```

**Error Classification (`lib/capture/errors.ts`):**

```typescript
const TRANSIENT_ERROR_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', '503', '504', '429'] as const;

export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = (error as NodeJS.ErrnoException).code;
  if (code && TRANSIENT_ERROR_CODES.includes(code as any)) return true;

  return TRANSIENT_ERROR_CODES.some(c => error.message.includes(c));
}
```

**Capture Endpoint Integration:**

```typescript
// app/api/prompts/capture/route.ts
import { withRetry, RetryError } from '@/lib/capture/retry';
import { isTransientError } from '@/lib/capture/errors';

// Inside POST handler, after validation and redaction:
try {
  const result = await withRetry(
    () => storePrompt({ team_id, project_id, user_id, text, metadata }),
    isTransientError
  );
  console.log(`[API] prompts/capture: stored prompt ${result.id}`);
  return NextResponse.json({ data: { id: result.id, status: result.analysis_status } }, { status: 201 });
} catch (error) {
  if (error instanceof RetryError) {
    console.error(`[API] prompts/capture: all retries failed after ${error.attempts} attempts`);
    return NextResponse.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Please retry later' } },
      { status: 503, headers: { 'Retry-After': '60' } }
    );
  }
  console.error('[API] prompts/capture: permanent error', error);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, { status: 500 });
}
```

### HTTP Response Codes

| Status | Code | Retryable | When |
|--------|------|-----------|------|
| 201 | - | No (success) | Prompt stored successfully |
| 400 | PROMPT_TOO_SHORT/LONG | No | Validation failed |
| 401 | INVALID_API_KEY | No | Auth failed |
| 429 | RATE_LIMITED | Yes (after delay) | Too many requests |
| 500 | INTERNAL_ERROR | Maybe | Unexpected permanent error |
| 503 | SERVICE_UNAVAILABLE | Yes | All retries exhausted |

### Security Considerations

1. **Never log sensitive data**: No prompt content, API keys, or user PII in logs
2. **Error obfuscation**: Don't expose internal error details in client responses
3. **Rate limit after retries**: Count retry attempts toward rate limit
4. **Jitter prevents thundering herd**: Random delay prevents synchronized retries

### Test Scenarios

After implementation, verify with these scenarios:

```bash
# 1. Transient error triggers retry
# Simulate: Mock storePrompt to throw ECONNRESET, verify 3 retry attempts logged

# 2. Backoff timing is correct
# Verify logs show: attempt 1 after 1s, attempt 2 after 5s, attempt 3 after 15s (+jitter)

# 3. Permanent error fails immediately
# Mock: 400 response, verify NO retry attempts, immediate failure

# 4. All retries exhausted returns 503
# Mock: All 3 attempts fail, verify 503 response with Retry-After header

# 5. Success returns 201 with no retry
# Normal operation, verify single attempt, 201 response

# 6. CLI handles 5xx gracefully
# Send 503 from API, verify CLI logs locally, exits 0, no user output

# 7. Error logs exclude PII
# Trigger error, verify logs contain attempt count but no prompt text
```

### Common Pitfalls to Avoid

1. **DO NOT** retry on permanent errors (400, 401, 404)
2. **DO NOT** log prompt content in error messages
3. **DO NOT** forget jitter - prevents thundering herd
4. **DO NOT** make retry delays too short - allow recovery time
5. **DO NOT** forget Retry-After header on 503 response
6. **DO NOT** block request indefinitely - cap at 25 seconds total

### References

- Architecture: `_bmad-output/architecture.md` (Analysis Engine retry logic, Rate Limiting)
- Project Context: `_bmad-output/project-context.md` (Error Handling patterns)
- Epic 4 Story 4.5: Prompt Storage & Queue (storePrompt function)

## Verification Checklist

- [ ] Transient error triggers retry (up to 3 times)
- [ ] Backoff delays are 1s, 5s, 15s with jitter
- [ ] Permanent error (400, 401) doesn't retry
- [ ] All retries failed returns 503 with Retry-After header
- [ ] Error logs include attempt count and duration
- [ ] Error logs exclude prompt content and PII
- [ ] Success returns 201 (no retry needed)
- [ ] CLI handles 5xx gracefully (logs locally, exits 0)
- [ ] Success case is silent (no CLI output)

## Dev Agent Record

### Agent Model Used

*(To be filled by dev agent)*

### Completion Notes List

*(To be filled by dev agent after implementation)*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*(To be filled by dev agent - list all files created/modified)*
