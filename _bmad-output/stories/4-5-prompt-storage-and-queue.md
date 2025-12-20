# Story 4.5: Prompt Storage & Queue

Status: ready-for-dev

## Story

**As a** system,
**I want** to store prompts and queue them for analysis,
**So that** they can be processed asynchronously.

## Dependencies

This story requires completion of:
- Story 4.1: Capture API Endpoint (provides `project_id`, `team_id` from API key validation)
- Story 4.2: Rate Limiting (rate limit headers)
- Story 4.3: Input Validation (validated prompt text)
- Story 4.4: Secret Redaction (redacted text for storage)

## Acceptance Criteria

**AC 1: Prompt Storage with RLS**
- **Given** a validated, redacted prompt
- **When** it is stored
- **Then** a new `prompts` row is created with: id, team_id, project_id, user_id, text, char_count, word_count, created_at, analysis_status='pending'
- **And** RLS policies enforce team-scoped access

**AC 2: Database Schema & Indexes**
- **Given** the database schema
- **When** this story is complete
- **Then** the `prompts` table exists with all required columns and constraints
- **And** indexes exist on: team_id, user_id, created_at, analysis_status
- **And** composite indexes exist for dashboard and queue queries

**AC 3: Async Queue Trigger**
- **Given** a prompt is inserted
- **When** the insert succeeds
- **Then** a database trigger notifies the analysis Edge Function via `pg_net`
- **And** HTTP 201 is returned to the CLI with `{ data: { id, status: 'pending' } }`
- **And** trigger failures are logged but do not block the insert

## Tasks / Subtasks

