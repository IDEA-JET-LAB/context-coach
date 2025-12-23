/**
 * Tool Result Extraction Tests
 * Story 15-7: Tool Execution Capture
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractToolResults,
  extractToolResultsArray,
  getToolResultById,
  hasToolResult,
  getToolResultStats,
  detectToolError,
  summarizeToolResult,
  type ToolResult,
} from '../extract-tool-results';
import type {
  TranscriptMessage,
  ContentBlock,
  ToolResultBlock,
  ToolUseBlock,
  TextBlock,
} from '../parser';

// ============================================================================
// Test Fixtures
// ============================================================================

const createUserMessage = (
  uuid: string,
  content: string | ContentBlock[]
): TranscriptMessage => ({
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
  content: ContentBlock[]
): TranscriptMessage => ({
  uuid,
  parentUuid,
  sessionId: 'test-session',
  timestamp: '2025-12-22T10:30:05.000Z',
  type: 'assistant',
  message: {
    role: 'assistant',
    content,
  },
});

const createToolResultBlock = (
  toolUseId: string,
  content: string | ContentBlock[],
  isError?: boolean
): ToolResultBlock & { is_error?: boolean } => {
  const block: ToolResultBlock & { is_error?: boolean } = {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content,
  };
  if (isError !== undefined) {
    block.is_error = isError;
  }
  return block;
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

// ============================================================================
// Tests: detectToolError
// ============================================================================

describe('detectToolError', () => {
  describe('explicit is_error field', () => {
    it('should detect error when is_error is true', () => {
      const block = createToolResultBlock('toolu_001', 'Some content', true);
      expect(detectToolError('Some content', block)).toBe(true);
    });

    it('should not detect error when is_error is false', () => {
      const block = createToolResultBlock('toolu_001', 'Some content', false);
      expect(detectToolError('Some content', block)).toBe(false);
    });

    it('should check patterns when is_error is not set', () => {
      const block = createToolResultBlock('toolu_001', 'Success');
      expect(detectToolError('Success', block)).toBe(false);
    });
  });

  describe('error pattern detection', () => {
    it('should detect "Error" in content', () => {
      expect(detectToolError('Error: something went wrong')).toBe(true);
    });

    it('should detect "Exception" in content', () => {
      expect(detectToolError('NullPointerException occurred')).toBe(true);
    });

    it('should detect "failed" in content', () => {
      expect(detectToolError('Command failed with code 1')).toBe(true);
    });

    it('should detect "permission denied" in content', () => {
      expect(detectToolError('Permission denied for /root/file')).toBe(true);
    });

    it('should detect "no such file" in content', () => {
      expect(detectToolError('No such file or directory: /path')).toBe(true);
    });

    it('should detect "file not found" in content', () => {
      expect(detectToolError('File not found: missing.txt')).toBe(true);
    });

    it('should detect "command not found" in content', () => {
      expect(detectToolError('bash: xyz: command not found')).toBe(true);
    });

    it('should detect non-zero exit codes', () => {
      expect(detectToolError('Process exited with exit code 1')).toBe(true);
      expect(detectToolError('returned 127')).toBe(true);
      expect(detectToolError('exit code 255')).toBe(true);
    });

    it('should not detect exit code 0 as error', () => {
      // exit code 0 should not match the pattern
      expect(detectToolError('Process completed with exit code 0')).toBe(false);
    });

    it('should detect connection errors', () => {
      expect(detectToolError('Connection refused')).toBe(true);
      expect(detectToolError('Network error occurred')).toBe(true);
      expect(detectToolError('Request timeout')).toBe(true);
    });

    it('should detect access errors', () => {
      expect(detectToolError('Access denied')).toBe(true);
      expect(detectToolError('Unauthorized access')).toBe(true);
      expect(detectToolError('403 Forbidden')).toBe(true);
    });

    it('should detect syntax errors', () => {
      expect(detectToolError('SyntaxError: unexpected token')).toBe(true);
      expect(detectToolError('Parse error on line 5')).toBe(true);
    });

    it('should detect generic failures', () => {
      expect(detectToolError('Operation aborted')).toBe(true);
      expect(detectToolError('Process crashed')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(detectToolError('ERROR: something')).toBe(true);
      expect(detectToolError('error: something')).toBe(true);
      expect(detectToolError('FAILED to complete')).toBe(true);
    });

    it('should not detect error in normal content', () => {
      expect(detectToolError('File read successfully')).toBe(false);
      expect(detectToolError('1 file changed, 5 insertions')).toBe(false);
      expect(detectToolError('npm install completed')).toBe(false);
    });
  });
});

// ============================================================================
// Tests: summarizeToolResult
// ============================================================================

describe('summarizeToolResult', () => {
  it('should return short content as-is', () => {
    const content = 'Short result';
    expect(summarizeToolResult(content)).toBe('Short result');
  });

  it('should truncate long content', () => {
    const content = 'A'.repeat(600);
    const result = summarizeToolResult(content);
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should normalize whitespace', () => {
    const content = 'Line 1\n\nLine 2\t\tLine 3';
    const result = summarizeToolResult(content);
    expect(result).toBe('Line 1 Line 2 Line 3');
  });

  it('should handle empty content', () => {
    expect(summarizeToolResult('')).toBe('');
  });

  it('should respect custom max length', () => {
    const content = 'A'.repeat(200);
    const result = summarizeToolResult(content, 100);
    expect(result.length).toBe(100);
    expect(result.endsWith('...')).toBe(true);
  });
});

// ============================================================================
// Tests: extractToolResults
// ============================================================================

describe('extractToolResults', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('basic extraction', () => {
    it('should extract tool results from user messages', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', [
          createToolUseBlock('toolu_001', 'Read', { file_path: '/test.ts' }),
        ]),
        createUserMessage('user-002', [
          createToolResultBlock('toolu_001', 'File content here'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.size).toBe(1);
      expect(results.has('toolu_001')).toBe(true);
      const result = results.get('toolu_001')!;
      expect(result.content).toBe('File content here');
      expect(result.isError).toBe(false);
    });

    it('should extract multiple tool results from same message', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', 'Result 1'),
          createToolResultBlock('toolu_002', 'Result 2'),
          createToolResultBlock('toolu_003', 'Result 3'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.size).toBe(3);
      expect(results.get('toolu_001')?.content).toBe('Result 1');
      expect(results.get('toolu_002')?.content).toBe('Result 2');
      expect(results.get('toolu_003')?.content).toBe('Result 3');
    });

    it('should extract tool results from multiple messages', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', 'Result 1'),
        ]),
        createUserMessage('user-002', [
          createToolResultBlock('toolu_002', 'Result 2'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.size).toBe(2);
    });

    it('should return empty map for no tool results', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', 'Just a plain text message'),
        createAssistantMessage('assistant-001', 'user-001', [
          createTextBlock('Response text'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.size).toBe(0);
    });

    it('should return empty map for empty messages array', () => {
      const results = extractToolResults([]);
      expect(results.size).toBe(0);
    });
  });

  describe('error detection in results', () => {
    it('should detect error from is_error field', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', 'Some output', true),
        ]),
      ];

      const results = extractToolResults(messages);
      const result = results.get('toolu_001')!;

      expect(result.isError).toBe(true);
    });

    it('should detect error from content patterns', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', 'Error: File not found'),
        ]),
      ];

      const results = extractToolResults(messages);
      const result = results.get('toolu_001')!;

      expect(result.isError).toBe(true);
    });

    it('should detect error from exit codes', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', 'Command failed with exit code 1'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.get('toolu_001')?.isError).toBe(true);
    });

    it('should mark successful results correctly', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', 'Operation completed successfully', false),
          createToolResultBlock('toolu_002', 'Files:\n- a.ts\n- b.ts'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.get('toolu_001')?.isError).toBe(false);
      expect(results.get('toolu_002')?.isError).toBe(false);
    });
  });

  describe('content handling', () => {
    it('should handle string content', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', 'Simple string content'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.get('toolu_001')?.content).toBe('Simple string content');
    });

    it('should handle array content with text blocks', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', [
            createTextBlock('Line 1'),
            createTextBlock('Line 2'),
          ]),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.get('toolu_001')?.content).toBe('Line 1 Line 2');
    });

    it('should calculate content length correctly', () => {
      const longContent = 'A'.repeat(1000);
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', longContent),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.get('toolu_001')?.contentLength).toBe(1000);
    });

    it('should summarize long content', () => {
      const longContent = 'A'.repeat(1000);
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', longContent),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.get('toolu_001')?.content.length).toBeLessThanOrEqual(500);
    });

    it('should respect custom maxSummaryLength option', () => {
      const longContent = 'A'.repeat(1000);
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createToolResultBlock('toolu_001', longContent),
        ]),
      ];

      const results = extractToolResults(messages, { maxSummaryLength: 100 });

      expect(results.get('toolu_001')?.content.length).toBe(100);
    });
  });

  describe('handling unmatched tool_use blocks', () => {
    it('should only extract results, not tool_use blocks', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', [
          createToolUseBlock('toolu_001', 'Read', { file_path: '/test.ts' }),
          createToolUseBlock('toolu_002', 'Bash', { command: 'ls' }),
        ]),
        createUserMessage('user-002', [
          // Only one result - toolu_002 has no result
          createToolResultBlock('toolu_001', 'File content'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.size).toBe(1);
      expect(results.has('toolu_001')).toBe(true);
      expect(results.has('toolu_002')).toBe(false);
    });
  });

  describe('matching by tool_use_id', () => {
    it('should use tool_use_id for matching', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', [
          createToolUseBlock('toolu_abc123', 'Read', { file_path: '/a.ts' }),
          createToolUseBlock('toolu_xyz789', 'Read', { file_path: '/b.ts' }),
        ]),
        createUserMessage('user-002', [
          createToolResultBlock('toolu_xyz789', 'Content of b.ts'),
          createToolResultBlock('toolu_abc123', 'Content of a.ts'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.get('toolu_abc123')?.content).toBe('Content of a.ts');
      expect(results.get('toolu_xyz789')?.content).toBe('Content of b.ts');
    });
  });

  describe('edge cases', () => {
    it('should skip tool_result without tool_use_id', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          { type: 'tool_result', content: 'No ID' } as unknown as ToolResultBlock,
          createToolResultBlock('toolu_valid', 'Valid result'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.size).toBe(1);
      expect(results.has('toolu_valid')).toBe(true);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should skip messages that are not user type', () => {
      const messages: TranscriptMessage[] = [
        createAssistantMessage('assistant-001', 'user-001', [
          createToolResultBlock('toolu_001', 'Should not be extracted') as ContentBlock,
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.size).toBe(0);
    });

    it('should skip user messages with string content', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', 'Plain string, not array'),
      ];

      const results = extractToolResults(messages);

      expect(results.size).toBe(0);
    });

    it('should handle mixed content blocks', () => {
      const messages: TranscriptMessage[] = [
        createUserMessage('user-001', [
          createTextBlock('Some text'),
          createToolResultBlock('toolu_001', 'Result 1'),
          createTextBlock('More text'),
          createToolResultBlock('toolu_002', 'Result 2'),
        ]),
      ];

      const results = extractToolResults(messages);

      expect(results.size).toBe(2);
    });
  });
});

// ============================================================================
// Tests: extractToolResultsArray
// ============================================================================

describe('extractToolResultsArray', () => {
  it('should return array of tool results', () => {
    const messages: TranscriptMessage[] = [
      createUserMessage('user-001', [
        createToolResultBlock('toolu_001', 'Result 1'),
        createToolResultBlock('toolu_002', 'Result 2'),
      ]),
    ];

    const results = extractToolResultsArray(messages);

    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);
  });

  it('should return empty array for no results', () => {
    const results = extractToolResultsArray([]);
    expect(results).toEqual([]);
  });
});

// ============================================================================
// Tests: getToolResultById
// ============================================================================

describe('getToolResultById', () => {
  it('should return result for existing ID', () => {
    const results = new Map<string, ToolResult>([
      ['toolu_001', { toolUseId: 'toolu_001', content: 'Test', isError: false, contentLength: 4 }],
    ]);

    const result = getToolResultById(results, 'toolu_001');

    expect(result).toBeDefined();
    expect(result?.content).toBe('Test');
  });

  it('should return undefined for non-existing ID', () => {
    const results = new Map<string, ToolResult>();

    const result = getToolResultById(results, 'toolu_missing');

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Tests: hasToolResult
// ============================================================================

describe('hasToolResult', () => {
  it('should return true for existing ID', () => {
    const results = new Map<string, ToolResult>([
      ['toolu_001', { toolUseId: 'toolu_001', content: 'Test', isError: false, contentLength: 4 }],
    ]);

    expect(hasToolResult(results, 'toolu_001')).toBe(true);
  });

  it('should return false for non-existing ID', () => {
    const results = new Map<string, ToolResult>();

    expect(hasToolResult(results, 'toolu_missing')).toBe(false);
  });
});

// ============================================================================
// Tests: getToolResultStats
// ============================================================================

describe('getToolResultStats', () => {
  it('should calculate correct stats', () => {
    const results = new Map<string, ToolResult>([
      ['toolu_001', { toolUseId: 'toolu_001', content: 'OK', isError: false, contentLength: 2 }],
      ['toolu_002', { toolUseId: 'toolu_002', content: 'Error', isError: true, contentLength: 5 }],
      ['toolu_003', { toolUseId: 'toolu_003', content: 'Done', isError: false, contentLength: 4 }],
    ]);

    const stats = getToolResultStats(results);

    expect(stats.totalResults).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.errorCount).toBe(1);
    expect(stats.totalContentLength).toBe(11);
    expect(stats.averageContentLength).toBe(4); // 11/3 rounded
  });

  it('should handle empty results', () => {
    const results = new Map<string, ToolResult>();

    const stats = getToolResultStats(results);

    expect(stats.totalResults).toBe(0);
    expect(stats.successCount).toBe(0);
    expect(stats.errorCount).toBe(0);
    expect(stats.totalContentLength).toBe(0);
    expect(stats.averageContentLength).toBe(0);
  });

  it('should handle all errors', () => {
    const results = new Map<string, ToolResult>([
      ['toolu_001', { toolUseId: 'toolu_001', content: 'Error 1', isError: true, contentLength: 7 }],
      ['toolu_002', { toolUseId: 'toolu_002', content: 'Error 2', isError: true, contentLength: 7 }],
    ]);

    const stats = getToolResultStats(results);

    expect(stats.successCount).toBe(0);
    expect(stats.errorCount).toBe(2);
  });

  it('should handle all successes', () => {
    const results = new Map<string, ToolResult>([
      ['toolu_001', { toolUseId: 'toolu_001', content: 'OK', isError: false, contentLength: 2 }],
      ['toolu_002', { toolUseId: 'toolu_002', content: 'OK', isError: false, contentLength: 2 }],
    ]);

    const stats = getToolResultStats(results);

    expect(stats.successCount).toBe(2);
    expect(stats.errorCount).toBe(0);
  });
});
