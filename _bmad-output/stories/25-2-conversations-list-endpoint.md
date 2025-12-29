# Story 25-2: Conversations List Endpoint

Status: Implemented

## Story

**As a** web dashboard user,
**I want** to fetch a list of my conversations with filtering options,
**So that** I can browse and filter my Claude Code sessions by project, stage, and other criteria.

## Acceptance Criteria

1. **Endpoint Available**
   - [x] **Given** a logged-in user
   - [x] **When** a GET request is made to `/api/conversations`
   - [x] **Then** the endpoint returns conversations for the user's current team
   - [x] **And** results are sorted by newest first

2. **Session Data with Phase 3 Fields**
   - [x] **Given** conversations are returned
   - [x] **When** the response is rendered
   - [x] **Then** each conversation includes Phase 3 fields:
     - `primaryStage` (detected project stage)
     - `hasDebuggingLoop` (boolean)
     - `conversationScore` (aggregate excluding selection/confirmation)
     - `userMessageCount` (prompts from user)
     - `stageBreakdown` (stage distribution)

3. **Filtering by Project**
   - [x] **Given** a `project_id` query parameter
   - [x] **When** the request is processed
   - [x] **Then** only conversations for that project are returned
   - [x] **And** if `project_id=unlinked`, return sessions with NULL project_id

4. **Filtering by Stage**
   - [x] **Given** a `stage` query parameter
   - [x] **When** the request is processed
   - [x] **Then** only conversations with matching `primary_stage` are returned

5. **Filtering by Debugging Loop**
   - [x] **Given** a `has_loop` query parameter
   - [x] **When** `has_loop=true`
   - [x] **Then** only conversations with debugging loops are returned
   - [x] **And** when `has_loop=false`, only loop-free conversations are returned

6. **Date Range Filtering**
   - [x] **Given** `date_from` and/or `date_to` query parameters
   - [x] **When** the request is processed
   - [x] **Then** only conversations within the date range are returned

7. **Pagination**
   - [x] **Given** `limit` and `offset` query parameters
   - [x] **When** the request is processed
   - [x] **Then** results are paginated accordingly
   - [x] **And** total count is returned in response metadata

8. **Authorization**
   - [x] **Given** an unauthenticated request
   - [x] **When** the endpoint is accessed
   - [x] **Then** HTTP 401 is returned

## API Specification

### Request

```
GET /api/conversations
Authorization: Bearer <session_token> (via cookies)
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `project_id` | string | - | Filter by project UUID, or "unlinked" |
| `stage` | string | - | Filter by primary_stage |
| `has_loop` | boolean | - | Filter by debugging loop presence |
| `date_from` | string | - | ISO 8601 date (inclusive) |
| `date_to` | string | - | ISO 8601 date (inclusive) |
| `limit` | number | 50 | Max results (max: 100) |
| `offset` | number | 0 | Pagination offset |
| `sort_by` | string | "date" | Sort field: "date", "messages", "score" |

### Response (Success)

```typescript
// HTTP 200
interface ConversationsResponse {
  data: {
    conversations: ConversationSummary[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

interface ConversationSummary {
  id: string;                    // Session UUID
  sessionId: string;             // Claude Code session_id
  slug: string;                  // Human-readable name
  projectId: string | null;
  projectName: string | null;
  userId: string;
  userName?: string;
  startedAt: string;             // ISO 8601
  endedAt: string | null;
  userMessageCount: number;      // Phase 3
  totalMessages: number;
  primaryStage: ProjectStage | null;  // Phase 3
  hasDebuggingLoop: boolean;          // Phase 3
  conversationScore: number | null;   // Phase 3
  stageBreakdown: StageBreakdown | null; // Phase 3
  gitBranch: string | null;
  cwd: string | null;
  claudeCodeVersion: string | null;
}

type ProjectStage =
  | 'architecture' | 'specification' | 'development'
  | 'debugging' | 'enhancement';

interface StageBreakdown {
  architecture: number;
  specification: number;
  development: number;
  debugging: number;
  enhancement: number;
}
```

### Response (Error)

```typescript
// HTTP 401 - Unauthorized
{
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
  }
}

// HTTP 400 - Invalid parameters
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid stage value'
  }
}
```

## Technical Notes

### Query Parameter Validation

```typescript
// lib/validations/conversations-query.ts
import { z } from 'zod';

const projectStages = [
  'architecture', 'specification', 'development',
  'debugging', 'enhancement'
] as const;

export const conversationsQuerySchema = z.object({
  project_id: z.string().optional(),
  stage: z.enum(projectStages).optional(),
  has_loop: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort_by: z.enum(['date', 'messages', 'score']).default('date'),
});

