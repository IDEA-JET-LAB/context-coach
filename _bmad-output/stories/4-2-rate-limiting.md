# Story 4.2: Rate Limiting

Status: ✅ Done

## Story

**As a** platform operator,
**I want** to rate limit the capture endpoint,
**So that** the system is protected from excessive requests and abuse.

## Acceptance Criteria

1. **Given** the rate limiting configuration
   **When** requests arrive at `/api/prompts/capture`
   **Then** Upstash Redis tracks request counts per identifier
   **And** limits are enforced: 100/min per project, 20/min per user, 10/min per IP (unauthenticated)

2. **Given** a request exceeds any rate limit
   **When** the limit is hit
   **Then** HTTP 429 is returned with `{ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }`
   **And** `Retry-After` header indicates seconds until next window

3. **Given** rate limit state
   **When** the sliding window expires
   **Then** the counter resets and requests succeed again

4. **Given** rate limiting is active
   **When** errors occur
   **Then** rate limit events are logged with format `[API] prompts/capture: rate limit exceeded for {identifier}`

## Technical Requirements

### Package & Dependencies

- **Package:** `@upstash/ratelimit` with `@upstash/redis`
- **Location:** `lib/rate-limit/index.ts`

### Environment Variables

```
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx
```

### Rate Limit Configuration

| Scope | Limit | Window | Identifier |
|-------|-------|--------|------------|
| Per Project | 100 requests | 1 minute | `project_id` from validated API key |
| Per User | 20 requests | 1 minute | `user_id` from request body |
| Per IP | 10 requests | 1 minute | Client IP (fallback for unauthenticated) |

### Implementation Pattern

```typescript
// lib/rate-limit/index.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export const projectRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'ratelimit:project',
});

export const userRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'ratelimit:user',
});

export const ipRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'ratelimit:ip',
});
```

### API Route Integration

```typescript
// In /api/prompts/capture/route.ts
import { projectRateLimit, userRateLimit } from '@/lib/rate-limit';

// Check limits sequentially (most specific first)
const { success: projectOk, reset: projectReset } = await projectRateLimit.limit(projectId);
if (!projectOk) {
  console.error(`[API] prompts/capture: rate limit exceeded for project ${projectId}`);
  return Response.json(
    { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    { status: 429, headers: { 'Retry-After': String(Math.ceil((projectReset - Date.now()) / 1000)) } }
  );
}

const { success: userOk, reset: userReset } = await userRateLimit.limit(userId);
if (!userOk) {
  console.error(`[API] prompts/capture: rate limit exceeded for user ${userId}`);
  return Response.json(
    { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    { status: 429, headers: { 'Retry-After': String(Math.ceil((userReset - Date.now()) / 1000)) } }
  );
}
```

## Tasks

- [x] **Task 1: Install and configure Upstash Redis client** (AC: #1)
  - Install `@upstash/ratelimit` and `@upstash/redis` packages
  - Add `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` to `.env.example`
  - Create `lib/rate-limit/index.ts` with rate limit instances

- [x] **Task 2: Implement project-level rate limiting** (AC: #1, #4)
  - Create `projectRateLimit` with 100 requests/minute sliding window
  - Use `project_id` (from API key validation in Story 4.1) as identifier
  - Log rate limit events: `[API] prompts/capture: rate limit exceeded for project {id}`

- [x] **Task 3: Implement user-level rate limiting** (AC: #1, #4)
  - Create `userRateLimit` with 20 requests/minute sliding window
  - Use `user_id` from request body as identifier
  - Log rate limit events: `[API] prompts/capture: rate limit exceeded for user {id}`

- [x] **Task 4: Implement IP-level rate limiting** (AC: #1, #4)
  - Create `ipRateLimit` with 10 requests/minute sliding window (fallback)
  - Extract client IP from request headers (`x-forwarded-for` or `x-real-ip`)
  - Apply when project/user identifiers are missing or invalid

- [x] **Task 5: Return HTTP 429 responses with Retry-After header** (AC: #2)
  - Return status code 429 when any limit is exceeded
  - Include error body: `{ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }`
  - Calculate `Retry-After` header from rate limiter `reset` timestamp

- [x] **Task 6: Integrate rate limiting into capture endpoint** (AC: #1, #2, #3)
  - Add rate limit checks at start of `/api/prompts/capture` handler
  - Check project limit first, then user limit (fail fast)
  - Ensure rate limiting runs BEFORE input validation and processing

- [x] **Task 7: Write unit and integration tests** (AC: #1, #2, #3)
  - Test project-level limit (100 requests then 429)
  - Test user-level limit (20 requests then 429)
  - Test IP-level limit (10 requests then 429)
  - Test counter reset after window expiration
  - Verify 429 response format and `Retry-After` header
  - Test concurrent requests near the limit boundary

## Dev Notes

### Dependencies

- **Requires Story 4.1** completed (Capture API Endpoint provides `project_id` from API key validation)
- Upstash account required for Redis instance

### Architecture References

- Rate limiting specification: `_bmad-output/architecture.md` (Rate Limiting section)
- API response format: `{ error: { code: string, message: string } }` per project conventions
- Logging format: `[API] route-name: message` per logging standards

### Anti-Patterns to Avoid

- Do not use in-memory rate limiting (won't work across Cloud Run instances)
- Do not skip rate limiting for any requests to `/api/prompts/capture`
- Do not expose internal rate limit state in error responses (security)

### Testing Considerations

- Use Upstash test instance or mock Redis for unit tests
- Consider testing with multiple concurrent requests to verify atomicity
- Verify sliding window behavior (not fixed window)
