import { describe, it, expect } from 'vitest';
import { conversationsKeys } from '../use-conversations';
import type { UseConversationsOptions } from '../use-conversations';

/**
 * Tests for use-conversations.ts - Story 25-5
 *
 * These tests validate:
 * 1. Query key factory patterns for cache management
 * 2. Type exports for external consumers
 */

describe('Conversations Query Keys - Story 25-5', () => {
  describe('conversationsKeys.all', () => {
    it('should return base conversations key', () => {
      expect(conversationsKeys.all).toEqual(['conversations']);
    });
  });

  describe('conversationsKeys.lists', () => {
    it('should return list key extending all key', () => {
      expect(conversationsKeys.lists()).toEqual(['conversations', 'list']);
    });
  });

  describe('conversationsKeys.list', () => {
    it('should return list key with empty options', () => {
      const options: UseConversationsOptions = {};
      const key = conversationsKeys.list(options);

      expect(key).toEqual(['conversations', 'list', {}]);
    });

    it('should return list key with projectId option', () => {
      const options: UseConversationsOptions = { projectId: 'proj-123' };
      const key = conversationsKeys.list(options);

      expect(key).toEqual(['conversations', 'list', { projectId: 'proj-123' }]);
    });

    it('should return list key with multiple options', () => {
      const options: UseConversationsOptions = {
        projectId: 'proj-123',
        stage: 'development',
        hasLoop: true,
        sortBy: 'messages',
        limit: 25,
        offset: 10,
      };
      const key = conversationsKeys.list(options);

      expect(key).toEqual(['conversations', 'list', options]);
    });

    it('should return list key with date range options', () => {
      const options: UseConversationsOptions = {
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
      };
      const key = conversationsKeys.list(options);

      expect(key).toEqual([
        'conversations',
        'list',
        { dateFrom: '2025-01-01', dateTo: '2025-01-31' },
      ]);
    });

    it('should return different keys for different options', () => {
      const key1 = conversationsKeys.list({ projectId: 'proj-1' });
      const key2 = conversationsKeys.list({ projectId: 'proj-2' });
      const key3 = conversationsKeys.list({ projectId: 'proj-1', stage: 'debugging' });

      expect(key1).not.toEqual(key2);
      expect(key1).not.toEqual(key3);
      expect(key2).not.toEqual(key3);
    });
  });

  describe('conversationsKeys.details', () => {
    it('should return details key extending all key', () => {
      expect(conversationsKeys.details()).toEqual(['conversations', 'detail']);
    });
  });

  describe('conversationsKeys.detail', () => {
    it('should return detail key with sessionId', () => {
      const sessionId = 'session-123';
      const key = conversationsKeys.detail(sessionId);

      expect(key).toEqual(['conversations', 'detail', 'session-123']);
    });

    it('should return detail key with UUID sessionId', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const key = conversationsKeys.detail(sessionId);

      expect(key).toEqual([
        'conversations',
        'detail',
        '550e8400-e29b-41d4-a716-446655440000',
      ]);
    });

    it('should return different keys for different sessions', () => {
      const key1 = conversationsKeys.detail('session-1');
      const key2 = conversationsKeys.detail('session-2');

      expect(key1).not.toEqual(key2);
    });
  });

  describe('Query Key Hierarchy', () => {
    it('should allow invalidating all conversations', () => {
      // Simulating React Query's invalidateQueries behavior
      const allKey = conversationsKeys.all;

      const listKey = conversationsKeys.list({ projectId: 'proj-1' });
      const detailKey = conversationsKeys.detail('session-1');

      // Both should start with the base key
      expect(listKey.slice(0, 1)).toEqual(allKey);
      expect(detailKey.slice(0, 1)).toEqual(allKey);
    });

    it('should allow invalidating all lists', () => {
      const listsKey = conversationsKeys.lists();

      const list1 = conversationsKeys.list({ projectId: 'proj-1' });
      const list2 = conversationsKeys.list({ stage: 'debugging' });

      // Both should start with lists key
      expect(list1.slice(0, 2)).toEqual(listsKey);
      expect(list2.slice(0, 2)).toEqual(listsKey);
    });

    it('should allow invalidating all details', () => {
      const detailsKey = conversationsKeys.details();

      const detail1 = conversationsKeys.detail('session-1');
      const detail2 = conversationsKeys.detail('session-2');

      // Both should start with details key
      expect(detail1.slice(0, 2)).toEqual(detailsKey);
      expect(detail2.slice(0, 2)).toEqual(detailsKey);
    });
  });
});

describe('UseConversationsOptions Type', () => {
  it('should accept all valid option combinations', () => {
    // This is a compile-time test - if it compiles, the types are correct
    const options1: UseConversationsOptions = {};
    const options2: UseConversationsOptions = { projectId: 'test' };
    const options3: UseConversationsOptions = { hasLoop: true };
    const options4: UseConversationsOptions = { hasLoop: false };
    const options5: UseConversationsOptions = { sortBy: 'date' };
    const options6: UseConversationsOptions = { sortBy: 'messages' };
    const options7: UseConversationsOptions = { sortBy: 'score' };
    const options8: UseConversationsOptions = {
      projectId: 'proj',
      stage: 'development',
      hasLoop: true,
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31',
      sortBy: 'score',
      limit: 50,
      offset: 0,
    };

    // All options should be valid
    expect(options1).toBeDefined();
    expect(options2).toBeDefined();
    expect(options3).toBeDefined();
    expect(options4).toBeDefined();
    expect(options5).toBeDefined();
    expect(options6).toBeDefined();
    expect(options7).toBeDefined();
    expect(options8).toBeDefined();
  });
});
