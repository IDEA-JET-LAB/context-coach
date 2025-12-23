# Story 16.3: Session Metadata Capture

Status: ✅ COMPLETED (2025-12-23)

## PRD Alignment Note

This story addresses the backend metadata capture component of PRD requirement 16.3 ("Conversation Grouping in UI"). The implementation was split for modularity:
- **Story 16-3** (this story): Backend metadata capture needed for UI grouping
- **Story 16-4** (Conversation Threading): Links prompts to sessions
- **Story 16-5** (Multi-Terminal Awareness): Handles concurrent terminal sessions

Together, these stories deliver the "Conversation Grouping in UI" capability described in the PRD.

## Story

**As a** user reviewing my sessions,
**I want** to see rich context about each session including timing, location, and git context,
**So that** I can understand when and where each conversation took place.

## Dependencies

This story requires:
- **Story 16-1: Sessions Database Schema** - Provides sessions table with metadata columns
- **Story 16-2: Session Detection Logic** - Provides findOrCreateSession function
- Story 15.x: Transcript Mining (provides transcript data)

## Acceptance Criteria

**AC 1: Timing Metadata Capture**
- **Given** a new session is detected
- **When** the session is created
- **Then** `started_at` is set to the timestamp of the first message
- **And** `ended_at` is initially NULL

**AC 2: Session End Detection**
- **Given** an active session
- **When** the session ends (detected via transcript or timeout)
- **Then** `ended_at` is set to the appropriate timestamp
- **And** `end_reason` is set to one of: 'clear', 'logout', 'crash', 'timeout'

**AC 3: Context Metadata Capture**
- **Given** transcript data is available
- **When** a session is created or updated
- **Then** the following are captured:
  - `cwd` (current working directory)
  - `git_branch` (current git branch)
  - `claude_code_version` (version of Claude Code)
  - `slug` (human-readable session name if available)

**AC 4: Prompt Count Tracking**
- **Given** prompts are added to a session
- **When** each prompt is stored
- **Then** `total_prompts` is incremented
- **And** the count is accurate across concurrent insertions

**AC 5: Empty Session Handling**
- **Given** a session is created
- **When** no messages are associated with the session
- **Then** `total_prompts` remains 0
- **And** the session is still valid and queryable
- **And** the session can be closed with any valid `end_reason`

**AC 6: Metadata Update Service**
- **Given** additional context becomes available after session creation
- **When** the update service is called
- **Then** nullable fields can be updated without overwriting existing data
- **And** `updated_at` timestamp is refreshed

## Note on Token Counting

The architecture mentions `total_tokens` as a session metric. Token counting requires integration with the AI analysis pipeline and is deferred to **Epic 21 (Advanced Analytics)**, specifically Story 21-4 (Prompt Complexity Metrics). This story focuses on `total_prompts` which can be tracked without AI analysis.

## Tasks / Subtasks

