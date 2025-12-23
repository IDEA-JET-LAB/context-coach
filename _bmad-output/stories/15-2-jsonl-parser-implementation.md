# Story 15.2: JSONL Parser Implementation

Status: ✅ COMPLETED (2025-12-23)

## Dependencies

- **Story 15-1: Transcript File Discovery** - Provides the file paths that this parser will process

## Story
**As a** Contextor capture system,
**I want** to parse Claude Code transcript JSONL files,
**So that** I can extract structured messages from raw transcript data.

## Acceptance Criteria
1. **Given** a valid JSONL transcript file
   **When** the parser processes it
   **Then** it reads each line as a separate JSON object
   **And** handles malformed lines gracefully (skip with warning)

2. **Given** a transcript contains messages
   **When** parsing completes
   **Then** all 8 message types are correctly identified: `user`, `assistant`, `file-history-snapshot`, `summary`, `queue-operation`, `tool_use`, `tool_result`, `thinking`

3. **Given** a large transcript file
   **When** parsing
   **Then** memory usage remains bounded via streaming
   **And** an async generator yields messages one at a time

4. **Given** each parsed message
   **When** extracting fields
   **Then** core fields are present: `uuid`, `parentUuid`, `sessionId`, `timestamp`, `type`
   **And** optional fields are handled: `message`, `cwd`, `gitBranch`, `version`, `slug`

5. **Given** nested content blocks in assistant messages
   **When** parsing `message.content` array
   **Then** correctly identifies `text`, `tool_use`, `tool_result`, and `thinking` blocks

