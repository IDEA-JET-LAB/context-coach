/**
 * Prompt-Response Pairing Tests
 * Story 15-5: Prompt-Response Pairing
 */

import { describe, it, expect } from 'vitest';
import {
  pairPromptsWithResponses,
  findConversationRoot,
  calculateConversationDepth,
  type PromptResponsePair,
  type OrphanedPrompt,
  type PairingResult,
} from '../pairing';
import type { TranscriptMessage } from '../parser';
import type { ExtractedPrompt } from '../extract-prompts';
import type { ExtractedResponse } from '../extract-responses';

// ============================================================================
// Test Fixtures - Message Factories
// ============================================================================

function createTranscriptMessage(
  uuid: string,
  parentUuid: string | null,
  type: TranscriptMessage['type'] = 'user',
  sessionId: string = 'test-session'
): TranscriptMessage {
  return {
    uuid,
    parentUuid,
    sessionId,
    timestamp: new Date().toISOString(),
    type,
  };
}

function createPrompt(
  uuid: string,
  parentUuid: string | null = null,
  sessionId: string = 'test-session',
  timestamp?: Date
): ExtractedPrompt {
  return {
    uuid,
    parentUuid,
    sessionId,
    timestamp: timestamp || new Date('2025-12-22T10:00:00.000Z'),
    sequenceNumber: 1,
    text: `Prompt ${uuid}`,
    charCount: 10,
    wordCount: 2,
    hasCodeBlocks: false,
    isQuestion: false,
    cwd: '/test',
    gitBranch: 'main',
    claudeCodeVersion: '2.0.75',
    slug: 'test-slug',
  };
}

function createResponse(
  uuid: string,
  parentUuid: string | null,
  sessionId: string = 'test-session',
  timestamp?: Date,
  options?: {
    inputTokens?: number;
    outputTokens?: number;
    toolCount?: number;
    hasThinking?: boolean;
  }
): ExtractedResponse {
  const inputTokens = options?.inputTokens ?? 1000;
  const outputTokens = options?.outputTokens ?? 500;
  return {
    uuid,
    parentUuid,
    sessionId,
    timestamp: timestamp || new Date('2025-12-22T10:00:05.000Z'),
    requestId: 'req_test',
    text: `Response ${uuid}`,
    charCount: 12,
    wordCount: 2,
    model: 'claude-opus-4-5-20251101',
    messageId: 'msg_test',
    tokens: {
      input: inputTokens,
      output: outputTokens,
      cacheRead: 0,
      cacheCreation: 0,
      total: inputTokens + outputTokens,
    },
    toolsUsed: [],
    toolCount: options?.toolCount ?? 0,
    hasThinking: options?.hasThinking ?? false,
    thinkingBlockCount: options?.hasThinking ? 1 : 0,
    thinkingContent: null,
  };
}

// ============================================================================
// Tests: Direct Prompt-Response Pairing
// ============================================================================