export type ConversationsQuery = z.infer<typeof conversationsQuerySchema>;
```

### Database Query Function

```typescript
// lib/conversations/get-conversations.ts
import { createClient } from '@/lib/supabase/server';
import { ConversationsQuery } from '@/lib/validations/conversations-query';

interface ConversationsResult {
  conversations: ConversationSummary[];
  total: number;
}

export async function getConversations(
  teamId: string,
  query: ConversationsQuery
): Promise<ConversationsResult> {
  const supabase = await createClient();

  // Build base query
  let dbQuery = supabase
    .from('sessions')
    .select(`
      id,
      session_id,
      slug,
      project_id,
      projects(name),
      user_id,
      users(full_name),
      started_at,
      ended_at,
      total_prompts,
      user_message_count,
      primary_stage,
      has_debugging_loop,
      conversation_score,
      stage_breakdown,
      git_branch,
      cwd,
      claude_code_version
    `, { count: 'exact' })
    .eq('team_id', teamId);

  // Apply filters
  if (query.project_id) {
    if (query.project_id === 'unlinked') {
      dbQuery = dbQuery.is('project_id', null);
    } else {
      dbQuery = dbQuery.eq('project_id', query.project_id);
    }
  }

  if (query.stage) {
    dbQuery = dbQuery.eq('primary_stage', query.stage);
  }

  if (query.has_loop !== undefined) {
    dbQuery = dbQuery.eq('has_debugging_loop', query.has_loop);
  }

  if (query.date_from) {
    dbQuery = dbQuery.gte('started_at', query.date_from);
  }

  if (query.date_to) {
    dbQuery = dbQuery.lte('started_at', query.date_to);
  }

  // Apply sorting
  const sortColumn = {
    date: 'started_at',
    messages: 'user_message_count',
    score: 'conversation_score',
  }[query.sort_by];

  dbQuery = dbQuery.order(sortColumn, { ascending: false, nullsFirst: false });

  // Apply pagination
  dbQuery = dbQuery.range(query.offset, query.offset + query.limit - 1);

  const { data, error, count } = await dbQuery;

  if (error) throw error;

  // Transform to API response format
  const conversations = data.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    slug: row.slug,
    projectId: row.project_id,
    projectName: row.projects?.name ?? null,
    userId: row.user_id,
    userName: row.users?.full_name,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    userMessageCount: row.user_message_count ?? 0,
    totalMessages: row.total_prompts ?? 0,
    primaryStage: row.primary_stage,
    hasDebuggingLoop: row.has_debugging_loop ?? false,
    conversationScore: row.conversation_score,
    stageBreakdown: row.stage_breakdown,
    gitBranch: row.git_branch,
    cwd: row.cwd,
    claudeCodeVersion: row.claude_code_version,
  }));

  return {
    conversations,
    total: count ?? 0,
  };
}
```

### API Route Implementation

```typescript
// app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { conversationsQuerySchema } from '@/lib/validations/conversations-query';
import { getConversations } from '@/lib/conversations/get-conversations';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Get current team
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: { code: 'NO_TEAM', message: 'User has no team' } },
        { status: 400 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = conversationsQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
        { status: 400 }
      );
    }

    // Fetch conversations
    const result = await getConversations(membership.team_id, parsed.data);

    return NextResponse.json({
      data: {
        conversations: result.conversations,
        pagination: {
          total: result.total,
          limit: parsed.data.limit,
          offset: parsed.data.offset,
          hasMore: parsed.data.offset + result.conversations.length < result.total,
        },
      },
    });

  } catch (error) {
    console.error('[API] conversations: error', error);
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
| API Route | `app/api/conversations/route.ts` |
| Query Schema | `lib/validations/conversations-query.ts` |
| Query Function | `lib/conversations/get-conversations.ts` |
| E2E Tests | `e2e/conversations-api.spec.ts` |

## Tasks / Subtasks

- [ ] **Task 1: Create query parameter schema** (AC: #3-7)
  - [ ] Create `lib/validations/conversations-query.ts`
  - [ ] Define project_id validation (UUID or "unlinked")
  - [ ] Define stage enum validation
  - [ ] Define has_loop boolean transformation
  - [ ] Define date range validation (ISO 8601)
  - [ ] Define pagination with limits
  - [ ] Define sort_by enum

- [ ] **Task 2: Create conversations query function** (AC: #1, #2)
  - [ ] Create `lib/conversations/get-conversations.ts`
  - [ ] Build base query with joins to projects and users
  - [ ] Select all Phase 3 fields
  - [ ] Transform database rows to API response format
  - [ ] Return total count for pagination

- [ ] **Task 3: Implement filtering logic** (AC: #3-6)
  - [ ] Add project_id filter (including "unlinked" case)
  - [ ] Add stage filter
  - [ ] Add has_loop filter
  - [ ] Add date_from filter (gte)
  - [ ] Add date_to filter (lte)

- [ ] **Task 4: Implement sorting and pagination** (AC: #7)
  - [ ] Add sort_by logic (date, messages, score)
  - [ ] Handle null values in sort (nullsFirst: false)
  - [ ] Apply range for pagination
  - [ ] Calculate hasMore flag

- [ ] **Task 5: Implement API route** (AC: #1, #8)
  - [ ] Create `app/api/conversations/route.ts`
  - [ ] Add authentication check
  - [ ] Get user's current team
  - [ ] Parse and validate query parameters
  - [ ] Call getConversations function
  - [ ] Return paginated response

- [ ] **Task 6: Write E2E tests** (AC: #1-8)
  - [ ] Test: Unauthenticated request returns 401
  - [ ] Test: Returns conversations sorted by date
  - [ ] Test: Includes Phase 3 fields
  - [ ] Test: Filter by project_id works
  - [ ] Test: Filter by stage works
  - [ ] Test: Filter by has_loop works
  - [ ] Test: Date range filtering works
  - [ ] Test: Pagination works correctly
  - [ ] Test: Sort options work

## Dependencies

- **Story 24-1**: Sessions table extensions (primary_stage, has_debugging_loop, etc.)
- **Existing**: Authentication middleware
- **Existing**: Supabase server client

## Design System Requirements

This is a backend-only story. The UI connection is handled in Story 25-5.

## Testing Checklist

- [ ] Unauthenticated request returns 401 UNAUTHORIZED
- [ ] User with no team returns 400 NO_TEAM
- [ ] Default request returns up to 50 conversations sorted by date
- [ ] Conversations include all Phase 3 fields
- [ ] project_id filter returns only matching conversations
- [ ] project_id=unlinked returns sessions with null project_id
- [ ] stage filter returns only matching stages
- [ ] has_loop=true returns only looped conversations
- [ ] has_loop=false returns only loop-free conversations
- [ ] date_from filters correctly (inclusive)
- [ ] date_to filters correctly (inclusive)
- [ ] Combined filters work together
- [ ] limit parameter caps at 100
- [ ] offset parameter skips correct number
- [ ] hasMore is true when more results exist
- [ ] sort_by=messages sorts by user_message_count
- [ ] sort_by=score sorts by conversation_score

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created comprehensive TypeScript types for conversations in `lib/types/conversations.ts`:
   - `ProjectStage` type covering Phase 2 and Phase 3 stage values
   - `StageBreakdown` interface for stage distribution
   - `ConversationSummary` interface with all required fields
   - `PaginationInfo` and response types

2. Created query validation schema in `lib/validations/conversations-query.ts`:
   - Zod schema for all query parameters
   - Support for `project_id` (UUID or "unlinked")
   - Stage enum validation with all valid values
   - Boolean transform for `has_loop`
   - Date validation for `date_from`/`date_to`
   - Pagination limits (1-100, default 50)
   - Sort options validation

3. Created database query function in `lib/conversations/get-conversations.ts`:
   - Joins to projects and users tables
   - Filters for project_id, stage, has_loop, date range
   - Sorting by date, messages, or score
   - Pagination with offset/limit
   - Returns conversation summaries with Phase 3 fields

4. Created API route at `app/api/conversations/route.ts`:
   - Session cookie authentication
   - Team membership lookup
   - Query parameter validation
   - Error responses for 400, 401, 500

5. Created E2E tests in `e2e/conversations-api.spec.ts`:
   - 17 test cases covering all acceptance criteria
   - Test helpers for creating/deleting sessions

6. Fixed existing bug: Renamed `/api/sessions/[id]/context` to `/api/sessions/[sessionId]/context` to resolve Next.js dynamic route slug conflict.

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Initial implementation of Story 25-2 | Claude Opus 4.5 |
| 2025-12-26 | Fixed [id] vs [sessionId] route conflict | Claude Opus 4.5 |

### File List

**Created:**
- `/app/lib/types/conversations.ts` - TypeScript types for conversation list
- `/app/lib/validations/conversations-query.ts` - Zod query validation schema
- `/app/lib/conversations/get-conversations.ts` - Database query function
- `/app/app/api/conversations/route.ts` - GET /api/conversations endpoint
- `/app/e2e/conversations-api.spec.ts` - E2E tests for the endpoint

**Modified:**
- `/app/app/api/sessions/[sessionId]/context/route.ts` - Fixed route parameter name from `id` to `sessionId`

**Moved:**
- `/app/app/api/sessions/[id]/` -> `/app/app/api/sessions/[sessionId]/` - Fixed dynamic route slug conflict
