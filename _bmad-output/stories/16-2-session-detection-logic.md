# Story 16.2: Session Detection Logic

Status: ✅ COMPLETED (2025-12-23)

## Story

**As a** system,
**I want** to automatically detect new sessions from Claude Code transcripts,
**So that** prompts are correctly grouped into conversations without manual intervention.

## PRD Alignment Note

**PRD 16.2 specifies "Hook Updates for Session Tracking" (SessionStart/SessionEnd hooks), while this story describes transcript-based detection.**

This design decision is intentional:

1. **Transcript-based detection is the PRIMARY implementation strategy** - Claude Code transcripts contain rich session context (sessionId, timestamps, environment metadata) that can be extracted during import or real-time capture.

2. **Hook updates (SessionStart/SessionEnd) are a future ENHANCEMENT** - These hooks would provide real-time session boundary events, but Claude Code's hook system currently focuses on prompt submission. Session lifecycle hooks may be added in future Claude Code versions.

3. **Transcript parsing provides richer context than hooks alone** - Transcripts contain historical session data, allowing us to:
   - Reconstruct sessions from past conversations
   - Capture metadata that may not be available at session start
   - Support batch import of historical data (Epic 17)

4. **The approaches are complementary, not mutually exclusive** - When/if SessionStart/SessionEnd hooks become available, they can trigger the same `findOrCreateSession` service, enhancing real-time detection while transcript parsing handles historical data.

## Dependencies

This story requires:
- Story 16-1: Sessions Database Schema (sessions table and prompts columns)
- Story 15-2: JSONL Parser Implementation (provides parsed transcript data)

## Privacy Integration Note

Session detection must integrate with Epic 14.5 privacy controls:

- **Pause/Resume Capture:** If user has paused capture (via privacy preferences), session detection should still track session boundaries but NOT store prompt content. This allows session continuity metrics without violating user privacy preferences.
- **Project Exclusions:** If user has excluded specific projects from capture, session detection should skip those projects entirely.
- **Data Minimization:** Session metadata should respect the same redaction rules applied to prompts (e.g., if PII redaction is enabled, session CWD paths should also be sanitized).

Implementation should check `user_privacy_preferences` table before creating/linking sessions.

## Acceptance Criteria

**AC 1: Session ID Extraction**
- **Given** a parsed transcript message
- **When** the message contains a `sessionId` field
- **Then** the session ID is extracted and normalized
- **And** empty or null session IDs are handled gracefully

**AC 2: New Session Detection**
- **Given** a prompt with a session ID
- **When** the session ID does not exist in the database
- **Then** a new session record is created with `started_at` set to the prompt's timestamp
- **And** the session is linked to the correct user, team, and project

**AC 3: Existing Session Matching**
- **Given** a prompt with a session ID
- **When** the session ID already exists in the database
- **Then** the existing session is returned without creating a duplicate
- **And** the prompt is linked to the existing session

**AC 4: Session Creation Service**
- **Given** a session detection request
- **When** processed by the service
- **Then** the operation is idempotent (same result if called multiple times)
- **And** concurrent requests for the same session_id don't create duplicates

**AC 5: Session Context Association**
- **Given** a new session is created
- **When** additional context is available (project_id from API key)
- **Then** the session is associated with the correct project
- **And** team_id is derived from the project or user context

## Tasks / Subtasks

