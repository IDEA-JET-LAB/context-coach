# Story 18.3: Recovery Prompt Generator

Status: Ready

## Story

**As a** developer resuming work after a crash,
**I want** an AI-generated recovery prompt that summarizes my previous context,
**So that** I can seamlessly continue my work without manually explaining what I was doing.

## Acceptance Criteria

1. **Given** a session state snapshot is available
   **When** the recovery prompt is generated
   **Then** it uses AI to summarize the task context from the last 20 messages
   **And** includes what was being worked on, last action, and pending items

2. **Given** the AI summary is generated
   **When** building the recovery prompt
   **Then** the prompt follows a structured format:
   - Context summary (1-2 sentences)
   - Last action taken
   - Pending work or next steps
   - The original last request (truncated to 100 chars)

3. **Given** the Contextor API is unavailable or rate limited
   **When** generating recovery prompt
   **Then** it falls back to a local template-based prompt
   **And** uses extracted metadata (files, tools, last prompt) as context
   **And** the user sees the recovery prompt without AI enhancement

4. **Given** the session snapshot has minimal data (e.g., only 1-2 messages)
   **When** generating a recovery prompt
   **Then** a simplified prompt is generated without AI summarization
   **And** the user can still resume with basic context

5. **Given** the AI returns an invalid or unusable response
   **When** validating the generated prompt
   **Then** the system falls back to template-based generation
   **And** the error is logged for monitoring

6. **Given** a recovery prompt is generated
   **When** displayed to user
   **Then** it is under 500 characters for easy clipboard copy
   **And** is formatted for direct paste into Claude Code

7. **Given** multiple interrupted sessions exist
   **When** generating recovery prompts
   **Then** each session gets its own distinct prompt
   **And** prompts are cached to avoid redundant API calls

## Tasks / Subtasks

