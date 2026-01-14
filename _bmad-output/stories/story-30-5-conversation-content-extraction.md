# Story 30-5: Conversation Content Extraction

## Story Info
- **Epic:** 30 - Conversation Analysis
- **Priority:** P1
- **Points:** 3
- **Status:** Done
- **Completed:** 2026-01-10

## Description

Create a service that extracts and formats conversation content for LLM analysis based on user-selected options. The output should be a clean, readable transcript that provides good context for analysis.

## Acceptance Criteria

- [x] Create `lib/analysis/content-extractor.ts`
- [x] Extract user prompts with timestamps and sequence numbers
- [x] Extract AI text responses (excluding raw tool results)
- [x] Extract thinking blocks (optional, when selected)
- [x] Extract tool calls with summarized parameters (optional)
- [x] Format as clean, readable conversation transcript
- [x] Handle missing or malformed data gracefully

## Technical Details

### Types

```typescript
// lib/analysis/content-extractor.ts

export interface ExtractionOptions {
  includePrompts: boolean;      // Default: true
  includeResponses: boolean;    // Default: true
  includeThinking: boolean;     // Default: false
  includeTools: boolean;        // Default: false
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  sequenceNumber: number;
  content: string;
  thinkingText?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface ExtractedContent {
  transcript: string;
  metadata: {
    sessionId: string;
    promptCount: number;
    responseCount: number;
    turnCount: number;
    includedThinking: boolean;
    includedTools: boolean;
    timeRange: {
      start: string;
      end: string;
    };
  };
  rawContent: {
    prompts: string[];
    responses: string[];
    thinking: string[];
    tools: ToolCallSummary[];
  };
}

export interface ToolCallSummary {
  name: string;
  inputSummary: string;
}
```

### Content Hierarchy & Defaults

| Content Type | Default | Notes |
|--------------|---------|-------|
| User prompts | ON | Always core of analysis |
| AI text responses | ON | Essential context |
| Tool calls (summarized) | OFF | Name + brief params only |
| Thinking blocks | OFF | Expensive, rarely needed |

### Main Functions

```typescript
/**
 * Extracts conversation content based on options.
 */
export async function extractConversationContent(
  sessionId: string,
  options: ExtractionOptions
): Promise<ExtractedContent> {
  // Fetch messages from database
  const messages = await fetchConversationMessages(sessionId);

  // Extract raw content
  const rawContent = extractRawContent(messages, options);

  // Format transcript
  const transcript = formatTranscript(messages, options);

  // Build metadata
  const metadata = buildMetadata(sessionId, messages, options);

  return {
    transcript,
    metadata,
    rawContent,
  };
}

/**
 * Extracts raw content arrays for token estimation.
 */
function extractRawContent(
  messages: ConversationMessage[],
  options: ExtractionOptions
): ExtractedContent['rawContent'] {
  const prompts: string[] = [];
  const responses: string[] = [];
  const thinking: string[] = [];
  const tools: ToolCallSummary[] = [];

  for (const msg of messages) {
    if (msg.role === 'user' && options.includePrompts) {
      prompts.push(msg.content);
    }

    if (msg.role === 'assistant') {
      if (options.includeResponses) {
        responses.push(msg.content);
      }

      if (options.includeThinking && msg.thinkingText) {
        thinking.push(msg.thinkingText);
      }

      if (options.includeTools && msg.toolCalls) {
        for (const tool of msg.toolCalls) {
          tools.push(summarizeToolCall(tool));
        }
      }
    }
  }

  return { prompts, responses, thinking, tools };
}
```

### Transcript Formatting

```typescript
/**
 * Formats messages into a readable transcript.
 */
function formatTranscript(
  messages: ConversationMessage[],
  options: ExtractionOptions
): string {
  const lines: string[] = [];
  let turnNumber = 0;

  for (const msg of messages) {
    if (msg.role === 'user' && options.includePrompts) {
      turnNumber++;
      const time = formatTime(msg.timestamp);
      lines.push(`\n[Turn ${turnNumber} - ${time}]`);
      lines.push(`USER: ${msg.content}`);
    }

    if (msg.role === 'assistant') {
      if (options.includeResponses && msg.content) {
        // Truncate very long responses
        const content = truncateText(msg.content, 2000);
        lines.push(`\nASSISTANT: ${content}`);
      }

      if (options.includeThinking && msg.thinkingText) {
        const thinking = truncateText(msg.thinkingText, 500);
        lines.push(`\n[Thinking]: ${thinking}`);
      }

      if (options.includeTools && msg.toolCalls?.length) {
        const toolSummary = msg.toolCalls
          .map(t => t.name)
          .join(', ');
        lines.push(`[Used tools: ${toolSummary}]`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Formats timestamp for display.
 */
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Truncates text with ellipsis.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Summarizes a tool call for inclusion.
 */
function summarizeToolCall(tool: ToolCall): ToolCallSummary {
  let inputSummary = '';

  if (tool.input) {
    // Extract key information based on tool type
    switch (tool.name) {
      case 'Read':
        inputSummary = tool.input.file_path as string || '';
        break;
      case 'Edit':
        inputSummary = tool.input.file_path as string || '';
        break;
      case 'Bash':
        const cmd = tool.input.command as string || '';
        inputSummary = cmd.slice(0, 50);
        break;
      case 'Grep':
        inputSummary = `"${tool.input.pattern}"`;
        break;
      case 'Task':
        inputSummary = tool.input.subagent_type as string || '';
        break;
      default:
        inputSummary = JSON.stringify(tool.input).slice(0, 50);
    }
  }

  return {
    name: tool.name,
    inputSummary: inputSummary.slice(0, 100),
  };
}
```

