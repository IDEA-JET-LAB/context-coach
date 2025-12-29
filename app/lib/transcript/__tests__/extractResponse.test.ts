/**
 * Response Extraction Tests
 * Story 26-4: Response Extraction Logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractResponse,
  extractResponses,
  extractTextContent,
  extractThinkingContent,
  extractToolUses,
  extractCacheStats,
  isRawAssistantMessage,
  type ContentBlock,
  type RawAssistantMessage,
  type ExtractedResponse,
  type Usage,
} from '../extractResponse';

// ============================================================================
// Test Fixtures
// ============================================================================

const createValidAssistantMessage = (
  overrides: Partial<RawAssistantMessage> = {}
): RawAssistantMessage => ({
  uuid: 'msg_01test123',
  type: 'assistant',
  message: {
    id: 'msg_01test123',
    model: 'claude-sonnet-4-20250514',
    content: [
      { type: 'text', text: 'Here is the solution.' },
    ],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 250,
    },
  },
  timestamp: '2025-12-25T10:00:00Z',
  ...overrides,
});

const createTextBlock = (text: string): ContentBlock => ({
  type: 'text',
  text,
});

const createThinkingBlock = (thinking: string): ContentBlock => ({
  type: 'thinking',
  thinking,
  signature: 'sig_test',
});

const createToolUseBlock = (
  id: string,
  name: string,
  input: unknown = {}
): ContentBlock => ({
  type: 'tool_use',
  id,
  name,
  input,
});

// ============================================================================
// Tests: isRawAssistantMessage
// ============================================================================

describe('isRawAssistantMessage', () => {
  it('should return true for valid assistant message', () => {
    const message = createValidAssistantMessage();
    expect(isRawAssistantMessage(message)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isRawAssistantMessage(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isRawAssistantMessage(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isRawAssistantMessage('string')).toBe(false);
    expect(isRawAssistantMessage(123)).toBe(false);
    expect(isRawAssistantMessage(true)).toBe(false);
  });

  it('should return false for wrong type', () => {
    expect(isRawAssistantMessage({ type: 'user', uuid: 'test' })).toBe(false);
    expect(isRawAssistantMessage({ type: 'summary', uuid: 'test' })).toBe(false);
  });

  it('should return false for missing uuid', () => {
    expect(isRawAssistantMessage({ type: 'assistant', message: {} })).toBe(false);
  });

  it('should return false for empty uuid', () => {
    expect(isRawAssistantMessage({ type: 'assistant', uuid: '', message: {} })).toBe(
      false
    );
    expect(isRawAssistantMessage({ type: 'assistant', uuid: '   ', message: {} })).toBe(
      false
    );
  });

  it('should return false for missing message', () => {
    expect(isRawAssistantMessage({ type: 'assistant', uuid: 'test' })).toBe(false);
  });

  it('should return false for null message', () => {
    expect(
      isRawAssistantMessage({ type: 'assistant', uuid: 'test', message: null })
    ).toBe(false);
  });
});

// ============================================================================
// Tests: extractTextContent
// ============================================================================

describe('extractTextContent', () => {
  it('should extract text from single text block', () => {
    const content: ContentBlock[] = [createTextBlock('Hello, world!')];
    expect(extractTextContent(content)).toBe('Hello, world!');
  });

  it('should concatenate multiple text blocks with newlines', () => {
    const content: ContentBlock[] = [
      createTextBlock('First paragraph.'),
      createTextBlock('Second paragraph.'),
      createTextBlock('Third paragraph.'),
    ];
    expect(extractTextContent(content)).toBe(
      'First paragraph.\nSecond paragraph.\nThird paragraph.'
    );
  });

  it('should skip empty text blocks', () => {
    const content: ContentBlock[] = [
      createTextBlock('Before'),
      createTextBlock(''),
      createTextBlock('   '),
      createTextBlock('After'),
    ];
    expect(extractTextContent(content)).toBe('Before\nAfter');
  });

  it('should skip non-text blocks', () => {
    const content: ContentBlock[] = [
      createTextBlock('Let me help you.'),
      createThinkingBlock('Thinking...'),
      createToolUseBlock('toolu_01', 'Read', { file_path: '/test.ts' }),
      createTextBlock('Here is what I found.'),
    ];
    expect(extractTextContent(content)).toBe('Let me help you.\nHere is what I found.');
  });

  it('should return empty string for empty array', () => {
    expect(extractTextContent([])).toBe('');
  });

  it('should return empty string for non-array', () => {
    expect(extractTextContent(null as unknown as ContentBlock[])).toBe('');
    expect(extractTextContent(undefined as unknown as ContentBlock[])).toBe('');
    expect(extractTextContent('string' as unknown as ContentBlock[])).toBe('');
  });

  it('should return empty string when no text blocks', () => {
    const content: ContentBlock[] = [
      createThinkingBlock('Thinking only'),
      createToolUseBlock('toolu_01', 'Bash', { command: 'ls' }),
    ];
    expect(extractTextContent(content)).toBe('');
  });

  it('should handle text blocks with only whitespace in content', () => {
    const content: ContentBlock[] = [
      createTextBlock('Valid text'),
      createTextBlock('\n\n\t\t'),
      createTextBlock('More valid'),
    ];
    expect(extractTextContent(content)).toBe('Valid text\nMore valid');
  });
});

// ============================================================================
// Tests: extractThinkingContent
// ============================================================================

describe('extractThinkingContent', () => {
  it('should extract thinking from single thinking block', () => {
    const content: ContentBlock[] = [createThinkingBlock('Let me analyze this...')];
    const result = extractThinkingContent(content);

    expect(result).not.toBeNull();
    expect(result?.fullText).toBe('Let me analyze this...');
    expect(result?.wordCount).toBe(4);
    expect(result?.summary).toBe('Let me analyze this...');
  });

  it('should concatenate multiple thinking blocks', () => {
    const content: ContentBlock[] = [
      createThinkingBlock('First thought.'),
      createThinkingBlock('Second thought.'),
    ];
    const result = extractThinkingContent(content);

    expect(result).not.toBeNull();
    expect(result?.fullText).toBe('First thought.\nSecond thought.');
    expect(result?.wordCount).toBe(4);
  });

  it('should calculate word count correctly', () => {
    const content: ContentBlock[] = [
      createThinkingBlock('One two three four five'),
    ];
    const result = extractThinkingContent(content);

    expect(result?.wordCount).toBe(5);
  });

  it('should compress long thinking content', () => {
    // Create thinking content longer than 500 chars
    const longThinking = 'A'.repeat(100) + ' ' + 'B'.repeat(100) + ' ' + 'C'.repeat(300) + ' end.';
    const content: ContentBlock[] = [createThinkingBlock(longThinking)];
    const result = extractThinkingContent(content);

    expect(result).not.toBeNull();
    expect(result?.summary.length).toBeLessThanOrEqual(503); // 500 + "..."
    expect(result?.fullText).toBe(longThinking);
  });

  it('should return null for empty array', () => {
    expect(extractThinkingContent([])).toBeNull();
  });

  it('should return null for non-array', () => {
    expect(extractThinkingContent(null as unknown as ContentBlock[])).toBeNull();
    expect(extractThinkingContent(undefined as unknown as ContentBlock[])).toBeNull();
  });

  it('should return null when no thinking blocks', () => {
    const content: ContentBlock[] = [
      createTextBlock('Just text'),
      createToolUseBlock('toolu_01', 'Read', {}),
    ];
    expect(extractThinkingContent(content)).toBeNull();
  });

  it('should skip non-thinking blocks', () => {
    const content: ContentBlock[] = [
      createTextBlock('Text before'),
      createThinkingBlock('The actual thinking'),
      createToolUseBlock('toolu_01', 'Bash', {}),
      createTextBlock('Text after'),
    ];
    const result = extractThinkingContent(content);

    expect(result?.fullText).toBe('The actual thinking');
  });
});

// ============================================================================
// Tests: extractToolUses
// ============================================================================

describe('extractToolUses', () => {
  it('should extract single tool use', () => {
    const content: ContentBlock[] = [
      createTextBlock('Let me read the file.'),
      createToolUseBlock('toolu_01abc', 'Read', { file_path: '/test.ts' }),
    ];
    const result = extractToolUses(content);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Read', id: 'toolu_01abc' });
  });

  it('should extract multiple tool uses in order', () => {
    const content: ContentBlock[] = [
      createToolUseBlock('toolu_01', 'Glob', { pattern: '*.ts' }),
      createTextBlock('Searching...'),
      createToolUseBlock('toolu_02', 'Read', { file_path: '/a.ts' }),
      createToolUseBlock('toolu_03', 'Edit', { file_path: '/a.ts' }),
    ];
    const result = extractToolUses(content);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: 'Glob', id: 'toolu_01' });
    expect(result[1]).toEqual({ name: 'Read', id: 'toolu_02' });
    expect(result[2]).toEqual({ name: 'Edit', id: 'toolu_03' });
  });

  it('should NOT include tool input (privacy)', () => {
    const sensitiveInput = {
      file_path: '/secrets/api-keys.ts',
      content: 'API_KEY=secret123',
    };
    const content: ContentBlock[] = [
      createToolUseBlock('toolu_01', 'Write', sensitiveInput),
    ];
    const result = extractToolUses(content);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Write', id: 'toolu_01' });
    // Verify input is not included
    expect((result[0] as unknown as Record<string, unknown>).input).toBeUndefined();
  });

  it('should skip tool_use blocks without id', () => {
    const content: ContentBlock[] = [
      { type: 'tool_use', name: 'Read', input: {} } as ContentBlock,
      createToolUseBlock('toolu_01', 'Bash', { command: 'ls' }),
    ];
    const result = extractToolUses(content);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bash');
  });

  it('should skip tool_use blocks without name', () => {
    const content: ContentBlock[] = [
      { type: 'tool_use', id: 'toolu_01', input: {} } as ContentBlock,
      createToolUseBlock('toolu_02', 'Grep', { pattern: 'test' }),
    ];
    const result = extractToolUses(content);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Grep');
  });

  it('should skip tool_use blocks with empty id', () => {
    const content: ContentBlock[] = [
      { type: 'tool_use', id: '', name: 'Read', input: {} } as ContentBlock,
      createToolUseBlock('toolu_01', 'Write', {}),
    ];
    const result = extractToolUses(content);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Write');
  });

  it('should skip tool_use blocks with empty name', () => {
    const content: ContentBlock[] = [
      { type: 'tool_use', id: 'toolu_01', name: '', input: {} } as ContentBlock,
      createToolUseBlock('toolu_02', 'Bash', {}),
    ];
    const result = extractToolUses(content);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bash');
  });

  it('should return empty array for empty content', () => {
    expect(extractToolUses([])).toEqual([]);
  });

  it('should return empty array for non-array', () => {
    expect(extractToolUses(null as unknown as ContentBlock[])).toEqual([]);
    expect(extractToolUses(undefined as unknown as ContentBlock[])).toEqual([]);
  });

  it('should return empty array when no tool_use blocks', () => {
    const content: ContentBlock[] = [
      createTextBlock('Just text'),
      createThinkingBlock('Just thinking'),
    ];
    expect(extractToolUses(content)).toEqual([]);
  });
});

// ============================================================================
// Tests: extractCacheStats
// ============================================================================

describe('extractCacheStats', () => {
  it('should extract cache stats when both present', () => {
    const usage: Usage = {
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 300,
    };
    const result = extractCacheStats(usage);

    expect(result).toEqual({ creation: 200, read: 300 });
  });

  it('should extract cache stats when only creation present', () => {
    const usage: Usage = {
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 150,
    };
    const result = extractCacheStats(usage);

    expect(result).toEqual({ creation: 150, read: 0 });
  });

  it('should extract cache stats when only read present', () => {
    const usage: Usage = {
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 400,
    };
    const result = extractCacheStats(usage);

    expect(result).toEqual({ creation: 0, read: 400 });
  });

  it('should return null when no cache fields', () => {
    const usage: Usage = {
      input_tokens: 1000,
      output_tokens: 500,
    };
    expect(extractCacheStats(usage)).toBeNull();
  });

  it('should return null for null usage', () => {
    expect(extractCacheStats(null)).toBeNull();
  });

  it('should return null for undefined usage', () => {
    expect(extractCacheStats(undefined)).toBeNull();
  });

  it('should handle zero cache values', () => {
    const usage: Usage = {
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    };
    const result = extractCacheStats(usage);

    expect(result).toEqual({ creation: 0, read: 0 });
  });
});

// ============================================================================
// Tests: extractResponse (main function)
// ============================================================================

describe('extractResponse', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('valid messages', () => {
    it('should extract all data from valid message', () => {
      const message = createValidAssistantMessage({
        message: {
          id: 'msg_01test',
          model: 'claude-opus-4-5-20251101',
          content: [
            createThinkingBlock('Analyzing the problem...'),
            createTextBlock('Here is my analysis.'),
            createToolUseBlock('toolu_01', 'Read', { file_path: '/test.ts' }),
            createTextBlock('Based on the file...'),
          ],
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 2000,
            output_tokens: 800,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 500,
          },
        },
      });

      const result = extractResponse(message);

      expect(result).not.toBeNull();
      expect(result?.messageUuid).toBe('msg_01test123');
      expect(result?.responseText).toBe('Here is my analysis.\nBased on the file...');
      expect(result?.thinking?.fullText).toBe('Analyzing the problem...');
      expect(result?.thinking?.wordCount).toBe(3);
      expect(result?.toolsUsed).toHaveLength(1);
      expect(result?.toolsUsed[0]).toEqual({ name: 'Read', id: 'toolu_01' });
      expect(result?.model).toBe('claude-opus-4-5-20251101');
      expect(result?.usage).toEqual({ inputTokens: 2000, outputTokens: 800 });
      expect(result?.cacheStats).toEqual({ creation: 100, read: 500 });
      expect(result?.stopReason).toBe('end_turn');
      expect(result?.timestamp).toBe('2025-12-25T10:00:00Z');
    });

    it('should handle message without thinking', () => {
      const message = createValidAssistantMessage({
        message: {
          id: 'msg_01',
          model: 'claude-sonnet-4-20250514',
          content: [createTextBlock('Simple response.')],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      });

      const result = extractResponse(message);

      expect(result?.thinking).toBeNull();
      expect(result?.responseText).toBe('Simple response.');
    });

    it('should handle message without tools', () => {
      const message = createValidAssistantMessage({
        message: {
          id: 'msg_01',
          model: 'claude-sonnet-4-20250514',
          content: [
            createThinkingBlock('Thinking...'),
            createTextBlock('Response without tools.'),
          ],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      });

      const result = extractResponse(message);

      expect(result?.toolsUsed).toEqual([]);
      expect(result?.responseText).toBe('Response without tools.');
    });

    it('should handle message with only tools (no text)', () => {
      const message = createValidAssistantMessage({
        message: {
          id: 'msg_01',
          model: 'claude-sonnet-4-20250514',
          content: [
            createToolUseBlock('toolu_01', 'Bash', { command: 'ls' }),
            createToolUseBlock('toolu_02', 'Read', { file_path: '/test' }),
          ],
          stop_reason: 'tool_use',
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      });

      const result = extractResponse(message);

      expect(result?.responseText).toBe('');
      expect(result?.toolsUsed).toHaveLength(2);
      expect(result?.stopReason).toBe('tool_use');
    });

    it('should handle empty content array', () => {
      const message = createValidAssistantMessage({
        message: {
          id: 'msg_01',
          model: 'claude-sonnet-4-20250514',
          content: [],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 0 },
        },
      });

      const result = extractResponse(message);

      expect(result?.responseText).toBe('');
      expect(result?.thinking).toBeNull();
      expect(result?.toolsUsed).toEqual([]);
    });
  });

  describe('metadata extraction', () => {
    it('should use default model when missing', () => {
      const message = createValidAssistantMessage();
      // Remove model
      (message.message as Record<string, unknown>).model = undefined;

      const result = extractResponse(message);

      expect(result?.model).toBe('unknown');
    });

    it('should use default stop_reason when missing', () => {
      const message = createValidAssistantMessage();
      (message.message as Record<string, unknown>).stop_reason = undefined;

      const result = extractResponse(message);

      expect(result?.stopReason).toBe('unknown');
    });

    it('should use default tokens when usage missing', () => {
      const message = createValidAssistantMessage();
      (message.message as Record<string, unknown>).usage = undefined;

      const result = extractResponse(message);

      expect(result?.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
      expect(result?.cacheStats).toBeNull();
    });

    it('should generate timestamp when missing', () => {
      const message = createValidAssistantMessage();
      (message as Record<string, unknown>).timestamp = undefined;

      const result = extractResponse(message);

      expect(result?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('invalid messages', () => {
    it('should return null for non-assistant type', () => {
      const message = { type: 'user', uuid: 'test', message: {} };
      expect(extractResponse(message)).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it('should return null for missing uuid', () => {
      const message = { type: 'assistant', message: { content: [] } };
      expect(extractResponse(message)).toBeNull();
    });

    it('should return null for missing message', () => {
      const message = { type: 'assistant', uuid: 'test' };
      expect(extractResponse(message)).toBeNull();
    });

    it('should return null for missing content', () => {
      const message = {
        type: 'assistant',
        uuid: 'test',
        message: { model: 'test' },
      };
      expect(extractResponse(message)).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('no content')
      );
    });

    it('should return null for non-array content', () => {
      const message = {
        type: 'assistant',
        uuid: 'test',
        message: { content: 'string content' },
      };
      expect(extractResponse(message)).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('not an array')
      );
    });

    it('should return null for null input', () => {
      expect(extractResponse(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(extractResponse(undefined)).toBeNull();
    });

    it('should return null for non-object input', () => {
      expect(extractResponse('string')).toBeNull();
      expect(extractResponse(123)).toBeNull();
      expect(extractResponse(true)).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle extraction errors gracefully', () => {
      // Create a message that will cause an error during extraction
      const message = {
        type: 'assistant',
        uuid: 'test',
        message: {
          content: null, // This will cause Array.isArray to return false
        },
      };

      const result = extractResponse(message);

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Tests: extractResponses (batch function)
// ============================================================================

describe('extractResponses', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should extract responses from array of messages', () => {
    const messages = [
      createValidAssistantMessage({ uuid: 'msg_01' }),
      { type: 'user', uuid: 'user_01', message: { content: 'hello' } },
      createValidAssistantMessage({ uuid: 'msg_02' }),
    ];

    const results = extractResponses(messages);

    expect(results).toHaveLength(2);
    expect(results[0].messageUuid).toBe('msg_01');
    expect(results[1].messageUuid).toBe('msg_02');
  });

  it('should skip non-assistant messages', () => {
    const messages = [
      { type: 'user', uuid: 'user_01' },
      { type: 'summary', uuid: 'sum_01' },
      { type: 'file-history-snapshot', uuid: 'snap_01' },
      createValidAssistantMessage({ uuid: 'msg_01' }),
    ];

    const results = extractResponses(messages);

    expect(results).toHaveLength(1);
    expect(results[0].messageUuid).toBe('msg_01');
  });

  it('should skip invalid assistant messages', () => {
    const messages = [
      createValidAssistantMessage({ uuid: 'msg_01' }),
      { type: 'assistant', uuid: '', message: {} }, // Invalid: empty uuid
      { type: 'assistant', uuid: 'msg_02' }, // Invalid: no message
      createValidAssistantMessage({ uuid: 'msg_03' }),
    ];

    const results = extractResponses(messages);

    expect(results).toHaveLength(2);
    expect(results[0].messageUuid).toBe('msg_01');
    expect(results[1].messageUuid).toBe('msg_03');
  });

  it('should skip null and non-object entries', () => {
    const messages = [
      null,
      'string',
      123,
      undefined,
      createValidAssistantMessage({ uuid: 'msg_01' }),
    ];

    const results = extractResponses(messages as unknown[]);

    expect(results).toHaveLength(1);
    expect(results[0].messageUuid).toBe('msg_01');
  });

  it('should return empty array for empty input', () => {
    expect(extractResponses([])).toEqual([]);
  });

  it('should return empty array for non-array input', () => {
    expect(extractResponses(null as unknown as unknown[])).toEqual([]);
    expect(extractResponses(undefined as unknown as unknown[])).toEqual([]);
    expect(extractResponses('string' as unknown as unknown[])).toEqual([]);
  });

  it('should return empty array when no valid responses', () => {
    const messages = [
      { type: 'user', uuid: 'user_01' },
      { type: 'summary', uuid: 'sum_01' },
    ];

    expect(extractResponses(messages)).toEqual([]);
  });
});

// ============================================================================
// Tests: Real-world transcript data
// ============================================================================

describe('real-world transcript data', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should handle Claude Code transcript format', () => {
    // Real-world format from Claude Code
    const message = {
      uuid: 'msg_01ABCdef123',
      type: 'assistant',
      message: {
        id: 'msg_01ABCdef123',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [
          {
            type: 'thinking',
            thinking:
              'Let me analyze this code to understand what changes need to be made. First, I should look at the current implementation...',
          },
          {
            type: 'text',
            text: "I've analyzed the code and found the issue. Here's what we need to change:",
          },
          {
            type: 'tool_use',
            id: 'toolu_01XYZ789',
            name: 'Read',
            input: {
              file_path: '/Users/dev/project/src/auth.ts',
            },
          },
        ],
        stop_reason: 'tool_use',
        usage: {
          input_tokens: 1234,
          output_tokens: 567,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 500,
        },
      },
      timestamp: '2025-12-25T10:30:00Z',
    };

    const result = extractResponse(message);

    expect(result).not.toBeNull();
    expect(result?.messageUuid).toBe('msg_01ABCdef123');
    expect(result?.responseText).toBe(
      "I've analyzed the code and found the issue. Here's what we need to change:"
    );
    expect(result?.thinking).not.toBeNull();
    expect(result?.thinking?.fullText).toContain('analyze this code');
    expect(result?.toolsUsed).toEqual([{ name: 'Read', id: 'toolu_01XYZ789' }]);
    expect(result?.model).toBe('claude-sonnet-4-20250514');
    expect(result?.usage).toEqual({ inputTokens: 1234, outputTokens: 567 });
    expect(result?.cacheStats).toEqual({ creation: 0, read: 500 });
    expect(result?.stopReason).toBe('tool_use');
  });

  it('should handle message with multiple tool invocations', () => {
    const message = {
      uuid: 'msg_multi_tool',
      type: 'assistant',
      message: {
        id: 'msg_multi_tool',
        model: 'claude-sonnet-4-20250514',
        content: [
          { type: 'text', text: 'Let me search for relevant files.' },
          { type: 'tool_use', id: 'toolu_glob', name: 'Glob', input: { pattern: '**/*.ts' } },
          { type: 'tool_use', id: 'toolu_grep', name: 'Grep', input: { pattern: 'function' } },
          { type: 'text', text: 'Now reading the files...' },
          { type: 'tool_use', id: 'toolu_read1', name: 'Read', input: { file_path: '/a.ts' } },
          { type: 'tool_use', id: 'toolu_read2', name: 'Read', input: { file_path: '/b.ts' } },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 500, output_tokens: 200 },
      },
      timestamp: '2025-12-25T11:00:00Z',
    };

    const result = extractResponse(message);

    expect(result?.toolsUsed).toHaveLength(4);
    expect(result?.toolsUsed.map((t) => t.name)).toEqual([
      'Glob',
      'Grep',
      'Read',
      'Read',
    ]);
    expect(result?.responseText).toBe(
      'Let me search for relevant files.\nNow reading the files...'
    );
  });

  it('should handle extended thinking with multiple blocks', () => {
    const message = {
      uuid: 'msg_extended',
      type: 'assistant',
      message: {
        id: 'msg_extended',
        model: 'claude-opus-4-5-20251101',
        content: [
          {
            type: 'thinking',
            thinking: 'First, let me understand the requirements.',
            signature: 'sig_1',
          },
          {
            type: 'thinking',
            thinking: 'Now I need to consider the edge cases.',
            signature: 'sig_2',
          },
          {
            type: 'thinking',
            thinking: 'Finally, let me plan the implementation.',
            signature: 'sig_3',
          },
          { type: 'text', text: 'Here is my comprehensive plan:' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 800, output_tokens: 1200 },
      },
      timestamp: '2025-12-25T12:00:00Z',
    };

    const result = extractResponse(message);

    expect(result?.thinking?.fullText).toBe(
      'First, let me understand the requirements.\n' +
        'Now I need to consider the edge cases.\n' +
        'Finally, let me plan the implementation.'
    );
    expect(result?.thinking?.wordCount).toBeGreaterThan(15);
  });
});