- [ ] **Task 1: Define recovery prompt interface and API contract** (AC: #1, #2)
  - [ ] Create `packages/vscode-extension/src/types/recovery.ts`
  - [ ] Define `RecoveryPrompt` interface with fields: sessionId, prompt, generatedAt, isAIGenerated
  - [ ] Define API request/response types for Contextor recovery endpoint
  - [ ] Document expected response format from AI summary

- [ ] **Task 2: Implement Contextor API client for recovery** (AC: #1, #3, #5)
  - [ ] Add `getRecoveryContext(sessionId, snapshot)` method to API client
  - [ ] Send recent messages and context to Contextor API
  - [ ] Handle API timeout (5 second limit)
  - [ ] Handle API errors gracefully (return null, don't throw)
  - [ ] Include authentication via API key header
  - [ ] Validate AI response structure before returning
  - [ ] Log invalid responses for monitoring

- [ ] **Task 3: Create AI summary endpoint on Contextor API** (AC: #1, #3)
  - [ ] Create `app/app/api/recovery/[sessionId]/route.ts`
  - [ ] Accept POST with session messages and context
  - [ ] Call OpenAI/Claude to generate task summary
  - [ ] Use structured prompt to extract: task, lastAction, pending
  - [ ] Return formatted summary object
  - [ ] Rate limit: 10 requests per minute per user
  - [ ] Return 429 with retry-after header when rate limited

- [ ] **Task 4: Build recovery prompt formatter** (AC: #2, #6)
  - [ ] Create `formatRecoveryPrompt(summary, snapshot)` function
  - [ ] Follow template:
    ```
    Continue from where we left off. Here's the context:

    - We were working on: {summary.task}
    - Last action: {summary.lastAction}
    - Pending: {summary.pending}
    - My last request was: "{lastPrompt.slice(0, 100)}..."

    Please continue.
    ```
  - [ ] Ensure total length is under 500 characters
  - [ ] Truncate fields as needed while preserving meaning
  - [ ] Handle missing fields with sensible defaults

- [ ] **Task 5: Implement local fallback template** (AC: #3, #4, #5)
  - [ ] Create `generateLocalRecoveryPrompt(snapshot)` function
  - [ ] Build prompt from extracted metadata only (no AI):
    ```
    Resume my previous session. Context:

    - Last working on: {firstUserMessage}
    - Files touched: {filesAffected.slice(0,3).join(', ')}
    - Last tool used: {lastToolUsed}
    - Last request: "{lastPrompt.slice(0, 100)}..."

    Continue where we left off.
    ```
  - [ ] Used when API unavailable, rate limited, or AI returns invalid response
  - [ ] Mark `isAIGenerated: false` in response
  - [ ] Handle minimal snapshot scenario (1-2 messages) with simplified prompt

- [ ] **Task 6: Implement caching for generated prompts** (AC: #7)
  - [ ] Store generated prompts in VS Code extension state
  - [ ] Key by sessionId + snapshot hash (to detect changes)
  - [ ] Cache expiry: 1 hour (force regeneration for stale data)
  - [ ] Clear cache when user modifies session manually
  - [ ] Implement `getCachedPrompt(sessionId)` and `cachePrompt(sessionId, prompt)`

- [ ] **Task 7: Create main recovery prompt generator service** (AC: #1-7)
  - [ ] Create `packages/vscode-extension/src/services/recoveryPromptGenerator.ts`
  - [ ] Implement `generateRecoveryPrompt(snapshot)` main function
  - [ ] Check cache first, return if valid
  - [ ] Check message count - skip AI for minimal snapshots (< 3 messages)
  - [ ] Try AI generation via API
  - [ ] Validate AI response before using
  - [ ] Fall back to local template on failure or invalid response
  - [ ] Cache and return result
  - [ ] Export singleton instance

## Dev Notes

### Architecture Reference

From `architecture-phase2.md` (Lines 957-984):

```typescript
export async function generateRecoveryPrompt(session: InterruptedSession): Promise<string> {
  // Use AI to summarize context
  const messages = await parseTranscript(session.sessionPath);
  const recentMessages = messages.slice(-20); // Last 20 messages

  const summary = await callContextorAI({
    task: 'summarize_session',
    messages: recentMessages.map(m => ({
      type: m.type,
      content: m.type === 'user'
        ? (typeof m.message?.content === 'string' ? m.message.content : '[tool result]')
        : extractAssistantText(m)
    }))
  });

  return `Continue from where we left off. Here's the context:

- We were working on: ${summary.task}
- Last action: ${summary.lastAction}
- Pending: ${summary.pending}
- My last request was: "${session.lastPrompt.slice(0, 100)}..."

Please continue.`;
}
```

### Recovery API Endpoint

```typescript
// app/app/api/recovery/[sessionId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { OpenAI } from 'openai';

const openai = new OpenAI();

interface RecoveryRequest {
  messages: Array<{
    type: string;
    content: string;
  }>;
  filesAffected?: string[];
  lastTool?: string;
}

interface RecoverySummary {
  task: string;
  lastAction: string;
  pending: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  // Validate authentication
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: RecoveryRequest = await request.json();

  // Call AI to summarize session
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Analyze this Claude Code session transcript and provide a brief summary.
          Return JSON with exactly these fields:
          - task: What was the user working on? (1 sentence)
          - lastAction: What was the last completed action? (1 sentence)
          - pending: What was left to do? (1 sentence, or "None" if complete)

          Be concise. Each field should be under 100 characters.`
      },
      {
        role: 'user',
        content: JSON.stringify(body.messages.slice(-20))
      }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 300,
  });

  const summary = JSON.parse(completion.choices[0].message.content!) as RecoverySummary;

  return NextResponse.json({
    sessionId: params.sessionId,
    summary,
    generatedAt: new Date().toISOString()
  });
}
```

### AI Summary Prompt

The system prompt for generating summaries:

```
Analyze this Claude Code session transcript and provide a brief summary.

The transcript contains a sequence of messages between a user and Claude Code.
Message types include: user (prompts), assistant (Claude's responses), tool_use (actions),
and tool_result (action outputs).

Return JSON with exactly these fields:
- task: What was the user working on? (1 sentence, max 100 chars)
- lastAction: What was the last completed action? (1 sentence, max 100 chars)
- pending: What was left to do? (1 sentence, or "None" if work appears complete)

Focus on the most recent context. Be specific about file names and operations when relevant.
```

### Local Fallback Implementation

```typescript
function generateLocalRecoveryPrompt(snapshot: SessionStateSnapshot): string {
  const { conversationContext, filesAffected, toolsUsed } = snapshot;

  const fileList = filesAffected
    .slice(0, 3)
    .map(f => f.path.split('/').pop())
    .join(', ');

  const lastTool = toolsUsed.length > 0
    ? toolsUsed[toolsUsed.length - 1].name
    : 'none';

  const lastPrompt = conversationContext.currentTask.slice(0, 100);

  return `Resume my previous session. Context:

- Last working on: ${conversationContext.initialTask.slice(0, 80)}
- Files touched: ${fileList || 'none'}
- Last tool used: ${lastTool}
- Last request: "${lastPrompt}..."

Continue where we left off.`.trim();
}
```

### Prompt Length Management

Ensure prompts stay under 500 characters:

```typescript
function truncateToLimit(parts: Record<string, string>, limit: number): string {
  const template = `Continue from where we left off. Here's the context:

- We were working on: {task}
- Last action: {lastAction}
- Pending: {pending}
- My last request was: "{lastPrompt}..."

Please continue.`;

  let result = template;
  let currentLength = template.length;

  for (const [key, value] of Object.entries(parts)) {
    const placeholder = `{${key}}`;
    const maxFieldLen = Math.floor((limit - currentLength + placeholder.length) / Object.keys(parts).length);
    const truncated = value.length > maxFieldLen
      ? value.slice(0, maxFieldLen - 3) + '...'
      : value;
    result = result.replace(placeholder, truncated);
  }

  return result;
}
```

### Caching Strategy

```typescript
interface CachedPrompt {
  prompt: string;
  snapshotHash: string;
  generatedAt: Date;
  isAIGenerated: boolean;
}

function computeSnapshotHash(snapshot: SessionStateSnapshot): string {
  // Simple hash of key fields to detect changes
  const key = [
    snapshot.sessionId,
    snapshot.recentMessages.length,
    snapshot.conversationContext.currentTask,
  ].join('|');

  return createHash('md5').update(key).digest('hex').slice(0, 8);
}

async function getCachedPrompt(
  sessionId: string,
  snapshotHash: string
): Promise<CachedPrompt | null> {
  const cached = store.get<CachedPrompt>(`prompt.${sessionId}`);

  if (!cached) return null;
  if (cached.snapshotHash !== snapshotHash) return null;
  if (Date.now() - cached.generatedAt.getTime() > 60 * 60 * 1000) return null;

  return cached;
}
```

### Rate Limiting

The API endpoint should implement rate limiting:
- 10 requests per minute per user
- Use existing Upstash Redis rate limiter
- Return 429 with retry-after header when limited

### Error Handling

1. **API timeout**: Fall back to local after 5 seconds
2. **API error (5xx)**: Fall back to local, log error
3. **Rate limited (429)**: Fall back to local, respect retry-after
4. **Invalid response**: Fall back to local, log malformed response
5. **No snapshot data**: Return minimal "Resume previous session" prompt

### Test Scenarios

1. Valid snapshot with AI available - should return AI-generated prompt
2. Valid snapshot with AI unavailable - should return local fallback
3. Cached prompt available - should return cached without API call
4. Prompt exceeds 500 chars - should truncate properly
5. Empty messages array - should return minimal prompt
6. Minimal snapshot (1-2 messages) - should skip AI and use simplified template
7. Rate limited - should fall back gracefully
8. API returns invalid JSON - should fall back to local and log error
9. AI returns incomplete/malformed response - should fall back to local and log
10. Multiple sessions - should generate distinct prompts

## Dependencies

- **Depends on:** Story 18-1 (Interrupted Session Detection), Story 18-2 (Session State Snapshot)
- **Blocks:** Story 18-4 (Recovery Notification UI), Story 18-5 (One-Click Resume)


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

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
