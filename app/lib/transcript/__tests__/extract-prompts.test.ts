/**
 * Extract Prompts Tests
 * Story 15-3: User Message Extraction
 */

import { describe, it, expect } from 'vitest';
import type { TranscriptMessage, ContentBlock } from '../parser';
import {
  extractPrompts,
  extractPromptsFromSession,
  isUserPrompt,
  isToolResult,
  type ExtractedPrompt,
  type ExtractionResult,
} from '../extract-prompts';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a user prompt message (string content)
 */
function createUserPromptMessage(
  uuid: string,
  content: string,
  options: {
    sessionId?: string;
    timestamp?: string;
    parentUuid?: string | null;
    cwd?: string;
    gitBranch?: string;
    version?: string;
    slug?: string;
  } = {}
): TranscriptMessage {
  return {
    uuid,
    parentUuid: options.parentUuid ?? null,
    sessionId: options.sessionId ?? 'test-session',
    type: 'user',
    timestamp: options.timestamp ?? '2025-12-22T10:30:00.000Z',
    cwd: options.cwd,
    gitBranch: options.gitBranch,
    version: options.version,
    slug: options.slug,
    message: {
      role: 'user',
      content,
    },
  };
}

/**
 * Create a tool result message (array content)
 */
function createToolResultMessage(
  uuid: string,
  toolUseId: string,
  resultContent: string,
  options: {
    sessionId?: string;
    timestamp?: string;
    parentUuid?: string | null;
  } = {}
): TranscriptMessage {
  return {
    uuid,
    parentUuid: options.parentUuid ?? null,
    sessionId: options.sessionId ?? 'test-session',
    type: 'user',
    timestamp: options.timestamp ?? '2025-12-22T10:30:00.000Z',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: resultContent,
        },
      ] as ContentBlock[],
    },
  };
}

/**
 * Create an assistant message
 */
function createAssistantMessage(
  uuid: string,
  content: string | ContentBlock[],
  options: {
    sessionId?: string;
    timestamp?: string;
    parentUuid?: string | null;
  } = {}
): TranscriptMessage {
  return {
    uuid,
    parentUuid: options.parentUuid ?? null,
    sessionId: options.sessionId ?? 'test-session',
    type: 'assistant',
    timestamp: options.timestamp ?? '2025-12-22T10:30:05.000Z',
    message: {
      role: 'assistant',
      content,
    },
  };
}

/**
 * Create a file-history-snapshot message
 */
function createFileHistorySnapshot(
  uuid: string,
  options: {
    sessionId?: string;
    timestamp?: string;
  } = {}
): TranscriptMessage {
  return {
    uuid,
    parentUuid: null,
    sessionId: options.sessionId ?? 'test-session',
    type: 'file-history-snapshot',
    timestamp: options.timestamp ?? '2025-12-22T10:29:00.000Z',
  };
}

// ============================================================================
// Tests: isUserPrompt
// ============================================================================

describe('isUserPrompt', () => {
  it('should return true for user message with string content', () => {
    const msg = createUserPromptMessage('msg-001', 'Hello Claude');
    expect(isUserPrompt(msg)).toBe(true);
  });

  it('should return false for user message with array content (tool result)', () => {
    const msg = createToolResultMessage('msg-001', 'toolu_001', 'file contents');
    expect(isUserPrompt(msg)).toBe(false);
  });

  it('should return false for assistant message', () => {
    const msg = createAssistantMessage('msg-001', 'Hello, how can I help?');
    expect(isUserPrompt(msg)).toBe(false);
  });

  it('should return false for file-history-snapshot message', () => {
    const msg = createFileHistorySnapshot('msg-001');
    expect(isUserPrompt(msg)).toBe(false);
  });

  it('should return false for message without message property', () => {
    const msg: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      type: 'user',
      timestamp: '2025-01-01T00:00:00Z',
    };
    expect(isUserPrompt(msg)).toBe(false);
  });

  it('should return false for message with wrong role', () => {
    const msg: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      type: 'user',
      timestamp: '2025-01-01T00:00:00Z',
      message: {
        role: 'assistant',
        content: 'test',
      },
    };
    expect(isUserPrompt(msg)).toBe(false);
  });
});

