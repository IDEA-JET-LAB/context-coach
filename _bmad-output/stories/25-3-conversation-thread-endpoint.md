# Story 25-3: Conversation Thread Endpoint

Status: Complete

## Story

**As a** web dashboard user,
**I want** to fetch the full threaded message history for a conversation,
**So that** I can view the complete exchange between myself and Claude with all metadata.

## Acceptance Criteria

1. **Endpoint Available**
   - [x] **Given** a logged-in user
   - [x] **When** a GET request is made to `/api/conversations/[sessionId]`
   - [x] **Then** the endpoint returns the conversation thread
   - [x] **And** messages are ordered by sequence_number

2. **Thread Contains User Messages**
   - [x] **Given** a conversation with user prompts
   - [x] **When** the thread is returned
   - [x] **Then** each user message includes:
     - Prompt text content
     - Prompt type classification
     - Analysis scores (if available)
     - Detected stage
     - Debugging loop flag
     - Timestamp

3. **Thread Contains Assistant Responses**
   - [x] **Given** a conversation with assistant responses
   - [x] **When** the thread is returned
   - [x] **Then** each assistant message includes:
     - Response text (decrypted)
     - Thinking summary
     - Tools used list
     - Token usage
     - Stop reason

4. **Messages Are Paired**
   - [x] **Given** a complete conversation
   - [x] **When** the thread is returned
   - [x] **Then** user prompts are linked to their responses
   - [x] **And** the pairing is based on sequence order

5. **Conversation Metadata**
   - [x] **Given** a conversation thread request
   - [x] **When** the response is returned
   - [x] **Then** conversation-level metadata is included:
     - Primary stage
     - Has debugging loop
     - Conversation score
     - Stage breakdown
     - Duration

6. **Authorization**
   - [x] **Given** a user requesting a conversation they don't have access to
   - [x] **When** the request is processed
   - [x] **Then** HTTP 404 is returned (no information leak)

## API Specification

### Request

```
GET /api/conversations/[sessionId]
Authorization: Bearer <session_token> (via cookies)
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Session UUID or Claude Code session_id |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_responses` | boolean | true | Include assistant responses |
| `include_tools` | boolean | true | Include tool execution details |

### Response (Success)

```typescript
// HTTP 200
interface ConversationThreadResponse {
  data: {
    conversation: ConversationDetail;
    messages: ThreadedMessage[];
  };
}

interface ConversationDetail {
  id: string;                    // Session UUID
  sessionId: string;             // Claude Code session_id
  slug: string;
  projectId: string | null;
  projectName: string | null;
  userId: string;
  userName?: string;
  startedAt: string;
  endedAt: string | null;
  duration: number;              // Minutes
  userMessageCount: number;
  totalMessages: number;
  primaryStage: ProjectStage | null;
  hasDebuggingLoop: boolean;
  conversationScore: number | null;
  stageBreakdown: StageBreakdown | null;
  gitBranch: string | null;
  cwd: string | null;
  claudeCodeVersion: string | null;
}

interface ThreadedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sequenceNumber: number;

  // User message fields (role === 'user')
  promptType?: PromptType;
  score?: number;
  detectedStage?: ProjectStage;
  isInDebuggingLoop?: boolean;
  analysis?: PromptAnalysis;

  // Assistant message fields (role === 'assistant')
  thinkingSummary?: string;
  thinkingWordCount?: number;
  toolCount?: number;
  toolsUsed?: string[];
  toolExecutions?: ToolExecution[];
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  stopReason?: string;
}

interface PromptAnalysis {
  overallScore: number;
  dimensions: {
    clarity: number;
    context: number;
    specificity: number;
    actionability: number;
    efficiency: number;
  };
  feedback?: string;
}

interface ToolExecution {
  id: string;
  toolName: string;
  toolId?: string;
  inputSummary: string;
  outputSummary?: string;
  success?: boolean;
  executionOrder: number;
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

// HTTP 404 - Not found (or no access)
{
  error: {
    code: 'NOT_FOUND',
    message: 'Conversation not found'
  }
}
```