### Database Query

```typescript
/**
 * Fetches conversation messages from database.
 */
async function fetchConversationMessages(
  sessionId: string
): Promise<ConversationMessage[]> {
  const supabase = createServerClient();

  // Get prompts
  const { data: prompts, error: promptsError } = await supabase
    .from('prompts')
    .select('id, prompt_text, created_at, sequence_number')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true });

  if (promptsError) throw promptsError;

  // Get responses
  const promptIds = prompts.map(p => p.id);
  const { data: responses, error: responsesError } = await supabase
    .from('responses')
    .select('prompt_id, response_text, thinking_text, tool_calls, created_at')
    .in('prompt_id', promptIds);

  if (responsesError) throw responsesError;

  // Map responses by prompt_id
  const responseMap = new Map(responses.map(r => [r.prompt_id, r]));

  // Build messages array
  const messages: ConversationMessage[] = [];

  for (const prompt of prompts) {
    // Add user message
    messages.push({
      id: prompt.id,
      role: 'user',
      timestamp: prompt.created_at,
      sequenceNumber: prompt.sequence_number,
      content: prompt.prompt_text,
    });

    // Add assistant response if exists
    const response = responseMap.get(prompt.id);
    if (response) {
      messages.push({
        id: `${prompt.id}-response`,
        role: 'assistant',
        timestamp: response.created_at,
        sequenceNumber: prompt.sequence_number,
        content: response.response_text || '',
        thinkingText: response.thinking_text,
        toolCalls: response.tool_calls
          ? JSON.parse(response.tool_calls)
          : undefined,
      });
    }
  }

  return messages;
}
```

### Example Output

```
[Turn 1 - 10:23 AM]
USER: Add a dark mode toggle to the settings page. The toggle should persist user preference to localStorage.

ASSISTANT: I'll help you add a dark mode toggle. Let me first examine the current settings page structure to understand how to best integrate this feature.
[Used tools: Read, Grep]

[Turn 2 - 10:25 AM]
USER: Yes, please proceed. Use the existing Button component for the toggle.

ASSISTANT: I've added the dark mode toggle component using the Button component as requested. The implementation includes:

1. A new `useDarkMode` hook that manages the state and localStorage persistence
2. Integration with the Settings page
3. CSS variables for theme colors

The toggle is now functional and will persist across sessions.
[Used tools: Read, Edit, Edit]

[Turn 3 - 10:28 AM]
USER: Looks good! Can you also add a system preference option?

ASSISTANT: I've updated the dark mode implementation to include three options: Light, Dark, and System. The System option uses the `prefers-color-scheme` media query to automatically match the user's OS preference.
[Used tools: Edit, Edit]
```

## Tests

### Unit Tests

```typescript
describe('ContentExtractor', () => {
  describe('extractConversationContent', () => {
    it('should extract prompts when includePrompts is true');
    it('should exclude prompts when includePrompts is false');
    it('should extract responses when includeResponses is true');
    it('should extract thinking when includeThinking is true');
    it('should extract tools when includeTools is true');
    it('should handle empty conversations');
    it('should handle missing responses');
  });

  describe('formatTranscript', () => {
    it('should format with turn numbers');
    it('should include timestamps');
    it('should truncate long content');
    it('should summarize tool usage');
  });

  describe('summarizeToolCall', () => {
    it('should extract file_path for Read tool');
    it('should extract command for Bash tool');
    it('should extract pattern for Grep tool');
    it('should extract subagent_type for Task tool');
    it('should handle unknown tools');
  });
});
```

### Integration Tests

```typescript
describe('Content extraction integration', () => {
  it('should fetch and format real conversation');
  it('should handle conversation with no responses');
  it('should handle very long conversations (100+ turns)');
});
```

## Dependencies

- Story 30-4: Token Estimation Service (uses rawContent for estimation)
- Existing prompts table
- Existing responses table

## Out of Scope

- LLM analysis (Story 30-7)
- UI components (Story 30-6, 30-7)

## Definition of Done

- [ ] Service implemented with TypeScript types
- [ ] All content types extractable
- [ ] Transcript format is clean and readable
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Handles edge cases gracefully
