# Story 5.5: Retry Logic and Error Handling

Status: ready-for-dev

## Story
**As a** system operator,
**I want** analysis to retry on failure,
**So that** transient errors don't cause missing analyses.

## Acceptance Criteria

1. **Given** an analysis attempt fails
   **When** the error is transient (API timeout, rate limit)
   **Then** `prompts.analysis_attempts` is incremented
   **And** retry is scheduled with delay: [1s, 5s, 15s]

2. **Given** analysis fails 3 times
   **When** max retries exceeded
   **Then** `prompts.analysis_status` is set to 'failed'
   **And** `prompts.last_analysis_error` stores the error message
   **And** the prompt appears in dead letter queue for review

3. **Given** analysis succeeds after retry
   **When** results are stored
   **Then** status is 'complete'
   **And** retry count is preserved for metrics

## Tasks / Subtasks

- [ ] **Task 1: Add retry columns to prompts table** (AC: #1, #2, #3)
  - [ ] Create migration to add `analysis_attempts` INTEGER DEFAULT 0
  - [ ] Add `last_analysis_error` TEXT column
  - [ ] Add `last_analysis_attempt_at` TIMESTAMPTZ column
  - [ ] Add partial index on `analysis_status` for querying failed/processing prompts
  - [ ] Add partial index on `analysis_attempts` for dead letter queue
  - [ ] RLS policies already exist on prompts table (team_id scoped)

- [ ] **Task 2: Create error classification module** (AC: #1)
  - [ ] Create `supabase/functions/analyze-prompt/lib/error-classifier.ts`
  - [ ] Define `TransientError` class for retryable errors
  - [ ] Define `PermanentError` class for non-retryable errors
  - [ ] Classify API timeout as transient
  - [ ] Classify rate limit (429) as transient
  - [ ] Classify invalid response/parse error as transient (AI might fix itself)
  - [ ] Classify auth errors (401/403) as permanent

- [ ] **Task 3: Implement retry delay calculation** (AC: #1)
  - [ ] Create `supabase/functions/analyze-prompt/lib/retry-scheduler.ts`
  - [ ] Define delay schedule: [1000, 5000, 15000] (ms)
  - [ ] Implement `getRetryDelay(attemptNumber)` function
  - [ ] Return null when max retries (3) exceeded
  - [ ] Add jitter (0-20%) to prevent thundering herd

- [ ] **Task 4: Implement retry scheduling mechanism** (AC: #1)
  - [ ] Use pg_net or re-invoke Edge Function with delay
  - [ ] Implement `scheduleRetry(promptId, delay)` function
  - [ ] Ensure retry doesn't block current function execution
  - [ ] Log retry scheduling: `[EDGE] retry-scheduler: scheduled retry`

- [ ] **Task 5: Update Edge Function with retry logic** (AC: #1, #2, #3)
  - [ ] Wrap analysis in try/catch with error classification
  - [ ] Increment `analysis_attempts` on each attempt
  - [ ] On transient error: schedule retry if attempts < 3
  - [ ] On max retries: set status to 'failed', store error message
  - [ ] On success after retry: preserve attempt count in result
  - [ ] Log all operations using `[EDGE] analyze-prompt: action` format

- [ ] **Task 6: Implement dead letter queue query** (AC: #2)
  - [ ] Create `lib/db/queries/dead-letter.ts` for admin dashboard
  - [ ] Implement `getFailedPrompts(limit)` query using admin client
  - [ ] Use `createClient()` from `lib/supabase/admin.ts` (service role, bypasses RLS)
  - [ ] Include `last_analysis_error` and `analysis_attempts` in results
  - [ ] Add ability to manually retry failed prompts

- [ ] **Task 7: Add manual retry API endpoint** (AC: #2)
  - [ ] Create `app/api/admin/prompts/retry/route.ts`
  - [ ] Check `is_super_admin` flag before allowing access
  - [ ] Reset `analysis_attempts` to 0 on manual retry
  - [ ] Reset `analysis_status` to 'pending'
  - [ ] Clear `last_analysis_error`
  - [ ] Return `{ data: { id, status: 'pending' } }` on success
  - [ ] Return `{ error: { code: 'FORBIDDEN', message } }` for non-admins
  - [ ] Return `{ error: { code: 'NOT_FOUND', message } }` for invalid prompt

## Dev Notes

### Retry Configuration

| Constant | Value | Purpose |
|----------|-------|---------|
| MAX_RETRIES | 3 | Maximum attempts before failing |
| RETRY_DELAYS | [1s, 5s, 15s] | Delay between attempts |
| REQUEST_TIMEOUT | 30s | AI API call timeout |

### Error Categories

| Category | Examples | Action |
|----------|----------|--------|
| Transient | Timeout, 429, 500-504, Parse Error | Retry with delay |
| Permanent | 401, 403, Invalid Config | Fail immediately |

### Migration

```sql
-- Migration: add_retry_columns_to_prompts.sql

ALTER TABLE prompts
ADD COLUMN analysis_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_analysis_error TEXT,
ADD COLUMN last_analysis_attempt_at TIMESTAMPTZ;

-- Partial index for dead letter queue queries
CREATE INDEX idx_prompts_analysis_status ON prompts(analysis_status)
WHERE analysis_status IN ('failed', 'processing');

CREATE INDEX idx_prompts_analysis_attempts ON prompts(analysis_attempts)
WHERE analysis_attempts > 0;

COMMENT ON COLUMN prompts.analysis_attempts IS 'Number of analysis attempts made';
COMMENT ON COLUMN prompts.last_analysis_error IS 'Error message from last failed attempt';
```

### Error Classification

```typescript
// supabase/functions/analyze-prompt/lib/error-classifier.ts

export class TransientError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'TransientError';
  }
}

export class PermanentError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'PermanentError';
  }
}

export function classifyError(error: unknown): TransientError | PermanentError {
  if (error instanceof TransientError || error instanceof PermanentError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Transient - worth retrying
  const transientPatterns = [
    'timeout', 'ETIMEDOUT', 'rate limit', '429',
    '500', '502', '503', '504', 'parse error', 'JSON'
  ];

  if (transientPatterns.some(p => message.includes(p))) {
    return new TransientError(message, error instanceof Error ? error : undefined);
  }

  // Permanent - don't retry
  const permanentPatterns = ['401', '403', 'invalid API key', 'no active config'];

  if (permanentPatterns.some(p => message.includes(p))) {
    return new PermanentError(message, error instanceof Error ? error : undefined);
  }

  // Default to transient
  return new TransientError(message, error instanceof Error ? error : undefined);
}
```

### Retry Scheduler

```typescript
// supabase/functions/analyze-prompt/lib/retry-scheduler.ts
import type { SupabaseClient } from '@supabase/supabase-js';

const RETRY_DELAYS_MS = [1000, 5000, 15000];
const MAX_RETRIES = 3;

export function getRetryDelay(attemptNumber: number): number | null {
  if (attemptNumber >= MAX_RETRIES) return null;

  const baseDelay = RETRY_DELAYS_MS[attemptNumber] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const jitter = Math.random() * 0.2 * baseDelay;

  return Math.floor(baseDelay + jitter);
}

export function shouldRetry(attemptNumber: number): boolean {
  return attemptNumber < MAX_RETRIES;
}

export async function scheduleRetry(
  supabase: SupabaseClient,
  promptId: string,
  delayMs: number
): Promise<void> {
  const { error } = await supabase.rpc('schedule_analysis_retry', {
    p_prompt_id: promptId,
    p_delay_ms: delayMs,
  });

  if (error) {
    console.error('[EDGE] retry-scheduler: failed to schedule', { promptId, error: error.message });
    throw error;
  }

  console.log('[EDGE] retry-scheduler: scheduled', { promptId, delayMs });
}
```

### Edge Function Retry Logic

```typescript
// Main retry wrapper in Edge Function
import { classifyError, TransientError, PermanentError } from './lib/error-classifier';
import { getRetryDelay, scheduleRetry } from './lib/retry-scheduler';

async function processWithRetry(
  supabase: SupabaseClient,
  promptId: string
): Promise<void> {
  const { data: prompt, error: fetchError } = await supabase
    .from('prompts')
    .select('analysis_attempts, prompt_text')
    .eq('id', promptId)
    .single();

  if (fetchError || !prompt) {
    console.error('[EDGE] analyze-prompt: prompt not found', { promptId });
    throw new PermanentError(`Prompt not found: ${promptId}`);
  }

  const attemptNumber = prompt.analysis_attempts;

  try {
    await supabase
      .from('prompts')
      .update({
        analysis_attempts: attemptNumber + 1,
        analysis_status: 'processing',
        last_analysis_attempt_at: new Date().toISOString(),
      })
      .eq('id', promptId);

    const result = await performAnalysis(prompt.prompt_text);
    await storeAnalysisResult(supabase, { promptId, ...result });

    console.log('[EDGE] analyze-prompt: success', { promptId, attempts: attemptNumber + 1 });
  } catch (error) {
    const classified = classifyError(error);
    console.error('[EDGE] analyze-prompt: error', {
      promptId,
      error: classified.message,
      attempt: attemptNumber + 1
    });

    if (classified instanceof TransientError) {
      const delay = getRetryDelay(attemptNumber);

      if (delay !== null) {
        await supabase
          .from('prompts')
          .update({ last_analysis_error: classified.message })
          .eq('id', promptId);

        await scheduleRetry(supabase, promptId, delay);
        return;
      }
    }

    // Max retries exceeded or permanent error
    await supabase
      .from('prompts')
      .update({
        analysis_status: 'failed',
        last_analysis_error: classified.message,
      })
      .eq('id', promptId);

    console.error('[EDGE] analyze-prompt: failed permanently', {
      promptId,
      attempts: attemptNumber + 1
    });
  }
}
```

### Dead Letter Queue (Admin)

```typescript
// lib/db/queries/dead-letter.ts
import { createClient } from '@/lib/supabase/admin';

export interface FailedPrompt {
  id: string;
  team_id: string;
  prompt_text: string;
  analysis_attempts: number;
  last_analysis_error: string | null;
  last_analysis_attempt_at: string | null;
  created_at: string;
}

export async function getFailedPrompts(limit = 50): Promise<FailedPrompt[]> {
  // Service role client bypasses RLS for cross-team admin access
  const supabase = createClient();

  const { data, error } = await supabase
    .from('prompts')
    .select('id, team_id, prompt_text, analysis_attempts, last_analysis_error, last_analysis_attempt_at, created_at')
    .eq('analysis_status', 'failed')
    .order('last_analysis_attempt_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[API] dead-letter: query failed', { error: error.message });
    throw error;
  }

  return data ?? [];
}

export async function retryFailedPrompt(promptId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('prompts')
    .update({
      analysis_status: 'pending',
      analysis_attempts: 0,
      last_analysis_error: null,
    })
    .eq('id', promptId);

  if (error) {
    console.error('[API] dead-letter: retry failed', { promptId, error: error.message });
    throw error;
  }

  console.log('[API] dead-letter: retry triggered', { promptId });
}
```

### Admin Retry API Endpoint

```typescript
// app/api/admin/prompts/retry/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check super admin status
    const { data: profile } = await supabase
      .from('users')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const { prompt_id } = await request.json();

    if (!prompt_id) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'prompt_id is required' } },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: prompt, error: fetchError } = await adminClient
      .from('prompts')
      .select('id')
      .eq('id', prompt_id)
      .single();

    if (fetchError || !prompt) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Prompt not found' } },
        { status: 404 }
      );
    }

    const { error: updateError } = await adminClient
      .from('prompts')
      .update({
        analysis_status: 'pending',
        analysis_attempts: 0,
        last_analysis_error: null,
      })
      .eq('id', prompt_id);

    if (updateError) {
      console.error('[API] admin/prompts/retry: update failed', { prompt_id, error: updateError.message });
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to reset prompt' } },
        { status: 500 }
      );
    }

    console.log('[API] admin/prompts/retry: success', { prompt_id, admin_id: user.id });

    return NextResponse.json(
      { data: { id: prompt_id, status: 'pending' } },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] admin/prompts/retry: unexpected error', { error });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### File Locations

| File | Path |
|------|------|
| Migration | `supabase/migrations/YYYYMMDDHHMMSS_add_retry_columns_to_prompts.sql` |
| Error Classifier | `supabase/functions/analyze-prompt/lib/error-classifier.ts` |
| Retry Scheduler | `supabase/functions/analyze-prompt/lib/retry-scheduler.ts` |
| Dead Letter Queries | `lib/db/queries/dead-letter.ts` |
| Admin Retry Endpoint | `app/api/admin/prompts/retry/route.ts` |

### Common Pitfalls

1. **DO NOT** retry permanent errors (auth failures, missing config)
2. **DO NOT** block Edge Function during retry delay - schedule async
3. **DO NOT** forget to increment attempt count before each attempt
4. **DO NOT** clear attempt count on success (preserve for metrics)
5. **DO NOT** expose detailed error messages to non-admin users
6. **DO NOT** allow retry endpoint without `is_super_admin` check
7. **DO NOT** use browser Supabase client for admin queries - use service role

### Verification Checklist

After completing this story, verify:
- [ ] `analysis_attempts` increments on each attempt
- [ ] Transient errors trigger retry with correct delay
- [ ] Max retries (3) results in 'failed' status
- [ ] `last_analysis_error` stores error message
- [ ] Dead letter queue shows failed prompts (admin only)
- [ ] Manual retry resets status to 'pending'
- [ ] Successful retry preserves attempt count
- [ ] Retry delays follow [1s, 5s, 15s] pattern with jitter
- [ ] Non-admins get 403 on retry endpoint
- [ ] Logs follow `[CONTEXT] action: details` format

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
