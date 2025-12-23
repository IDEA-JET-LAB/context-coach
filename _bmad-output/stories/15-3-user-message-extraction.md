# Story 15.3: User Message Extraction

Status: ✅ COMPLETED (2025-12-23)

**Dependencies:** Story 15-2 (JSONL Parser Implementation) - requires `TranscriptMessage` type and parser output

## Story
**As a** Contextor capture system,
**I want** to extract user prompts with their metadata from parsed transcripts,
**So that** I can capture rich context about when, where, and how prompts were submitted.

## Acceptance Criteria
1. **Given** a parsed transcript with user messages
   **When** extracting user prompts
   **Then** only messages with `type: 'user'` and string content are selected
   **And** tool result messages (array content) are excluded

2. **Given** a user message
   **When** extracting metadata
   **Then** `cwd` (current working directory) is captured
   **And** `gitBranch` is captured
   **And** `version` (Claude Code version) is captured
   **And** `slug` (conversation name) is captured

3. **Given** a user prompt
   **When** extracting timing data
   **Then** `timestamp` is parsed to Date object
   **And** `uuid` is preserved for pairing with responses
   **And** `sessionId` is preserved for session grouping

4. **Given** multiple user messages in a session
   **When** extracting prompts
   **Then** they are ordered chronologically
   **And** sequence numbers are assigned (1, 2, 3...)

5. **Given** a user message with very long content
   **When** extracting
   **Then** character count and word count are calculated
   **And** content is preserved without truncation