## Technical Notes

### SECURITY: Input Validation

**CRITICAL**: The sessionId parameter must be validated before use in database queries. The `.or()` clause with string interpolation could be vulnerable to SQL injection if not properly validated.

**Solution**: Before querying, validate that sessionId is either:
1. A valid UUID format (for database `id` lookup), OR
2. A valid Claude Code session ID format (alphanumeric string for `session_id` lookup)

```typescript
import { isValidUuid } from '@/lib/utils/uuid';

// Validate sessionId before use
const isUuid = isValidUuid(sessionId);
const isValidSessionId = /^[a-zA-Z0-9_-]{1,100}$/.test(sessionId);

if (!isUuid && !isValidSessionId) {
  return null; // Invalid format, return not found
}
```

### Prompt-Response Linking Note

Responses may arrive before their corresponding prompts due to the Stop hook firing when Claude finishes responding, while the prompt is captured via the UserPromptSubmit hook. The linking is done via `message_uuid` matching and `sequence_number` ordering, not direct foreign key relationships.

### Database Query Function

```typescript
// lib/conversations/get-conversation-thread.ts
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { isValidUuid } from '@/lib/utils/uuid';

interface ThreadOptions {
  includeResponses?: boolean;
  includeTools?: boolean;
}

interface ThreadResult {
  conversation: ConversationDetail;
  messages: ThreadedMessage[];
}

export async function getConversationThread(
  sessionId: string,
  teamId: string,
  options: ThreadOptions = {}
): Promise<ThreadResult | null> {
  const { includeResponses = true, includeTools = true } = options;
  const supabase = await createClient();

  // SECURITY: Validate sessionId format before use in query
  const isUuid = isValidUuid(sessionId);
  const isValidSessionIdFormat = /^[a-zA-Z0-9_-]{1,100}$/.test(sessionId);

  if (!isUuid && !isValidSessionIdFormat) {
    return null; // Invalid format
  }

  // Get session with team check (RLS)
  // Use parameterized approach: query by specific field based on format
  let sessionQuery = supabase
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
    `)
    .eq('team_id', teamId);

  // Query by appropriate field based on format
  if (isUuid) {
    sessionQuery = sessionQuery.or(`id.eq.${sessionId},session_id.eq.${sessionId}`);
  } else {
    // Not a UUID, only query by session_id field
    sessionQuery = sessionQuery.eq('session_id', sessionId);
  }

  const { data: session, error: sessionError } = await sessionQuery.single();

  if (sessionError || !session) {
    return null;
  }

  // Calculate duration
  const startedAt = new Date(session.started_at);
  const endedAt = session.ended_at ? new Date(session.ended_at) : new Date();
  const duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  // Get prompts with responses
  let promptsQuery = supabase
    .from('prompts')
    .select(`
      id,
      content,
      created_at,
      sequence_number,
      prompt_type,
      detected_stage,
      is_in_debugging_loop,
      prompt_analyses(
        overall_score,
        dimension_scores,
        feedback
      )
      ${includeResponses ? `,
      prompt_responses(
        id,
        response_text_encrypted,
        thinking_summary,
        thinking_word_count,
        tool_count,
        tools_used,
        model,
        tokens_in,
        tokens_out,
        stop_reason
        ${includeTools ? `,
        tool_executions(
          id,
          tool_name,
          tool_id,
          input_summary,
          output_summary,
          success,
          execution_order
        )` : ''}
      )` : ''}
    `)
    .eq('session_uuid', session.id)
    .order('sequence_number', { ascending: true });

  const { data: prompts, error: promptsError } = await promptsQuery;

  if (promptsError) throw promptsError;

  // Build threaded messages array
  const messages: ThreadedMessage[] = [];

  for (const prompt of prompts || []) {
    // Add user message
    messages.push({
      id: prompt.id,
      role: 'user',
      content: prompt.content,
      timestamp: prompt.created_at,
      sequenceNumber: prompt.sequence_number,
      promptType: prompt.prompt_type,
      detectedStage: prompt.detected_stage,
      isInDebuggingLoop: prompt.is_in_debugging_loop,
      score: prompt.prompt_analyses?.[0]?.overall_score,
      analysis: prompt.prompt_analyses?.[0] ? {
        overallScore: prompt.prompt_analyses[0].overall_score,
        dimensions: prompt.prompt_analyses[0].dimension_scores,
        feedback: prompt.prompt_analyses[0].feedback,
      } : undefined,
    });

    // Add assistant message if response exists
    if (includeResponses && prompt.prompt_responses?.[0]) {
      const response = prompt.prompt_responses[0];
      const decryptedText = response.response_text_encrypted
        ? await decrypt(response.response_text_encrypted)
        : '';

      messages.push({
        id: response.id,
        role: 'assistant',
        content: decryptedText,
        timestamp: prompt.created_at, // Use prompt timestamp
        sequenceNumber: prompt.sequence_number + 0.5, // Between prompts
        thinkingSummary: response.thinking_summary,
        thinkingWordCount: response.thinking_word_count,
        toolCount: response.tool_count,
        toolsUsed: response.tools_used,
        toolExecutions: includeTools ? response.tool_executions?.map(te => ({
          id: te.id,
          toolName: te.tool_name,
          toolId: te.tool_id,
          inputSummary: te.input_summary,
          outputSummary: te.output_summary,
          success: te.success,
          executionOrder: te.execution_order,
        })) : undefined,
        model: response.model,
        tokensIn: response.tokens_in,
        tokensOut: response.tokens_out,
        stopReason: response.stop_reason,
      });
    }
  }

  return {
    conversation: {
      id: session.id,
      sessionId: session.session_id,
      slug: session.slug,
      projectId: session.project_id,
      projectName: session.projects?.name ?? null,
      userId: session.user_id,
      userName: session.users?.full_name,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      duration,
      userMessageCount: session.user_message_count ?? 0,
      totalMessages: session.total_prompts ?? 0,
      primaryStage: session.primary_stage,
      hasDebuggingLoop: session.has_debugging_loop ?? false,
      conversationScore: session.conversation_score,
      stageBreakdown: session.stage_breakdown,
      gitBranch: session.git_branch,
      cwd: session.cwd,
      claudeCodeVersion: session.claude_code_version,
    },
    messages,
  };
}
```

### API Route Implementation

```typescript
// app/api/conversations/[sessionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getConversationThread } from '@/lib/conversations/get-conversation-thread';