## Tasks / Subtasks
- [ ] **Task 1: Create parser module and types** (AC: #2, #4)
  - [ ] Create `lib/transcript/parser.ts` file
  - [ ] Define `TranscriptMessage` interface with all fields
  - [ ] Define `MessageType` enum for all 8 types
  - [ ] Define `ContentBlock` union type for nested content
  - [ ] Define `TokenUsage` interface for usage stats

- [ ] **Task 2: Implement line-by-line parsing** (AC: #1)
  - [ ] Use Node.js `readline` with `createReadStream`
  - [ ] Parse each line as JSON with try/catch
  - [ ] Log warnings for malformed lines (include line number)
  - [ ] Skip empty lines silently
  - [ ] Track parsing statistics (total lines, parsed, skipped)

- [ ] **Task 3: Implement streaming async generator** (AC: #3)
  - [ ] Create `streamParseTranscript()` async generator function
  - [ ] Yield each message as parsed without buffering all
  - [ ] Allow consumers to break early without processing entire file
  - [ ] Include cleanup on generator close

- [ ] **Task 4: Implement batch parsing** (AC: #1, #4)
  - [ ] Create `parseTranscript()` that returns `Promise<TranscriptMessage[]>`
  - [ ] Use streaming internally but collect results
  - [ ] Add optional limit parameter to stop after N messages
  - [ ] Sort results by timestamp for consistent ordering

- [ ] **Task 5: Implement content block parsing** (AC: #5)
  - [ ] Create `parseContentBlocks()` helper function
  - [ ] Handle `{ type: 'text', text: string }` blocks
  - [ ] Handle `{ type: 'tool_use', id: string, name: string, input: object }` blocks
  - [ ] Handle `{ type: 'tool_result', tool_use_id: string, content: string }` blocks
  - [ ] Handle `{ type: 'thinking', thinking: string, signature: string }` blocks

- [ ] **Task 6: Add validation and normalization** (AC: #4)
  - [ ] Validate `uuid` is present and valid format
  - [ ] Normalize `timestamp` to ISO string format
  - [ ] Handle missing optional fields with defaults
  - [ ] Validate `type` is one of the 8 known types

## Dev Notes

### Redaction Handling

**Note:** The PRD requires "Apply redaction" for transcript data. This story focuses solely on parsing the raw JSONL format. The parsed output from this module feeds into the redaction pipeline implemented in **Epic 14.5 (Privacy & Security)**, specifically Story 14.5-1 (Local Redaction Engine). The parser outputs raw, unredacted data; redaction is applied as a separate processing step before storage.

### JSONL Format Specification

Each line in a `.jsonl` file is a self-contained JSON object representing one message in the conversation.

**Common Message Fields:**
```typescript
interface TranscriptMessage {
  uuid: string;           // Unique message identifier
  parentUuid: string | null;  // Parent message UUID (for threading)
  sessionId: string;      // Session identifier
  timestamp: string;      // ISO timestamp
  type: MessageType;      // One of 8 types

  // Optional fields
  message?: {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
    model?: string;
    id?: string;
    usage?: TokenUsage;
  };
  cwd?: string;           // Current working directory
  gitBranch?: string;     // Git branch name
  version?: string;       // Claude Code version
  slug?: string;          // Human-readable session name
  requestId?: string;     // API request ID (assistant only)
}
```

**Message Types:**
```typescript
type MessageType =
  | 'user'                 // User prompts and tool results
  | 'assistant'            // Claude's responses
  | 'file-history-snapshot' // File state checkpoints
  | 'summary'              // Conversation summary
  | 'queue-operation'      // Background task tracking
  | 'tool_use'             // Tool invocation (nested)
  | 'tool_result'          // Tool output (nested)
  | 'thinking';            // Extended thinking (nested)
```

**Content Block Types:**
```typescript
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[] }
  | { type: 'thinking'; thinking: string; signature: string };
```

### Implementation

```typescript
// lib/transcript/parser.ts
import * as readline from 'readline';
import * as fs from 'fs';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export type MessageType =
  | 'user'
  | 'assistant'
  | 'file-history-snapshot'
  | 'summary'
  | 'queue-operation'
  | 'tool_use'
  | 'tool_result'
  | 'thinking';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

export interface TranscriptMessage {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  type: MessageType;
  message?: {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
    model?: string;
    id?: string;
    usage?: TokenUsage;
  };
  cwd?: string;
  gitBranch?: string;
  version?: string;
  slug?: string;
  requestId?: string;
}

export interface ParseResult {
  messages: TranscriptMessage[];
  stats: {
    totalLines: number;
    parsedLines: number;
    skippedLines: number;
    duration: number;
  };
}

const VALID_TYPES: MessageType[] = [
  'user', 'assistant', 'file-history-snapshot',
  'summary', 'queue-operation', 'tool_use',
  'tool_result', 'thinking'
];

/**
 * Stream-parse a transcript file, yielding messages one at a time.
 * Memory-efficient for large files.
 */
export async function* streamParseTranscript(
  filePath: string
): AsyncGenerator<TranscriptMessage, void, undefined> {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  try {
    for await (const line of rl) {
      lineNumber++;

      if (!line.trim()) {
        continue; // Skip empty lines
      }

      try {
        const parsed = JSON.parse(line);
        const message = validateAndNormalize(parsed, lineNumber);
        if (message) {
          yield message;
        }
      } catch (e) {
        console.warn(`[parser] Skipping malformed JSON at line ${lineNumber}: ${e}`);
      }
    }
  } finally {
    rl.close();
    fileStream.destroy();
  }
}

/**
 * Parse entire transcript file into memory.
 * Use for smaller files or when random access is needed.
 */
export async function parseTranscript(
  filePath: string,
  options?: { limit?: number }
): Promise<ParseResult> {
  const startTime = Date.now();
  const messages: TranscriptMessage[] = [];
  let totalLines = 0;
  let parsedLines = 0;
  let skippedLines = 0;

  for await (const message of streamParseTranscript(filePath)) {
    totalLines++;

    if (message) {
      messages.push(message);
      parsedLines++;

      if (options?.limit && messages.length >= options.limit) {
        break;
      }
    } else {
      skippedLines++;
    }
  }

  // Sort by timestamp for consistent ordering
  messages.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    messages,
    stats: {
      totalLines,
      parsedLines,
      skippedLines,
      duration: Date.now() - startTime,
    },
  };
}

/**
 * Validate and normalize a parsed message.
 * Returns null if message is invalid.
 */
function validateAndNormalize(
  raw: unknown,
  lineNumber: number
): TranscriptMessage | null {
  if (!raw || typeof raw !== 'object') {
    console.warn(`[parser] Line ${lineNumber}: Not an object`);
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Required fields
  if (typeof obj.uuid !== 'string') {
    console.warn(`[parser] Line ${lineNumber}: Missing or invalid uuid`);
    return null;
  }

  if (typeof obj.type !== 'string' || !VALID_TYPES.includes(obj.type as MessageType)) {
    console.warn(`[parser] Line ${lineNumber}: Invalid type '${obj.type}'`);
    return null;
  }

  // Normalize timestamp
  let timestamp = obj.timestamp as string;
  if (!timestamp) {
    timestamp = new Date().toISOString();
  }

  return {
    uuid: obj.uuid as string,
    parentUuid: (obj.parentUuid as string) || null,
    sessionId: (obj.sessionId as string) || '',
    timestamp,
    type: obj.type as MessageType,
    message: obj.message as TranscriptMessage['message'],
    cwd: obj.cwd as string | undefined,
    gitBranch: obj.gitBranch as string | undefined,
    version: obj.version as string | undefined,
    slug: obj.slug as string | undefined,
    requestId: obj.requestId as string | undefined,
  };
}

/**
 * Extract content blocks from assistant message.
 */
export function extractContentBlocks(message: TranscriptMessage): ContentBlock[] {
  if (message.type !== 'assistant' || !message.message?.content) {
    return [];
  }

  if (typeof message.message.content === 'string') {
    return [{ type: 'text', text: message.message.content }];
  }

  return message.message.content as ContentBlock[];
}

/**
 * Extract text content from any message.
 */
export function extractTextContent(message: TranscriptMessage): string {
  if (!message.message?.content) {
    return '';
  }

  if (typeof message.message.content === 'string') {
    return message.message.content;
  }

  return (message.message.content as ContentBlock[])
    .filter((block): block is TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');
}
```

### Example JSONL Messages

**User Message:**
```json
{
  "parentUuid": null,
  "sessionId": "abc-123",
  "type": "user",
  "uuid": "msg-001",
  "timestamp": "2025-12-22T10:30:00.000Z",
  "cwd": "/Users/edgars/project",
  "gitBranch": "main",
  "version": "2.0.75",
  "slug": "fix-auth-bug",
  "message": {
    "role": "user",
    "content": "Help me fix the authentication bug"
  }
}
```

**Assistant Message:**
```json
{
  "parentUuid": "msg-001",
  "sessionId": "abc-123",
  "type": "assistant",
  "uuid": "msg-002",
  "timestamp": "2025-12-22T10:30:05.000Z",
  "requestId": "req_011...",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "id": "msg_01...",
    "role": "assistant",
    "content": [
      { "type": "text", "text": "I'll help you fix the auth bug..." },
      { "type": "tool_use", "id": "toolu_01", "name": "Read", "input": {"file_path": "/auth.ts"} }
    ],
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_read_input_tokens": 890
    }
  }
}
```

### Performance Characteristics

| File Size | Parse Method | Memory Usage | Time |
|-----------|--------------|--------------|------|
| < 1 MB | `parseTranscript()` | Low | < 100ms |
| 1-10 MB | `parseTranscript()` | Moderate | 100-500ms |
| > 10 MB | `streamParseTranscript()` | Low (streaming) | 500ms+ |

### File Structure

| File | Path |
|------|------|
| Parser Module | `app/lib/transcript/parser.ts` |
| Types | `app/lib/transcript/types.ts` |
| Tests | `app/lib/transcript/__tests__/parser.test.ts` |

### Verification Checklist
- [ ] All 8 message types are correctly parsed
- [ ] Malformed JSON lines are skipped with warning
- [ ] Empty lines are silently skipped
- [ ] Streaming generator yields messages one at a time
- [ ] Batch parsing collects all messages
- [ ] Content blocks are correctly extracted from assistant messages
- [ ] Timestamps are normalized to ISO format
- [ ] Parse stats track total/parsed/skipped accurately

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
