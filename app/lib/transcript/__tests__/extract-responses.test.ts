/**
 * Assistant Response Extraction Tests
 * Story 15-4: Assistant Response Extraction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractResponses,
  isAssistantResponse,
  summarizeToolInput,
  getUniqueToolNames,
  type ExtractedResponse,
  type ToolExecution,
} from '../extract-responses';
import type {
  TranscriptMessage,
  ContentBlock,
  ToolUseBlock,
  ThinkingBlock,
  TextBlock,
} from '../parser';

// ============================================================================
// Test Fixtures
// ============================================================================

const createUserMessage = (uuid: string, content: string): TranscriptMessage => ({
  uuid,
  parentUuid: null,
  sessionId: 'test-session',
  timestamp: '2025-12-22T10:30:00.000Z',
  type: 'user',
  message: {
    role: 'user',
    content,
  },
});

const createAssistantMessage = (
  uuid: string,
  parentUuid: string,
  content: string | ContentBlock[],
  options?: {
    model?: string;
    messageId?: string;
    requestId?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  }
): TranscriptMessage => {
  // Build usage object, only including fields that are specified
  const usage = options?.usage ? {
    input_tokens: options.usage.input_tokens ?? 1234,
    output_tokens: options.usage.output_tokens ?? 567,
    // Only include cache tokens if explicitly provided
    ...(options.usage.cache_read_input_tokens !== undefined
      ? { cache_read_input_tokens: options.usage.cache_read_input_tokens }
      : {}),
    ...(options.usage.cache_creation_input_tokens !== undefined
      ? { cache_creation_input_tokens: options.usage.cache_creation_input_tokens }
      : {}),
  } : {
    // Default usage when no options.usage is provided
    input_tokens: 1234,
    output_tokens: 567,
    cache_read_input_tokens: 890,
    cache_creation_input_tokens: 0,
  };

  return {
    uuid,
    parentUuid,
    sessionId: 'test-session',
    timestamp: '2025-12-22T10:30:05.000Z',
    type: 'assistant',
    requestId: options?.requestId ?? 'req_test123',
    message: {
      role: 'assistant',
      model: options?.model ?? 'claude-opus-4-5-20251101',
      id: options?.messageId ?? 'msg_test123',
      content,
      usage,
    },
  };
};

const createToolUseBlock = (
  id: string,
  name: string,
  input: Record<string, unknown>
): ToolUseBlock => ({
  type: 'tool_use',
  id,
  name,
  input,
});

const createTextBlock = (text: string): TextBlock => ({
  type: 'text',
  text,
});

const createThinkingBlock = (thinking: string, signature?: string): ThinkingBlock => ({
  type: 'thinking',
  thinking,
  signature: signature ?? 'sig_test123',
});

// ============================================================================
// Tests: isAssistantResponse
// ============================================================================

describe('isAssistantResponse', () => {
  it('should return true for valid assistant messages', () => {
    const message = createAssistantMessage('msg-001', 'parent-001', 'Hello');
    expect(isAssistantResponse(message)).toBe(true);
  });

  it('should return false for user messages', () => {
    const message = createUserMessage('msg-001', 'Hello');
    expect(isAssistantResponse(message)).toBe(false);
  });

  it('should return false for file-history-snapshot messages', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test-session',
      timestamp: '2025-12-22T10:30:00.000Z',
      type: 'file-history-snapshot',
    };
    expect(isAssistantResponse(message)).toBe(false);
  });

  it('should return false for summary messages', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test-session',
      timestamp: '2025-12-22T10:30:00.000Z',
      type: 'summary',
      message: {
        role: 'assistant',
        content: 'Summary content',
      },
    };
    // Type is 'summary', not 'assistant'
    expect(isAssistantResponse(message)).toBe(false);
  });

  it('should return false for messages without message content', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test-session',
      timestamp: '2025-12-22T10:30:00.000Z',
      type: 'assistant',
    };
    expect(isAssistantResponse(message)).toBe(false);
  });

  it('should return false for messages with wrong role', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test-session',
      timestamp: '2025-12-22T10:30:00.000Z',
      type: 'assistant',
      message: {
        role: 'user', // Wrong role
        content: 'Hello',
      },
    };
    expect(isAssistantResponse(message)).toBe(false);
  });
});

// ============================================================================
// Tests: summarizeToolInput
// ============================================================================

describe('summarizeToolInput', () => {
  it('should summarize file_path inputs (Read tool)', () => {
    const input = { file_path: '/Users/test/project/src/auth.ts' };
    expect(summarizeToolInput(input)).toBe('file: /Users/test/project/src/auth.ts');
  });

  it('should summarize short command inputs (Bash tool)', () => {
    const input = { command: 'npm install' };
    expect(summarizeToolInput(input)).toBe('cmd: npm install');
  });

  it('should truncate long command inputs', () => {
    const longCommand = 'docker build --platform linux/amd64 --build-arg NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co --build-arg VERY_LONG_ARG=value123456789012345678901234567890';
    const input = { command: longCommand };
    const result = summarizeToolInput(input);
    // MAX_SUMMARY_LENGTH is 100, so total output should be <= 100
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith('...')).toBe(true);
    expect(result.startsWith('cmd: ')).toBe(true);
  });

  it('should summarize pattern inputs (Glob tool)', () => {
    const input = { pattern: '**/*.ts' };
    expect(summarizeToolInput(input)).toBe('pattern: **/*.ts');
  });

  it('should summarize query inputs (WebSearch tool)', () => {
    const input = { query: 'react hooks best practices 2025' };
    expect(summarizeToolInput(input)).toBe('query: react hooks best practices 2025');
  });

  it('should summarize url inputs (WebFetch tool)', () => {
    const input = { url: 'https://docs.example.com/api' };
    expect(summarizeToolInput(input)).toBe('url: https://docs.example.com/api');
  });

  it('should summarize Edit tool with file_path', () => {
    const input = {
      file_path: '/src/auth.ts',
      old_string: 'const x = 1',
      new_string: 'const x = 2',
    };
    expect(summarizeToolInput(input)).toBe('edit: /src/auth.ts');
  });

  it('should summarize Edit tool without file_path', () => {
    const input = {
      old_string: 'const x = 1',
      new_string: 'const x = 2',
    };
    expect(summarizeToolInput(input)).toBe('edit operation');
  });

  it('should handle short generic inputs as JSON', () => {
    const input = { key: 'value' };
    expect(summarizeToolInput(input)).toBe('{"key":"value"}');
  });

  it('should truncate long generic inputs', () => {
    const input = {
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
      field4: 'this is a very long value that will push the JSON over 100 characters definitely',
    };
    const result = summarizeToolInput(input);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should handle null input', () => {
    expect(summarizeToolInput(null as unknown as Record<string, unknown>)).toBe('{}');
  });

  it('should handle undefined input', () => {
    expect(summarizeToolInput(undefined as unknown as Record<string, unknown>)).toBe('{}');
  });

  it('should handle empty object', () => {
    expect(summarizeToolInput({})).toBe('{}');
  });
});