// ============================================================================
// Tests: isToolResult
// ============================================================================

describe('isToolResult', () => {
  it('should return true for user message with array content', () => {
    const msg = createToolResultMessage('msg-001', 'toolu_001', 'file contents');
    expect(isToolResult(msg)).toBe(true);
  });

  it('should return false for user message with string content', () => {
    const msg = createUserPromptMessage('msg-001', 'Hello Claude');
    expect(isToolResult(msg)).toBe(false);
  });

  it('should return false for assistant message with array content', () => {
    const msg = createAssistantMessage('msg-001', [
      { type: 'text', text: 'Let me help' },
      { type: 'tool_use', id: 'toolu_001', name: 'Read', input: {} },
    ]);
    expect(isToolResult(msg)).toBe(false);
  });

  it('should return false for message without message property', () => {
    const msg: TranscriptMessage = {
      uuid: 'msg-001',
      parentUuid: null,
      sessionId: 'test',
      type: 'user',
      timestamp: '2025-01-01T00:00:00Z',
    };
    expect(isToolResult(msg)).toBe(false);
  });
});

// ============================================================================
// Tests: extractPrompts - Basic Extraction
// ============================================================================

describe('extractPrompts - basic extraction', () => {
  it('should extract a single user prompt', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Hello Claude'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.uuid).toBe('msg-001');
    expect(result.prompts[0]?.text).toBe('Hello Claude');
  });

  it('should extract multiple user prompts', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'First prompt'),
      createUserPromptMessage('msg-002', 'Second prompt'),
      createUserPromptMessage('msg-003', 'Third prompt'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts).toHaveLength(3);
  });

  it('should exclude tool result messages', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'User prompt'),
      createToolResultMessage('msg-002', 'toolu_001', 'File contents here'),
      createUserPromptMessage('msg-003', 'Another prompt'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts).toHaveLength(2);
    expect(result.prompts[0]?.uuid).toBe('msg-001');
    expect(result.prompts[1]?.uuid).toBe('msg-003');
  });

  it('should exclude assistant messages', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'User prompt'),
      createAssistantMessage('msg-002', 'Assistant response'),
      createUserPromptMessage('msg-003', 'Follow-up prompt'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts).toHaveLength(2);
  });

  it('should exclude file-history-snapshot messages', () => {
    const messages: TranscriptMessage[] = [
      createFileHistorySnapshot('msg-000'),
      createUserPromptMessage('msg-001', 'User prompt'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.uuid).toBe('msg-001');
  });

  it('should handle empty message array', () => {
    const result = extractPrompts([]);

    expect(result.prompts).toHaveLength(0);
    expect(result.stats.totalMessages).toBe(0);
    expect(result.stats.extractedPrompts).toBe(0);
  });
});

// ============================================================================
// Tests: extractPrompts - Metadata Extraction
// ============================================================================

describe('extractPrompts - metadata extraction', () => {
  it('should extract cwd metadata', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test', { cwd: '/Users/test/project' }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.cwd).toBe('/Users/test/project');
  });

  it('should extract gitBranch metadata', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test', { gitBranch: 'feature/auth' }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.gitBranch).toBe('feature/auth');
  });

  it('should extract version as claudeCodeVersion', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test', { version: '2.0.75' }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.claudeCodeVersion).toBe('2.0.75');
  });

  it('should extract slug metadata', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test', { slug: 'fix-auth-bug' }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.slug).toBe('fix-auth-bug');
  });

  it('should extract all metadata together', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test', {
        cwd: '/Users/edgars/project',
        gitBranch: 'main',
        version: '2.0.80',
        slug: 'my-session',
      }),
    ];

    const result = extractPrompts(messages);
    const prompt = result.prompts[0]!;

    expect(prompt.cwd).toBe('/Users/edgars/project');
    expect(prompt.gitBranch).toBe('main');
    expect(prompt.claudeCodeVersion).toBe('2.0.80');
    expect(prompt.slug).toBe('my-session');
  });

  it('should default missing metadata to null', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test'),
    ];

    const result = extractPrompts(messages);
    const prompt = result.prompts[0]!;

    expect(prompt.cwd).toBeNull();
    expect(prompt.gitBranch).toBeNull();
    expect(prompt.claudeCodeVersion).toBeNull();
    expect(prompt.slug).toBeNull();
  });
});

