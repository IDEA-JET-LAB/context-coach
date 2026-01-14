import { describe, it, expect } from 'vitest';
import { conversationStatsKeys } from '../use-conversation-stats';

/**
 * Tests for use-conversation-stats.ts - Story 30-6
 *
 * These tests validate:
 * 1. Query key factory patterns for cache management
 * 2. Type exports for external consumers
 */

describe('Conversation Stats Query Keys - Story 30-6', () => {
  describe('conversationStatsKeys.all', () => {
    it('should return base conversation-stats key', () => {
      expect(conversationStatsKeys.all).toEqual(['conversation-stats']);
    });
  });

  describe('conversationStatsKeys.detail', () => {
    it('should return detail key with sessionId', () => {
      const sessionId = 'session-123';
      const key = conversationStatsKeys.detail(sessionId);

      expect(key).toEqual(['conversation-stats', 'session-123']);
    });

    it('should return detail key with UUID sessionId', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const key = conversationStatsKeys.detail(sessionId);

      expect(key).toEqual([
        'conversation-stats',
        '550e8400-e29b-41d4-a716-446655440000',
      ]);
    });

    it('should return different keys for different sessions', () => {
      const key1 = conversationStatsKeys.detail('session-1');
      const key2 = conversationStatsKeys.detail('session-2');

      expect(key1).not.toEqual(key2);
    });
  });

  describe('Query Key Hierarchy', () => {
    it('should allow invalidating all conversation stats', () => {
      // Simulating React Query's invalidateQueries behavior
      const allKey = conversationStatsKeys.all;

      const detailKey1 = conversationStatsKeys.detail('session-1');
      const detailKey2 = conversationStatsKeys.detail('session-2');

      // Both should start with the base key
      expect(detailKey1.slice(0, 1)).toEqual(allKey);
      expect(detailKey2.slice(0, 1)).toEqual(allKey);
    });

    it('detail keys should extend base key', () => {
      const baseKey = conversationStatsKeys.all;
      const detailKey = conversationStatsKeys.detail('test-session');

      expect(detailKey.length).toBe(baseKey.length + 1);
      expect(detailKey[0]).toBe(baseKey[0]);
    });
  });
});
