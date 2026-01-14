import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  extractPairsFromSession,
  parseJsonlFile,
  extractUserContent,
  extractAssistantContent,
  extractThinkingContent,
  extractTokens,
  pairMessages,
} from '../parser';
import type { ParsedMessage, PromptResponsePair } from '../types';

// Helper to create temp files
async function createTempJsonlFile(lines: object[]): Promise<string> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'parser-test-'));
  const filePath = path.join(tmpDir, 'session.jsonl');
  const content = lines.map((line) => JSON.stringify(line)).join('\n');
  await fs.promises.writeFile(filePath, content, 'utf-8');
  return filePath;
}

// Helper to clean up temp files
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
    await fs.promises.rmdir(path.dirname(filePath));
  } catch {
    // Ignore cleanup errors
  }
}

describe('JSONL Parser - Story 17-3', () => {
  describe('extractUserContent', () => {
    it('should extract string content directly', () => {
      const msg = {
        message: {
          content: 'Hello world',
        },
      };
      expect(extractUserContent(msg)).toBe('Hello world');
    });

    it('should extract text from array content', () => {
      const msg = {
        message: {
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' },
          ],
        },
      };
      expect(extractUserContent(msg)).toBe('First part\nSecond part');
    });

    it('should filter out non-text content', () => {
      const msg = {
        message: {
          content: [
            { type: 'image', data: 'base64data' },
            { type: 'text', text: 'Only text' },
          ],
        },
      };
      expect(extractUserContent(msg)).toBe('Only text');
    });

    it('should return empty string for missing content', () => {
      expect(extractUserContent({})).toBe('');
      expect(extractUserContent({ message: {} })).toBe('');
      expect(extractUserContent({ message: { content: null } })).toBe('');
    });
  });

  describe('extractAssistantContent', () => {
    it('should extract string content directly', () => {
      const msg = {
        message: {
          content: 'I can help with that',
        },
      };
      expect(extractAssistantContent(msg)).toBe('I can help with that');
    });

    it('should extract text from array content', () => {
      const msg = {
        message: {
          content: [
            { type: 'text', text: 'Here is my response' },
            { type: 'tool_use', name: 'Read', input: {} },
            { type: 'text', text: 'And more text' },
          ],
        },
      };
      expect(extractAssistantContent(msg)).toBe('Here is my response\nAnd more text');
    });

    it('should handle empty array', () => {
      const msg = {
        message: {
          content: [],
        },
      };
      expect(extractAssistantContent(msg)).toBe('');
    });
  });

  describe('extractTokens', () => {
    it('should extract input and output tokens', () => {
      const msg = {
        message: {
          usage: {
            input_tokens: 150,
            output_tokens: 500,
          },
        },
      };
      expect(extractTokens(msg)).toEqual({ input: 150, output: 500 });
    });

    it('should return undefined when no usage data', () => {
      expect(extractTokens({})).toBeUndefined();
      expect(extractTokens({ message: {} })).toBeUndefined();
    });

    it('should default to 0 for missing token counts', () => {
      const msg = {
        message: {
          usage: {
            input_tokens: 100,
          },
        },
      };
      expect(extractTokens(msg)).toEqual({ input: 100, output: 0 });
    });
  });

  describe('extractThinkingContent', () => {
    it('should extract thinking content from a message with one thinking block', () => {
      const msg = {
        message: {
          content: [
            { type: 'thinking', thinking: 'Let me analyze this problem step by step.' },
            { type: 'text', text: 'Here is my response.' },
          ],
        },
      };
      const result = extractThinkingContent(msg);
      expect(result).toBeDefined();
      expect(result!.text).toBe('Let me analyze this problem step by step.');
      expect(result!.wordCount).toBe(8);
      expect(result!.summary).toBe('Let me analyze this problem step by step.');
    });

    it('should concatenate multiple thinking blocks with newlines', () => {
      const msg = {
        message: {
          content: [
            { type: 'thinking', thinking: 'First thought.' },
            { type: 'text', text: 'Some text.' },
            { type: 'thinking', thinking: 'Second thought.' },
          ],
        },
      };
      const result = extractThinkingContent(msg);
      expect(result).toBeDefined();
      expect(result!.text).toBe('First thought.\nSecond thought.');
      expect(result!.wordCount).toBe(4);
    });

    it('should return undefined when no thinking blocks present', () => {
      const msg = {
        message: {
          content: [
            { type: 'text', text: 'Just regular text.' },
            { type: 'tool_use', name: 'Read', input: {} },
          ],
        },
      };
      expect(extractThinkingContent(msg)).toBeUndefined();
    });

    it('should return undefined for empty content array', () => {
      const msg = {
        message: {
          content: [],
        },
      };
      expect(extractThinkingContent(msg)).toBeUndefined();
    });

    it('should return undefined for missing message', () => {
      expect(extractThinkingContent({})).toBeUndefined();
    });

    it('should skip empty thinking blocks', () => {
      const msg = {
        message: {
          content: [
            { type: 'thinking', thinking: '' },
            { type: 'thinking', thinking: '   ' },
            { type: 'thinking', thinking: 'Valid thought.' },
          ],
        },
      };
      const result = extractThinkingContent(msg);
      expect(result).toBeDefined();
      expect(result!.text).toBe('Valid thought.');
    });

    it('should truncate summary for long thinking content', () => {
      const longThinking = 'A'.repeat(300);
      const msg = {
        message: {
          content: [{ type: 'thinking', thinking: longThinking }],
        },
      };
      const result = extractThinkingContent(msg);
      expect(result).toBeDefined();
      expect(result!.text.length).toBe(300);
      expect(result!.summary.length).toBe(203); // 200 + '...'
      expect(result!.summary.endsWith('...')).toBe(true);
    });

    it('should handle thinking with special characters', () => {
      const msg = {
        message: {
          content: [{ type: 'thinking', thinking: 'Analysis: "foo" & <bar>' }],
        },
      };
      const result = extractThinkingContent(msg);
      expect(result).toBeDefined();
      expect(result!.text).toBe('Analysis: "foo" & <bar>');
    });
  });

  describe('pairMessages', () => {
    it('should pair user message with subsequent assistant response', () => {
      const messages: ParsedMessage[] = [
        {
          type: 'user',
          content: 'Write a function',
          timestamp: '2025-01-15T10:30:00Z',
          uuid: 'user-1',
        },
        {
          type: 'assistant',
          content: 'Here is the function',
          timestamp: '2025-01-15T10:30:05Z',
          model: 'claude-3-opus',
          tokens: { input: 100, output: 200 },
        },
      ];

      const pairs = pairMessages(messages);

      expect(pairs).toHaveLength(1);
      expect(pairs[0]!.prompt.text).toBe('Write a function');
      expect(pairs[0]!.prompt.timestamp).toBe('2025-01-15T10:30:00Z');
      expect(pairs[0]!.prompt.uuid).toBe('user-1');
      expect(pairs[0]!.response).toBeDefined();
      expect(pairs[0]!.response!.text).toBe('Here is the function');
      expect(pairs[0]!.response!.model).toBe('claude-3-opus');
      expect(pairs[0]!.response!.tokens).toEqual({ input: 100, output: 200 });
    });

    it('should handle user message without response (interrupted session)', () => {
      const messages: ParsedMessage[] = [
        {
          type: 'user',
          content: 'Start a task',
          timestamp: '2025-01-15T10:30:00Z',
        },
      ];

      const pairs = pairMessages(messages);

      expect(pairs).toHaveLength(1);
      expect(pairs[0]!.prompt.text).toBe('Start a task');
      expect(pairs[0]!.response).toBeUndefined();
    });

    it('should handle multiple prompt-response pairs', () => {
      const messages: ParsedMessage[] = [
        {
          type: 'user',
          content: 'First question',
          timestamp: '2025-01-15T10:30:00Z',
        },
        {
          type: 'assistant',
          content: 'First answer',
          timestamp: '2025-01-15T10:30:05Z',
        },
        {
          type: 'user',
          content: 'Second question',
          timestamp: '2025-01-15T10:31:00Z',
        },
        {
          type: 'assistant',
          content: 'Second answer',
          timestamp: '2025-01-15T10:31:05Z',
        },
      ];

      const pairs = pairMessages(messages);

      expect(pairs).toHaveLength(2);
      expect(pairs[0]!.prompt.text).toBe('First question');
      expect(pairs[0]!.response!.text).toBe('First answer');
      expect(pairs[1]!.prompt.text).toBe('Second question');
      expect(pairs[1]!.response!.text).toBe('Second answer');
    });

    it('should skip assistant messages without preceding user message', () => {
      const messages: ParsedMessage[] = [
        {
          type: 'assistant',
          content: 'Orphan response',
          timestamp: '2025-01-15T10:30:00Z',
        },
        {
          type: 'user',
          content: 'Valid question',
          timestamp: '2025-01-15T10:31:00Z',
        },
        {
          type: 'assistant',
          content: 'Valid answer',
          timestamp: '2025-01-15T10:31:05Z',
        },
      ];

      const pairs = pairMessages(messages);

      expect(pairs).toHaveLength(1);
      expect(pairs[0]!.prompt.text).toBe('Valid question');
    });

    it('should handle consecutive user messages (no response to first)', () => {
      const messages: ParsedMessage[] = [
        {
          type: 'user',
          content: 'First without response',
          timestamp: '2025-01-15T10:30:00Z',
        },
        {
          type: 'user',
          content: 'Second question',
          timestamp: '2025-01-15T10:31:00Z',
        },
        {
          type: 'assistant',
          content: 'Response to second',
          timestamp: '2025-01-15T10:31:05Z',
        },
      ];

      const pairs = pairMessages(messages);

      expect(pairs).toHaveLength(2);
      expect(pairs[0]!.prompt.text).toBe('First without response');
      expect(pairs[0]!.response).toBeUndefined();
      expect(pairs[1]!.prompt.text).toBe('Second question');
      expect(pairs[1]!.response!.text).toBe('Response to second');
    });

    it('should return empty array for empty messages', () => {
      expect(pairMessages([])).toEqual([]);
    });
  });

  describe('parseJsonlFile', () => {
    it('should parse user and assistant messages from JSONL', async () => {
      const lines = [
        {
          type: 'user',
          uuid: 'abc123',
          timestamp: '2025-01-15T10:30:00Z',
          message: {
            content: [{ type: 'text', text: 'Hello' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'def456',
          timestamp: '2025-01-15T10:30:05Z',
          message: {
            model: 'claude-3-opus',
            content: [{ type: 'text', text: 'Hi there!' }],
            usage: { input_tokens: 50, output_tokens: 100 },
          },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const messages = await parseJsonlFile(filePath);

        expect(messages).toHaveLength(2);
        expect(messages[0]!.type).toBe('user');
        expect(messages[0]!.content).toBe('Hello');
        expect(messages[0]!.uuid).toBe('abc123');
        expect(messages[1]!.type).toBe('assistant');
        expect(messages[1]!.content).toBe('Hi there!');
        expect(messages[1]!.model).toBe('claude-3-opus');
        expect(messages[1]!.tokens).toEqual({ input: 50, output: 100 });
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should skip malformed JSON lines', async () => {
      const filePath = await createTempJsonlFile([]);
      await fs.promises.writeFile(
        filePath,
        '{"type":"user","timestamp":"2025-01-15T10:30:00Z","message":{"content":"Valid"}}\n' +
          'invalid json line\n' +
          '{"type":"assistant","timestamp":"2025-01-15T10:30:05Z","message":{"content":"Also valid"}}',
        'utf-8'
      );

      try {
        const messages = await parseJsonlFile(filePath);
        expect(messages).toHaveLength(2);
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should skip empty lines', async () => {
      const filePath = await createTempJsonlFile([]);
      await fs.promises.writeFile(
        filePath,
        '{"type":"user","timestamp":"2025-01-15T10:30:00Z","message":{"content":"Valid"}}\n' +
          '\n' +
          '   \n' +
          '{"type":"assistant","timestamp":"2025-01-15T10:30:05Z","message":{"content":"Also valid"}}',
        'utf-8'
      );

      try {
        const messages = await parseJsonlFile(filePath);
        expect(messages).toHaveLength(2);
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should ignore non-user/assistant message types', async () => {
      const lines = [
        { type: 'user', timestamp: '2025-01-15T10:30:00Z', message: { content: 'Hello' } },
        { type: 'system', timestamp: '2025-01-15T10:30:00Z', message: { content: 'System message' } },
        { type: 'tool_result', timestamp: '2025-01-15T10:30:00Z', message: { content: 'Tool output' } },
        { type: 'assistant', timestamp: '2025-01-15T10:30:05Z', message: { content: 'Response' } },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const messages = await parseJsonlFile(filePath);
        expect(messages).toHaveLength(2);
        expect(messages.map((m) => m.type)).toEqual(['user', 'assistant']);
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should handle empty file', async () => {
      const filePath = await createTempJsonlFile([]);

      try {
        const messages = await parseJsonlFile(filePath);
        expect(messages).toEqual([]);
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should extract thinking content from assistant messages', async () => {
      const lines = [
        {
          type: 'user',
          uuid: 'user-1',
          timestamp: '2025-01-15T10:30:00Z',
          message: {
            content: [{ type: 'text', text: 'Explain recursion' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'asst-1',
          timestamp: '2025-01-15T10:30:05Z',
          message: {
            model: 'claude-3-opus',
            content: [
              { type: 'thinking', thinking: 'Let me think about how to explain recursion clearly.' },
              { type: 'text', text: 'Recursion is when a function calls itself.' },
            ],
            usage: { input_tokens: 50, output_tokens: 100 },
          },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const messages = await parseJsonlFile(filePath);

        expect(messages).toHaveLength(2);
        expect(messages[1]!.thinking).toBeDefined();
        expect(messages[1]!.thinking!.text).toBe('Let me think about how to explain recursion clearly.');
        expect(messages[1]!.thinking!.wordCount).toBe(9);
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should handle assistant messages without thinking', async () => {
      const lines = [
        {
          type: 'assistant',
          timestamp: '2025-01-15T10:30:05Z',
          message: {
            model: 'claude-3-haiku',
            content: [{ type: 'text', text: 'Simple response without thinking.' }],
          },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const messages = await parseJsonlFile(filePath);

        expect(messages).toHaveLength(1);
        expect(messages[0]!.thinking).toBeUndefined();
      } finally {
        await cleanupTempFile(filePath);
      }
    });
  });

  describe('extractPairsFromSession', () => {
    it('should extract prompt-response pairs from session file', async () => {
      const lines = [
        {
          type: 'user',
          uuid: 'abc123',
          timestamp: '2025-01-15T10:30:00Z',
          message: {
            content: [{ type: 'text', text: 'Write a fibonacci function' }],
          },
        },
        {
          type: 'assistant',
          timestamp: '2025-01-15T10:30:30Z',
          message: {
            model: 'claude-3-opus',
            content: [{ type: 'text', text: 'Here is a fibonacci function:' }],
            usage: { input_tokens: 50, output_tokens: 200 },
          },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const pairs = await extractPairsFromSession(filePath);

        expect(pairs).toHaveLength(1);
        expect(pairs[0]!.prompt.text).toBe('Write a fibonacci function');
        expect(pairs[0]!.prompt.uuid).toBe('abc123');
        expect(pairs[0]!.response!.text).toBe('Here is a fibonacci function:');
        expect(pairs[0]!.response!.model).toBe('claude-3-opus');
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should handle session with multiple conversations', async () => {
      const lines = [
        {
          type: 'user',
          timestamp: '2025-01-15T10:30:00Z',
          message: { content: 'Question 1' },
        },
        {
          type: 'assistant',
          timestamp: '2025-01-15T10:30:05Z',
          message: { content: 'Answer 1' },
        },
        {
          type: 'user',
          timestamp: '2025-01-15T10:31:00Z',
          message: { content: 'Question 2' },
        },
        {
          type: 'assistant',
          timestamp: '2025-01-15T10:31:05Z',
          message: { content: 'Answer 2' },
        },
        {
          type: 'user',
          timestamp: '2025-01-15T10:32:00Z',
          message: { content: 'Question 3' },
        },
        // No response - interrupted
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const pairs = await extractPairsFromSession(filePath);

        expect(pairs).toHaveLength(3);
        expect(pairs[2]!.response).toBeUndefined();
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should preserve timestamp precision', async () => {
      const lines = [
        {
          type: 'user',
          timestamp: '2025-01-15T10:30:45.123Z',
          message: { content: 'Test' },
        },
        {
          type: 'assistant',
          timestamp: '2025-01-15T10:30:50.456Z',
          message: { content: 'Response' },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const pairs = await extractPairsFromSession(filePath);

        expect(pairs[0]!.prompt.timestamp).toBe('2025-01-15T10:30:45.123Z');
        expect(pairs[0]!.response!.timestamp).toBe('2025-01-15T10:30:50.456Z');
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should include thinking content in paired responses', async () => {
      const lines = [
        {
          type: 'user',
          uuid: 'user-think',
          timestamp: '2025-01-15T10:30:00Z',
          message: {
            content: [{ type: 'text', text: 'Explain how to sort an array' }],
          },
        },
        {
          type: 'assistant',
          timestamp: '2025-01-15T10:30:30Z',
          message: {
            model: 'claude-3-opus',
            content: [
              { type: 'thinking', thinking: 'I should explain different sorting algorithms.' },
              { type: 'thinking', thinking: 'Quicksort would be a good example.' },
              { type: 'text', text: 'You can sort an array using quicksort.' },
            ],
            usage: { input_tokens: 50, output_tokens: 200 },
          },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const pairs = await extractPairsFromSession(filePath);

        expect(pairs).toHaveLength(1);
        expect(pairs[0]!.response).toBeDefined();
        expect(pairs[0]!.response!.thinking).toBeDefined();
        expect(pairs[0]!.response!.thinking!.text).toBe(
          'I should explain different sorting algorithms.\nQuicksort would be a good example.'
        );
        expect(pairs[0]!.response!.thinking!.wordCount).toBe(12);
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should handle response without thinking in paired output', async () => {
      const lines = [
        {
          type: 'user',
          timestamp: '2025-01-15T10:30:00Z',
          message: { content: 'Simple question' },
        },
        {
          type: 'assistant',
          timestamp: '2025-01-15T10:30:05Z',
          message: {
            content: [{ type: 'text', text: 'Simple answer' }],
          },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const pairs = await extractPairsFromSession(filePath);

        expect(pairs).toHaveLength(1);
        expect(pairs[0]!.response!.thinking).toBeUndefined();
      } finally {
        await cleanupTempFile(filePath);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very long prompts (over 200 characters)', async () => {
      const longText = 'A'.repeat(500);
      const lines = [
        {
          type: 'user',
          timestamp: '2025-01-15T10:30:00Z',
          message: { content: longText },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const pairs = await extractPairsFromSession(filePath);
        expect(pairs[0]!.prompt.text).toBe(longText);
        expect(pairs[0]!.prompt.text.length).toBe(500);
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should handle unicode content', async () => {
      const unicodeText = 'Hello world! Special chars: ;DROP TABLE users;';
      const lines = [
        {
          type: 'user',
          timestamp: '2025-01-15T10:30:00Z',
          message: { content: unicodeText },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const pairs = await extractPairsFromSession(filePath);
        expect(pairs[0]!.prompt.text).toBe(unicodeText);
      } finally {
        await cleanupTempFile(filePath);
      }
    });

    it('should handle newlines in content', async () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      const lines = [
        {
          type: 'user',
          timestamp: '2025-01-15T10:30:00Z',
          message: { content: multilineText },
        },
      ];

      const filePath = await createTempJsonlFile(lines);

      try {
        const pairs = await extractPairsFromSession(filePath);
        expect(pairs[0]!.prompt.text).toBe(multilineText);
      } finally {
        await cleanupTempFile(filePath);
      }
    });
  });
});
