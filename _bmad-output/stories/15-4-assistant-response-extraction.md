# Story 15.4: Assistant Response Extraction

Status: ✅ COMPLETED (2025-12-23)

## Story
**As a** Contextor capture system,
**I want** to extract Claude's responses with tool usage and thinking blocks,
**So that** I can capture the full context of prompt-response interactions.

## PRD Alignment Note

This story implements PRD 15.4 "Enhanced Analysis with Response Context" at the **extraction phase**:
- **This story** handles extracting and structuring response data (text, tools, thinking, tokens)
- **Enhanced analysis** (using this data for insights) is covered by Epic 21 (Advanced Analytics)
- This extraction is a **prerequisite** for the analysis enhancements in Epic 21

## Dependencies

- **Story 15-2** (JSONL Parser Implementation) - provides `TranscriptMessage` type and parsing
- **Story 15-3** (User Message Extraction) - establishes extraction patterns and interfaces

## Acceptance Criteria
1. **Given** a parsed transcript with assistant messages
   **When** extracting responses
   **Then** only messages with `type: 'assistant'` are selected
   **And** the full response text is extracted from `text` content blocks

2. **Given** an assistant response
   **When** extracting tool usage
   **Then** all `tool_use` blocks are identified
   **And** tool name, input summary, and ID are captured
   **And** tools are listed in order of invocation

3. **Given** an assistant response with thinking
   **When** extracting
   **Then** presence of `thinking` blocks is detected
   **And** thinking content is optionally captured (based on privacy settings)
   **And** thinking signature is preserved for verification

4. **Given** an assistant message
   **When** extracting usage stats
   **Then** `input_tokens` and `output_tokens` are captured
   **And** `cache_read_input_tokens` is captured if present
   **And** model name/version is captured

5. **Given** an assistant response
   **When** extracting metadata
   **Then** `requestId` is preserved for API tracking
   **And** `timestamp` is parsed for response timing
   **And** `parentUuid` links to the triggering user message

6. **Given** an assistant message with empty content array
   **When** extracting response
   **Then** extraction completes without error
   **And** text is set to empty string
   **And** toolsUsed is set to empty array
   **And** hasThinking is set to false

7. **Given** a malformed tool_use block (missing required fields)
   **When** extracting tools
   **Then** the malformed block is skipped
   **And** a warning is logged with the block content
   **And** valid tool blocks in the same message are still extracted

