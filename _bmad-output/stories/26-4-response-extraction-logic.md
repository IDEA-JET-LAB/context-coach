# Story 26-4: Response Extraction Logic

Status: Completed

## Story

**As a** Contextor system,
**I want** to parse Claude Code transcripts and extract response data,
**So that** responses are stored with full metadata for context-aware analysis.

## Background

The Stop hook (Story 26-1) captures responses by reading transcript files. This story defines the server-side extraction logic that parses the transcript JSONL format and normalizes the data for storage.

While Story 26-1 handles basic extraction in bash, this story provides:
1. TypeScript extraction logic for the backend
2. Validation of extracted data
3. Normalization for storage
4. Error handling for malformed transcripts

## Acceptance Criteria

1. **Text Content Extraction**
   - [x] **Given** an assistant message with text content blocks
   - [x] **When** extracting response text
   - [x] **Then** all text blocks are concatenated with newlines
   - [x] **And** empty text blocks are skipped

2. **Thinking Content Extraction**
   - [x] **Given** an assistant message with thinking blocks
   - [x] **When** extracting thinking content
   - [x] **Then** all thinking blocks are concatenated
   - [x] **And** the original word count is calculated
   - [x] **And** thinking is compressed per Story 26-5

3. **Tool Use Extraction**
   - [x] **Given** an assistant message with tool_use blocks
   - [x] **When** extracting tool data
   - [x] **Then** each tool's name and id are captured
   - [x] **And** tool input is NOT stored (privacy)
   - [x] **And** tools are returned as an array

4. **Metadata Extraction**
   - [x] **Given** a valid assistant message
   - [x] **When** extracting metadata
   - [x] **Then** model, stop_reason, and usage are extracted
   - [x] **And** message UUID is extracted for threading

5. **Cache Statistics**
   - [x] **Given** usage data with cache statistics
   - [x] **When** extracting cache data
   - [x] **Then** cache_creation_input_tokens is captured
   - [x] **And** cache_read_input_tokens is captured

6. **Error Handling**
   - [x] **Given** malformed or incomplete message data
   - [x] **When** extraction fails
   - [x] **Then** appropriate defaults are used
   - [x] **And** the extraction does not throw
   - [x] **And** errors are logged for debugging

## Tasks / Subtasks