describe('pairPromptsWithResponses', () => {
  describe('direct pairing', () => {
    it('should pair prompt with response via parentUuid', () => {
      const prompts = [createPrompt('prompt-1')];
      const responses = [createResponse('response-1', 'prompt-1')];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.prompt.uuid).toBe('prompt-1');
      expect(result.pairs[0]?.response?.uuid).toBe('response-1');
      expect(result.orphans).toHaveLength(0);
    });

    it('should pair multiple prompts with their responses', () => {
      const prompts = [
        createPrompt('prompt-1'),
        createPrompt('prompt-2', 'response-1'),
      ];
      const responses = [
        createResponse('response-1', 'prompt-1'),
        createResponse('response-2', 'prompt-2'),
      ];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
        createTranscriptMessage('prompt-2', 'response-1'),
        createTranscriptMessage('response-2', 'prompt-2', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs).toHaveLength(2);
      expect(result.pairs[0]?.prompt.uuid).toBe('prompt-1');
      expect(result.pairs[0]?.response?.uuid).toBe('response-1');
      expect(result.pairs[1]?.prompt.uuid).toBe('prompt-2');
      expect(result.pairs[1]?.response?.uuid).toBe('response-2');
    });

    it('should handle empty prompts array', () => {
      const result = pairPromptsWithResponses([], [], []);

      expect(result.pairs).toHaveLength(0);
      expect(result.orphans).toHaveLength(0);
      expect(result.stats.totalPrompts).toBe(0);
    });

    it('should handle prompts without corresponding responses', () => {
      const prompts = [createPrompt('prompt-1')];
      const responses: ExtractedResponse[] = [];
      const messages = [createTranscriptMessage('prompt-1', null)];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs).toHaveLength(0);
      expect(result.orphans).toHaveLength(1);
      expect(result.orphans[0]?.prompt.uuid).toBe('prompt-1');
    });
  });

  describe('tool result chain handling', () => {
    it('should trace through tool result to find response', () => {
      // Prompt -> Tool Result -> Response chain
      const prompts = [createPrompt('prompt-1')];
      const responses = [createResponse('response-1', 'tool-result-1')];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('tool-result-1', 'prompt-1'), // Tool result points to prompt
        createTranscriptMessage('response-1', 'tool-result-1', 'assistant'), // Response points to tool result
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.prompt.uuid).toBe('prompt-1');
      expect(result.pairs[0]?.response?.uuid).toBe('response-1');
      expect(result.pairs[0]?.intermediateMessages).toBe(1); // Tool result is intermediate
    });

    it('should handle multiple tool results in chain', () => {
      // Prompt -> Tool Result 1 -> Tool Result 2 -> Response
      const prompts = [createPrompt('prompt-1')];
      const responses = [createResponse('response-1', 'tool-result-2')];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('tool-result-1', 'prompt-1'),
        createTranscriptMessage('tool-result-2', 'tool-result-1'),
        createTranscriptMessage('response-1', 'tool-result-2', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.response?.uuid).toBe('response-1');
      expect(result.pairs[0]?.intermediateMessages).toBe(2);
    });

    it('should prevent infinite loops in circular references', () => {
      // Create a circular reference scenario
      const prompts = [createPrompt('prompt-1')];
      const responses: ExtractedResponse[] = [];
      const messages = [
        createTranscriptMessage('prompt-1', 'circular-ref'),
        createTranscriptMessage('circular-ref', 'prompt-1'),
      ];

      // Should not hang - will return orphan
      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs).toHaveLength(0);
      expect(result.orphans).toHaveLength(1);
    });
  });

  describe('orphaned prompt detection', () => {
    it('should detect orphaned prompt with no_response reason', () => {
      const prompts = [
        createPrompt('prompt-1'),
        createPrompt('prompt-2', 'response-1'),
      ];
      const responses = [createResponse('response-1', 'prompt-1')];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
        createTranscriptMessage('prompt-2', 'response-1'),
        // No response for prompt-2, but more messages exist
        createTranscriptMessage('other-msg', null),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.orphans).toHaveLength(1);
      expect(result.orphans[0]?.prompt.uuid).toBe('prompt-2');
      expect(result.orphans[0]?.reason).toBe('no_response');
    });

    it('should detect orphaned prompt with session_ended reason', () => {
      const prompts = [createPrompt('prompt-1')];
      const responses: ExtractedResponse[] = [];
      const messages = [createTranscriptMessage('prompt-1', null)];
      // Prompt is the last message

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.orphans).toHaveLength(1);
      expect(result.orphans[0]?.reason).toBe('session_ended');
    });

    it('should detect orphaned prompt with interrupted reason', () => {
      const prompts = [createPrompt('prompt-1')];
      const responses: ExtractedResponse[] = [];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('summary-1', 'prompt-1', 'summary'), // Summary indicates interrupted
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.orphans).toHaveLength(1);
      expect(result.orphans[0]?.reason).toBe('interrupted');
    });

    it('should detect session_ended when remaining messages are from different session', () => {
      const prompts = [createPrompt('prompt-1', null, 'session-1')];
      const responses: ExtractedResponse[] = [];
      const messages = [
        createTranscriptMessage('prompt-1', null, 'user', 'session-1'),
        createTranscriptMessage('other-msg', null, 'user', 'session-2'), // Different session
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.orphans).toHaveLength(1);
      expect(result.orphans[0]?.reason).toBe('session_ended');
    });
  });

  describe('conversation context', () => {
    it('should set isConversationStart true for root prompts', () => {
      const prompts = [createPrompt('prompt-1', null)]; // No parent
      const responses = [createResponse('response-1', 'prompt-1')];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs[0]?.isConversationStart).toBe(true);
    });

    it('should set isConversationStart false for non-root prompts', () => {
      const prompts = [
        createPrompt('prompt-1', null),
        createPrompt('prompt-2', 'response-1'), // Has parent
      ];
      const responses = [
        createResponse('response-1', 'prompt-1'),
        createResponse('response-2', 'prompt-2'),
      ];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
        createTranscriptMessage('prompt-2', 'response-1'),
        createTranscriptMessage('response-2', 'prompt-2', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs[0]?.isConversationStart).toBe(true);
      expect(result.pairs[1]?.isConversationStart).toBe(false);
    });

    it('should correctly identify conversation IDs', () => {
      // All messages in same conversation should have same conversationId
      const prompts = [
        createPrompt('prompt-1', null),
        createPrompt('prompt-2', 'response-1'),
      ];
      const responses = [
        createResponse('response-1', 'prompt-1'),
        createResponse('response-2', 'prompt-2'),
      ];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
        createTranscriptMessage('prompt-2', 'response-1'),
        createTranscriptMessage('response-2', 'prompt-2', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      // Both should trace back to prompt-1 as root
      expect(result.pairs[0]?.conversationId).toBe('prompt-1');
      expect(result.pairs[1]?.conversationId).toBe('prompt-1');
    });

    it('should identify separate conversations', () => {
      const prompts = [
        createPrompt('conv1-prompt', null),
        createPrompt('conv2-prompt', null), // Separate conversation (null parent)
      ];
      const responses = [
        createResponse('conv1-response', 'conv1-prompt'),
        createResponse('conv2-response', 'conv2-prompt'),
      ];
      const messages = [
        createTranscriptMessage('conv1-prompt', null),
        createTranscriptMessage('conv1-response', 'conv1-prompt', 'assistant'),
        createTranscriptMessage('conv2-prompt', null),
        createTranscriptMessage('conv2-response', 'conv2-prompt', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs[0]?.conversationId).toBe('conv1-prompt');
      expect(result.pairs[1]?.conversationId).toBe('conv2-prompt');
      expect(result.stats.conversationCount).toBe(2);
    });
  });

  describe('derived metrics', () => {
    it('should calculate response time in milliseconds', () => {
      const promptTime = new Date('2025-12-22T10:00:00.000Z');
      const responseTime = new Date('2025-12-22T10:00:05.000Z'); // 5 seconds later

      const prompts = [createPrompt('prompt-1', null, 'test-session', promptTime)];
      const responses = [createResponse('response-1', 'prompt-1', 'test-session', responseTime)];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs[0]?.responseTimeMs).toBe(5000);
    });

    it('should calculate token efficiency ratio', () => {
      const prompts = [createPrompt('prompt-1')];
      const responses = [createResponse('response-1', 'prompt-1', 'test-session', undefined, {
        inputTokens: 1000,
        outputTokens: 500,
      })];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs[0]?.tokenEfficiency).toBe(0.5); // 500/1000
    });

    it('should return null token efficiency for zero input tokens', () => {
      const prompts = [createPrompt('prompt-1')];
      const responses = [createResponse('response-1', 'prompt-1', 'test-session', undefined, {
        inputTokens: 0,
        outputTokens: 500,
      })];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs[0]?.tokenEfficiency).toBeNull();
    });

    it('should capture tools per response', () => {
      const prompts = [createPrompt('prompt-1')];
      const responses = [createResponse('response-1', 'prompt-1', 'test-session', undefined, {
        toolCount: 3,
      })];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs[0]?.toolsPerResponse).toBe(3);
    });

    it('should detect thinking usage', () => {
      const prompts = [createPrompt('prompt-1')];
      const responses = [createResponse('response-1', 'prompt-1', 'test-session', undefined, {
        hasThinking: true,
      })];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs[0]?.usedThinking).toBe(true);
    });

    it('should count intermediate messages', () => {
      const prompts = [createPrompt('prompt-1')];
      const responses = [createResponse('response-1', 'prompt-1')];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('intermediate-1', 'prompt-1'),
        createTranscriptMessage('intermediate-2', 'intermediate-1'),
        createTranscriptMessage('response-1', 'intermediate-2', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.pairs[0]?.intermediateMessages).toBe(2);
    });
  });

  describe('statistics', () => {
    it('should calculate total prompts correctly', () => {
      const prompts = [
        createPrompt('prompt-1'),
        createPrompt('prompt-2'),
        createPrompt('prompt-3'),
      ];
      const responses = [
        createResponse('response-1', 'prompt-1'),
        createResponse('response-2', 'prompt-2'),
        // No response for prompt-3
      ];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
        createTranscriptMessage('prompt-2', null),
        createTranscriptMessage('response-2', 'prompt-2', 'assistant'),
        createTranscriptMessage('prompt-3', null),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.stats.totalPrompts).toBe(3);
      expect(result.stats.pairedPrompts).toBe(2);
      expect(result.stats.orphanedPrompts).toBe(1);
    });

    it('should calculate average response time', () => {
      const baseTime = new Date('2025-12-22T10:00:00.000Z');
      const prompts = [
        createPrompt('prompt-1', null, 'test', baseTime),
        createPrompt('prompt-2', null, 'test', new Date(baseTime.getTime() + 10000)),
      ];
      const responses = [
        createResponse('response-1', 'prompt-1', 'test', new Date(baseTime.getTime() + 2000)), // 2s
        createResponse('response-2', 'prompt-2', 'test', new Date(baseTime.getTime() + 18000)), // 8s from prompt-2
      ];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
        createTranscriptMessage('prompt-2', null),
        createTranscriptMessage('response-2', 'prompt-2', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      // Average of 2000ms and 8000ms = 5000ms
      expect(result.stats.averageResponseTimeMs).toBe(5000);
    });

    it('should calculate average token efficiency', () => {
      const prompts = [
        createPrompt('prompt-1'),
        createPrompt('prompt-2'),
      ];
      const responses = [
        createResponse('response-1', 'prompt-1', 'test', undefined, {
          inputTokens: 1000,
          outputTokens: 500, // 0.5 efficiency
        }),
        createResponse('response-2', 'prompt-2', 'test', undefined, {
          inputTokens: 1000,
          outputTokens: 1000, // 1.0 efficiency
        }),
      ];
      const messages = [
        createTranscriptMessage('prompt-1', null),
        createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
        createTranscriptMessage('prompt-2', null),
        createTranscriptMessage('response-2', 'prompt-2', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      // Average of 0.5 and 1.0 = 0.75
      expect(result.stats.averageTokenEfficiency).toBe(0.75);
    });

    it('should count unique conversations', () => {
      const prompts = [
        createPrompt('conv1-p1', null),
        createPrompt('conv1-p2', 'conv1-r1'),
        createPrompt('conv2-p1', null),
      ];
      const responses = [
        createResponse('conv1-r1', 'conv1-p1'),
        createResponse('conv1-r2', 'conv1-p2'),
        createResponse('conv2-r1', 'conv2-p1'),
      ];
      const messages = [
        createTranscriptMessage('conv1-p1', null),
        createTranscriptMessage('conv1-r1', 'conv1-p1', 'assistant'),
        createTranscriptMessage('conv1-p2', 'conv1-r1'),
        createTranscriptMessage('conv1-r2', 'conv1-p2', 'assistant'),
        createTranscriptMessage('conv2-p1', null),
        createTranscriptMessage('conv2-r1', 'conv2-p1', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      expect(result.stats.conversationCount).toBe(2);
    });

    it('should calculate average conversation length', () => {
      // 2 conversations: one with 2 prompts, one with 1 prompt
      const prompts = [
        createPrompt('conv1-p1', null),
        createPrompt('conv1-p2', 'conv1-r1'),
        createPrompt('conv2-p1', null),
      ];
      const responses = [
        createResponse('conv1-r1', 'conv1-p1'),
        createResponse('conv1-r2', 'conv1-p2'),
        createResponse('conv2-r1', 'conv2-p1'),
      ];
      const messages = [
        createTranscriptMessage('conv1-p1', null),
        createTranscriptMessage('conv1-r1', 'conv1-p1', 'assistant'),
        createTranscriptMessage('conv1-p2', 'conv1-r1'),
        createTranscriptMessage('conv1-r2', 'conv1-p2', 'assistant'),
        createTranscriptMessage('conv2-p1', null),
        createTranscriptMessage('conv2-r1', 'conv2-p1', 'assistant'),
      ];

      const result = pairPromptsWithResponses(prompts, responses, messages);

      // 3 pairs / 2 conversations = 1.5 average length
      expect(result.stats.averageConversationLength).toBe(1.5);
    });

    it('should handle zero values in stats gracefully', () => {
      const result = pairPromptsWithResponses([], [], []);

      expect(result.stats.averageResponseTimeMs).toBe(0);
      expect(result.stats.averageTokenEfficiency).toBe(0);
      expect(result.stats.conversationCount).toBe(0);
      expect(result.stats.averageConversationLength).toBe(0);
    });
  });
});

// ============================================================================
// Tests: findConversationRoot
// ============================================================================

describe('findConversationRoot', () => {
  it('should return uuid for message with null parent', () => {
    const messages = new Map<string, TranscriptMessage>([
      ['msg-1', createTranscriptMessage('msg-1', null)],
    ]);

    expect(findConversationRoot('msg-1', messages)).toBe('msg-1');
  });

  it('should trace up to root parent', () => {
    const messages = new Map<string, TranscriptMessage>([
      ['root', createTranscriptMessage('root', null)],
      ['child', createTranscriptMessage('child', 'root')],
      ['grandchild', createTranscriptMessage('grandchild', 'child')],
    ]);

    expect(findConversationRoot('grandchild', messages)).toBe('root');
    expect(findConversationRoot('child', messages)).toBe('root');
    expect(findConversationRoot('root', messages)).toBe('root');
  });

  it('should handle missing parent gracefully', () => {
    const messages = new Map<string, TranscriptMessage>([
      ['orphan', createTranscriptMessage('orphan', 'missing-parent')],
    ]);

    // Should return the orphan since parent doesn't exist
    expect(findConversationRoot('orphan', messages)).toBe('missing-parent');
  });

  it('should handle circular references without infinite loop', () => {
    const messages = new Map<string, TranscriptMessage>([
      ['a', createTranscriptMessage('a', 'b')],
      ['b', createTranscriptMessage('b', 'a')],
    ]);

    // Should not hang - will return one of them
    const result = findConversationRoot('a', messages);
    expect(['a', 'b']).toContain(result);
  });

  it('should return uuid for unknown message', () => {
    const messages = new Map<string, TranscriptMessage>();

    expect(findConversationRoot('unknown', messages)).toBe('unknown');
  });
});

// ============================================================================
// Tests: calculateConversationDepth
// ============================================================================

describe('calculateConversationDepth', () => {
  it('should return 1 for root message', () => {
    const messages = new Map<string, TranscriptMessage>([
      ['root', createTranscriptMessage('root', null)],
    ]);

    expect(calculateConversationDepth('root', messages)).toBe(1);
  });

  it('should count depth from child to root', () => {
    const messages = new Map<string, TranscriptMessage>([
      ['root', createTranscriptMessage('root', null)],
      ['child', createTranscriptMessage('child', 'root')],
      ['grandchild', createTranscriptMessage('grandchild', 'child')],
    ]);

    expect(calculateConversationDepth('root', messages)).toBe(1);
    expect(calculateConversationDepth('child', messages)).toBe(2);
    expect(calculateConversationDepth('grandchild', messages)).toBe(3);
  });

  it('should handle deep conversations', () => {
    const messages = new Map<string, TranscriptMessage>();
    let parentUuid: string | null = null;

    for (let i = 0; i < 10; i++) {
      const uuid = `msg-${i}`;
      messages.set(uuid, createTranscriptMessage(uuid, parentUuid));
      parentUuid = uuid;
    }

    expect(calculateConversationDepth('msg-9', messages)).toBe(10);
  });

  it('should handle circular references', () => {
    const messages = new Map<string, TranscriptMessage>([
      ['a', createTranscriptMessage('a', 'b')],
      ['b', createTranscriptMessage('b', 'a')],
    ]);

    // Should not hang, returns some depth
    const depth = calculateConversationDepth('a', messages);
    expect(depth).toBeGreaterThan(0);
  });

  it('should return 1 for unknown message', () => {
    const messages = new Map<string, TranscriptMessage>();

    expect(calculateConversationDepth('unknown', messages)).toBe(1);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle single message transcript', () => {
    const prompts = [createPrompt('only-prompt')];
    const responses: ExtractedResponse[] = [];
    const messages = [createTranscriptMessage('only-prompt', null)];

    const result = pairPromptsWithResponses(prompts, responses, messages);

    expect(result.pairs).toHaveLength(0);
    expect(result.orphans).toHaveLength(1);
  });

  it('should handle responses without prompts (orphaned responses)', () => {
    // Response with a parentUuid that doesn't exist in prompts
    const prompts: ExtractedPrompt[] = [];
    const responses = [createResponse('response-1', 'unknown-prompt')];
    const messages = [
      createTranscriptMessage('response-1', 'unknown-prompt', 'assistant'),
    ];

    const result = pairPromptsWithResponses(prompts, responses, messages);

    // No pairs since no prompts match
    expect(result.pairs).toHaveLength(0);
    expect(result.orphans).toHaveLength(0);
  });

  it('should handle response with null parentUuid', () => {
    const prompts = [createPrompt('prompt-1')];
    const responses = [createResponse('response-1', null)];
    const messages = [
      createTranscriptMessage('prompt-1', null),
      createTranscriptMessage('response-1', null, 'assistant'),
    ];

    const result = pairPromptsWithResponses(prompts, responses, messages);

    // Can't pair since response has no parent
    expect(result.pairs).toHaveLength(0);
    expect(result.orphans).toHaveLength(1);
  });

  it('should handle very long conversation chains', () => {
    const depth = 50;
    const prompts: ExtractedPrompt[] = [];
    const responses: ExtractedResponse[] = [];
    const messages: TranscriptMessage[] = [];

    let lastResponseUuid: string | null = null;

    for (let i = 0; i < depth; i++) {
      const promptUuid = `prompt-${i}`;
      const responseUuid = `response-${i}`;

      prompts.push(createPrompt(promptUuid, lastResponseUuid));
      responses.push(createResponse(responseUuid, promptUuid));
      messages.push(createTranscriptMessage(promptUuid, lastResponseUuid));
      messages.push(createTranscriptMessage(responseUuid, promptUuid, 'assistant'));

      lastResponseUuid = responseUuid;
    }

    const result = pairPromptsWithResponses(prompts, responses, messages);

    expect(result.pairs).toHaveLength(depth);
    expect(result.stats.conversationCount).toBe(1);

    // Last prompt should have max depth
    const lastPair = result.pairs[depth - 1];
    expect(lastPair?.conversationDepth).toBeGreaterThan(1);
  });

  it('should handle multiple sessions in one transcript', () => {
    const prompts = [
      createPrompt('session1-prompt', null, 'session-1'),
      createPrompt('session2-prompt', null, 'session-2'),
    ];
    const responses = [
      createResponse('session1-response', 'session1-prompt', 'session-1'),
      createResponse('session2-response', 'session2-prompt', 'session-2'),
    ];
    const messages = [
      createTranscriptMessage('session1-prompt', null, 'user', 'session-1'),
      createTranscriptMessage('session1-response', 'session1-prompt', 'assistant', 'session-1'),
      createTranscriptMessage('session2-prompt', null, 'user', 'session-2'),
      createTranscriptMessage('session2-response', 'session2-prompt', 'assistant', 'session-2'),
    ];

    const result = pairPromptsWithResponses(prompts, responses, messages);

    expect(result.pairs).toHaveLength(2);
    expect(result.stats.conversationCount).toBe(2);
  });

  it('should handle negative response time gracefully', () => {
    // Response timestamp before prompt (should be rare but handle it)
    const promptTime = new Date('2025-12-22T10:00:05.000Z');
    const responseTime = new Date('2025-12-22T10:00:00.000Z'); // Before prompt

    const prompts = [createPrompt('prompt-1', null, 'test', promptTime)];
    const responses = [createResponse('response-1', 'prompt-1', 'test', responseTime)];
    const messages = [
      createTranscriptMessage('prompt-1', null),
      createTranscriptMessage('response-1', 'prompt-1', 'assistant'),
    ];

    const result = pairPromptsWithResponses(prompts, responses, messages);

    // Should still pair, just with negative time
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]?.responseTimeMs).toBe(-5000);
  });
});