// ============================================================================
// Tests: extractPrompts - Timestamp and ID Handling
// ============================================================================

describe('extractPrompts - timestamp and ID handling', () => {
  it('should parse timestamp to Date object', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test', {
        timestamp: '2025-12-22T10:30:00.000Z',
      }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.timestamp).toBeInstanceOf(Date);
    expect(result.prompts[0]?.timestamp.toISOString()).toBe('2025-12-22T10:30:00.000Z');
  });

  it('should preserve uuid', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('unique-uuid-123', 'Test'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.uuid).toBe('unique-uuid-123');
  });

  it('should preserve sessionId', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test', { sessionId: 'session-abc' }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.sessionId).toBe('session-abc');
  });

  it('should preserve parentUuid when present', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-002', 'Test', { parentUuid: 'msg-001' }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.parentUuid).toBe('msg-001');
  });

  it('should set parentUuid to null when not present', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test', { parentUuid: null }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.parentUuid).toBeNull();
  });
});

// ============================================================================
// Tests: extractPrompts - Chronological Ordering
// ============================================================================

describe('extractPrompts - chronological ordering', () => {
  it('should order prompts chronologically', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-003', 'Third', {
        timestamp: '2025-12-22T12:00:00.000Z',
      }),
      createUserPromptMessage('msg-001', 'First', {
        timestamp: '2025-12-22T10:00:00.000Z',
      }),
      createUserPromptMessage('msg-002', 'Second', {
        timestamp: '2025-12-22T11:00:00.000Z',
      }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.uuid).toBe('msg-001');
    expect(result.prompts[1]?.uuid).toBe('msg-002');
    expect(result.prompts[2]?.uuid).toBe('msg-003');
  });

  it('should handle messages with same timestamp', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'First', {
        timestamp: '2025-12-22T10:00:00.000Z',
      }),
      createUserPromptMessage('msg-002', 'Second', {
        timestamp: '2025-12-22T10:00:00.000Z',
      }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts).toHaveLength(2);
    // Order is stable but not guaranteed when timestamps are equal
    const uuids = result.prompts.map((p) => p.uuid);
    expect(uuids).toContain('msg-001');
    expect(uuids).toContain('msg-002');
  });

  it('should handle out-of-order timestamps gracefully', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-late', 'Late message', {
        timestamp: '2025-12-23T10:00:00.000Z',
      }),
      createUserPromptMessage('msg-early', 'Early message', {
        timestamp: '2025-12-21T10:00:00.000Z',
      }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.uuid).toBe('msg-early');
    expect(result.prompts[1]?.uuid).toBe('msg-late');
  });
});

// ============================================================================
// Tests: extractPrompts - Sequence Numbers
// ============================================================================

