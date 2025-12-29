# Story 25-4: Conversation Context Endpoint

Status: Complete

## Story

**As an** analysis pipeline,
**I want** to retrieve recent conversation context for a session,
**So that** I can analyze prompts with awareness of the full conversation history.

## Acceptance Criteria

1. **Endpoint Available**
   - [x] **Given** a valid session ID
   - [x] **When** a GET request is made to `/api/sessions/[id]/context`
   - [x] **Then** the endpoint returns recent conversation messages
   - [x] **And** messages are formatted for LLM consumption

2. **Token Budget Enforcement**
   - [x] **Given** a `token_budget` query parameter
   - [x] **When** building the context
   - [x] **Then** messages are included until the token budget is reached
   - [x] **And** older messages are excluded first

3. **Message Limit**
   - [x] **Given** a `message_limit` query parameter
   - [x] **When** building the context
   - [x] **Then** no more than `message_limit` messages are returned
   - [x] **And** default is 50 messages

4. **Context Includes Recent Response**
   - [x] **Given** a context request
   - [x] **When** the session has responses
   - [x] **Then** the last assistant response is included
   - [x] **And** any options presented in that response are extracted

5. **Context Metadata**
   - [x] **Given** a context response
   - [x] **When** the context is returned
   - [x] **Then** metadata is included:
     - Session stage
     - Debugging loop status
     - Total tokens used
     - Message count
     - Whether context was truncated

6. **API Key Authentication**
   - [x] **Given** this endpoint is called by the analysis pipeline
   - [x] **When** a request is made
   - [x] **Then** API key authentication is accepted
   - [x] **Or** session cookie authentication is accepted

## API Specification

### Request

```
GET /api/sessions/[id]/context
Authorization: Bearer <api_key> OR via session cookie
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Session UUID |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `token_budget` | number | 10000 | Max tokens to include |
| `message_limit` | number | 50 | Max messages to include |
| `prompt_id` | string | - | Include context up to this prompt |

### Response (Success)

```typescript
// HTTP 200
interface ConversationContextResponse {
  data: {
    sessionId: string;
    context: ConversationContext;
  };
}

interface ConversationContext {
  messages: ContextMessage[];
  lastResponse?: LastResponseSummary;
  metadata: ContextMetadata;
}

interface ContextMessage {
  role: 'user' | 'assistant';
  content: string;
  promptType?: PromptType;
  tokenCount: number;
  truncated: boolean;
}

interface LastResponseSummary {
  content: string;
  thinkingSummary?: string;
  toolsUsed: string[];
  options?: string[];        // Extracted options from response
}