## Tasks / Subtasks
- [ ] **Task 1: Create extraction module** (AC: #1)
  - [ ] Create `lib/transcript/extract-prompts.ts` file
  - [ ] Define `ExtractedPrompt` interface with all fields
  - [ ] Create filter function for user messages with string content
  - [ ] Exclude messages where `message.content` is array (tool results)

- [ ] **Task 2: Implement metadata extraction** (AC: #2)
  - [ ] Extract `cwd` with validation (must be valid path format)
  - [ ] Extract `gitBranch` (may be null if not in git repo)
  - [ ] Extract `version` string for Claude Code version tracking
  - [ ] Extract `slug` for human-readable session identification
  - [ ] Handle missing fields with explicit null values

- [ ] **Task 3: Implement timing and identification** (AC: #3)
  - [ ] Parse `timestamp` string to JavaScript Date
  - [ ] Validate timestamp is reasonable:
    - Not in the future (beyond current time + 1 minute tolerance for clock drift)
    - Not before 2024-03-01 (Claude Code's approximate release date)
    - Timestamps outside this range should be flagged but still processed
  - [ ] Preserve original `uuid` for response pairing
  - [ ] Preserve `sessionId` for session grouping
  - [ ] Preserve `parentUuid` for conversation threading

- [ ] **Task 4: Implement ordering and sequencing** (AC: #4)
  - [ ] Sort extracted prompts by timestamp ascending
  - [ ] Assign sequence numbers starting from 1
  - [ ] Group by session for per-session sequence numbers
  - [ ] Handle out-of-order timestamps gracefully

- [ ] **Task 5: Implement content analysis** (AC: #5)
  - [ ] Calculate character count for prompt text
  - [ ] Calculate word count (split on whitespace)
  - [ ] Detect if prompt contains code blocks (``` markers)
  - [ ] Detect if prompt is a question (ends with ?)
  - [ ] Calculate reading time estimate

- [ ] **Task 6: Create batch extraction function** (AC: #1-5)
  - [ ] Create `extractPrompts()` that processes entire transcript
  - [ ] Accept `TranscriptMessage[]` as input
  - [ ] Return `ExtractedPrompt[]` with all metadata
  - [ ] Include extraction stats in result

## Dev Notes

### User Message Identification

A user message is identified by:
1. `type === 'user'`
2. `message.role === 'user'`
3. `typeof message.content === 'string'` (not an array)

Messages with array content are **tool results**, not user prompts:
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      { "type": "tool_result", "tool_use_id": "toolu_01", "content": "..." }
    ]
  }
}
```

### Implementation

```typescript
// lib/transcript/extract-prompts.ts
import { TranscriptMessage } from './parser';

export interface ExtractedPrompt {
  /** Original message UUID for pairing */
  uuid: string;
  /** Parent message UUID for threading */
  parentUuid: string | null;
  /** Session identifier */
  sessionId: string;
  /** Prompt timestamp */
  timestamp: Date;
  /** Sequence number within session (1-indexed) */
  sequenceNumber: number;

  /** Prompt text content */
  text: string;
  /** Character count */
  charCount: number;
  /** Word count */
  wordCount: number;
  /** Contains code blocks */
  hasCodeBlocks: boolean;
  /** Is a question (ends with ?) */
  isQuestion: boolean;

  /** Current working directory */
  cwd: string | null;
  /** Git branch name */
  gitBranch: string | null;
  /** Claude Code version */
  claudeCodeVersion: string | null;
  /** Conversation slug/name */
  slug: string | null;
}

export interface ExtractionResult {
  prompts: ExtractedPrompt[];
  stats: {
    totalMessages: number;
    userMessages: number;
    toolResultMessages: number;
    extractedPrompts: number;
    sessionsFound: number;
  };
}

/**
 * Check if a message is a user prompt (not a tool result).
 */
export function isUserPrompt(message: TranscriptMessage): boolean {
  return (
    message.type === 'user' &&
    message.message?.role === 'user' &&
    typeof message.message.content === 'string'
  );
}

/**
 * Check if a message is a tool result.
 */
export function isToolResult(message: TranscriptMessage): boolean {
  return (
    message.type === 'user' &&
    message.message?.role === 'user' &&
    Array.isArray(message.message.content)
  );
}

/**
 * Extract user prompts from parsed transcript messages.
 */
export function extractPrompts(messages: TranscriptMessage[]): ExtractionResult {
  const stats = {
    totalMessages: messages.length,
    userMessages: 0,
    toolResultMessages: 0,
    extractedPrompts: 0,
    sessionsFound: new Set<string>(),
  };

  // Filter to user prompts only
  const userPrompts = messages.filter(msg => {
    if (msg.type === 'user') {
      stats.userMessages++;
      if (isToolResult(msg)) {
        stats.toolResultMessages++;
        return false;
      }
      if (isUserPrompt(msg)) {
        return true;
      }
    }
    return false;
  });

  // Sort by timestamp
  userPrompts.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Track sequence numbers per session
  const sessionSequence = new Map<string, number>();

  const prompts: ExtractedPrompt[] = userPrompts.map(msg => {
    const sessionId = msg.sessionId;
    stats.sessionsFound.add(sessionId);

    // Increment sequence for this session
    const seq = (sessionSequence.get(sessionId) || 0) + 1;
    sessionSequence.set(sessionId, seq);

    const text = msg.message!.content as string;

    return {
      uuid: msg.uuid,
      parentUuid: msg.parentUuid,
      sessionId,
      timestamp: new Date(msg.timestamp),
      sequenceNumber: seq,

      text,
      charCount: text.length,
      wordCount: countWords(text),
      hasCodeBlocks: text.includes('```'),
      isQuestion: text.trim().endsWith('?'),

      cwd: msg.cwd || null,
      gitBranch: msg.gitBranch || null,
      claudeCodeVersion: msg.version || null,
      slug: msg.slug || null,
    };
  });

  stats.extractedPrompts = prompts.length;

  return {
    prompts,
    stats: {
      ...stats,
      sessionsFound: stats.sessionsFound.size,
    },
  };
}

/**
 * Count words in text (split on whitespace).
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Extract prompts from a single session.
 */
export function extractPromptsFromSession(
  messages: TranscriptMessage[],
  sessionId: string
): ExtractedPrompt[] {
  const sessionMessages = messages.filter(m => m.sessionId === sessionId);
  return extractPrompts(sessionMessages).prompts;
}
```

### Example Extraction

**Input Message:**
```json
{
  "parentUuid": null,
  "sessionId": "session-123",
  "type": "user",
  "uuid": "msg-001",
  "timestamp": "2025-12-22T10:30:00.000Z",
  "cwd": "/Users/edgars/project",
  "gitBranch": "feature/auth",
  "version": "2.0.75",
  "slug": "fix-auth-bug",
  "message": {
    "role": "user",
    "content": "Help me fix the authentication bug in the login flow"
  }
}
```

**Output:**
```typescript
{
  uuid: "msg-001",
  parentUuid: null,
  sessionId: "session-123",
  timestamp: new Date("2025-12-22T10:30:00.000Z"),
  sequenceNumber: 1,

  text: "Help me fix the authentication bug in the login flow",
  charCount: 52,
  wordCount: 10,
  hasCodeBlocks: false,
  isQuestion: false,

  cwd: "/Users/edgars/project",
  gitBranch: "feature/auth",
  claudeCodeVersion: "2.0.75",
  slug: "fix-auth-bug",
}
```

### Metadata Field Sources

| Field | Source | Notes |
|-------|--------|-------|
| `cwd` | Message `cwd` | Project root directory |
| `gitBranch` | Message `gitBranch` | Current git branch |
| `claudeCodeVersion` | Message `version` | e.g., "2.0.75" |
| `slug` | Message `slug` | Human-readable session name |
| `timestamp` | Message `timestamp` | ISO format string |
| `sessionId` | Message `sessionId` | Session UUID |

### File Structure

| File | Path |
|------|------|
| Extraction Module | `app/lib/transcript/extract-prompts.ts` |
| Tests | `app/lib/transcript/__tests__/extract-prompts.test.ts` |

### Verification Checklist
- [ ] Only string content messages are extracted (not tool results)
- [ ] All metadata fields are correctly captured
- [ ] Timestamps are parsed to Date objects
- [ ] Prompts are sorted chronologically
- [ ] Sequence numbers are assigned correctly per session
- [ ] Character and word counts are accurate
- [ ] Code block detection works
- [ ] Question detection works
- [ ] Missing optional fields default to null

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