## Tasks / Subtasks
- [ ] **Task 1: Create response extraction module** (AC: #1)
  - [ ] Create `lib/transcript/extract-responses.ts` file
  - [ ] Define `ExtractedResponse` interface with all fields
  - [ ] Define `ToolExecution` interface for tool calls
  - [ ] Create filter function for assistant messages

- [ ] **Task 2: Implement text extraction** (AC: #1)
  - [ ] Filter content blocks to `type: 'text'` only
  - [ ] Concatenate multiple text blocks with newlines
  - [ ] Calculate response character and word count
  - [ ] Preserve original text without modification

- [ ] **Task 3: Implement tool extraction** (AC: #2)
  - [ ] Filter content blocks to `type: 'tool_use'`
  - [ ] Extract tool name from each block
  - [ ] Summarize tool input (truncate large inputs)
  - [ ] Preserve tool ID for matching with results
  - [ ] Maintain tool invocation order

- [ ] **Task 4: Implement thinking extraction** (AC: #3)
  - [ ] Detect presence of `type: 'thinking'` blocks
  - [ ] Set `hasThinking` boolean flag
  - [ ] Optionally extract thinking content (privacy flag)
  - [ ] Preserve signature for verification
  - [ ] Count thinking blocks

- [ ] **Task 5: Implement usage stats extraction** (AC: #4)
  - [ ] Extract `input_tokens` from `message.usage`
  - [ ] Extract `output_tokens` from `message.usage`
  - [ ] Extract `cache_read_input_tokens` if present
  - [ ] Extract `cache_creation_input_tokens` if present
  - [ ] Calculate total tokens

- [ ] **Task 6: Implement metadata extraction** (AC: #5)
  - [ ] Extract `requestId` for API request tracking
  - [ ] Parse `timestamp` to Date object
  - [ ] Preserve `parentUuid` for prompt pairing
  - [ ] Extract `model` name from `message.model`
  - [ ] Extract message `id` from `message.id`

- [ ] **Task 7: Handle empty content array** (AC: #6)
  - [ ] Check for empty or undefined content array
  - [ ] Return empty string for text when no text blocks exist
  - [ ] Return empty array for toolsUsed when no tool blocks exist
  - [ ] Set hasThinking to false when no thinking blocks exist
  - [ ] Add unit test for empty content array case

- [ ] **Task 8: Handle malformed tool_use blocks** (AC: #7)
  - [ ] Validate required fields (id, name, input) on tool_use blocks
  - [ ] Skip blocks missing required fields
  - [ ] Log warning with malformed block details
  - [ ] Continue processing valid blocks in same message
  - [ ] Add unit tests for malformed tool block scenarios

## Dev Notes

### Assistant Message Structure

```json
{
  "parentUuid": "user-msg-uuid",
  "sessionId": "session-123",
  "type": "assistant",
  "uuid": "assistant-msg-uuid",
  "timestamp": "2025-12-22T10:30:05.000Z",
  "requestId": "req_011CPjBLX...",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "id": "msg_01ABC...",
    "role": "assistant",
    "content": [
      { "type": "text", "text": "I'll help you fix the bug..." },
      { "type": "tool_use", "id": "toolu_01", "name": "Read", "input": {"file_path": "/auth.ts"} },
      { "type": "thinking", "thinking": "Analyzing the auth flow...", "signature": "sig..." }
    ],
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_read_input_tokens": 890
    }
  }
}
```

### Implementation

```typescript
// lib/transcript/extract-responses.ts
import { TranscriptMessage, ContentBlock, ToolUseBlock, ThinkingBlock, TokenUsage } from './parser';

export interface ToolExecution {
  /** Tool use ID for matching with results */
  toolId: string;
  /** Tool name (e.g., Read, Write, Edit, Bash) */
  name: string;
  /** Summarized input (truncated for large inputs) */
  inputSummary: string;
  /** Full input object (may be redacted) */
  input: Record<string, unknown>;
  /** Order of invocation (1-indexed) */
  order: number;
}

export interface ExtractedResponse {
  /** Original message UUID */
  uuid: string;
  /** Parent message UUID (links to user prompt) */
  parentUuid: string | null;
  /** Session identifier */
  sessionId: string;
  /** Response timestamp */
  timestamp: Date;
  /** API request ID */
  requestId: string | null;

  /** Response text (concatenated text blocks) */
  text: string;
  /** Character count */
  charCount: number;
  /** Word count */
  wordCount: number;

  /** Model name/version */
  model: string;
  /** API message ID */
  messageId: string | null;

  /** Token usage statistics */
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
    total: number;
  };

  /** Tools used in this response */
  toolsUsed: ToolExecution[];
  /** Number of tools invoked */
  toolCount: number;

  /** Has thinking blocks */
  hasThinking: boolean;
  /** Number of thinking blocks */
  thinkingBlockCount: number;
  /** Thinking content (if privacy allows) */
  thinkingContent: string | null;
}

export interface ResponseExtractionResult {
  responses: ExtractedResponse[];
  stats: {
    totalMessages: number;
    assistantMessages: number;
    extractedResponses: number;
    totalToolCalls: number;
    responsesWithThinking: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
}

/**
 * Check if a message is an assistant response.
 */
export function isAssistantResponse(message: TranscriptMessage): boolean {
  return (
    message.type === 'assistant' &&
    message.message?.role === 'assistant'
  );
}

/**
 * Extract responses from parsed transcript messages.
 */
export function extractResponses(
  messages: TranscriptMessage[],
  options?: { includeThinkingContent?: boolean }
): ResponseExtractionResult {
  const stats = {
    totalMessages: messages.length,
    assistantMessages: 0,
    extractedResponses: 0,
    totalToolCalls: 0,
    responsesWithThinking: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  const assistantMessages = messages.filter(msg => {
    if (isAssistantResponse(msg)) {
      stats.assistantMessages++;
      return true;
    }
    return false;
  });

  const responses: ExtractedResponse[] = assistantMessages.map(msg => {
    const content = msg.message!.content;
    const contentBlocks = Array.isArray(content) ? content as ContentBlock[] : [];
    const usage = msg.message!.usage as TokenUsage | undefined;

    // Extract text
    const textBlocks = contentBlocks.filter(
      (b): b is { type: 'text'; text: string } => b.type === 'text'
    );
    const text = textBlocks.map(b => b.text).join('\n');

    // Extract tools
    const toolBlocks = contentBlocks.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use'
    );
    const toolsUsed: ToolExecution[] = toolBlocks.map((tool, index) => ({
      toolId: tool.id,
      name: tool.name,
      inputSummary: summarizeToolInput(tool.input),
      input: tool.input,
      order: index + 1,
    }));
    stats.totalToolCalls += toolsUsed.length;

    // Extract thinking
    const thinkingBlocks = contentBlocks.filter(
      (b): b is ThinkingBlock => b.type === 'thinking'
    );
    const hasThinking = thinkingBlocks.length > 0;
    if (hasThinking) stats.responsesWithThinking++;

    // Token stats
    const inputTokens = usage?.input_tokens || 0;
    const outputTokens = usage?.output_tokens || 0;
    stats.totalInputTokens += inputTokens;
    stats.totalOutputTokens += outputTokens;

    return {
      uuid: msg.uuid,
      parentUuid: msg.parentUuid,
      sessionId: msg.sessionId,
      timestamp: new Date(msg.timestamp),
      requestId: msg.requestId || null,

      text,
      charCount: text.length,
      wordCount: countWords(text),

      model: msg.message!.model || 'unknown',
      messageId: (msg.message as Record<string, unknown>).id as string || null,

      tokens: {
        input: inputTokens,
        output: outputTokens,
        cacheRead: usage?.cache_read_input_tokens || 0,
        cacheCreation: usage?.cache_creation_input_tokens || 0,
        total: inputTokens + outputTokens,
      },

      toolsUsed,
      toolCount: toolsUsed.length,

      hasThinking,
      thinkingBlockCount: thinkingBlocks.length,
      thinkingContent: options?.includeThinkingContent
        ? thinkingBlocks.map(b => b.thinking).join('\n---\n')
        : null,
    };
  });

  stats.extractedResponses = responses.length;

  return { responses, stats };
}

/**
 * Summarize tool input for display (truncate large inputs).
 */
function summarizeToolInput(input: Record<string, unknown>): string {
  const MAX_LENGTH = 100;

  // Common patterns
  if ('file_path' in input) {
    return `file: ${input.file_path}`;
  }
  if ('command' in input) {
    const cmd = String(input.command);
    return `cmd: ${cmd.slice(0, MAX_LENGTH)}${cmd.length > MAX_LENGTH ? '...' : ''}`;
  }
  if ('pattern' in input) {
    return `pattern: ${input.pattern}`;
  }
  if ('query' in input) {
    return `query: ${input.query}`;
  }
  if ('url' in input) {
    return `url: ${input.url}`;
  }

  // Generic summary
  const json = JSON.stringify(input);
  if (json.length <= MAX_LENGTH) {
    return json;
  }
  return json.slice(0, MAX_LENGTH) + '...';
}

/**
 * Count words in text.
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Get list of unique tool names from responses.
 */
export function getUniqueToolNames(responses: ExtractedResponse[]): string[] {
  const names = new Set<string>();
  for (const response of responses) {
    for (const tool of response.toolsUsed) {
      names.add(tool.name);
    }
  }
  return Array.from(names).sort();
}
```

### Common Tool Names

| Tool Name | Purpose | Input Fields |
|-----------|---------|--------------|
| `Read` | Read file | `file_path` |
| `Write` | Write file | `file_path`, `content` |
| `Edit` | Edit file | `file_path`, `old_string`, `new_string` |
| `Bash` | Run command | `command` |
| `Glob` | Find files | `pattern` |
| `Grep` | Search content | `pattern`, `path` |
| `WebFetch` | Fetch URL | `url` |
| `WebSearch` | Search web | `query` |

### Tool Input Summarization

Large tool inputs (especially file contents) are summarized:

```typescript
// Full input
{ "file_path": "/auth.ts", "content": "... 5000 chars ..." }

// Summarized
"file: /auth.ts"
```

### File Structure

| File | Path |
|------|------|
| Response Extraction | `app/lib/transcript/extract-responses.ts` |
| Tests | `app/lib/transcript/__tests__/extract-responses.test.ts` |

### Verification Checklist
- [ ] Only assistant messages are extracted
- [ ] Text from multiple blocks is concatenated correctly
- [ ] All tool_use blocks are captured with correct order
- [ ] Tool input is summarized appropriately
- [ ] Thinking presence is detected correctly
- [ ] Thinking content is only included when privacy flag is true
- [ ] Token usage stats are extracted correctly
- [ ] Model name and message ID are captured
- [ ] Request ID is preserved
- [ ] Parent UUID links correctly to user message
- [ ] Empty content array is handled gracefully
- [ ] Malformed tool_use blocks are skipped with warning

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