// ============================================================================
// Tests: extractResponses - Basic Extraction
// ============================================================================

describe('extractResponses', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('basic extraction', () => {
    it('should extract only assistant messages', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', 'Hello'),
        createAssistantMessage('assistant-001', 'user-001', 'Hi there!'),
        createUserMessage('user-002', 'Thanks'),
        createAssistantMessage('assistant-002', 'user-002', 'You are welcome!'),
      ];

      const result = extractResponses(messages);

      expect(result.responses).toHaveLength(2);
      expect(result.stats.totalMessages).toBe(4);
      expect(result.stats.assistantMessages).toBe(2);
      expect(result.stats.extractedResponses).toBe(2);
    });

    it('should return empty responses for no assistant messages', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', 'Hello'),
        createUserMessage('user-002', 'Hello again'),
      ];

      const result = extractResponses(messages);

      expect(result.responses).toHaveLength(0);
      expect(result.stats.assistantMessages).toBe(0);
    });

    it('should handle empty messages array', () => {
      const result = extractResponses([]);

      expect(result.responses).toHaveLength(0);
      expect(result.stats.totalMessages).toBe(0);
    });
  });

  describe('text extraction', () => {
    it('should extract text from string content', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', 'This is a response.'),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.text).toBe('This is a response.');
      expect(result.responses[0]?.charCount).toBe(19);
      expect(result.responses[0]?.wordCount).toBe(4);
    });

    it('should concatenate multiple text blocks with newlines', () => {
      const content: ContentBlock[] = [
        createTextBlock('First paragraph.'),
        createTextBlock('Second paragraph.'),
        createTextBlock('Third paragraph.'),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.text).toBe(
        'First paragraph.\nSecond paragraph.\nThird paragraph.'
      );
      expect(result.responses[0]?.wordCount).toBe(6);
    });

    it('should extract text when mixed with tool blocks', () => {
      const content: ContentBlock[] = [
        createTextBlock('Let me read that file.'),
        createToolUseBlock('toolu_001', 'Read', { file_path: '/test.ts' }),
        createTextBlock('Here is what I found.'),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.text).toBe(
        'Let me read that file.\nHere is what I found.'
      );
    });
  });

  describe('tool extraction', () => {
    it('should extract single tool_use block', () => {
      const content: ContentBlock[] = [
        createTextBlock('Let me read the file.'),
        createToolUseBlock('toolu_001', 'Read', { file_path: '/auth.ts' }),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.toolsUsed).toHaveLength(1);
      expect(result.responses[0]?.toolCount).toBe(1);
      expect(result.responses[0]?.toolsUsed[0]).toMatchObject({
        toolId: 'toolu_001',
        name: 'Read',
        inputSummary: 'file: /auth.ts',
        order: 1,
      });
    });

    it('should extract multiple tool_use blocks in order', () => {
      const content: ContentBlock[] = [
        createTextBlock('I will help you.'),
        createToolUseBlock('toolu_001', 'Glob', { pattern: '**/*.ts' }),
        createToolUseBlock('toolu_002', 'Read', { file_path: '/auth.ts' }),
        createToolUseBlock('toolu_003', 'Bash', { command: 'npm test' }),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);
      const tools = result.responses[0]?.toolsUsed;

      expect(tools).toHaveLength(3);
      expect(tools?.[0]?.order).toBe(1);
      expect(tools?.[0]?.name).toBe('Glob');
      expect(tools?.[1]?.order).toBe(2);
      expect(tools?.[1]?.name).toBe('Read');
      expect(tools?.[2]?.order).toBe(3);
      expect(tools?.[2]?.name).toBe('Bash');
    });

    it('should preserve full input in toolsUsed', () => {
      const toolInput = { file_path: '/auth.ts', offset: 100, limit: 50 };
      const content: ContentBlock[] = [
        createToolUseBlock('toolu_001', 'Read', toolInput),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.toolsUsed[0]?.input).toEqual(toolInput);
    });

    it('should calculate total tool calls across responses', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', [
          createToolUseBlock('toolu_001', 'Read', { file_path: '/a.ts' }),
          createToolUseBlock('toolu_002', 'Read', { file_path: '/b.ts' }),
        ]),
        createAssistantMessage('assistant-002', 'user-002', [
          createToolUseBlock('toolu_003', 'Bash', { command: 'ls' }),
        ]),
      ];

      const result = extractResponses(messages);

      expect(result.stats.totalToolCalls).toBe(3);
    });
  });

  describe('thinking block detection', () => {
    it('should detect presence of thinking blocks', () => {
      const content: ContentBlock[] = [
        createThinkingBlock('Let me analyze this problem...'),
        createTextBlock('Based on my analysis...'),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.hasThinking).toBe(true);
      expect(result.responses[0]?.thinkingBlockCount).toBe(1);
    });

    it('should not include thinking content by default (privacy)', () => {
      const content: ContentBlock[] = [
        createThinkingBlock('Secret thinking process...'),
        createTextBlock('Here is my response.'),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.thinkingContent).toBeNull();
    });

    it('should include thinking content when option is enabled', () => {
      const content: ContentBlock[] = [
        createThinkingBlock('First thinking block.'),
        createTextBlock('Response text.'),
        createThinkingBlock('Second thinking block.'),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages, { includeThinkingContent: true });

      expect(result.responses[0]?.thinkingContent).toBe(
        'First thinking block.\n---\nSecond thinking block.'
      );
      expect(result.responses[0]?.thinkingBlockCount).toBe(2);
    });

    it('should count responses with thinking in stats', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', [
          createThinkingBlock('Thinking...'),
          createTextBlock('Response 1'),
        ]),
        createAssistantMessage('assistant-002', 'user-002', [
          createTextBlock('Response 2 without thinking'),
        ]),
        createAssistantMessage('assistant-003', 'user-003', [
          createThinkingBlock('More thinking...'),
          createTextBlock('Response 3'),
        ]),
      ];

      const result = extractResponses(messages);

      expect(result.stats.responsesWithThinking).toBe(2);
    });

    it('should set hasThinking false when no thinking blocks', () => {
      const content: ContentBlock[] = [
        createTextBlock('Just text, no thinking.'),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.hasThinking).toBe(false);
      expect(result.responses[0]?.thinkingBlockCount).toBe(0);
      expect(result.responses[0]?.thinkingContent).toBeNull();
    });
  });

  describe('token usage extraction', () => {
    it('should extract all token usage fields', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', 'Response', {
          usage: {
            input_tokens: 1500,
            output_tokens: 800,
            cache_read_input_tokens: 500,
            cache_creation_input_tokens: 200,
          },
        }),
      ];

      const result = extractResponses(messages);
      const tokens = result.responses[0]?.tokens;

      expect(tokens?.input).toBe(1500);
      expect(tokens?.output).toBe(800);
      expect(tokens?.cacheRead).toBe(500);
      expect(tokens?.cacheCreation).toBe(200);
      expect(tokens?.total).toBe(2300); // input + output
    });

    it('should handle missing cache tokens', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', 'Response', {
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
          },
        }),
      ];

      const result = extractResponses(messages);
      const tokens = result.responses[0]?.tokens;

      expect(tokens?.cacheRead).toBe(0);
      expect(tokens?.cacheCreation).toBe(0);
    });

    it('should calculate total tokens in stats', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', 'Response 1', {
          usage: { input_tokens: 1000, output_tokens: 500 },
        }),
        createAssistantMessage('assistant-002', 'user-002', 'Response 2', {
          usage: { input_tokens: 800, output_tokens: 300 },
        }),
      ];

      const result = extractResponses(messages);

      expect(result.stats.totalInputTokens).toBe(1800);
      expect(result.stats.totalOutputTokens).toBe(800);
    });

    it('should handle missing usage object', () => {
      const message: TranscriptMessage = {
        uuid: 'assistant-001',
        parentUuid: 'user-001',
        sessionId: 'test-session',
        timestamp: '2025-12-22T10:30:05.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Response without usage',
        },
      };

      const result = extractResponses([message]);
      const tokens = result.responses[0]?.tokens;

      expect(tokens?.input).toBe(0);
      expect(tokens?.output).toBe(0);
      expect(tokens?.total).toBe(0);
    });
  });

  describe('metadata extraction', () => {
    it('should extract model name', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', 'Response', {
          model: 'claude-sonnet-4-20251101',
        }),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.model).toBe('claude-sonnet-4-20251101');
    });

    it('should handle missing model with default', () => {
      const message: TranscriptMessage = {
        uuid: 'assistant-001',
        parentUuid: 'user-001',
        sessionId: 'test-session',
        timestamp: '2025-12-22T10:30:05.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Response without model',
        },
      };

      const result = extractResponses([message]);

      expect(result.responses[0]?.model).toBe('unknown');
    });

    it('should extract message ID', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', 'Response', {
          messageId: 'msg_01ABC123',
        }),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.messageId).toBe('msg_01ABC123');
    });

    it('should handle missing message ID', () => {
      const message: TranscriptMessage = {
        uuid: 'assistant-001',
        parentUuid: 'user-001',
        sessionId: 'test-session',
        timestamp: '2025-12-22T10:30:05.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Response without ID',
        },
      };

      const result = extractResponses([message]);

      expect(result.responses[0]?.messageId).toBeNull();
    });

    it('should preserve requestId', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', 'Response', {
          requestId: 'req_011CPjBLX123',
        }),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.requestId).toBe('req_011CPjBLX123');
    });

    it('should handle missing requestId', () => {
      const message: TranscriptMessage = {
        uuid: 'assistant-001',
        parentUuid: 'user-001',
        sessionId: 'test-session',
        timestamp: '2025-12-22T10:30:05.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Response',
        },
      };

      const result = extractResponses([message]);

      expect(result.responses[0]?.requestId).toBeNull();
    });

    it('should preserve parentUuid for linking to user prompt', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-msg-uuid-123', 'Response'),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.parentUuid).toBe('user-msg-uuid-123');
    });

    it('should parse timestamp to Date object', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', 'Response'),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.timestamp).toBeInstanceOf(Date);
      expect(result.responses[0]?.timestamp.toISOString()).toBe('2025-12-22T10:30:05.000Z');
    });

    it('should preserve sessionId', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', 'Response'),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.sessionId).toBe('test-session');
    });
  });

  describe('empty content handling', () => {
    it('should handle empty content array gracefully', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', []),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.text).toBe('');
      expect(result.responses[0]?.charCount).toBe(0);
      expect(result.responses[0]?.wordCount).toBe(0);
      expect(result.responses[0]?.toolsUsed).toEqual([]);
      expect(result.responses[0]?.toolCount).toBe(0);
      expect(result.responses[0]?.hasThinking).toBe(false);
    });

    it('should handle undefined content', () => {
      const message: TranscriptMessage = {
        uuid: 'assistant-001',
        parentUuid: 'user-001',
        sessionId: 'test-session',
        timestamp: '2025-12-22T10:30:05.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: undefined as unknown as string,
        },
      };

      const result = extractResponses([message]);

      expect(result.responses[0]?.text).toBe('');
      expect(result.responses[0]?.toolsUsed).toEqual([]);
      expect(result.responses[0]?.hasThinking).toBe(false);
    });

    it('should handle empty string content', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', ''),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.text).toBe('');
      expect(result.responses[0]?.charCount).toBe(0);
      expect(result.responses[0]?.wordCount).toBe(0);
    });
  });

  describe('malformed tool_use block handling', () => {
    it('should skip tool_use block without id', () => {
      const content: ContentBlock[] = [
        { type: 'tool_use', name: 'Read', input: { file_path: '/test.ts' } } as ToolUseBlock,
        createToolUseBlock('toolu_002', 'Bash', { command: 'ls' }),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.toolsUsed).toHaveLength(1);
      expect(result.responses[0]?.toolsUsed[0]?.name).toBe('Bash');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should skip tool_use block without name', () => {
      const content: ContentBlock[] = [
        { type: 'tool_use', id: 'toolu_001', input: { file_path: '/test.ts' } } as ToolUseBlock,
        createToolUseBlock('toolu_002', 'Read', { file_path: '/valid.ts' }),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.toolsUsed).toHaveLength(1);
      expect(result.responses[0]?.toolsUsed[0]?.toolId).toBe('toolu_002');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should skip tool_use block without input', () => {
      const content: ContentBlock[] = [
        { type: 'tool_use', id: 'toolu_001', name: 'Read' } as ToolUseBlock,
        createToolUseBlock('toolu_002', 'Glob', { pattern: '*.ts' }),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.toolsUsed).toHaveLength(1);
      expect(result.responses[0]?.toolsUsed[0]?.name).toBe('Glob');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should skip tool_use block with empty id', () => {
      const content: ContentBlock[] = [
        { type: 'tool_use', id: '', name: 'Read', input: { file_path: '/test.ts' } } as ToolUseBlock,
        createToolUseBlock('toolu_002', 'Write', { file_path: '/out.ts', content: '' }),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.toolsUsed).toHaveLength(1);
      expect(result.responses[0]?.toolsUsed[0]?.name).toBe('Write');
    });

    it('should skip tool_use block with null input', () => {
      const content: ContentBlock[] = [
        { type: 'tool_use', id: 'toolu_001', name: 'Read', input: null } as unknown as ToolUseBlock,
        createToolUseBlock('toolu_002', 'Bash', { command: 'echo test' }),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.toolsUsed).toHaveLength(1);
      expect(result.responses[0]?.toolsUsed[0]?.name).toBe('Bash');
    });

    it('should continue processing valid blocks after malformed ones', () => {
      const content: ContentBlock[] = [
        createTextBlock('Starting...'),
        { type: 'tool_use' } as ToolUseBlock, // Completely malformed
        createToolUseBlock('toolu_001', 'Read', { file_path: '/a.ts' }),
        { type: 'tool_use', id: 'bad' } as ToolUseBlock, // Missing name and input
        createToolUseBlock('toolu_002', 'Read', { file_path: '/b.ts' }),
        createTextBlock('Done.'),
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      const result = extractResponses(messages);

      expect(result.responses[0]?.toolsUsed).toHaveLength(2);
      expect(result.responses[0]?.toolsUsed[0]?.toolId).toBe('toolu_001');
      expect(result.responses[0]?.toolsUsed[1]?.toolId).toBe('toolu_002');
      expect(result.responses[0]?.text).toBe('Starting...\nDone.');
    });

    it('should include malformed block details in warning', () => {
      const content: ContentBlock[] = [
        { type: 'tool_use', id: 'toolu_001' } as ToolUseBlock,
      ];
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', content),
      ];

      extractResponses(messages);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Malformed tool_use block')
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('assistant-001')
      );
    });
  });

  describe('extraction stats accuracy', () => {
    it('should calculate all stats correctly', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', 'Hello'),
        createAssistantMessage('assistant-001', 'user-001', [
          createThinkingBlock('Thinking 1...'),
          createTextBlock('Response 1'),
          createToolUseBlock('toolu_001', 'Read', { file_path: '/a.ts' }),
        ], { usage: { input_tokens: 1000, output_tokens: 500 } }),
        createUserMessage('user-002', 'Next'),
        createAssistantMessage('assistant-002', 'user-002', [
          createTextBlock('Response 2'),
          createToolUseBlock('toolu_002', 'Bash', { command: 'ls' }),
          createToolUseBlock('toolu_003', 'Grep', { pattern: 'test' }),
        ], { usage: { input_tokens: 800, output_tokens: 400 } }),
        createAssistantMessage('assistant-003', 'user-002', 'Simple response', {
          usage: { input_tokens: 600, output_tokens: 300 },
        }),
        {
          uuid: 'snapshot-001',
          parentUuid: null,
          sessionId: 'test-session',
          timestamp: '2025-12-22T10:00:00.000Z',
          type: 'file-history-snapshot',
        },
      ];

      const result = extractResponses(messages);

      expect(result.stats.totalMessages).toBe(6);
      expect(result.stats.assistantMessages).toBe(3);
      expect(result.stats.extractedResponses).toBe(3);
      expect(result.stats.totalToolCalls).toBe(3);
      expect(result.stats.responsesWithThinking).toBe(1);
      expect(result.stats.totalInputTokens).toBe(2400);
      expect(result.stats.totalOutputTokens).toBe(1200);
    });
  });
});