describe('extractPrompts - sequence numbers', () => {
  it('should assign sequence numbers starting from 1', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'First', {
        sessionId: 'session-1',
        timestamp: '2025-12-22T10:00:00.000Z',
      }),
      createUserPromptMessage('msg-002', 'Second', {
        sessionId: 'session-1',
        timestamp: '2025-12-22T10:01:00.000Z',
      }),
      createUserPromptMessage('msg-003', 'Third', {
        sessionId: 'session-1',
        timestamp: '2025-12-22T10:02:00.000Z',
      }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.sequenceNumber).toBe(1);
    expect(result.prompts[1]?.sequenceNumber).toBe(2);
    expect(result.prompts[2]?.sequenceNumber).toBe(3);
  });

  it('should assign sequence numbers per session', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-a1', 'Session A first', {
        sessionId: 'session-a',
        timestamp: '2025-12-22T10:00:00.000Z',
      }),
      createUserPromptMessage('msg-b1', 'Session B first', {
        sessionId: 'session-b',
        timestamp: '2025-12-22T10:01:00.000Z',
      }),
      createUserPromptMessage('msg-a2', 'Session A second', {
        sessionId: 'session-a',
        timestamp: '2025-12-22T10:02:00.000Z',
      }),
      createUserPromptMessage('msg-b2', 'Session B second', {
        sessionId: 'session-b',
        timestamp: '2025-12-22T10:03:00.000Z',
      }),
    ];

    const result = extractPrompts(messages);

    // Session A prompts
    const sessionAPrompts = result.prompts.filter((p) => p.sessionId === 'session-a');
    expect(sessionAPrompts[0]?.sequenceNumber).toBe(1);
    expect(sessionAPrompts[1]?.sequenceNumber).toBe(2);

    // Session B prompts
    const sessionBPrompts = result.prompts.filter((p) => p.sessionId === 'session-b');
    expect(sessionBPrompts[0]?.sequenceNumber).toBe(1);
    expect(sessionBPrompts[1]?.sequenceNumber).toBe(2);
  });

  it('should maintain sequence numbers based on chronological order', () => {
    // Session A prompt at 10:00, Session B prompt at 10:01, Session A prompt at 10:02
    // After sorting: A1(10:00) -> B1(10:01) -> A2(10:02)
    // Sequence numbers: A gets 1,2 and B gets 1
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-a2', 'Session A second', {
        sessionId: 'session-a',
        timestamp: '2025-12-22T10:02:00.000Z',
      }),
      createUserPromptMessage('msg-a1', 'Session A first', {
        sessionId: 'session-a',
        timestamp: '2025-12-22T10:00:00.000Z',
      }),
      createUserPromptMessage('msg-b1', 'Session B first', {
        sessionId: 'session-b',
        timestamp: '2025-12-22T10:01:00.000Z',
      }),
    ];

    const result = extractPrompts(messages);

    // Order should be: a1, b1, a2
    expect(result.prompts[0]?.uuid).toBe('msg-a1');
    expect(result.prompts[0]?.sequenceNumber).toBe(1);

    expect(result.prompts[1]?.uuid).toBe('msg-b1');
    expect(result.prompts[1]?.sequenceNumber).toBe(1);

    expect(result.prompts[2]?.uuid).toBe('msg-a2');
    expect(result.prompts[2]?.sequenceNumber).toBe(2);
  });
});

// ============================================================================
// Tests: extractPrompts - Character and Word Count
// ============================================================================

describe('extractPrompts - character and word count', () => {
  it('should calculate character count correctly', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Hello'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.charCount).toBe(5);
  });

  it('should calculate word count correctly', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Hello Claude how are you'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.wordCount).toBe(5);
  });

  it('should handle single word', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Hello'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.wordCount).toBe(1);
  });

  it('should handle multiple spaces between words', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Hello   Claude    world'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.wordCount).toBe(3);
  });

  it('should handle leading and trailing whitespace', () => {
    const text = '  Hello world  ';
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', text),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.wordCount).toBe(2);
    expect(result.prompts[0]?.charCount).toBe(text.length); // includes whitespace
  });

  it('should handle newlines in word count', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Hello\nworld\ntest'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.wordCount).toBe(3);
  });

  it('should handle tabs in word count', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Hello\tworld\ttest'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.wordCount).toBe(3);
  });

  it('should handle empty string', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', ''),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.charCount).toBe(0);
    expect(result.prompts[0]?.wordCount).toBe(0);
  });

  it('should handle whitespace-only string', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', '   '),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.charCount).toBe(3);
    expect(result.prompts[0]?.wordCount).toBe(0);
  });

  it('should handle long prompt accurately', () => {
    const longText = 'This is a longer prompt that contains many words and should be counted accurately for both character count and word count purposes in the test suite.';
    const expectedWordCount = longText.trim().split(/\s+/).length;
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', longText),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.charCount).toBe(longText.length);
    expect(result.prompts[0]?.wordCount).toBe(expectedWordCount);
  });
});

// ============================================================================
// Tests: extractPrompts - Code Block Detection
// ============================================================================