- [ ] **Task 1: Create prompts table migration** (AC: #2)
  - [ ] Enable `pg_net` extension for async HTTP calls
  - [ ] Create Supabase migration for `prompts` table with all columns
  - [ ] Add columns: `id` (uuid PK), `team_id` (uuid FK), `project_id` (uuid FK), `user_id` (text)
  - [ ] Add columns: `text` (text), `char_count` (integer), `word_count` (integer)
  - [ ] Add columns: `created_at` (timestamptz), `analysis_status` (text default 'pending')
  - [ ] Add column: `metadata` (jsonb nullable) for optional context
  - [ ] Add CHECK constraint for valid `analysis_status` values

- [ ] **Task 2: Create indexes for performance** (AC: #2)
  - [ ] Add index `idx_prompts_team_id` for RLS filtering
  - [ ] Add index `idx_prompts_user_id` for user queries
  - [ ] Add index `idx_prompts_created_at` for time-based queries
  - [ ] Add index `idx_prompts_analysis_status` for queue processing
  - [ ] Add composite index `idx_prompts_team_created` on `(team_id, created_at DESC)` for dashboard
  - [ ] Add partial composite index `idx_prompts_queue` on `(analysis_status, created_at)` WHERE status='pending'

- [ ] **Task 3: Create RLS policies** (AC: #1)
  - [ ] Enable RLS on `prompts` table
  - [ ] Create SELECT policy: team members can read their team's prompts using `auth.jwt() ->> 'team_id'`
  - [ ] Create INSERT policy: service role can insert with valid project/team context
  - [ ] Verify service role bypasses RLS for API capture endpoint

- [ ] **Task 4: Create prompt storage utility** (AC: #1)
  - [ ] Create `lib/capture/store-prompt.ts` module
  - [ ] Create `lib/capture/word-count.ts` utility
  - [ ] Create `storePrompt()` function accepting validated, redacted data
  - [ ] Use Supabase admin client (service role) for insert
  - [ ] Calculate `char_count` and `word_count` before insert
  - [ ] Return `{ id, analysis_status }` on success
  - [ ] Throw typed error with code `STORAGE_FAILED` on failure

- [ ] **Task 5: Integrate storage into capture endpoint** (AC: #1, #3)
  - [ ] Import `storePrompt` into `app/api/prompts/capture/route.ts`
  - [ ] Call storage after redaction completes
  - [ ] Pass `project_id`, `team_id` from API key validation (Story 4.1)
  - [ ] Pass `user_id`, `metadata` from request body
  - [ ] Return HTTP 201 with `{ data: { id, status } }` on success
  - [ ] Return HTTP 503 with `{ error: { code: 'STORAGE_FAILED' } }` on failure

- [ ] **Task 6: Create analysis queue trigger** (AC: #3)
  - [ ] Create `notify_analysis()` trigger function using `pg_net`
  - [ ] Configure trigger to fire AFTER INSERT on prompts
  - [ ] Pass `prompt_id` in POST body to analysis Edge Function URL
  - [ ] Use EXCEPTION handler to log failures without blocking insert
  - [ ] Set analysis function URL via `app.settings.analysis_function_url`

## Dev Notes

### Critical Architecture Constraints

**Database Schema (DO NOT DEVIATE):**
- Table name: `prompts` (plural, snake_case per architecture)
- All rows MUST have `team_id` for RLS tenant isolation
- `analysis_status` values: `pending`, `processing`, `complete`, `failed`
- Use UUID for `id`, `team_id`, `project_id`
- Foreign keys reference `teams(id)` and `projects(id)` with ON DELETE CASCADE

**Multi-Tenancy:**
- RLS is mandatory on `prompts` table
- Use `auth.jwt() ->> 'team_id'` in SELECT policies
- API capture uses service role client (bypasses RLS for insert)
- Service role client is server-only, never expose to client

### Database Migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_prompts_table.sql

-- Enable pg_net for async HTTP (required for trigger)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create prompts table
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  metadata JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_analysis_status CHECK (
    analysis_status IN ('pending', 'processing', 'complete', 'failed')
  )
);

-- Performance indexes
CREATE INDEX idx_prompts_team_id ON prompts(team_id);
CREATE INDEX idx_prompts_user_id ON prompts(user_id);
CREATE INDEX idx_prompts_created_at ON prompts(created_at);
CREATE INDEX idx_prompts_analysis_status ON prompts(analysis_status);
CREATE INDEX idx_prompts_team_created ON prompts(team_id, created_at DESC);
CREATE INDEX idx_prompts_queue ON prompts(analysis_status, created_at)
  WHERE analysis_status = 'pending';

-- Enable Row Level Security
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Team members can view their prompts"
  ON prompts FOR SELECT
  TO authenticated
  USING (team_id::text = auth.jwt() ->> 'team_id');

CREATE POLICY "Service role can insert prompts"
  ON prompts FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Analysis trigger function (async HTTP via pg_net)
CREATE OR REPLACE FUNCTION notify_analysis()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.analysis_function_url'),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object('prompt_id', NEW.id)::text
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Analysis notification failed for prompt %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to prompts table
CREATE TRIGGER on_prompt_insert
  AFTER INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION notify_analysis();
```

### Supabase Admin Client

```typescript
// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';

// Service role client - SERVER ONLY, bypasses RLS
// NEVER import this in client components
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

### Prompt Storage Utility

```typescript
// lib/capture/store-prompt.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateWordCount } from './word-count';

export interface StorePromptInput {
  team_id: string;
  project_id: string;
  user_id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface StorePromptResult {
  id: string;
  analysis_status: string;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'STORAGE_FAILED'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export async function storePrompt(
  input: StorePromptInput
): Promise<StorePromptResult> {
  const supabase = createAdminClient();

  const charCount = input.text.length;
  const wordCount = calculateWordCount(input.text);

  const { data, error } = await supabase
    .from('prompts')
    .insert({
      team_id: input.team_id,
      project_id: input.project_id,
      user_id: input.user_id,
      text: input.text,
      char_count: charCount,
      word_count: wordCount,
      metadata: input.metadata ?? null,
      analysis_status: 'pending',
    })
    .select('id, analysis_status')
    .single();

  if (error) {
    throw new StorageError(`Failed to store prompt: ${error.message}`);
  }

  return {
    id: data.id,
    analysis_status: data.analysis_status,
  };
}
```

### Word Count Utility

```typescript
// lib/capture/word-count.ts

/**
 * Calculate word count for a prompt text.
 * Words are sequences of non-whitespace characters.
 */
export function calculateWordCount(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  // Split on whitespace (spaces, tabs, newlines) and filter empty
  return trimmed.split(/\s+/).filter(Boolean).length;
}
```

### Integration in Capture Endpoint

```typescript
// app/api/prompts/capture/route.ts (storage integration)
import { NextRequest, NextResponse } from 'next/server';
import { storePrompt, StorageError } from '@/lib/capture/store-prompt';

export async function POST(request: NextRequest) {
  // ... API key validation (Story 4.1) - extracts project_id, team_id
  // ... Rate limiting (Story 4.2) - returns rateLimit.remaining
  // ... Input validation (Story 4.3) - validates prompt length
  // ... Secret redaction (Story 4.4) - returns redactedText

  try {
    const result = await storePrompt({
      team_id: keyResult.team_id,
      project_id: keyResult.project_id,
      user_id: body.user_id,
      text: redactedText,
      metadata: body.metadata,
    });

    console.log(`[API] prompts/capture: stored prompt ${result.id}`);

    return NextResponse.json(
      { data: { id: result.id, status: result.analysis_status } },
      {
        status: 201,
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    if (error instanceof StorageError) {
      console.error(`[API] prompts/capture: ${error.code} - ${error.message}`);
      return NextResponse.json(
        { error: { code: error.code, message: 'Failed to store prompt' } },
        { status: 503 }
      );
    }
    throw error;
  }
}
```

### TypeScript Types

```typescript
// types/database.ts (add to existing types)
export interface PromptsRow {
  id: string;
  team_id: string;
  project_id: string;
  user_id: string;
  text: string;
  char_count: number;
  word_count: number;
  metadata: Record<string, unknown> | null;
  analysis_status: 'pending' | 'processing' | 'complete' | 'failed';
  created_at: string;
}
```

### Metadata Schema (Optional Context)

The `metadata` JSONB column stores optional context from the CLI hook:

```typescript
interface PromptMetadata {
  source?: 'claude-code-hook' | 'bmad-agent' | 'api';
  agent_id?: string;
  agent_name?: string;
  file_context?: string[];
  session_id?: string;
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Prompts Migration | `supabase/migrations/YYYYMMDDHHMMSS_create_prompts_table.sql` |
| Supabase Admin Client | `lib/supabase/admin.ts` |
| Store Prompt | `lib/capture/store-prompt.ts` |
| Word Count | `lib/capture/word-count.ts` |
| Capture API Route | `app/api/prompts/capture/route.ts` |
| Database Types | `types/database.ts` |

### Analysis Status State Machine

```
pending -> processing -> complete
                     \-> failed
```

| Status | Meaning | Next States |
|--------|---------|-------------|
| `pending` | Awaiting analysis (queue) | `processing` |
| `processing` | Analysis in progress | `complete`, `failed` |
| `complete` | Analysis finished successfully | (terminal) |
| `failed` | Analysis failed after retries | (terminal) |

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `STORAGE_FAILED` | 503 | Database write failed |
| `SERVICE_UNAVAILABLE` | 503 | Supabase connection issue |

### Security Considerations

1. **RLS Required**: All SELECT queries filter by `team_id` from JWT claims
2. **Service Role for Insert**: API uses admin client, not user session
3. **Trigger Safety**: EXCEPTION handler prevents trigger failures from blocking inserts
4. **No PII in Logs**: Log prompt ID only, never content
5. **Service Key Protection**: `SUPABASE_SERVICE_ROLE_KEY` is server-only, never exposed

### Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # Server-only, never NEXT_PUBLIC_
```

### Testing Guidance

**Word Count Unit Tests:**
```typescript
// lib/capture/__tests__/word-count.test.ts
describe('calculateWordCount', () => {
  it('counts words separated by spaces', () => {
    expect(calculateWordCount('hello world')).toBe(2);
  });
  it('handles multiple spaces', () => {
    expect(calculateWordCount('hello   world')).toBe(2);
  });
  it('handles newlines and tabs', () => {
    expect(calculateWordCount('hello\nworld\tthere')).toBe(3);
  });
  it('returns 0 for empty string', () => {
    expect(calculateWordCount('')).toBe(0);
  });
  it('returns 0 for whitespace only', () => {
    expect(calculateWordCount('   \n\t  ')).toBe(0);
  });
});
```

**Storage Integration Test:**
- Insert prompt via `storePrompt()` with test data
- Verify row exists with correct `char_count`, `word_count`, `analysis_status`
- Verify trigger executed (check for pending analysis or mock Edge Function)

### Common Pitfalls to Avoid

1. **DO NOT** skip RLS policies - mandatory for multi-tenancy
2. **DO NOT** use user session for API insert - use service role
3. **DO NOT** let trigger failures block the insert - use EXCEPTION handler
4. **DO NOT** forget to enable `pg_net` extension before creating trigger
5. **DO NOT** calculate word count in database - do it in app code
6. **DO NOT** return HTTP 200 - use 201 Created for successful insert
7. **DO NOT** import admin client in client components - server-only

### Verification Checklist

After completing this story, verify:
- [ ] `prompts` table exists with all columns and constraints
- [ ] `pg_net` extension is enabled
- [ ] All 6 indexes are created
- [ ] RLS is enabled with SELECT and INSERT policies
- [ ] Team members can only query their team's prompts
- [ ] API can insert prompts with service role client
- [ ] `char_count` and `word_count` are calculated correctly
- [ ] `analysis_status` defaults to 'pending'
- [ ] Database trigger fires on insert (check logs)
- [ ] Trigger failure doesn't block insert
- [ ] HTTP 201 returned with `{ data: { id, status } }`

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
