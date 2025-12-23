import { describe, it, expect } from 'vitest';
import { detectSessionEnd, inferEndReason } from '../session-lifecycle';
import type { TranscriptMessage } from '../types';

describe('detectSessionEnd', () => {
  describe('completion patterns', () => {
    it('should detect "bye" as completion', () => {
      const messages: TranscriptMessage[] = [
        { role: 'user', timestamp: '2025-01-15T10:30:00Z', content: 'Bye!' },
        { role: 'assistant', timestamp: '2025-01-15T10:30:05Z', content: 'Goodbye!' },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
      expect(result.endInfo?.end_reason).toBe('completed');
      expect(result.confidence).toBe('high');
    });

    it('should detect "exit" as completion', () => {
      const messages: TranscriptMessage[] = [
        { role: 'user', timestamp: '2025-01-15T10:30:00Z', content: 'I want to exit' },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
      expect(result.endInfo?.end_reason).toBe('completed');
    });

    it('should detect "done" as completion', () => {
      const messages: TranscriptMessage[] = [
        { role: 'user', timestamp: '2025-01-15T10:30:00Z', content: "I'm done, thanks" },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
      expect(result.endInfo?.end_reason).toBe('completed');
    });

    it('should detect "finished" as completion', () => {
      const messages: TranscriptMessage[] = [
        { role: 'assistant', timestamp: '2025-01-15T10:30:00Z', content: "We're finished with the task" },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
      expect(result.endInfo?.end_reason).toBe('completed');
    });

    it('should detect "that\'s all" as completion', () => {
      const messages: TranscriptMessage[] = [
        { role: 'user', timestamp: '2025-01-15T10:30:00Z', content: "That's all for now" },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
      expect(result.endInfo?.end_reason).toBe('completed');
    });

    it('should detect "thanks, that\'s all" pattern', () => {
      const messages: TranscriptMessage[] = [
        { role: 'user', timestamp: '2025-01-15T10:30:00Z', content: 'Thanks for all your help!' },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
      expect(result.endInfo?.end_reason).toBe('completed');
    });
  });

  describe('interruption patterns', () => {
    it('should detect fatal error as interruption', () => {
      const messages: TranscriptMessage[] = [
        {
          role: 'system',
          timestamp: '2025-01-15T10:30:00Z',
          content: 'Error: fatal exception occurred',
        },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
      expect(result.endInfo?.end_reason).toBe('interrupted');
      expect(result.confidence).toBe('high');
    });

    it('should detect crash as interruption', () => {
      const messages: TranscriptMessage[] = [
        { role: 'system', timestamp: '2025-01-15T10:30:00Z', content: 'Process crash detected' },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
      expect(result.endInfo?.end_reason).toBe('interrupted');
    });

    it('should detect SIGKILL as interruption', () => {
      const messages: TranscriptMessage[] = [
        { role: 'system', timestamp: '2025-01-15T10:30:00Z', content: 'Received SIGKILL' },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
      expect(result.endInfo?.end_reason).toBe('interrupted');
    });
  });

  describe('no end detected', () => {
    it('should not detect end for normal conversation', () => {
      const messages: TranscriptMessage[] = [
        { role: 'user', timestamp: '2025-01-15T10:30:00Z', content: 'Can you help me?' },
        { role: 'assistant', timestamp: '2025-01-15T10:30:05Z', content: 'Of course!' },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(false);
      expect(result.endInfo).toBe(null);
    });

    it('should return hasEnded false for empty messages', () => {
      const result = detectSessionEnd([]);

      expect(result.hasEnded).toBe(false);
      expect(result.confidence).toBe('low');
    });
  });

  describe('timestamp extraction', () => {
    it('should use last message timestamp for ended_at', () => {
      const messages: TranscriptMessage[] = [
        { role: 'user', timestamp: '2025-01-15T10:30:00Z', content: 'Hello' },
        { role: 'assistant', timestamp: '2025-01-15T10:31:00Z', content: 'Hi' },
        { role: 'user', timestamp: '2025-01-15T10:32:00Z', content: 'Bye!' },
      ];

      const result = detectSessionEnd(messages);

      expect(result.endInfo?.ended_at.toISOString()).toBe('2025-01-15T10:32:00.000Z');
    });

    it('should use current time if no timestamps', () => {
      const before = new Date();
      const messages: TranscriptMessage[] = [{ role: 'user', content: 'Bye!' }];

      const result = detectSessionEnd(messages);
      const after = new Date();

      expect(result.endInfo?.ended_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.endInfo?.ended_at.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('structured content handling', () => {
    it('should handle object content', () => {
      const messages: TranscriptMessage[] = [
        {
          role: 'user',
          timestamp: '2025-01-15T10:30:00Z',
          content: { type: 'text', text: 'Bye!' },
        },
      ];

      const result = detectSessionEnd(messages);

      // Should still detect "bye" in stringified content
      expect(result.hasEnded).toBe(true);
    });

    it('should handle null content', () => {
      const messages: TranscriptMessage[] = [
        { role: 'user', timestamp: '2025-01-15T10:30:00Z' },
        { role: 'user', timestamp: '2025-01-15T10:31:00Z', content: 'Bye!' },
      ];

      const result = detectSessionEnd(messages);

      expect(result.hasEnded).toBe(true);
    });
  });

  describe('only analyzes recent messages', () => {
    it('should only check last 5 messages', () => {
      const oldMessages: TranscriptMessage[] = Array(10).fill({
        role: 'user',
        timestamp: '2025-01-15T10:00:00Z',
        content: 'bye', // Would trigger completion
      });
      const recentMessages: TranscriptMessage[] = Array(5).fill({
        role: 'user',
        timestamp: '2025-01-15T10:30:00Z',
        content: 'Continue working',
      });

      const messages = [...oldMessages, ...recentMessages];
      const result = detectSessionEnd(messages);

      // Recent messages don't contain end patterns
      expect(result.hasEnded).toBe(false);
    });
  });
});

describe('inferEndReason', () => {
  it('should return abandoned for very long inactivity (> 24 hours)', () => {
    const longAgo = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

    expect(inferEndReason(longAgo)).toBe('abandoned');
  });

  it('should return unknown for recent timeout', () => {
    // Just past the 2-hour default timeout
    const recentlyInactive = new Date(Date.now() - 125 * 60 * 1000); // 2h 5min ago

    expect(inferEndReason(recentlyInactive, 120)).toBe('unknown');
  });

  it('should return abandoned for moderate inactivity past threshold', () => {
    // 4 hours ago (past 1.5x of 2 hour timeout)
    const moderatelyInactive = new Date(Date.now() - 4 * 60 * 60 * 1000);

    expect(inferEndReason(moderatelyInactive, 120)).toBe('abandoned');
  });

  it('should respect custom timeout parameter', () => {
    // 45 minutes ago with 30 min timeout (1.5x = 45 min, just at boundary)
    const recent = new Date(Date.now() - 46 * 60 * 1000);

    expect(inferEndReason(recent, 30)).toBe('abandoned');
  });
});