describe('extractPrompts - code block detection', () => {
  it('should detect code blocks with triple backticks', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage(
        'msg-001',
        'Here is some code:\n```typescript\nconst x = 1;\n```'
      ),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.hasCodeBlocks).toBe(true);
  });

  it('should detect code blocks without language specifier', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Check this:\n```\nconst x = 1;\n```'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.hasCodeBlocks).toBe(true);
  });

  it('should return false when no code blocks present', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'This is plain text without any code'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.hasCodeBlocks).toBe(false);
  });

  it('should detect incomplete/unclosed code blocks', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Here is code:\n```\nconst x = 1;'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.hasCodeBlocks).toBe(true);
  });

  it('should detect inline backticks as not code blocks', () => {
    // Single backticks are inline code, not code blocks
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Use the `console.log` function'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.hasCodeBlocks).toBe(false);
  });

  it('should detect multiple code blocks', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage(
        'msg-001',
        '```js\nfirst\n```\nsome text\n```python\nsecond\n```'
      ),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.hasCodeBlocks).toBe(true);
  });
});

// ============================================================================
// Tests: extractPrompts - Question Detection
// ============================================================================

describe('extractPrompts - question detection', () => {
  it('should detect questions ending with ?', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'How do I fix this bug?'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.isQuestion).toBe(true);
  });

  it('should return false for statements', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Fix this bug for me'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.isQuestion).toBe(false);
  });

  it('should detect questions with trailing whitespace', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'What is this?  '),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.isQuestion).toBe(true);
  });

  it('should detect questions with trailing newlines', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'What is this?\n'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.isQuestion).toBe(true);
  });

  it('should not detect questions with ? in the middle', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'What? I want you to fix it'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.isQuestion).toBe(false);
  });

  it('should detect multi-line questions', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage(
        'msg-001',
        'I have a problem.\nCan you help me fix it?'
      ),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.isQuestion).toBe(true);
  });
});

// ============================================================================
// Tests: extractPrompts - Statistics
// ============================================================================

describe('extractPrompts - statistics', () => {
  it('should count total messages', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Prompt 1'),
      createAssistantMessage('msg-002', 'Response 1'),
      createUserPromptMessage('msg-003', 'Prompt 2'),
    ];

    const result = extractPrompts(messages);

    expect(result.stats.totalMessages).toBe(3);
  });

  it('should count user messages', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Prompt 1'),
      createAssistantMessage('msg-002', 'Response 1'),
      createToolResultMessage('msg-003', 'toolu_001', 'result'),
      createUserPromptMessage('msg-004', 'Prompt 2'),
    ];

    const result = extractPrompts(messages);

    expect(result.stats.userMessages).toBe(3); // 2 prompts + 1 tool result
  });

  it('should count tool result messages', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Prompt'),
      createToolResultMessage('msg-002', 'toolu_001', 'result 1'),
      createToolResultMessage('msg-003', 'toolu_002', 'result 2'),
    ];

    const result = extractPrompts(messages);

    expect(result.stats.toolResultMessages).toBe(2);
  });

  it('should count extracted prompts', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Prompt 1'),
      createToolResultMessage('msg-002', 'toolu_001', 'result'),
      createUserPromptMessage('msg-003', 'Prompt 2'),
      createUserPromptMessage('msg-004', 'Prompt 3'),
    ];

    const result = extractPrompts(messages);

    expect(result.stats.extractedPrompts).toBe(3);
  });

  it('should count unique sessions', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Session A', { sessionId: 'session-a' }),
      createUserPromptMessage('msg-002', 'Session B', { sessionId: 'session-b' }),
      createUserPromptMessage('msg-003', 'Session A again', { sessionId: 'session-a' }),
      createUserPromptMessage('msg-004', 'Session C', { sessionId: 'session-c' }),
    ];

    const result = extractPrompts(messages);

    expect(result.stats.sessionsFound).toBe(3);
  });

  it('should return zero stats for empty input', () => {
    const result = extractPrompts([]);

    expect(result.stats).toEqual({
      totalMessages: 0,
      userMessages: 0,
      toolResultMessages: 0,
      extractedPrompts: 0,
      sessionsFound: 0,
    });
  });

  it('should handle all tool results (no extracted prompts)', () => {
    const messages: TranscriptMessage[] = [
      createToolResultMessage('msg-001', 'toolu_001', 'result 1'),
      createToolResultMessage('msg-002', 'toolu_002', 'result 2'),
    ];

    const result = extractPrompts(messages);

    expect(result.stats.userMessages).toBe(2);
    expect(result.stats.toolResultMessages).toBe(2);
    expect(result.stats.extractedPrompts).toBe(0);
  });
});

// ============================================================================
// Tests: extractPromptsFromSession
// ============================================================================

describe('extractPromptsFromSession', () => {
  it('should extract prompts from specific session only', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-a1', 'Session A first', { sessionId: 'session-a' }),
      createUserPromptMessage('msg-b1', 'Session B first', { sessionId: 'session-b' }),
      createUserPromptMessage('msg-a2', 'Session A second', { sessionId: 'session-a' }),
    ];

    const sessionAPrompts = extractPromptsFromSession(messages, 'session-a');

    expect(sessionAPrompts).toHaveLength(2);
    expect(sessionAPrompts[0]?.uuid).toBe('msg-a1');
    expect(sessionAPrompts[1]?.uuid).toBe('msg-a2');
  });

  it('should return empty array for non-existent session', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Test', { sessionId: 'session-a' }),
    ];

    const sessionPrompts = extractPromptsFromSession(messages, 'non-existent');

    expect(sessionPrompts).toHaveLength(0);
  });

  it('should assign sequence numbers correctly for single session', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-a1', 'First', {
        sessionId: 'session-a',
        timestamp: '2025-12-22T10:00:00.000Z',
      }),
      createUserPromptMessage('msg-b1', 'Other session', {
        sessionId: 'session-b',
        timestamp: '2025-12-22T10:01:00.000Z',
      }),
      createUserPromptMessage('msg-a2', 'Second', {
        sessionId: 'session-a',
        timestamp: '2025-12-22T10:02:00.000Z',
      }),
    ];

    const sessionAPrompts = extractPromptsFromSession(messages, 'session-a');

    expect(sessionAPrompts[0]?.sequenceNumber).toBe(1);
    expect(sessionAPrompts[1]?.sequenceNumber).toBe(2);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('extractPrompts - edge cases', () => {
  it('should handle prompts with unicode characters', () => {
    const text = 'Hello \u{1F30D} World'; // Hello Globe World (with emoji)
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', text),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.text).toBe(text);
    expect(result.prompts[0]?.charCount).toBe(text.length);
    expect(result.prompts[0]?.wordCount).toBe(3); // Hello, emoji, World are 3 tokens
  });

  it('should handle prompts with special characters', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Fix the @#$% bug in /path/to/file.ts'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.wordCount).toBe(6);
  });

  it('should handle very long prompts', () => {
    const longText = 'word '.repeat(10000).trim();
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', longText),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.wordCount).toBe(10000);
    expect(result.prompts[0]?.charCount).toBe(longText.length);
  });

  it('should handle prompts with only code blocks', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', '```\nconst x = 1;\n```'),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.hasCodeBlocks).toBe(true);
    expect(result.prompts[0]?.isQuestion).toBe(false);
  });

  it('should handle mixed content prompts', () => {
    const text = `Can you help me with this code?

\`\`\`typescript
function test() {
  return 42;
}
\`\`\`

I need to add error handling.`;

    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', text),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts[0]?.hasCodeBlocks).toBe(true);
    expect(result.prompts[0]?.isQuestion).toBe(false); // ends with statement
  });
});