interface ContextMetadata {
  sessionStage: ProjectStage | null;
  hasDebuggingLoop: boolean;
  messageIndex: number;      // Position in conversation
  totalTokens: number;       // Actual tokens included
  messageCount: number;      // Messages included
  truncated: boolean;        // Whether context was cut
  tokenBudget: number;       // Requested budget
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

// HTTP 404 - Not found
{
  error: {
    code: 'NOT_FOUND',
    message: 'Session not found'
  }
}
```

## Technical Notes

### Token Estimation

```typescript
// lib/utils/token-estimation.ts

/**
 * Estimate token count for text.
 * Uses simple heuristic: ~4 characters per token for English text.
 * This is conservative and works well for context budgeting.
 */
export function estimateTokens(text: string): number {
  // More accurate: count words and multiply by 1.3
  // Words are roughly 1.3 tokens on average
  const words = text.split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

/**
 * Truncate text to fit within token budget.
 * Returns truncated text and whether truncation occurred.
 */
export function truncateToTokens(
  text: string,
  maxTokens: number
): { text: string; truncated: boolean } {
  const tokens = estimateTokens(text);
  if (tokens <= maxTokens) {
    return { text, truncated: false };
  }

  // Estimate characters to keep
  const charLimit = Math.floor(maxTokens * 4);
  const truncated = text.substring(0, charLimit);

  // Try to end at sentence boundary
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > charLimit * 0.7) {
    return { text: truncated.substring(0, lastPeriod + 1), truncated: true };
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return { text: truncated.substring(0, lastSpace) + '...', truncated: true };
}
```

### Option Extraction

```typescript
// lib/analysis/option-extraction.ts

/**
 * Extract options from Claude's response.
 * Looks for numbered lists, bullet points, or "Option A/B/C" patterns.
 */
export function extractOptions(responseText: string): string[] {
  const options: string[] = [];

  // Pattern 1: Numbered options (1. Option text)
  const numberedPattern = /^\s*(\d+)\.\s*(.+)$/gm;
  let match;
  while ((match = numberedPattern.exec(responseText)) !== null) {
    options.push(match[2].trim());
  }

  if (options.length > 0) return options;

  // Pattern 2: Lettered options (A. Option or Option A:)
  const letteredPattern = /(?:^|\n)\s*(?:Option\s+)?([A-Z])[\.:]\s*(.+)/gi;
  while ((match = letteredPattern.exec(responseText)) !== null) {
    options.push(match[2].trim());
  }

  if (options.length > 0) return options;

  // Pattern 3: Bullet points (- or * at start of line)
  const bulletPattern = /^\s*[-*]\s+(.+)$/gm;
  while ((match = bulletPattern.exec(responseText)) !== null) {
    // Only include if it looks like an option (short and actionable)
    const text = match[1].trim();
    if (text.length < 100 && !text.endsWith(':')) {
      options.push(text);
    }
  }

  return options.slice(0, 10); // Max 10 options
}
```

### Context Building Function

**Context Ordering Strategy:**

The context building algorithm works as follows:
1. **Query Phase**: Fetch messages ordered by `sequence_number DESC` (newest first) with a limit
2. **Selection Phase**: This gives us the N most recent messages
3. **Processing Phase**: Reverse the array to process from oldest to newest
4. **Truncation Phase**: When token budget is exceeded, we stop adding messages - this excludes the OLDEST messages first (the ones at the beginning of the reversed array that we haven't processed yet)
5. **Output Phase**: Messages are returned in chronological order (oldest to newest) for LLM consumption

**Why this approach?** We want to preserve the MOST RECENT context for the LLM while truncating older messages when we hit the token budget. The query `DESC` + reverse ensures we always have the newest messages, and the forward iteration with budget check means older messages get dropped first.

```typescript
// lib/conversations/build-context.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { estimateTokens, truncateToTokens } from '@/lib/utils/token-estimation';
import { extractOptions } from '@/lib/analysis/option-extraction';

interface ContextOptions {
  tokenBudget?: number;
  messageLimit?: number;
  promptId?: string;
}

interface ContextResult {
  messages: ContextMessage[];
  lastResponse?: LastResponseSummary;
  metadata: ContextMetadata;
}

export async function buildConversationContext(
  sessionId: string,
  options: ContextOptions = {}
): Promise<ContextResult | null> {
  const {
    tokenBudget = 10000,
    messageLimit = 50,
    promptId,
  } = options;

  const supabase = createAdminClient();

  // Get session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, primary_stage, has_debugging_loop')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return null;
  }

  // Get prompts up to promptId if specified
  // Query DESC to get the NEWEST messages first, then reverse for chronological processing
  let promptsQuery = supabase
    .from('prompts')
    .select(`
      id,
      content,
      sequence_number,
      prompt_type,
      prompt_responses(
        response_text_encrypted,
        thinking_summary,
        tools_used
      )
    `)
    .eq('session_uuid', sessionId)
    .order('sequence_number', { ascending: false })
    .limit(messageLimit);

  if (promptId) {
    // Get sequence number of target prompt
    const { data: targetPrompt } = await supabase
      .from('prompts')
      .select('sequence_number')
      .eq('id', promptId)
      .single();

    if (targetPrompt) {
      promptsQuery = promptsQuery.lt('sequence_number', targetPrompt.sequence_number);
    }
  }

  const { data: prompts, error: promptsError } = await promptsQuery;
  if (promptsError) throw promptsError;

  // Build context with token budget
  const messages: ContextMessage[] = [];
  let totalTokens = 0;
  let truncated = false;
  let lastResponse: LastResponseSummary | undefined;

  // Reverse to chronological order (oldest first) for processing
  // We selected newest first (DESC), now reverse so we iterate oldest->newest
  // When we hit token budget, we stop - meaning OLDEST messages are kept,
  // and we're missing the NEWEST ones... wait, that's backwards!
  //
  // CORRECT APPROACH: We actually want to KEEP newest and DROP oldest.
  // So we should iterate from NEWEST to OLDEST, and stop when budget exceeded.
  // Then reverse the result for chronological output to LLM.

  const promptsNewestFirst = prompts || [];
  const tempMessages: ContextMessage[] = [];

  for (const prompt of promptsNewestFirst) {
    // Check token budget BEFORE adding
    const promptTokens = estimateTokens(prompt.content);
    if (totalTokens + promptTokens > tokenBudget) {
      truncated = true;
      break; // Stop - older messages (earlier in this loop) are dropped
    }

    // Add user message to temp array (will reverse later for chronological order)
    tempMessages.push({
      role: 'user',
      content: prompt.content,
      promptType: prompt.prompt_type,
      tokenCount: promptTokens,
      truncated: false,
    });
    totalTokens += promptTokens;

    // Add assistant message if exists
    if (prompt.prompt_responses?.[0]) {
      const response = prompt.prompt_responses[0];
      const decryptedText = response.response_text_encrypted
        ? await decrypt(response.response_text_encrypted)
        : '';

      const responseTokens = estimateTokens(decryptedText);

      if (totalTokens + responseTokens > tokenBudget) {
        // Truncate response to fit
        const remainingBudget = tokenBudget - totalTokens;
        const { text, truncated: wasTruncated } = truncateToTokens(decryptedText, remainingBudget);

        tempMessages.push({
          role: 'assistant',
          content: text,
          tokenCount: estimateTokens(text),
          truncated: wasTruncated,
        });
        totalTokens += estimateTokens(text);
        truncated = true;
        break;
      }

      tempMessages.push({
        role: 'assistant',
        content: decryptedText,
        tokenCount: responseTokens,
        truncated: false,
      });
      totalTokens += responseTokens;

      // Track last response (the first one we process since we're going newest-first)
      if (!lastResponse) {
        lastResponse = {
          content: decryptedText.substring(0, 500),
          thinkingSummary: response.thinking_summary,
          toolsUsed: response.tools_used || [],
          options: extractOptions(decryptedText),
        };
      }
    }
  }

  // Reverse to chronological order for LLM consumption (oldest first)
  // We iterated newest->oldest, now flip for oldest->newest output
  const chronologicalMessages = tempMessages.reverse();

  return {
    messages: chronologicalMessages,
    lastResponse,
    metadata: {
      sessionStage: session.primary_stage,
      hasDebuggingLoop: session.has_debugging_loop ?? false,
      messageIndex: promptsNewestFirst.length,
      totalTokens,
      messageCount: chronologicalMessages.length,
      truncated,
      tokenBudget,
    },
  };
}
```

### API Route Implementation

```typescript
// app/api/sessions/[id]/context/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateApiKey } from '@/lib/api/validate-api-key';
import { buildConversationContext } from '@/lib/conversations/build-context';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Try API key auth first (for analysis pipeline)
    const authHeader = request.headers.get('Authorization');
    let isAuthorized = false;
    let teamId: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const keyResult = await validateApiKey(apiKey);
      if (keyResult.valid) {
        isAuthorized = true;
        teamId = keyResult.team_id;
      }
    }

    // Fall back to session auth
    if (!isAuthorized) {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }

      // Get user's team
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

      isAuthorized = true;
      teamId = membership.team_id;
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const tokenBudget = parseInt(searchParams.get('token_budget') || '10000', 10);
    const messageLimit = parseInt(searchParams.get('message_limit') || '50', 10);
    const promptId = searchParams.get('prompt_id') || undefined;

    // Validate parameters
    if (tokenBudget < 100 || tokenBudget > 100000) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'token_budget must be 100-100000' } },
        { status: 400 }
      );
    }

    if (messageLimit < 1 || messageLimit > 200) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'message_limit must be 1-200' } },
        { status: 400 }
      );
    }

    // Build context
    const context = await buildConversationContext(params.id, {
      tokenBudget,
      messageLimit,
      promptId,
    });

    if (!context) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Session not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        sessionId: params.id,
        context,
      },
    });

  } catch (error) {
    console.error('[API] sessions/[id]/context: error', error);
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
| API Route | `app/api/sessions/[id]/context/route.ts` |
| Context Builder | `lib/conversations/build-context.ts` |
| Token Estimation | `lib/utils/token-estimation.ts` |
| Option Extraction | `lib/analysis/option-extraction.ts` |
| Unit Tests | `lib/conversations/__tests__/build-context.test.ts` |
| E2E Tests | `e2e/session-context-api.spec.ts` |

## Tasks / Subtasks

- [x] **Task 1: Create token estimation utilities** (AC: #2)
  - [x] Create `lib/utils/token-estimation.ts`
  - [x] Implement estimateTokens function
  - [x] Implement truncateToTokens function
  - [x] Add unit tests for token estimation

- [x] **Task 2: Create option extraction utility** (AC: #4)
  - [x] Create `lib/analysis/option-extraction.ts`
  - [x] Implement numbered option pattern matching
  - [x] Implement lettered option pattern matching
  - [x] Implement bullet point pattern matching
  - [x] Add unit tests for option extraction

- [x] **Task 3: Create context building function** (AC: #1-5)
  - [x] Create `lib/conversations/build-context.ts`
  - [x] Query session and prompts
  - [x] Build messages array with token tracking
  - [x] Handle token budget truncation
  - [x] Extract last response options
  - [x] Include context metadata

- [x] **Task 4: Implement API route** (AC: #1, #6)
  - [x] Create `app/api/sessions/[id]/context/route.ts`
  - [x] Support API key authentication
  - [x] Support session cookie authentication
  - [x] Parse and validate query parameters
  - [x] Call buildConversationContext function
  - [x] Return 404 for not found

- [x] **Task 5: Write unit tests** (AC: #1-5)
  - [x] Test token estimation accuracy
  - [x] Test token truncation at sentence boundary
  - [x] Test option extraction patterns
  - [x] Test context building with token budget
  - [x] Test message limit enforcement

- [x] **Task 6: Write E2E tests** (AC: #1-6)
  - [x] Test: API key authentication works
  - [x] Test: Session cookie authentication works
  - [x] Test: Returns context for valid session
  - [x] Test: Token budget limits messages
  - [x] Test: Message limit caps results
  - [x] Test: Last response options extracted
  - [x] Test: Metadata includes all fields
  - [x] Test: Non-existent session returns 404

## Dependencies

- **Story 24-2**: Prompts table extensions
- **Story 24-3**: Prompt responses extensions
- **Story 25-1**: Response capture (populates responses)
- **Existing**: Crypto utilities for decryption
- **Existing**: API key validation

## Design System Requirements

This is a backend-only story with no UI components.

## Testing Checklist

- [x] API key authentication returns 200
- [x] Session cookie authentication returns 200
- [x] Missing auth returns 401 UNAUTHORIZED
- [x] Valid session returns context
- [x] Messages are in chronological order
- [x] Token budget limits total tokens
- [x] Message limit caps message count
- [x] Truncated messages are marked
- [x] Last response includes options
- [x] Metadata includes session stage
- [x] Metadata includes loop status
- [x] prompt_id excludes later messages
- [x] Invalid token_budget returns 400
- [x] Invalid message_limit returns 400
- [x] Non-existent session returns 404
- [x] Response text is decrypted

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created token estimation utility (`lib/utils/token-estimation.ts`) with functions:
   - `estimateTokens()` - estimates token count using words * 1.3 heuristic
   - `truncateToTokens()` - truncates text to fit token budget with sentence/word boundary detection
   - `getTokenBudgetUsage()` - calculates percentage of budget used
   - `wouldExceedBudget()` - checks if adding tokens would exceed budget

2. Created option extraction utility (`lib/analysis/option-extraction.ts`) with:
   - `extractOptions()` - extracts numbered, lettered, and bullet point options from text
   - `hasOptions()` - quick check if response contains options
   - Pattern matching for 1. 2. 3., A. B. C., and - bullet formats
   - Maximum 10 options, filters out long paragraphs

3. Created conversation context builder (`lib/conversations/build-context.ts`) with:
   - `buildConversationContext()` - builds context for LLM analysis
   - Token-aware processing that preserves newest messages
   - Decryption of response text via Supabase RPC
   - Metadata including session stage, debugging loop status, truncation info
   - `formatContextForLLM()` - formats context as string for prompts

4. Created API route (`app/api/sessions/[id]/context/route.ts`) with:
   - Dual authentication (API key Bearer token OR session cookie)
   - Parameter validation for token_budget (100-100000) and message_limit (1-200)
   - Access control via team membership verification
   - Error responses for 400, 401, 403, 404, 500 cases

5. Unit tests (65 tests passing):
   - Token estimation tests (27 tests)
   - Option extraction tests (25 tests)
   - Build context tests (13 tests)

6. E2E tests cover:
   - API key authentication
   - Session cookie authentication
   - Parameter validation
   - Access control between teams
   - Context metadata verification

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Initial implementation of Story 25-4 | Claude Opus 4.5 |

### File List

**Created:**
- `app/lib/utils/token-estimation.ts` - Token estimation utilities
- `app/lib/analysis/option-extraction.ts` - Option extraction from responses
- `app/lib/conversations/build-context.ts` - Context builder for LLM analysis
- `app/app/api/sessions/[id]/context/route.ts` - API endpoint
- `app/lib/utils/__tests__/token-estimation.test.ts` - Unit tests
- `app/lib/analysis/__tests__/option-extraction.test.ts` - Unit tests
- `app/lib/conversations/__tests__/build-context.test.ts` - Unit tests
- `app/e2e/session-context-api.spec.ts` - E2E tests

**Modified:**
- `_bmad-output/stories/25-4-conversation-context-endpoint.md` - Updated status to Complete