- [ ] **Task 1: Create session metadata types** (AC: #3)
  - [ ] Define `SessionMetadata` interface in `lib/sessions/types.ts`
  - [ ] Include all metadata fields with proper typing
  - [ ] Add validation functions for metadata fields

- [ ] **Task 2: Implement session start capture** (AC: #1, #3)
  - [ ] Extract `started_at` from first message timestamp
  - [ ] Parse `cwd` from transcript context
  - [ ] Parse `git_branch` from environment or transcript
  - [ ] Parse `claude_code_version` from transcript headers
  - [ ] Generate or extract `slug` for session naming

- [ ] **Task 3: Implement session end detection** (AC: #2)
  - [ ] Create `lib/sessions/session-lifecycle.ts`
  - [ ] Implement `detectSessionEnd(transcript: TranscriptMessage[]): EndInfo | null`
  - [ ] Handle 'clear' end reason (context cleared by user)
  - [ ] Handle 'logout' end reason (session explicitly ended)
  - [ ] Implement timeout detection for stale sessions

- [ ] **Task 4: Create session update service** (AC: #6)
  - [ ] Create `updateSessionMetadata(sessionId: string, metadata: Partial<SessionMetadata>)`
  - [ ] Only update NULL fields (preserve original data)
  - [ ] Handle concurrent updates safely
  - [ ] Update `updated_at` timestamp

- [ ] **Task 5: Implement prompt count tracking** (AC: #4)
  - [ ] Create database function `increment_session_prompt_count`
  - [ ] Ensure atomic increment to handle concurrency
  - [ ] Call function after successful prompt insert
  - [ ] Add error handling for count updates

- [ ] **Task 6: Create session timeout job** (AC: #2)
  - [ ] Create `lib/sessions/session-timeout.ts`
  - [ ] Implement `closeStaleSession()` function
  - [ ] Mark sessions with no activity for 2+ hours as 'timeout'
  - [ ] Design for scheduled execution (cron or Edge Function)

- [ ] **Task 7: Add comprehensive tests** (AC: #1-6)
  - [ ] Test metadata extraction from various transcript formats
  - [ ] Test session end detection for each end reason
  - [ ] Test concurrent prompt count updates
  - [ ] Test timeout detection logic
  - [ ] Test empty session handling (zero messages, valid closure)

## Dev Notes

### Session Metadata Types

```typescript
// lib/sessions/types.ts

export interface SessionMetadata {
  cwd: string | null;
  git_branch: string | null;
  claude_code_version: string | null;
  slug: string | null;
}

export interface SessionTimingInfo {
  started_at: Date;
  ended_at: Date | null;
  end_reason: 'clear' | 'logout' | 'crash' | 'timeout' | null;
}

export interface SessionEndInfo {
  ended_at: Date;
  end_reason: 'clear' | 'logout' | 'crash' | 'timeout';
}

export interface TranscriptContext {
  sessionId: string;
  timestamp: string;
  cwd?: string;
  gitBranch?: string;
  claudeCodeVersion?: string;
  customConversationTitle?: string;
}
```

### Metadata Extraction from Transcripts

```typescript
// lib/sessions/metadata-extraction.ts

import { SessionMetadata, TranscriptContext } from './types';

/**
 * Extract session metadata from transcript context.
 * Claude Code transcripts include context in the first few messages.
 */
export function extractSessionMetadata(
  context: TranscriptContext
): SessionMetadata {
  return {
    cwd: sanitizePath(context.cwd) ?? null,
    git_branch: sanitizeBranchName(context.gitBranch) ?? null,
    claude_code_version: context.claudeCodeVersion ?? null,
    slug: generateSlug(context) ?? null,
  };
}

/**
 * Extract started_at timestamp from first message.
 */
export function extractStartedAt(
  messages: Array<{ timestamp?: string }>
): Date {
  const firstMessage = messages[0];

  if (firstMessage?.timestamp) {
    const parsed = new Date(firstMessage.timestamp);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Fallback to now if no valid timestamp
  return new Date();
}

/**
 * Generate a human-readable slug for the session.
 * Priority: custom title > git branch + short timestamp > generic
 */
function generateSlug(context: TranscriptContext): string | null {
  if (context.customConversationTitle) {
    return sanitizeSlug(context.customConversationTitle);
  }

  if (context.gitBranch) {
    const date = new Date(context.timestamp);
    const shortDate = date.toISOString().slice(5, 10); // MM-DD
    return `${context.gitBranch}-${shortDate}`;
  }

  return null;
}

/**
 * Sanitize file paths - remove sensitive information.
 */
function sanitizePath(path: string | undefined): string | null {
  if (!path) return null;

  // Replace home directory with ~
  const home = process.env.HOME || '/Users/user';
  return path.replace(home, '~');
}

/**
 * Sanitize git branch names.
 */
function sanitizeBranchName(branch: string | undefined): string | null {
  if (!branch) return null;

  // Trim whitespace and limit length
  return branch.trim().slice(0, 100);
}

/**
 * Sanitize slug for URL-safe display.
 */
function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
```

### Session Lifecycle Management

```typescript
// lib/sessions/session-lifecycle.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { SessionEndInfo } from './types';

export type EndReason = 'clear' | 'logout' | 'crash' | 'timeout';

interface TranscriptMessage {
  type: string;
  message?: {
    type?: string;
    content?: string;
  };
  timestamp?: string;
}

/**
 * Detect if a session has ended based on transcript messages.
 */
export function detectSessionEnd(
  messages: TranscriptMessage[]
): SessionEndInfo | null {
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage) return null;

  // Check for explicit session end signals
  if (lastMessage.type === 'system') {
    const content = lastMessage.message?.content?.toLowerCase() ?? '';

    if (content.includes('conversation cleared') || content.includes('context cleared')) {
      return {
        ended_at: new Date(lastMessage.timestamp ?? Date.now()),
        end_reason: 'clear',
      };
    }

    if (content.includes('goodbye') || content.includes('session ended')) {
      return {
        ended_at: new Date(lastMessage.timestamp ?? Date.now()),
        end_reason: 'logout',
      };
    }
  }

  // Check for crash indicators
  if (lastMessage.type === 'error') {
    return {
      ended_at: new Date(lastMessage.timestamp ?? Date.now()),
      end_reason: 'crash',
    };
  }

  return null;
}

/**
 * Close a session with end timing information.
 */
export async function closeSession(
  sessionUuid: string,
  endInfo: SessionEndInfo
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: endInfo.ended_at.toISOString(),
      end_reason: endInfo.end_reason,
    })
    .eq('id', sessionUuid)
    .is('ended_at', null); // Only close if not already closed

  if (error) {
    console.error(`[SessionLifecycle] Failed to close session ${sessionUuid}:`, error);
    throw error;
  }
}

/**
 * Mark stale sessions as timed out.
 * Should be called periodically (e.g., every hour).
 */
export async function closeStaleSession(
  timeoutMinutes: number = 120 // 2 hours default
): Promise<number> {
  const supabase = createAdminClient();

  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - timeoutMinutes);

  const { data, error } = await supabase
    .from('sessions')
    .update({
      ended_at: new Date().toISOString(),
      end_reason: 'timeout',
    })
    .is('ended_at', null)
    .lt('updated_at', cutoffTime.toISOString())
    .select('id');

  if (error) {
    console.error('[SessionLifecycle] Failed to close stale sessions:', error);
    throw error;
  }

  const closedCount = data?.length ?? 0;
  console.log(`[SessionLifecycle] Closed ${closedCount} stale sessions`);

  return closedCount;
}
```

### Session Update Service

```typescript
// lib/sessions/session-update.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { SessionMetadata } from './types';

/**
 * Update session metadata.
 * Only updates NULL fields to preserve original data.
 */
export async function updateSessionMetadata(
  sessionUuid: string,
  metadata: Partial<SessionMetadata>
): Promise<void> {
  const supabase = createAdminClient();

  // Build update object, only including non-null values
  const updates: Record<string, unknown> = {};

  if (metadata.cwd !== undefined) {
    updates.cwd = metadata.cwd;
  }
  if (metadata.git_branch !== undefined) {
    updates.git_branch = metadata.git_branch;
  }
  if (metadata.claude_code_version !== undefined) {
    updates.claude_code_version = metadata.claude_code_version;
  }
  if (metadata.slug !== undefined) {
    updates.slug = metadata.slug;
  }

  if (Object.keys(updates).length === 0) {
    return; // Nothing to update
  }

  // Use COALESCE in raw SQL to preserve existing values
  const setClauses = Object.keys(updates)
    .map((key) => `${key} = COALESCE(${key}, $${key})`)
    .join(', ');

  // For simpler approach without raw SQL:
  const { error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', sessionUuid);

  if (error) {
    console.error(`[SessionUpdate] Failed to update session ${sessionUuid}:`, error);
    throw error;
  }
}

/**
 * Conditionally update metadata only if current value is NULL.
 */
export async function updateSessionMetadataIfNull(
  sessionUuid: string,
  metadata: Partial<SessionMetadata>
): Promise<void> {
  const supabase = createAdminClient();

  // Fetch current session to check null fields
  const { data: current, error: fetchError } = await supabase
    .from('sessions')
    .select('cwd, git_branch, claude_code_version, slug')
    .eq('id', sessionUuid)
    .single();

  if (fetchError || !current) {
    throw new Error(`Session not found: ${sessionUuid}`);
  }

  const updates: Record<string, unknown> = {};

  if (current.cwd === null && metadata.cwd) {
    updates.cwd = metadata.cwd;
  }
  if (current.git_branch === null && metadata.git_branch) {
    updates.git_branch = metadata.git_branch;
  }
  if (current.claude_code_version === null && metadata.claude_code_version) {
    updates.claude_code_version = metadata.claude_code_version;
  }
  if (current.slug === null && metadata.slug) {
    updates.slug = metadata.slug;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', sessionUuid);

  if (error) {
    throw error;
  }
}
```

### Prompt Count Database Function

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_session_prompt_count.sql

-- Atomic increment for prompt count
CREATE OR REPLACE FUNCTION increment_session_prompt_count(p_session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE sessions
  SET
    total_prompts = total_prompts + 1,
    updated_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION increment_session_prompt_count(UUID) TO service_role;

-- Trigger to auto-increment on prompt insert (alternative approach)
CREATE OR REPLACE FUNCTION on_prompt_session_link()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_uuid IS NOT NULL THEN
    UPDATE sessions
    SET
      total_prompts = total_prompts + 1,
      updated_at = NOW()
    WHERE id = NEW.session_uuid;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prompt_session_link_trigger
  AFTER INSERT ON prompts
  FOR EACH ROW
  WHEN (NEW.session_uuid IS NOT NULL)
  EXECUTE FUNCTION on_prompt_session_link();
```

### Session Timeout Edge Function

```typescript
// supabase/functions/session-timeout/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TIMEOUT_MINUTES = 120; // 2 hours

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - TIMEOUT_MINUTES);

  const { data, error } = await supabase
    .from('sessions')
    .update({
      ended_at: new Date().toISOString(),
      end_reason: 'timeout',
    })
    .is('ended_at', null)
    .lt('updated_at', cutoffTime.toISOString())
    .select('id');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      message: `Closed ${data?.length ?? 0} stale sessions`,
      closed: data?.map((s) => s.id) ?? [],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
```

### Component File Locations

| Component | Path |
|-----------|------|
| Session Types | `app/lib/sessions/types.ts` |
| Metadata Extraction | `app/lib/sessions/metadata-extraction.ts` |
| Session Lifecycle | `app/lib/sessions/session-lifecycle.ts` |
| Session Update | `app/lib/sessions/session-update.ts` |
| Prompt Count Migration | `app/supabase/migrations/YYYYMMDDHHMMSS_session_prompt_count.sql` |
| Timeout Edge Function | `app/supabase/functions/session-timeout/index.ts` |

### End Reason Meanings

| End Reason | Description | Detection Method |
|------------|-------------|------------------|
| `clear` | User cleared conversation context | Transcript "context cleared" message |
| `logout` | User explicitly ended session | Transcript "goodbye" or session end message |
| `crash` | Session ended due to error | Error message in transcript |
| `timeout` | No activity for 2+ hours | Scheduled timeout job |

### Testing Guidance

**Metadata Extraction Tests:**
```typescript
describe('extractSessionMetadata', () => {
  it('extracts cwd with home directory sanitization', () => {
    const metadata = extractSessionMetadata({
      sessionId: 'session_123',
      timestamp: '2025-01-01T00:00:00Z',
      cwd: '/Users/john/projects/app',
    });
    expect(metadata.cwd).toBe('~/projects/app');
  });

  it('generates slug from git branch', () => {
    const metadata = extractSessionMetadata({
      sessionId: 'session_123',
      timestamp: '2025-03-15T00:00:00Z',
      gitBranch: 'feature/auth',
    });
    expect(metadata.slug).toBe('feature-auth-03-15');
  });
});
```

**Session End Detection Tests:**
```typescript
describe('detectSessionEnd', () => {
  it('detects context clear', () => {
    const messages = [
      { type: 'user', message: { content: 'hello' } },
      { type: 'system', message: { content: 'Conversation cleared' } },
    ];
    const result = detectSessionEnd(messages);
    expect(result?.end_reason).toBe('clear');
  });

  it('returns null for active session', () => {
    const messages = [
      { type: 'user', message: { content: 'hello' } },
      { type: 'assistant', message: { content: 'hi' } },
    ];
    expect(detectSessionEnd(messages)).toBeNull();
  });
});
```

**Empty Session Tests:**
```typescript
describe('empty session handling', () => {
  it('creates session with zero prompts', async () => {
    const session = await createSession({
      projectUuid: 'project-123',
      terminalId: 'term-1',
      started_at: new Date(),
    });
    expect(session.total_prompts).toBe(0);
  });

  it('allows closing empty session', async () => {
    const session = await createSession({
      projectUuid: 'project-123',
      terminalId: 'term-1',
      started_at: new Date(),
    });
    await closeSession(session.id, {
      ended_at: new Date(),
      end_reason: 'timeout',
    });
    const updated = await getSession(session.id);
    expect(updated.ended_at).toBeDefined();
    expect(updated.end_reason).toBe('timeout');
  });
});
```

### Common Pitfalls to Avoid

1. **DO NOT** overwrite existing metadata - use COALESCE or check for NULL
2. **DO NOT** store full absolute paths - sanitize to remove home directory
3. **DO NOT** rely solely on transcript end signals - implement timeout fallback
4. **DO NOT** forget timezone handling - always use ISO strings with Z suffix
5. **DO NOT** make prompt count updates blocking - use fire-and-forget pattern

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