// ============================================================================
// Tests: Integration-style Tests
// ============================================================================

describe('extractPrompts - integration scenarios', () => {
  it('should handle a realistic conversation flow', () => {
    const messages: TranscriptMessage[] = [
      // Session starts
      createFileHistorySnapshot('snap-001', { sessionId: 'session-1' }),

      // User asks a question
      createUserPromptMessage('msg-001', 'How do I fix this authentication bug?', {
        sessionId: 'session-1',
        timestamp: '2025-12-22T10:00:00.000Z',
        cwd: '/Users/dev/project',
        gitBranch: 'main',
        version: '2.0.75',
        slug: 'fix-auth-bug',
      }),

      // Assistant responds and uses tool
      createAssistantMessage('msg-002', 'Let me check the code.', {
        sessionId: 'session-1',
        timestamp: '2025-12-22T10:00:01.000Z',
        parentUuid: 'msg-001',
      }),

      // Tool result
      createToolResultMessage('msg-003', 'toolu_001', 'file contents...', {
        sessionId: 'session-1',
        timestamp: '2025-12-22T10:00:02.000Z',
        parentUuid: 'msg-002',
      }),

      // User follows up
      createUserPromptMessage('msg-004', 'Can you show me the full implementation?', {
        sessionId: 'session-1',
        timestamp: '2025-12-22T10:01:00.000Z',
        parentUuid: 'msg-003',
        cwd: '/Users/dev/project',
        gitBranch: 'main',
        version: '2.0.75',
        slug: 'fix-auth-bug',
      }),

      // User in different session
      createUserPromptMessage('msg-005', 'Help with another task', {
        sessionId: 'session-2',
        timestamp: '2025-12-22T11:00:00.000Z',
        cwd: '/Users/dev/other-project',
        gitBranch: 'feature',
        version: '2.0.80',
        slug: 'other-task',
      }),
    ];

    const result = extractPrompts(messages);

    // Should extract 3 user prompts (not tool results)
    expect(result.prompts).toHaveLength(3);
    expect(result.stats.totalMessages).toBe(6);
    expect(result.stats.userMessages).toBe(4); // 3 prompts + 1 tool result
    expect(result.stats.toolResultMessages).toBe(1);
    expect(result.stats.extractedPrompts).toBe(3);
    expect(result.stats.sessionsFound).toBe(2);

    // Check first prompt (question)
    const firstPrompt = result.prompts[0]!;
    expect(firstPrompt.uuid).toBe('msg-001');
    expect(firstPrompt.isQuestion).toBe(true);
    expect(firstPrompt.sequenceNumber).toBe(1);
    expect(firstPrompt.cwd).toBe('/Users/dev/project');

    // Check second prompt (follow-up question in same session)
    const secondPrompt = result.prompts[1]!;
    expect(secondPrompt.uuid).toBe('msg-004');
    expect(secondPrompt.isQuestion).toBe(true);
    expect(secondPrompt.sequenceNumber).toBe(2);
    expect(secondPrompt.sessionId).toBe('session-1');

    // Check third prompt (different session)
    const thirdPrompt = result.prompts[2]!;
    expect(thirdPrompt.uuid).toBe('msg-005');
    expect(thirdPrompt.sequenceNumber).toBe(1); // First in session-2
    expect(thirdPrompt.sessionId).toBe('session-2');
    expect(thirdPrompt.claudeCodeVersion).toBe('2.0.80');
  });

  it('should handle multiple tool results between prompts', () => {
    const messages: TranscriptMessage[] = [
      createUserPromptMessage('msg-001', 'Read these files', {
        timestamp: '2025-12-22T10:00:00.000Z',
      }),
      createToolResultMessage('msg-002', 'toolu_001', 'file 1 contents', {
        timestamp: '2025-12-22T10:00:01.000Z',
      }),
      createToolResultMessage('msg-003', 'toolu_002', 'file 2 contents', {
        timestamp: '2025-12-22T10:00:02.000Z',
      }),
      createToolResultMessage('msg-004', 'toolu_003', 'file 3 contents', {
        timestamp: '2025-12-22T10:00:03.000Z',
      }),
      createUserPromptMessage('msg-005', 'Now analyze them', {
        timestamp: '2025-12-22T10:00:04.000Z',
      }),
    ];

    const result = extractPrompts(messages);

    expect(result.prompts).toHaveLength(2);
    expect(result.stats.toolResultMessages).toBe(3);
    expect(result.prompts[0]?.sequenceNumber).toBe(1);
    expect(result.prompts[1]?.sequenceNumber).toBe(2);
  });
});