// ============================================================================
// Tests: getUniqueToolNames
// ============================================================================

describe('getUniqueToolNames', () => {
  it('should return unique tool names sorted', () => {
    const responses: ExtractedResponse[] = [
      {
        uuid: 'r1',
        parentUuid: 'u1',
        sessionId: 's1',
        timestamp: new Date(),
        requestId: null,
        text: '',
        charCount: 0,
        wordCount: 0,
        model: 'test',
        messageId: null,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, total: 0 },
        toolsUsed: [
          { toolId: 't1', name: 'Read', inputSummary: '', input: {}, order: 1 },
          { toolId: 't2', name: 'Bash', inputSummary: '', input: {}, order: 2 },
        ],
        toolCount: 2,
        hasThinking: false,
        thinkingBlockCount: 0,
        thinkingContent: null,
      },
      {
        uuid: 'r2',
        parentUuid: 'u2',
        sessionId: 's1',
        timestamp: new Date(),
        requestId: null,
        text: '',
        charCount: 0,
        wordCount: 0,
        model: 'test',
        messageId: null,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, total: 0 },
        toolsUsed: [
          { toolId: 't3', name: 'Write', inputSummary: '', input: {}, order: 1 },
          { toolId: 't4', name: 'Read', inputSummary: '', input: {}, order: 2 }, // Duplicate
          { toolId: 't5', name: 'Glob', inputSummary: '', input: {}, order: 3 },
        ],
        toolCount: 3,
        hasThinking: false,
        thinkingBlockCount: 0,
        thinkingContent: null,
      },
    ];

    const names = getUniqueToolNames(responses);

    expect(names).toEqual(['Bash', 'Glob', 'Read', 'Write']);
  });

  it('should return empty array for no responses', () => {
    expect(getUniqueToolNames([])).toEqual([]);
  });

  it('should return empty array when no tools used', () => {
    const responses: ExtractedResponse[] = [
      {
        uuid: 'r1',
        parentUuid: 'u1',
        sessionId: 's1',
        timestamp: new Date(),
        requestId: null,
        text: 'Just text',
        charCount: 9,
        wordCount: 2,
        model: 'test',
        messageId: null,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, total: 0 },
        toolsUsed: [],
        toolCount: 0,
        hasThinking: false,
        thinkingBlockCount: 0,
        thinkingContent: null,
      },
    ];

    expect(getUniqueToolNames(responses)).toEqual([]);
  });
});