- [x] **Task 1: Create extraction module** (AC: #1-6)
  - [x] Create `lib/transcript/extractResponse.ts`
  - [x] Define `AssistantMessage` interface matching Claude format
  - [x] Define `ExtractedResponse` interface for output
  - [x] Export main `extractResponse()` function

- [x] **Task 2: Implement text extraction** (AC: #1)
  - [x] Create `extractTextContent(content: ContentBlock[]): string`
  - [x] Filter for `type === "text"` blocks
  - [x] Concatenate with newline separator
  - [x] Handle empty/missing content gracefully

- [x] **Task 3: Implement thinking extraction** (AC: #2)
  - [x] Create `extractThinkingContent(content: ContentBlock[]): ThinkingResult`
  - [x] Filter for `type === "thinking"` blocks
  - [x] Concatenate thinking text
  - [x] Calculate word count
  - [x] Return structured result

- [x] **Task 4: Implement tool use extraction** (AC: #3)
  - [x] Create `extractToolUses(content: ContentBlock[]): ToolUse[]`
  - [x] Filter for `type === "tool_use"` blocks
  - [x] Extract name and id only (no input)
  - [x] Return array of tool metadata

- [x] **Task 5: Implement metadata extraction** (AC: #4, #5)
  - [x] Create `extractCacheStats(usage: Usage): CacheStats | null`
  - [x] Extract model from `.message.model`
  - [x] Extract stop_reason from `.message.stop_reason`
  - [x] Extract usage from `.message.usage`
  - [x] Extract cache stats from usage

- [x] **Task 6: Implement main extraction function** (AC: #1-6)
  - [x] Combine all extraction functions
  - [x] Add try/catch for robustness
  - [x] Provide defaults for missing fields
  - [x] Log warnings for unexpected formats

- [x] **Task 7: Add validation** (AC: #6)
  - [x] Validate message has required structure
  - [x] Validate content is array
  - [x] Validate usage has token counts
  - [x] Return `null` for invalid messages

- [x] **Task 8: Write unit tests**
  - [x] Test text extraction with multiple blocks
  - [x] Test thinking extraction with word count
  - [x] Test tool use extraction
  - [x] Test metadata extraction
  - [x] Test cache statistics extraction
  - [x] Test error handling for malformed data
  - [x] Test with real Claude transcript examples

## Dev Notes

### Extraction Architecture: Server-Side Role

**This TypeScript extraction serves as a server-side validation layer.** It complements the bash extraction in Story 26-1, which runs client-side in the Stop hook.

**Server-side responsibilities:**
1. **Re-extract from raw_message:** If the client sends the raw assistant message (instead of pre-extracted fields), the server can extract data itself
2. **Validate pre-extracted data:** Verify that data sent from the bash hook is well-formed and complete
3. **Consistent extraction logic:** Provide a single source of truth for extraction that can be used by:
   - Response capture endpoint
   - Batch import processing
   - Historical transcript analysis
   - Testing and debugging

**Why dual-layer extraction?**
- **Bash (client):** Fast, non-blocking, runs in user's environment
- **TypeScript (server):** Robust, testable, handles edge cases with proper error handling

The API endpoint can accept either:
- Pre-extracted fields (from bash hook) - faster, less bandwidth
- Raw message (raw_message field) - server extracts, more reliable

### Claude Transcript Format

Each line in a Claude Code transcript is a JSON object. Assistant messages have this structure:

```json
{
  "uuid": "msg_01ABCdef...",
  "type": "assistant",
  "message": {
    "id": "msg_01ABCdef...",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "content": [
      {
        "type": "thinking",
        "thinking": "Let me analyze this code...\n\nFirst, I'll check..."
      },
      {
        "type": "text",
        "text": "I've analyzed the code and found..."
      },
      {
        "type": "tool_use",
        "id": "toolu_01XYZ...",
        "name": "Read",
        "input": {
          "file_path": "/path/to/file.ts"
        }
      }
    ],
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 500
    }
  },
  "timestamp": "2025-12-25T10:30:00Z"
}
```

### TypeScript Interfaces

```typescript
// lib/transcript/extractResponse.ts

interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface AssistantMessage {
  uuid: string;
  type: 'assistant';
  message: {
    id: string;
    model: string;
    content: ContentBlock[];
    stop_reason: string;
    usage: Usage;
  };
  timestamp: string;
}

interface ToolUse {
  name: string;
  id: string;
}

interface ThinkingResult {
  summary: string;        // Compressed (per Story 26-5)
  wordCount: number;      // Original word count
  fullText: string;       // Full thinking text
}

interface CacheStats {
  creation: number;
  read: number;
}

interface ExtractedResponse {
  messageUuid: string;
  responseText: string;
  thinking: ThinkingResult | null;
  toolsUsed: ToolUse[];
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  cacheStats: CacheStats | null;
  stopReason: string;
  timestamp: string;
}
```

### Implementation

```typescript
// lib/transcript/extractResponse.ts

import { compressThinking } from './thinkingCompressor';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('TRANSCRIPT');

/**
 * Extract text content from message content blocks
 */
function extractTextContent(content: ContentBlock[]): string {
  const textBlocks = content
    .filter((block): block is ContentBlock & { type: 'text'; text: string } =>
      block.type === 'text' && typeof block.text === 'string'
    )
    .map(block => block.text);

  return textBlocks.join('\n');
}

/**
 * Extract thinking content from message content blocks
 */
function extractThinkingContent(content: ContentBlock[]): ThinkingResult | null {
  const thinkingBlocks = content
    .filter((block): block is ContentBlock & { type: 'thinking'; thinking: string } =>
      block.type === 'thinking' && typeof block.thinking === 'string'
    )
    .map(block => block.thinking);

  if (thinkingBlocks.length === 0) {
    return null;
  }

  const fullText = thinkingBlocks.join('\n');
  const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;
  const { summary } = compressThinking(fullText);

  return {
    summary,
    wordCount,
    fullText,
  };
}

/**
 * Extract tool uses from message content blocks
 * Note: We intentionally do NOT capture tool input for privacy
 */
function extractToolUses(content: ContentBlock[]): ToolUse[] {
  return content
    .filter((block): block is ContentBlock & { type: 'tool_use'; name: string; id: string } =>
      block.type === 'tool_use' &&
      typeof block.name === 'string' &&
      typeof block.id === 'string'
    )
    .map(block => ({
      name: block.name,
      id: block.id,
    }));
}

/**
 * Extract cache statistics from usage data
 */
function extractCacheStats(usage: Usage): CacheStats | null {
  if (
    typeof usage.cache_creation_input_tokens !== 'number' &&
    typeof usage.cache_read_input_tokens !== 'number'
  ) {
    return null;
  }

  return {
    creation: usage.cache_creation_input_tokens ?? 0,
    read: usage.cache_read_input_tokens ?? 0,
  };
}

/**
 * Main extraction function - parses assistant message and extracts all data
 */
export function extractResponse(message: unknown): ExtractedResponse | null {
  try {
    // Type guard for basic structure
    if (!isAssistantMessage(message)) {
      logger.warn('Invalid assistant message structure');
      return null;
    }

    const { uuid, message: msg, timestamp } = message;
    const { model, content, stop_reason, usage } = msg;

    // Validate content is array
    if (!Array.isArray(content)) {
      logger.warn('Message content is not an array');
      return null;
    }

    return {
      messageUuid: uuid,
      responseText: extractTextContent(content),
      thinking: extractThinkingContent(content),
      toolsUsed: extractToolUses(content),
      model: model ?? 'unknown',
      usage: {
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
      },
      cacheStats: usage ? extractCacheStats(usage) : null,
      stopReason: stop_reason ?? 'unknown',
      timestamp: timestamp ?? new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Response extraction failed', error);
    return null;
  }
}

/**
 * Type guard to validate assistant message structure
 */
function isAssistantMessage(value: unknown): value is AssistantMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    obj.type === 'assistant' &&
    typeof obj.uuid === 'string' &&
    typeof obj.message === 'object' &&
    obj.message !== null
  );
}
```

### Usage in Response Capture Endpoint

```typescript
// app/api/responses/capture/route.ts

import { extractResponse } from '@/lib/transcript/extractResponse';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // If raw message is provided, extract it
  if (body.raw_message) {
    const extracted = extractResponse(body.raw_message);
    if (!extracted) {
      return NextResponse.json(
        { error: { code: 'EXTRACTION_FAILED', message: 'Failed to extract response' } },
        { status: 400 }
      );
    }
    // Use extracted data
    body.message_uuid = extracted.messageUuid;
    body.response_text = extracted.responseText;
    // ... etc
  }

  // Continue with storage
}
```

### Test Fixtures

```typescript
// __tests__/fixtures/assistantMessage.ts

export const validAssistantMessage = {
  uuid: "msg_01test123",
  type: "assistant",
  message: {
    id: "msg_01test123",
    model: "claude-sonnet-4-20250514",
    content: [
      { type: "thinking", thinking: "Let me analyze this..." },
      { type: "text", text: "Here is the solution." },
      { type: "tool_use", id: "toolu_01abc", name: "Read", input: { file_path: "/test.ts" } }
    ],
    stop_reason: "end_turn",
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 25
    }
  },
  timestamp: "2025-12-25T10:00:00Z"
};

export const messageWithoutThinking = {
  ...validAssistantMessage,
  message: {
    ...validAssistantMessage.message,
    content: [
      { type: "text", text: "Simple response without thinking." }
    ]
  }
};

export const malformedMessage = {
  type: "assistant",
  // Missing uuid, message, etc.
};
```

### Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Valid message with all blocks | All data extracted correctly |
| Message without thinking | thinking is null |
| Message without tools | toolsUsed is empty array |
| Message with multiple text blocks | Text concatenated with newlines |
| Message missing uuid | Returns null |
| Message with invalid content | Returns null |
| Message missing usage | Defaults to 0 tokens |
| Null/undefined input | Returns null |

### Verification Checklist

- [x] `extractTextContent` concatenates text blocks
- [x] `extractThinkingContent` returns word count
- [x] `extractToolUses` excludes tool input
- [x] `extractCacheStats` handles missing cache data
- [x] `extractResponse` validates message structure
- [x] `extractResponse` returns null for invalid input
- [x] `isRawAssistantMessage` type guard works
- [x] Logging captures extraction errors
- [x] Unit tests cover all content block types
- [x] Integration test with real transcript data

### Dependencies

- Story 26-5: `compressThinking()` function for thinking summary
- Existing transcript parsing from Epic 15

### Security Notes

1. **Tool Input Privacy**: We intentionally do NOT store tool input, which may contain file contents, paths, or other sensitive data.
2. **Thinking Content**: Extended thinking may contain reasoning about code/architecture. Compressed summaries reduce storage of potentially sensitive analysis.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created `extractResponse.ts` module with comprehensive TypeScript extraction logic
2. Implemented all required extraction functions:
   - `extractTextContent()` - Concatenates text blocks, skips empty ones
   - `extractThinkingContent()` - Uses `compressThinking()` from thinkingCompressor.ts
   - `extractToolUses()` - Extracts name and id only (no input for privacy)
   - `extractCacheStats()` - Handles missing cache fields gracefully
3. Implemented `isRawAssistantMessage()` type guard for message validation
4. Added `extractResponse()` main function with robust error handling
5. Added `extractResponses()` batch function for processing multiple messages
6. Integrated with existing thinkingCompressor.ts from Story 26-5
7. Exported all types and functions from transcript index.ts
8. Created comprehensive unit test suite with 70 tests covering:
   - Type guard validation (7 tests)
   - Text extraction (8 tests)
   - Thinking extraction (8 tests)
   - Tool use extraction (10 tests)
   - Cache stats extraction (6 tests)
   - Main extraction function (18 tests)
   - Batch extraction (7 tests)
   - Real-world transcript data (3 tests)
9. All 70 tests pass successfully

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-25 | Story created | PM Agent |
| 2025-12-26 | Story implemented | Claude Opus 4.5 |

### File List

**Created:**
- `app/lib/transcript/extractResponse.ts` - Main extraction module (415 lines)
- `app/lib/transcript/__tests__/extractResponse.test.ts` - Unit tests (70 tests)

**Modified:**
- `app/lib/transcript/index.ts` - Added exports for new module