- [ ] **Task 1: Create session detection service** (AC: #1, #2, #3)
  - [ ] Create `lib/sessions/session-detection.ts`
  - [ ] Implement `extractSessionId(transcript: TranscriptMessage): string | null`
  - [ ] Implement `findOrCreateSession(sessionId: string, context: SessionContext): Promise<Session>`
  - [ ] Handle null/empty session IDs gracefully

- [ ] **Task 2: Implement idempotent session creation** (AC: #4)
  - [ ] Use upsert pattern with `session_id` as conflict key
  - [ ] Ensure `started_at` is only set on initial creation
  - [ ] Handle concurrent requests with database-level locking
  - [ ] Return existing session if found

- [ ] **Task 3: Create session context resolver** (AC: #5)
  - [ ] Create `lib/sessions/session-context.ts`
  - [ ] Implement `resolveSessionContext(projectId: string, userId: string): Promise<SessionContext>`
  - [ ] Lookup team_id from project or user's default team
  - [ ] Validate user belongs to team

- [ ] **Task 4: Integrate with prompt capture** (AC: #2, #3)
  - [ ] Modify capture flow to extract session_id from metadata
  - [ ] Call session detection service before storing prompt
  - [ ] Link prompt to session via `session_uuid`
  - [ ] Increment session's `total_prompts` counter

- [ ] **Task 5: Add session detection unit tests** (AC: #1-5)
  - [ ] Test extractSessionId with various formats
  - [ ] Test findOrCreateSession idempotency
  - [ ] Test concurrent session creation
  - [ ] Test team/project resolution

- [ ] **Task 6: Add E2E tests** (AC: #2, #3, #4)
  - [ ] Test new session creation flow
  - [ ] Test existing session matching
  - [ ] Test session-prompt linking

## Dev Notes

### Session ID Format from Claude Code

Claude Code transcripts include session information in the JSONL structure:

```json
{
  "type": "user",
  "sessionId": "session_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": { ... }
}
```

The `sessionId` follows the format `session_<uuid>`.

### Session Detection Service

```typescript
// lib/sessions/session-detection.ts

import { createAdminClient } from '@/lib/supabase/admin';

export interface SessionContext {
  user_id: string;
  team_id: string;
  project_id?: string;
  git_branch?: string;
  cwd?: string;
  claude_code_version?: string;
}

export interface TranscriptMessage {
  type: string;
  sessionId?: string;
  timestamp?: string;
  message?: unknown;
}

/**
 * Extract session ID from a transcript message.
 * Returns null if no valid session ID is present.
 */
export function extractSessionId(
  transcript: TranscriptMessage | null | undefined
): string | null {
  if (!transcript?.sessionId) {
    return null;
  }

  const sessionId = transcript.sessionId.trim();

  // Validate format: session_<uuid>
  if (!sessionId.startsWith('session_') || sessionId.length < 20) {
    console.warn(`[SessionDetection] Invalid session ID format: ${sessionId}`);
    return null;
  }

  return sessionId;
}

/**
 * Find an existing session or create a new one.
 * This operation is idempotent - multiple calls with the same sessionId
 * will return the same session without creating duplicates.
 */
export async function findOrCreateSession(
  sessionId: string,
  context: SessionContext,
  startedAt: Date = new Date()
): Promise<{ id: string; isNew: boolean }> {
  const supabase = createAdminClient();

  // First, try to find existing session
  const { data: existing, error: findError } = await supabase
    .from('sessions')
    .select('id')
    .eq('session_id', sessionId)
    .single();

  if (findError && findError.code !== 'PGRST116') {
    // PGRST116 = no rows returned (expected for new sessions)
    throw new Error(`Failed to find session: ${findError.message}`);
  }

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  // Create new session with upsert to handle race conditions
  const { data: newSession, error: insertError } = await supabase
    .from('sessions')
    .upsert(
      {
        session_id: sessionId,
        user_id: context.user_id,
        team_id: context.team_id,
        project_id: context.project_id ?? null,
        started_at: startedAt.toISOString(),
        git_branch: context.git_branch ?? null,
        cwd: context.cwd ?? null,
        claude_code_version: context.claude_code_version ?? null,
        total_prompts: 0,
        total_tokens: 0,
      },
      {
        onConflict: 'session_id',
        ignoreDuplicates: true,
      }
    )
    .select('id')
    .single();

  if (insertError) {
    // If upsert failed, try to fetch again (race condition resolved)
    const { data: raceResolved, error: retryError } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (retryError || !raceResolved) {
      throw new Error(`Failed to create/find session: ${insertError.message}`);
    }

    return { id: raceResolved.id, isNew: false };
  }

  return { id: newSession.id, isNew: true };
}
```

### Session Context Resolver

```typescript
// lib/sessions/session-context.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { SessionContext } from './session-detection';

export interface ResolveContextInput {
  project_id?: string;
  user_id: string;
  metadata?: {
    git_branch?: string;
    cwd?: string;
    claude_code_version?: string;
  };
}

/**
 * Resolve session context from project and user information.
 * Determines team_id and validates user access.
 */
export async function resolveSessionContext(
  input: ResolveContextInput
): Promise<SessionContext> {
  const supabase = createAdminClient();

  let team_id: string;

  if (input.project_id) {
    // Get team from project
    const { data: project, error } = await supabase
      .from('projects')
      .select('team_id')
      .eq('id', input.project_id)
      .single();

    if (error || !project) {
      throw new Error(`Project not found: ${input.project_id}`);
    }

    team_id = project.team_id;
  } else {
    // Get user's default team (first team membership)
    const { data: membership, error } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', input.user_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !membership) {
      throw new Error(`User has no team membership: ${input.user_id}`);
    }

    team_id = membership.team_id;
  }

  // Validate user belongs to team
  const { data: access, error: accessError } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team_id)
    .eq('user_id', input.user_id)
    .single();

  if (accessError || !access) {
    throw new Error(`User ${input.user_id} does not belong to team ${team_id}`);
  }

  return {
    user_id: input.user_id,
    team_id,
    project_id: input.project_id,
    git_branch: input.metadata?.git_branch,
    cwd: input.metadata?.cwd,
    claude_code_version: input.metadata?.claude_code_version,
  };
}
```

### Prompt Capture Integration

```typescript
// lib/capture/store-prompt.ts - Updated with session detection

import { extractSessionId, findOrCreateSession } from '@/lib/sessions/session-detection';
import { resolveSessionContext } from '@/lib/sessions/session-context';

export interface StorePromptInput {
  team_id: string;
  project_id: string;
  user_id: string;
  text: string;
  metadata?: {
    session_id?: string;
    git_branch?: string;
    cwd?: string;
    claude_code_version?: string;
    [key: string]: unknown;
  };
}

export async function storePrompt(input: StorePromptInput): Promise<StorePromptResult> {
  const supabase = createAdminClient();

  let session_uuid: string | null = null;
  let sequence_number: number | null = null;

  // Session detection and linking
  if (input.metadata?.session_id) {
    try {
      const sessionContext = await resolveSessionContext({
        project_id: input.project_id,
        user_id: input.user_id,
        metadata: {
          git_branch: input.metadata.git_branch as string | undefined,
          cwd: input.metadata.cwd as string | undefined,
          claude_code_version: input.metadata.claude_code_version as string | undefined,
        },
      });

      const session = await findOrCreateSession(
        input.metadata.session_id,
        sessionContext
      );

      session_uuid = session.id;

      // Get next sequence number for this session
      const { count } = await supabase
        .from('prompts')
        .select('id', { count: 'exact', head: true })
        .eq('session_uuid', session_uuid);

      sequence_number = (count ?? 0) + 1;

    } catch (error) {
      console.warn('[StorePrompt] Session detection failed:', error);
      // Continue without session linking - don't block prompt storage
    }
  }

  // Store prompt with session link
  const { data, error } = await supabase
    .from('prompts')
    .insert({
      team_id: input.team_id,
      project_id: input.project_id,
      user_id: input.user_id,
      text: input.text,
      char_count: input.text.length,
      word_count: calculateWordCount(input.text),
      metadata: input.metadata ?? null,
      analysis_status: 'pending',
      session_uuid,
      sequence_number,
    })
    .select('id, analysis_status')
    .single();

  if (error) {
    throw new StorageError(`Failed to store prompt: ${error.message}`);
  }

  // Update session prompt count (non-blocking)
  if (session_uuid) {
    supabase
      .rpc('increment_session_prompt_count', { session_id: session_uuid })
      .then(() => {})
      .catch((err) => console.warn('[StorePrompt] Failed to update session count:', err));
  }

  return {
    id: data.id,
    analysis_status: data.analysis_status,
  };
}
```

### Database Function for Prompt Count

```sql
-- Add to session creation migration or separate migration

CREATE OR REPLACE FUNCTION increment_session_prompt_count(session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE sessions
  SET
    total_prompts = total_prompts + 1,
    updated_at = NOW()
  WHERE id = session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Transcript Metadata in Capture Hook

The CLI hook should pass session information in the metadata:

```bash
# In contextor-capture.sh hook
curl -X POST "${API_ENDPOINT}/prompts/capture" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "'"${PROMPT_TEXT}"'",
    "user_id": "'"${USER_ID}"'",
    "metadata": {
      "session_id": "'"${SESSION_ID}"'",
      "git_branch": "'"${GIT_BRANCH}"'",
      "cwd": "'"${CWD}"'"
    }
  }'
```

### Component File Locations

| Component | Path |
|-----------|------|
| Session Detection | `app/lib/sessions/session-detection.ts` |
| Session Context | `app/lib/sessions/session-context.ts` |
| Store Prompt (updated) | `app/lib/capture/store-prompt.ts` |
| Prompt Count Function | `app/supabase/migrations/YYYYMMDDHHMMSS_session_functions.sql` |

### Idempotency Strategy

The session detection uses a two-phase approach:

1. **Check first**: Query for existing session
2. **Upsert if needed**: Create with ON CONFLICT to handle race conditions
3. **Retry on conflict**: If upsert fails, fetch again (concurrent create resolved)

This ensures:
- No duplicate sessions even with concurrent requests
- Minimal database writes for existing sessions
- Graceful handling of race conditions

### Error Handling Strategy

Session detection failures should NOT block prompt capture:

```typescript
try {
  session_uuid = await detectSession(...);
} catch (error) {
  console.warn('[Session] Detection failed:', error);
  // Continue with session_uuid = null
}

// Prompt is still stored even if session detection fails
```

### Testing Guidance

**Unit Tests:**
```typescript
describe('extractSessionId', () => {
  it('extracts valid session ID', () => {
    expect(extractSessionId({ sessionId: 'session_abc123' })).toBe('session_abc123');
  });

  it('returns null for missing sessionId', () => {
    expect(extractSessionId({})).toBeNull();
  });

  it('returns null for invalid format', () => {
    expect(extractSessionId({ sessionId: 'invalid' })).toBeNull();
  });
});

describe('findOrCreateSession', () => {
  it('creates new session when none exists', async () => {
    const result = await findOrCreateSession('session_new', context);
    expect(result.isNew).toBe(true);
  });

  it('returns existing session without creating duplicate', async () => {
    await findOrCreateSession('session_existing', context);
    const result = await findOrCreateSession('session_existing', context);
    expect(result.isNew).toBe(false);
  });
});
```

**E2E Tests:**
1. Capture prompt with session_id -> verify session created
2. Capture second prompt with same session_id -> verify same session used
3. Verify prompt.sequence_number increments correctly
4. Verify session.total_prompts updates

### Common Pitfalls to Avoid

1. **DO NOT** throw errors that block prompt capture on session failure
2. **DO NOT** trust session_id format without validation
3. **DO NOT** skip the race condition handling in findOrCreateSession
4. **DO NOT** update session.started_at on subsequent prompts (only first)
5. **DO NOT** use client-side Supabase for session operations - use admin client

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
