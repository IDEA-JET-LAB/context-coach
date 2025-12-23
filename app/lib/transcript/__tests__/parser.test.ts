/**
 * Parser Tests
 * Story 15-2: JSONL Parser Implementation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  streamParseTranscript,
  parseTranscript,
  extractContentBlocks,
  extractTextContent,
  extractToolUseBlocks,
  extractToolResultBlocks,
  extractThinkingBlocks,
  type TranscriptMessage,
  type MessageType,
  type ContentBlock,
} from '../parser';

// ============================================================================
// Test Fixtures
// ============================================================================

const createUserMessage = (uuid: string, content: string): object => ({
  uuid,
  parentUuid: null,
  sessionId: 'test-session',
  type: 'user',
  timestamp: '2025-12-22T10:30:00.000Z',
  cwd: '/Users/test/project',
  gitBranch: 'main',
  version: '2.0.75',
  slug: 'test-session',
  message: {
    role: 'user',
    content,
  },
});

const createAssistantMessage = (
  uuid: string,
  parentUuid: string,
  content: string | ContentBlock[]
): object => ({
  uuid,
  parentUuid,
  sessionId: 'test-session',
  type: 'assistant',
  timestamp: '2025-12-22T10:30:05.000Z',
  requestId: 'req_test123',
  message: {
    role: 'assistant',
    model: 'claude-opus-4-5-20251101',
    id: 'msg_test123',
    content,
    usage: {
      input_tokens: 1234,
      output_tokens: 567,
      cache_read_input_tokens: 890,
    },
  },
});

const createFileHistorySnapshot = (uuid: string): object => ({
  uuid,
  parentUuid: null,
  sessionId: 'test-session',
  type: 'file-history-snapshot',
  timestamp: '2025-12-22T10:29:00.000Z',
});

const createSummary = (uuid: string): object => ({
  uuid,
  parentUuid: null,
  sessionId: 'test-session',
  type: 'summary',
  timestamp: '2025-12-22T10:35:00.000Z',
  message: {
    role: 'assistant',
    content: 'This is a conversation summary.',
  },
});

const createQueueOperation = (uuid: string): object => ({
  uuid,
  parentUuid: null,
  sessionId: 'test-session',
  type: 'queue-operation',
  timestamp: '2025-12-22T10:31:00.000Z',
});

const createToolUse = (uuid: string, parentUuid: string): object => ({
  uuid,
  parentUuid,
  sessionId: 'test-session',
  type: 'tool_use',
  timestamp: '2025-12-22T10:30:10.000Z',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_001',
        name: 'Read',
        input: { file_path: '/test/file.ts' },
      },
    ],
  },
});

const createToolResult = (uuid: string, parentUuid: string): object => ({
  uuid,
  parentUuid,
  sessionId: 'test-session',
  type: 'tool_result',
  timestamp: '2025-12-22T10:30:15.000Z',
  message: {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'toolu_001',
        content: 'File contents here...',
      },
    ],
  },
});

const createThinking = (uuid: string, parentUuid: string): object => ({
  uuid,
  parentUuid,
  sessionId: 'test-session',
  type: 'thinking',
  timestamp: '2025-12-22T10:30:03.000Z',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'thinking',
        thinking: 'Let me analyze this problem...',
        signature: 'sig_test123',
      },
    ],
  },
});

// ============================================================================
// Test Helpers
// ============================================================================

let tempDir: string;
let testFiles: string[] = [];

beforeAll(() => {
  // Create temp directory for test files
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-test-'));
});

afterAll(() => {
  // Clean up temp files
  for (const file of testFiles) {
    try {
      fs.unlinkSync(file);
    } catch {
      // Ignore cleanup errors
    }
  }
  try {
    fs.rmdirSync(tempDir);
  } catch {
    // Ignore cleanup errors
  }
});

function createTestFile(lines: (object | string)[]): string {
  const filePath = path.join(tempDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  const content = lines
    .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
    .join('\n');
  fs.writeFileSync(filePath, content, 'utf-8');
  testFiles.push(filePath);
  return filePath;
}

// ============================================================================
// Tests: streamParseTranscript
// ============================================================================

describe('streamParseTranscript', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('valid JSONL parsing', () => {
    it('should parse a single user message', async () => {
      const filePath = createTestFile([createUserMessage('msg-001', 'Hello Claude')]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(1);
      expect(messages[0]?.uuid).toBe('msg-001');
      expect(messages[0]?.type).toBe('user');
      expect(messages[0]?.message?.content).toBe('Hello Claude');
    });

    it('should parse all 8 message types', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'User prompt'),
        createAssistantMessage('msg-002', 'msg-001', 'Assistant response'),
        createFileHistorySnapshot('msg-003'),
        createSummary('msg-004'),
        createQueueOperation('msg-005'),
        createToolUse('msg-006', 'msg-002'),
        createToolResult('msg-007', 'msg-006'),
        createThinking('msg-008', 'msg-001'),
      ]);

      const messages: TranscriptMessage[] = [];
      const types: Set<MessageType> = new Set();

      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
        types.add(msg.type);
      }

      expect(messages).toHaveLength(8);
      expect(types.size).toBe(8);
      expect(types.has('user')).toBe(true);
      expect(types.has('assistant')).toBe(true);
      expect(types.has('file-history-snapshot')).toBe(true);
      expect(types.has('summary')).toBe(true);
      expect(types.has('queue-operation')).toBe(true);
      expect(types.has('tool_use')).toBe(true);
      expect(types.has('tool_result')).toBe(true);
      expect(types.has('thinking')).toBe(true);
    });

    it('should extract all core fields', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Test prompt'),
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      const msg = messages[0];
      expect(msg?.uuid).toBe('msg-001');
      expect(msg?.parentUuid).toBeNull();
      expect(msg?.sessionId).toBe('test-session');
      expect(msg?.timestamp).toBe('2025-12-22T10:30:00.000Z');
      expect(msg?.type).toBe('user');
    });

    it('should extract optional fields', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Test prompt'),
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      const msg = messages[0];
      expect(msg?.cwd).toBe('/Users/test/project');
      expect(msg?.gitBranch).toBe('main');
      expect(msg?.version).toBe('2.0.75');
      expect(msg?.slug).toBe('test-session');
    });

    it('should parse messages with parentUuid', async () => {
      const filePath = createTestFile([
        createAssistantMessage('msg-002', 'msg-001', 'Response'),
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages[0]?.parentUuid).toBe('msg-001');
    });
  });

  describe('malformed JSON handling', () => {
    it('should skip malformed JSON lines with warning', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Valid message'),
        'this is not valid json {{{',
        createUserMessage('msg-003', 'Another valid message'),
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(2);
      expect(messages[0]?.uuid).toBe('msg-001');
      expect(messages[1]?.uuid).toBe('msg-003');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should skip messages without uuid', async () => {
      const filePath = createTestFile([
        { type: 'user', sessionId: 'test', timestamp: '2025-01-01T00:00:00Z' },
        createUserMessage('msg-002', 'Valid message'),
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(1);
      expect(messages[0]?.uuid).toBe('msg-002');
    });

    it('should skip messages with invalid type', async () => {
      const filePath = createTestFile([
        { uuid: 'msg-001', type: 'invalid_type', sessionId: 'test', timestamp: '2025-01-01T00:00:00Z' },
        createUserMessage('msg-002', 'Valid message'),
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(1);
      expect(messages[0]?.uuid).toBe('msg-002');
    });

    it('should skip non-object lines', async () => {
      const filePath = createTestFile([
        '"just a string"',
        '123',
        'null',
        createUserMessage('msg-001', 'Valid message'),
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(1);
    });
  });

  describe('empty line handling', () => {
    it('should skip empty lines silently', async () => {
      const filePath = createTestFile([
        '',
        createUserMessage('msg-001', 'Message 1'),
        '',
        '',
        createUserMessage('msg-002', 'Message 2'),
        '',
      ]);

      const warnSpy = vi.spyOn(console, 'warn');
      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(2);
      // Empty lines should not trigger warnings
      expect(warnSpy.mock.calls.filter(call =>
        String(call[0]).includes('empty')
      )).toHaveLength(0);
    });

    it('should skip whitespace-only lines', async () => {
      const filePath = createTestFile([
        '   ',
        '\t\t',
        createUserMessage('msg-001', 'Valid message'),
        '  \t  ',
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(1);
    });
  });

  describe('timestamp normalization', () => {
    it('should preserve valid ISO timestamps', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Test'),
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages[0]?.timestamp).toBe('2025-12-22T10:30:00.000Z');
    });

    it('should normalize numeric timestamps', async () => {
      const timestamp = 1734867000000; // 2024-12-22T10:30:00.000Z
      const filePath = createTestFile([
        { uuid: 'msg-001', type: 'user', sessionId: 'test', timestamp },
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should provide default timestamp when missing', async () => {
      const filePath = createTestFile([
        { uuid: 'msg-001', type: 'user', sessionId: 'test' },
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
      }

      expect(messages[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('streaming behavior', () => {
    it('should allow early termination', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Message 1'),
        createUserMessage('msg-002', 'Message 2'),
        createUserMessage('msg-003', 'Message 3'),
        createUserMessage('msg-004', 'Message 4'),
        createUserMessage('msg-005', 'Message 5'),
      ]);

      const messages: TranscriptMessage[] = [];
      for await (const msg of streamParseTranscript(filePath)) {
        messages.push(msg);
        if (messages.length >= 2) {
          break;
        }
      }

      expect(messages).toHaveLength(2);
    });

    it('should yield messages one at a time', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Message 1'),
        createUserMessage('msg-002', 'Message 2'),
        createUserMessage('msg-003', 'Message 3'),
      ]);

      const generator = streamParseTranscript(filePath);

      const first = await generator.next();
      expect(first.done).toBe(false);
      expect(first.value?.uuid).toBe('msg-001');

      const second = await generator.next();
      expect(second.done).toBe(false);
      expect(second.value?.uuid).toBe('msg-002');

      const third = await generator.next();
      expect(third.done).toBe(false);
      expect(third.value?.uuid).toBe('msg-003');

      const done = await generator.next();
      expect(done.done).toBe(true);
    });
  });
});

// ============================================================================
// Tests: parseTranscript
// ============================================================================

describe('parseTranscript', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('batch parsing', () => {
    it('should return all messages', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Message 1'),
        createUserMessage('msg-002', 'Message 2'),
        createUserMessage('msg-003', 'Message 3'),
      ]);

      const result = await parseTranscript(filePath);

      expect(result.messages).toHaveLength(3);
    });

    it('should sort messages by timestamp', async () => {
      const filePath = createTestFile([
        { ...createUserMessage('msg-003', 'Late'), timestamp: '2025-12-22T12:00:00Z' },
        { ...createUserMessage('msg-001', 'Early'), timestamp: '2025-12-22T10:00:00Z' },
        { ...createUserMessage('msg-002', 'Middle'), timestamp: '2025-12-22T11:00:00Z' },
      ]);

      const result = await parseTranscript(filePath);

      expect(result.messages[0]?.uuid).toBe('msg-001');
      expect(result.messages[1]?.uuid).toBe('msg-002');
      expect(result.messages[2]?.uuid).toBe('msg-003');
    });

    it('should respect sort: false option', async () => {
      const filePath = createTestFile([
        { ...createUserMessage('msg-003', 'Late'), timestamp: '2025-12-22T12:00:00Z' },
        { ...createUserMessage('msg-001', 'Early'), timestamp: '2025-12-22T10:00:00Z' },
      ]);

      const result = await parseTranscript(filePath, { sort: false });

      // Should maintain file order
      expect(result.messages[0]?.uuid).toBe('msg-003');
      expect(result.messages[1]?.uuid).toBe('msg-001');
    });
  });

  describe('limit option', () => {
    it('should respect limit option', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Message 1'),
        createUserMessage('msg-002', 'Message 2'),
        createUserMessage('msg-003', 'Message 3'),
        createUserMessage('msg-004', 'Message 4'),
        createUserMessage('msg-005', 'Message 5'),
      ]);

      const result = await parseTranscript(filePath, { limit: 2 });

      expect(result.messages).toHaveLength(2);
    });

    it('should return all if limit exceeds count', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Message 1'),
        createUserMessage('msg-002', 'Message 2'),
      ]);

      const result = await parseTranscript(filePath, { limit: 10 });

      expect(result.messages).toHaveLength(2);
    });
  });

  describe('parse statistics', () => {
    it('should return accurate stats for clean file', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Message 1'),
        createUserMessage('msg-002', 'Message 2'),
        createUserMessage('msg-003', 'Message 3'),
      ]);

      const result = await parseTranscript(filePath);

      expect(result.stats.parsedLines).toBe(3);
      expect(result.stats.skippedLines).toBe(0);
      expect(result.stats.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track empty lines separately', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Message 1'),
        '',
        '',
        createUserMessage('msg-002', 'Message 2'),
      ]);

      const result = await parseTranscript(filePath);

      expect(result.stats.parsedLines).toBe(2);
      expect(result.stats.emptyLines).toBe(2);
    });

    it('should track skipped malformed lines', async () => {
      const filePath = createTestFile([
        createUserMessage('msg-001', 'Valid'),
        'invalid json',
        { uuid: 'msg-002', type: 'invalid_type' }, // Invalid type
        createUserMessage('msg-003', 'Valid'),
      ]);

      const result = await parseTranscript(filePath);

      expect(result.stats.parsedLines).toBe(2);
      expect(result.stats.skippedLines).toBe(2);
    });
  });

  describe('empty file handling', () => {
    it('should handle empty file', async () => {
      const filePath = createTestFile([]);

      const result = await parseTranscript(filePath);

      expect(result.messages).toHaveLength(0);
      expect(result.stats.totalLines).toBe(0);
    });

    it('should handle file with only empty lines', async () => {
      // Note: ['', '', ''].join('\n') creates "\n\n" which readline reads as 2 empty lines
      // (the trailing newline doesn't create an extra line)
      const filePath = createTestFile(['', '', '']);

      const result = await parseTranscript(filePath);

      expect(result.messages).toHaveLength(0);
      // With 3 empty strings joined by \n, we get 2 newlines = 2 empty lines read
      expect(result.stats.emptyLines).toBe(2);
    });
  });
});

// ============================================================================
// Tests: extractContentBlocks
// ============================================================================

describe('extractContentBlocks', () => {
  it('should return empty array for non-assistant messages', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'user',
      message: {
        role: 'user',
        content: 'Hello',
      },
    };

    const blocks = extractContentBlocks(message);
    expect(blocks).toHaveLength(0);
  });

  it('should convert string content to TextBlock', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: 'Hello, I am Claude.',
      },
    };

    const blocks = extractContentBlocks(message);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('text');
    expect((blocks[0] as { type: 'text'; text: string }).text).toBe('Hello, I am Claude.');
  });

  it('should return content blocks array as-is', () => {
    const contentBlocks: ContentBlock[] = [
      { type: 'text', text: 'Let me help you.' },
      { type: 'tool_use', id: 'toolu_001', name: 'Read', input: { file: 'test.ts' } },
    ];

    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: contentBlocks,
      },
    };

    const blocks = extractContentBlocks(message);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe('text');
    expect(blocks[1]?.type).toBe('tool_use');
  });

  it('should return empty array for message without content', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'assistant',
    };

    const blocks = extractContentBlocks(message);
    expect(blocks).toHaveLength(0);
  });
});

// ============================================================================
// Tests: extractTextContent
// ============================================================================

describe('extractTextContent', () => {
  it('should return string content directly', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'user',
      message: {
        role: 'user',
        content: 'Hello Claude',
      },
    };

    const text = extractTextContent(message);
    expect(text).toBe('Hello Claude');
  });

  it('should extract text from content blocks', () => {
    const contentBlocks: ContentBlock[] = [
      { type: 'text', text: 'First paragraph.' },
      { type: 'tool_use', id: 'toolu_001', name: 'Read', input: {} },
      { type: 'text', text: 'Second paragraph.' },
    ];

    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: contentBlocks,
      },
    };

    const text = extractTextContent(message);
    expect(text).toBe('First paragraph.\nSecond paragraph.');
  });

  it('should return empty string for no content', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'file-history-snapshot',
    };

    const text = extractTextContent(message);
    expect(text).toBe('');
  });

  it('should handle content with only non-text blocks', () => {
    const contentBlocks: ContentBlock[] = [
      { type: 'tool_use', id: 'toolu_001', name: 'Read', input: {} },
      { type: 'tool_result', tool_use_id: 'toolu_001', content: 'Result' },
    ];

    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: contentBlocks,
      },
    };

    const text = extractTextContent(message);
    expect(text).toBe('');
  });
});

// ============================================================================
// Tests: extractToolUseBlocks
// ============================================================================

describe('extractToolUseBlocks', () => {
  it('should extract tool_use blocks', () => {
    const contentBlocks: ContentBlock[] = [
      { type: 'text', text: 'Let me read that file.' },
      { type: 'tool_use', id: 'toolu_001', name: 'Read', input: { file_path: '/test.ts' } },
      { type: 'tool_use', id: 'toolu_002', name: 'Bash', input: { command: 'ls' } },
    ];

    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: contentBlocks,
      },
    };

    const tools = extractToolUseBlocks(message);
    expect(tools).toHaveLength(2);
    expect(tools[0]?.name).toBe('Read');
    expect(tools[1]?.name).toBe('Bash');
  });

  it('should return empty array when no tool_use blocks', () => {
    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: 'Just a text response.',
      },
    };

    const tools = extractToolUseBlocks(message);
    expect(tools).toHaveLength(0);
  });
});

// ============================================================================
// Tests: extractToolResultBlocks
// ============================================================================

describe('extractToolResultBlocks', () => {
  it('should extract tool_result blocks', () => {
    const contentBlocks: ContentBlock[] = [
      { type: 'tool_result', tool_use_id: 'toolu_001', content: 'File contents...' },
      { type: 'text', text: 'I see the file.' },
      { type: 'tool_result', tool_use_id: 'toolu_002', content: 'Command output...' },
    ];

    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'user',
      message: {
        role: 'user',
        content: contentBlocks,
      },
    };

    const results = extractToolResultBlocks(message);
    expect(results).toHaveLength(2);
    expect(results[0]?.tool_use_id).toBe('toolu_001');
    expect(results[1]?.tool_use_id).toBe('toolu_002');
  });
});

// ============================================================================
// Tests: extractThinkingBlocks
// ============================================================================

describe('extractThinkingBlocks', () => {
  it('should extract thinking blocks', () => {
    const contentBlocks: ContentBlock[] = [
      { type: 'thinking', thinking: 'Let me think about this...', signature: 'sig_001' },
      { type: 'text', text: 'After consideration...' },
    ];

    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: contentBlocks,
      },
    };

    const thinking = extractThinkingBlocks(message);
    expect(thinking).toHaveLength(1);
    expect(thinking[0]?.thinking).toBe('Let me think about this...');
    expect(thinking[0]?.signature).toBe('sig_001');
  });
});

// ============================================================================
// Tests: Complex content structures
// ============================================================================

describe('complex content structures', () => {
  it('should handle nested tool_result content', () => {
    const contentBlocks: ContentBlock[] = [
      {
        type: 'tool_result',
        tool_use_id: 'toolu_001',
        content: [
          { type: 'text', text: 'Nested text result' },
        ],
      },
    ];

    const message: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      timestamp: '2025-01-01T00:00:00Z',
      type: 'user',
      message: {
        role: 'user',
        content: contentBlocks,
      },
    };

    const results = extractToolResultBlocks(message);
    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0]?.content)).toBe(true);
  });

  it('should handle assistant message with usage stats', async () => {
    const filePath = createTestFile([
      createAssistantMessage('msg-001', 'parent-001', 'Response text'),
    ]);

    const result = await parseTranscript(filePath);
    const msg = result.messages[0];

    expect(msg?.message?.usage).toBeDefined();
    expect(msg?.message?.usage?.input_tokens).toBe(1234);
    expect(msg?.message?.usage?.output_tokens).toBe(567);
    expect(msg?.message?.usage?.cache_read_input_tokens).toBe(890);
  });

  it('should handle message with all optional fields', async () => {
    const fullMessage = {
      uuid: 'msg-full',
      parentUuid: 'msg-parent',
      sessionId: 'session-123',
      type: 'user',
      timestamp: '2025-12-22T10:30:00.000Z',
      cwd: '/path/to/project',
      gitBranch: 'feature-branch',
      version: '2.0.75',
      slug: 'my-session',
      requestId: 'req_123',
      message: {
        role: 'user',
        content: 'Full message with all fields',
      },
    };

    const filePath = createTestFile([fullMessage]);
    const result = await parseTranscript(filePath);
    const msg = result.messages[0];

    expect(msg?.uuid).toBe('msg-full');
    expect(msg?.parentUuid).toBe('msg-parent');
    expect(msg?.sessionId).toBe('session-123');
    expect(msg?.cwd).toBe('/path/to/project');
    expect(msg?.gitBranch).toBe('feature-branch');
    expect(msg?.version).toBe('2.0.75');
    expect(msg?.slug).toBe('my-session');
    expect(msg?.requestId).toBe('req_123');
  });
});