interface RouteParams {
  params: {
    sessionId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const includeResponses = searchParams.get('include_responses') !== 'false';
    const includeTools = searchParams.get('include_tools') !== 'false';

    // Get conversation thread
    const result = await getConversationThread(
      params.sessionId,
      membership.team_id,
      { includeResponses, includeTools }
    );

    if (!result) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: result,
    });

  } catch (error) {
    console.error('[API] conversations/[sessionId]: error', error);
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
| API Route | `app/api/conversations/[sessionId]/route.ts` |
| Query Function | `lib/conversations/get-conversation-thread.ts` |
| E2E Tests | `e2e/conversation-thread-api.spec.ts` |

## Tasks / Subtasks

- [x] **Task 1: Create conversation thread query function** (AC: #1-4)
  - [x] Create `lib/conversations/get-conversation-thread.ts`
  - [x] **SECURITY**: Validate sessionId format (UUID or alphanumeric) before query
  - [x] Query session with team check
  - [x] Support lookup by UUID or session_id with safe query construction
  - [x] Calculate duration from timestamps
  - [x] Query prompts with responses
  - [x] Decrypt response text via RPC function
  - [x] Build threaded messages array
  - [x] Include tool executions when requested

- [x] **Task 2: Transform data to API format** (AC: #2, #3, #5)
  - [x] Map prompt fields to user message format
  - [x] Map response fields to assistant message format
  - [x] Include analysis data with dimensions
  - [x] Include conversation metadata
  - [x] Handle null/undefined fields gracefully

- [x] **Task 3: Implement API route** (AC: #1, #6)
  - [x] Create `app/api/conversations/[sessionId]/route.ts`
  - [x] Add authentication check
  - [x] Get user's current team
  - [x] Parse query parameters (include_responses, include_tools)
  - [x] Call getConversationThread function
  - [x] Return 404 for not found/no access
  - [x] Handle errors properly

- [x] **Task 4: Write E2E tests** (AC: #1-6)
  - [x] Test: Unauthenticated request returns 401
  - [x] Test: Valid request returns conversation and messages
  - [x] Test: User messages include prompt type and analysis
  - [x] Test: Assistant messages include response text and tools
  - [x] Test: include_responses=false excludes responses
  - [x] Test: include_tools=false excludes tool executions
  - [x] Test: Non-existent conversation returns 404
  - [x] Test: Other team's conversation returns 404
  - [x] Test: SQL injection prevention with malicious inputs

## Dependencies

- **Story 24-2**: Prompts table extensions (prompt_type, detected_stage)
- **Story 24-3**: Prompt responses extensions (thinking_summary, stop_reason)
- **Story 25-1**: Response capture endpoint (populates responses)
- **Existing**: Crypto utilities for decryption

## Design System Requirements

This is a backend-only story. The UI consumption is handled in Story 25-5.

## Testing Checklist

- [x] Unauthenticated request returns 401 UNAUTHORIZED
- [x] User with no team returns 400 NO_TEAM
- [x] Valid UUID returns conversation thread
- [x] Valid session_id returns conversation thread
- [x] Messages are ordered by sequence_number
- [x] User messages include all prompt fields
- [x] User messages include analysis if available
- [x] Assistant messages include decrypted response text
- [x] Assistant messages include thinking summary
- [x] Assistant messages include tools used
- [x] Tool executions are included by default
- [x] include_responses=false excludes assistant messages
- [x] include_tools=false excludes tool executions
- [x] Conversation metadata includes Phase 3 fields
- [x] Duration is calculated correctly
- [x] Non-existent session returns 404
- [x] Other team's session returns 404 (not 403)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Secure Session ID Validation**: Implemented dual validation supporting both UUID format and Claude Code alphanumeric session_id format. Rejects malformed inputs (SQL injection attempts, path traversal, etc.) before any database query.

2. **Typed Query Results**: Created internal TypeScript interfaces (SessionQueryResult, PromptQueryResult, etc.) to properly type Supabase query results and avoid "unknown" type issues.

3. **Response Decryption**: Uses the existing `get_decrypted_response` RPC function to decrypt encrypted response text. Gracefully handles decryption failures by continuing with empty content rather than failing the entire request.

4. **Query Optimization**: Dynamically builds the SELECT clause based on `include_responses` and `include_tools` options to avoid fetching unnecessary data.

5. **Access Control**: Returns 404 for both "not found" AND "no access" scenarios to prevent information leakage about the existence of sessions.

6. **E2E Test Coverage**: Created comprehensive tests covering authentication, authorization, query parameters, SQL injection prevention, and cross-team access denial.

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Initial implementation | Claude Opus 4.5 |

### File List

**Created:**
- `app/lib/conversations/get-conversation-thread.ts` - Query function with types
- `app/app/api/conversations/[sessionId]/route.ts` - API route handler
- `app/e2e/conversation-thread-api.spec.ts` - E2E tests (15 test cases)

**Modified:**
- `_bmad-output/stories/25-3-conversation-thread-endpoint.md` - This story file
