# Story 16.5: Multi-Terminal Awareness

Status: ✅ COMPLETED (2025-12-23)

## PRD Alignment Note

This story was added during implementation planning to provide better modularity for Epic 16. The PRD defines 4 stories for this epic, with Story 16.4 ("Multi-Terminal Session Visualization") covering both the backend threading logic and the UI visualization aspects.

During story breakdown, we split this into:
- **Story 16-4 (Conversation Threading):** Backend logic for linking prompts to sessions and maintaining conversation threads
- **Story 16-5 (Multi-Terminal Awareness):** Frontend awareness and display of concurrent sessions, session identification, and overlap visualization

This separation follows the single-responsibility principle and allows parallel development of backend and frontend concerns.

## Story

**As a** power user running multiple Claude Code sessions,
**I want** the system to correctly track each terminal session separately,
**So that** my prompts are grouped correctly even when working in parallel.

## Dependencies

This story requires:
- **Story 16-1:** Sessions Database Schema (sessions table must exist)
- **Story 16-4:** Conversation Threading (backend session linking and thread management)

Related stories (for context, not blocking):
- Story 16.2: Session Detection Logic (session creation/matching)
- Story 16.3: Session Metadata Capture (cwd, git_branch)

## Acceptance Criteria

**AC 1: Concurrent Session Tracking**
- **Given** a user with multiple terminal windows running Claude Code
- **When** prompts are captured from each terminal
- **Then** each terminal's prompts are linked to their respective sessions
- **And** sessions are not confused or merged

**AC 2: Session Identification by Context**
- **Given** two sessions with different `session_id` values
- **When** prompts arrive for each
- **Then** they are correctly routed to separate session records
- **And** the `cwd` and `git_branch` may differ between sessions

**AC 3: Same Project Multi-Session**
- **Given** two terminals working on the same project
- **When** both have the same `project_id` but different `session_id`
- **Then** two separate session records are created
- **And** `total_prompts` is tracked per session, not per project

**AC 4: Session Overlap Detection** *(Stretch Goal)*
- **Given** active sessions are being tracked
- **When** a user queries their sessions
- **Then** overlapping (concurrent) sessions are identifiable
- **And** the UI can indicate parallel work

> **Note:** This AC is marked as a stretch goal. While overlap detection is a logical extension of multi-terminal awareness (users working in parallel terminals will want to see which sessions overlapped), it is not explicitly required by the PRD. Implement if time permits; the core value is delivered by AC 1-3 and AC 5.

**AC 5: Terminal Context Display**
- **Given** multiple active sessions
- **When** displayed in the UI
- **Then** each session shows its distinguishing context (cwd, git_branch)
- **And** users can easily identify which terminal each session represents

## Tasks / Subtasks

- [ ] **Task 1: Verify session isolation** (AC: #1, #2)
  - [ ] Review session detection to ensure `session_id` is the primary key
  - [ ] Add tests for concurrent session creation
  - [ ] Verify no race condition causes session merging

- [ ] **Task 2: Create active sessions query** (AC: #4)
  - [ ] Create `lib/sessions/active-sessions.ts`
  - [ ] Implement `getActiveSessions(userId: string): Promise<Session[]>`
  - [ ] Return sessions with `ended_at = NULL`
  - [ ] Include context metadata for identification

- [ ] **Task 3: Implement overlap detection** (AC: #4) *(Stretch Goal)*
  - [ ] Create `lib/sessions/session-overlap.ts`
  - [ ] Implement `detectOverlappingSessions(sessions: Session[]): OverlapInfo[]`
  - [ ] Calculate time overlap between sessions
  - [ ] Return overlap duration and session pairs

- [ ] **Task 4: Create session list API** (AC: #5, optionally #4)
  - [ ] Create `app/api/sessions/route.ts`
  - [ ] Support filtering by: active, project_id, date range
  - [ ] Include overlap indicators in response *(if Task 3 implemented)*
  - [ ] Implement pagination for large result sets

- [ ] **Task 5: Add distinguishing context to sessions** (AC: #5)
  - [ ] Ensure `cwd` is captured for each session
  - [ ] Ensure `git_branch` is captured
  - [ ] Generate unique display names when sessions share context

- [ ] **Task 6: Create session summary types** (AC: #5)
  - [ ] Define `SessionSummary` type with display-friendly fields
  - [ ] Include `displayName` field for UI
  - [ ] Include `isActive` boolean
  - [ ] Include `concurrentWith` array for overlaps

- [ ] **Task 7: Add E2E tests for multi-session** (AC: #1-5)
  - [ ] Test two sessions created simultaneously
  - [ ] Test sessions with same project but different terminal
  - [ ] Test overlap detection accuracy
  - [ ] Test session list API with filters

## Dev Notes

### Multi-Terminal Scenario

Users often work with multiple terminals:

```
Terminal 1                    Terminal 2
    |                            |
[session_abc123]            [session_def456]
    |                            |
  cwd: ~/project/frontend      cwd: ~/project/backend
  branch: feature/auth         branch: feature/api
    |                            |
  prompts 1, 3, 5              prompts 2, 4, 6
```

Each terminal has its own Claude Code session with a unique `session_id`. Our job is to keep these separate.

### Active Sessions Query

```typescript
// lib/sessions/active-sessions.ts

import { createServerClient } from '@/lib/supabase/server';

export interface ActiveSession {
  id: string;
  session_id: string;
  started_at: string;
  cwd: string | null;
  git_branch: string | null;
  project_id: string | null;
  project_name: string | null;
  total_prompts: number;
  last_activity: string;
}

/**
 * Get all active (not ended) sessions for a user.
 */
export async function getActiveSessions(
  userId: string
): Promise<ActiveSession[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id,
      session_id,
      started_at,
      cwd,
      git_branch,
      project_id,
      total_prompts,
      updated_at,
      projects (name)
    `)
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch active sessions: ${error.message}`);
  }

  return (data ?? []).map((session) => ({
    id: session.id,
    session_id: session.session_id,
    started_at: session.started_at,
    cwd: session.cwd,
    git_branch: session.git_branch,
    project_id: session.project_id,
    project_name: (session.projects as { name: string } | null)?.name ?? null,
    total_prompts: session.total_prompts,
    last_activity: session.updated_at,
  }));
}

/**
 * Get all sessions for a user within a time range.
 */
export async function getUserSessions(
  userId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    projectId?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ sessions: ActiveSession[]; total: number }> {
  const supabase = await createServerClient();

  let query = supabase
    .from('sessions')
    .select(`
      id,
      session_id,
      started_at,
      ended_at,
      cwd,
      git_branch,
      project_id,
      total_prompts,
      updated_at,
      projects (name)
    `, { count: 'exact' })
    .eq('user_id', userId);

  if (options.startDate) {
    query = query.gte('started_at', options.startDate.toISOString());
  }
  if (options.endDate) {
    query = query.lte('started_at', options.endDate.toISOString());
  }
  if (options.projectId) {
    query = query.eq('project_id', options.projectId);
  }
  if (options.activeOnly) {
    query = query.is('ended_at', null);
  }

  query = query.order('started_at', { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  const sessions = (data ?? []).map((session) => ({
    id: session.id,
    session_id: session.session_id,
    started_at: session.started_at,
    cwd: session.cwd,
    git_branch: session.git_branch,
    project_id: session.project_id,
    project_name: (session.projects as { name: string } | null)?.name ?? null,
    total_prompts: session.total_prompts,
    last_activity: session.updated_at,
  }));

  return { sessions, total: count ?? 0 };
}
```

### Session Overlap Detection

```typescript
// lib/sessions/session-overlap.ts

interface SessionTimeRange {
  id: string;
  session_id: string;
  started_at: Date;
  ended_at: Date | null;
  cwd: string | null;
  git_branch: string | null;
}

export interface OverlapInfo {
  session1: string;
  session2: string;
  overlapStart: Date;
  overlapEnd: Date | null;
  overlapMinutes: number | null; // null if still active
}

/**
 * Detect overlapping sessions (concurrent work).
 * Returns pairs of sessions that were active at the same time.
 */
export function detectOverlappingSessions(
  sessions: SessionTimeRange[]
): OverlapInfo[] {
  const overlaps: OverlapInfo[] = [];

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const s1 = sessions[i];
      const s2 = sessions[j];

      const overlap = calculateOverlap(s1, s2);
      if (overlap) {
        overlaps.push(overlap);
      }
    }
  }

  return overlaps;
}

function calculateOverlap(
  s1: SessionTimeRange,
  s2: SessionTimeRange
): OverlapInfo | null {
  const start1 = s1.started_at.getTime();
  const end1 = s1.ended_at?.getTime() ?? Date.now();
  const start2 = s2.started_at.getTime();
  const end2 = s2.ended_at?.getTime() ?? Date.now();

  // Check for overlap: max(start1, start2) < min(end1, end2)
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);

  if (overlapStart >= overlapEnd) {
    return null; // No overlap
  }

  const bothEnded = s1.ended_at && s2.ended_at;

  return {
    session1: s1.id,
    session2: s2.id,
    overlapStart: new Date(overlapStart),
    overlapEnd: bothEnded ? new Date(overlapEnd) : null,
    overlapMinutes: bothEnded
      ? Math.round((overlapEnd - overlapStart) / 60000)
      : null,
  };
}

/**
 * Group sessions by concurrent activity windows.
 * Returns groups of sessions that were all active together.
 */
export function groupConcurrentSessions(
  sessions: SessionTimeRange[]
): SessionTimeRange[][] {
  if (sessions.length <= 1) {
    return sessions.length === 1 ? [[sessions[0]]] : [];
  }

  const groups: SessionTimeRange[][] = [];
  const assigned = new Set<string>();

  for (const session of sessions) {
    if (assigned.has(session.id)) continue;

    const concurrent = sessions.filter((other) => {
      if (other.id === session.id) return true;
      const overlap = calculateOverlap(session, other);
      return overlap !== null;
    });

    if (concurrent.length > 1) {
      concurrent.forEach((s) => assigned.add(s.id));
      groups.push(concurrent);
    }
  }

  return groups;
}
```

### Session Summary Types

```typescript
// lib/sessions/types.ts - Add to existing types

export interface SessionSummary {
  id: string;
  session_id: string;
  displayName: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  isActive: boolean;
  context: {
    cwd: string | null;
    git_branch: string | null;
    project_name: string | null;
  };
  stats: {
    total_prompts: number;
    avg_prompt_score: number | null;
  };
  concurrentWith: string[]; // IDs of overlapping sessions
}

/**
 * Generate a human-readable display name for a session.
 * Prioritizes uniqueness when multiple sessions exist.
 */
export function generateSessionDisplayName(
  session: {
    cwd: string | null;
    git_branch: string | null;
    started_at: string;
    project_name: string | null;
  },
  allSessions: Array<{ cwd: string | null; git_branch: string | null }>
): string {
  const date = new Date(session.started_at);
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Check if we need more specificity
  const sameTime = allSessions.filter((s) => s !== session);
  const hasDuplicate = sameTime.some(
    (s) => s.cwd === session.cwd && s.git_branch === session.git_branch
  );

  if (session.git_branch) {
    if (hasDuplicate && session.cwd) {
      // Need full path distinction
      const dirName = session.cwd.split('/').pop() ?? 'unknown';
      return `${session.git_branch} (${dirName}) @ ${timeStr}`;
    }
    return `${session.git_branch} @ ${timeStr}`;
  }

  if (session.cwd) {
    const dirName = session.cwd.split('/').pop() ?? 'unknown';
    return `${dirName} @ ${timeStr}`;
  }

  if (session.project_name) {
    return `${session.project_name} @ ${timeStr}`;
  }

  return `Session @ ${timeStr}`;
}
```

### Sessions List API

```typescript
// app/api/sessions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getUserSessions } from '@/lib/sessions/active-sessions';
import { detectOverlappingSessions } from '@/lib/sessions/session-overlap';
import { generateSessionDisplayName, SessionSummary } from '@/lib/sessions/types';

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();

  // Authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId') ?? undefined;
  const activeOnly = searchParams.get('active') === 'true';
  const startDate = searchParams.get('startDate')
    ? new Date(searchParams.get('startDate')!)
    : undefined;
  const endDate = searchParams.get('endDate')
    ? new Date(searchParams.get('endDate')!)
    : undefined;
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    const { sessions, total } = await getUserSessions(user.id, {
      projectId,
      activeOnly,
      startDate,
      endDate,
      limit,
      offset,
    });

    // Detect overlaps
    const sessionRanges = sessions.map((s) => ({
      id: s.id,
      session_id: s.session_id,
      started_at: new Date(s.started_at),
      ended_at: s.last_activity ? new Date(s.last_activity) : null,
      cwd: s.cwd,
      git_branch: s.git_branch,
    }));
    const overlaps = detectOverlappingSessions(sessionRanges);

    // Build overlap map
    const overlapMap = new Map<string, string[]>();
    for (const overlap of overlaps) {
      const existing1 = overlapMap.get(overlap.session1) ?? [];
      existing1.push(overlap.session2);
      overlapMap.set(overlap.session1, existing1);

      const existing2 = overlapMap.get(overlap.session2) ?? [];
      existing2.push(overlap.session1);
      overlapMap.set(overlap.session2, existing2);
    }

    // Build summaries
    const summaries: SessionSummary[] = sessions.map((session) => {
      const startedAt = new Date(session.started_at);
      const endedAt = session.last_activity ? new Date(session.last_activity) : null;
      const durationMinutes = endedAt
        ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)
        : null;

      return {
        id: session.id,
        session_id: session.session_id,
        displayName: generateSessionDisplayName(
          {
            cwd: session.cwd,
            git_branch: session.git_branch,
            started_at: session.started_at,
            project_name: session.project_name,
          },
          sessions
        ),
        started_at: session.started_at,
        ended_at: session.last_activity,
        duration_minutes: durationMinutes,
        isActive: !endedAt || Date.now() - endedAt.getTime() < 120 * 60 * 1000,
        context: {
          cwd: session.cwd,
          git_branch: session.git_branch,
          project_name: session.project_name,
        },
        stats: {
          total_prompts: session.total_prompts,
          avg_prompt_score: null, // TODO: Calculate from prompt_analysis
        },
        concurrentWith: overlapMap.get(session.id) ?? [],
      };
    });

    return NextResponse.json({
      data: {
        sessions: summaries,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + sessions.length < total,
        },
        overlaps: overlaps.length,
      },
    });
  } catch (error) {
    console.error('[API] sessions list error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sessions' } },
      { status: 500 }
    );
  }
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Active Sessions | `app/lib/sessions/active-sessions.ts` |
| Session Overlap | `app/lib/sessions/session-overlap.ts` |
| Session Types | `app/lib/sessions/types.ts` |
| Sessions API | `app/app/api/sessions/route.ts` |

### UI Considerations

Multi-session display should clearly distinguish terminals:

```
Today's Sessions
----------------
[ACTIVE] feature/auth (frontend) @ 2:30 PM
         15 prompts | ~/projects/app/frontend
         ⚡ Concurrent with: feature/api

[ACTIVE] feature/api (backend) @ 2:45 PM
         8 prompts | ~/projects/app/backend
         ⚡ Concurrent with: feature/auth

[ENDED] main @ 10:15 AM - 11:30 AM
         42 prompts | ~/projects/app
```

### Testing Guidance

**Concurrent Session Tests:**
```typescript
describe('Multi-Terminal Sessions', () => {
  it('creates separate sessions for concurrent terminals', async () => {
    // Create two sessions with different session_ids
    const session1 = await findOrCreateSession('session_abc', context);
    const session2 = await findOrCreateSession('session_def', context);

    expect(session1.id).not.toBe(session2.id);
  });

  it('maintains correct prompt counts per session', async () => {
    // Add prompts to both sessions
    await storePrompt({ ...promptData, metadata: { session_id: 'session_abc' } });
    await storePrompt({ ...promptData, metadata: { session_id: 'session_def' } });
    await storePrompt({ ...promptData, metadata: { session_id: 'session_abc' } });

    const sessions = await getActiveSessions(userId);
    const s1 = sessions.find(s => s.session_id === 'session_abc');
    const s2 = sessions.find(s => s.session_id === 'session_def');

    expect(s1?.total_prompts).toBe(2);
    expect(s2?.total_prompts).toBe(1);
  });
});

describe('Session Overlap Detection', () => {
  it('detects overlapping sessions', () => {
    const sessions = [
      { id: '1', started_at: new Date('2025-01-01T10:00:00'), ended_at: new Date('2025-01-01T12:00:00') },
      { id: '2', started_at: new Date('2025-01-01T11:00:00'), ended_at: new Date('2025-01-01T13:00:00') },
    ];

    const overlaps = detectOverlappingSessions(sessions);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].overlapMinutes).toBe(60);
  });

  it('handles active sessions', () => {
    const sessions = [
      { id: '1', started_at: new Date('2025-01-01T10:00:00'), ended_at: null },
      { id: '2', started_at: new Date('2025-01-01T11:00:00'), ended_at: null },
    ];

    const overlaps = detectOverlappingSessions(sessions);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].overlapMinutes).toBeNull(); // Still active
  });
});
```

### Common Pitfalls to Avoid

1. **DO NOT** merge sessions based on project_id - session_id is the key
2. **DO NOT** assume only one active session per user - multi-terminal is normal
3. **DO NOT** use `cwd` or `git_branch` for session identity - they're context, not ID
4. **DO NOT** forget to handle the overlap calculation for active sessions
5. **DO NOT** display session_id to users - generate human-readable names

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
