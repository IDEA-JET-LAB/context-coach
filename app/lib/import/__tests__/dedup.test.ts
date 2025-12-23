import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  filterDuplicates,
  addFingerprints,
  checkExistingFingerprints,
} from '../dedup';
import type { PromptResponsePair } from '../types';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  in: vi.fn().mockResolvedValue({ data: [], error: null }),
};

describe('Deduplication Module - Story 17-4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.in.mockResolvedValue({ data: [], error: null });
  });

  describe('addFingerprints', () => {
    it('should add fingerprints to all prompt pairs', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
        {
          prompt: {
            text: 'Fix a bug',
            timestamp: '2025-01-15T10:31:00Z',
          },
        },
      ];

      const result = addFingerprints(userId, pairs);

      expect(result).toHaveLength(2);
      expect(result[0]!.fingerprint).toHaveLength(16);
      expect(result[1]!.fingerprint).toHaveLength(16);
      expect(result[0]!.fingerprint).not.toBe(result[1]!.fingerprint);
    });

    it('should preserve original prompt data', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function',
            timestamp: '2025-01-15T10:30:00Z',
            metadata: { source: 'test' },
          },
          response: {
            text: 'Here is the function...',
            timestamp: '2025-01-15T10:30:05Z',
          },
        },
      ];

      const result = addFingerprints(userId, pairs);

      expect(result[0]!.prompt.text).toBe('Write a function');
      expect(result[0]!.prompt.timestamp).toBe('2025-01-15T10:30:00Z');
      expect(result[0]!.prompt.metadata).toEqual({ source: 'test' });
      expect(result[0]!.response?.text).toBe('Here is the function...');
    });

    it('should generate consistent fingerprints for same input', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
      ];

      const result1 = addFingerprints(userId, pairs);
      const result2 = addFingerprints(userId, pairs);

      expect(result1[0]!.fingerprint).toBe(result2[0]!.fingerprint);
    });

    it('should handle empty array', () => {
      const result = addFingerprints('user-id', []);
      expect(result).toEqual([]);
    });

    it('should generate unique fingerprints map', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
        {
          prompt: {
            text: 'Same text but different time',
            timestamp: '2025-01-15T10:31:00Z',
          },
        },
        {
          prompt: {
            text: 'Same text but different time',
            timestamp: '2025-01-15T10:31:00Z',
          },
        },
      ];

      const result = addFingerprints(userId, pairs);

      // Third item should have same fingerprint as second (duplicate)
      expect(result[1]!.fingerprint).toBe(result[2]!.fingerprint);
      expect(result[0]!.fingerprint).not.toBe(result[1]!.fingerprint);
    });
  });

  describe('checkExistingFingerprints', () => {
    it('should return empty set when no fingerprints exist in database', async () => {
      mockSupabase.in.mockResolvedValue({ data: [], error: null });

      const fingerprints = ['abc123', 'def456'];
      const result = await checkExistingFingerprints(
        fingerprints,
        mockSupabase as any
      );

      expect(result.size).toBe(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('prompts');
      expect(mockSupabase.select).toHaveBeenCalledWith('fingerprint');
      expect(mockSupabase.in).toHaveBeenCalledWith('fingerprint', fingerprints);
    });

    it('should return set of existing fingerprints', async () => {
      mockSupabase.in.mockResolvedValue({
        data: [{ fingerprint: 'abc123' }],
        error: null,
      });

      const fingerprints = ['abc123', 'def456'];
      const result = await checkExistingFingerprints(
        fingerprints,
        mockSupabase as any
      );

      expect(result.size).toBe(1);
      expect(result.has('abc123')).toBe(true);
      expect(result.has('def456')).toBe(false);
    });

    it('should handle empty fingerprints array', async () => {
      const result = await checkExistingFingerprints([], mockSupabase as any);
      expect(result.size).toBe(0);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should chunk large fingerprint arrays', async () => {
      // Create 1500 fingerprints (should be chunked into 2 batches)
      const fingerprints = Array.from({ length: 1500 }, (_, i) =>
        String(i).padStart(16, '0')
      );

      mockSupabase.in.mockResolvedValue({
        data: [{ fingerprint: '0000000000000000' }],
        error: null,
      });

      const result = await checkExistingFingerprints(
        fingerprints,
        mockSupabase as any
      );

      // Should have made 2 calls (1000 + 500)
      expect(mockSupabase.in).toHaveBeenCalledTimes(2);
      expect(result.has('0000000000000000')).toBe(true);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.in.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: '500' },
      });

      await expect(
        checkExistingFingerprints(['abc123'], mockSupabase as any)
      ).rejects.toThrow('Failed to check existing fingerprints');
    });
  });

  describe('filterDuplicates', () => {
    it('should return all pairs when none exist in database', async () => {
      mockSupabase.in.mockResolvedValue({ data: [], error: null });

      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
        {
          prompt: {
            text: 'Fix a bug',
            timestamp: '2025-01-15T10:31:00Z',
          },
        },
      ];

      const result = await filterDuplicates(userId, pairs, mockSupabase as any);

      expect(result.newPairs).toHaveLength(2);
      expect(result.duplicateCount).toBe(0);
    });

    it('should filter out duplicates that exist in database', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
        {
          prompt: {
            text: 'Fix a bug',
            timestamp: '2025-01-15T10:31:00Z',
          },
        },
      ];

      // First, add fingerprints to know what the fingerprint will be
      const pairsWithFp = addFingerprints(userId, pairs);

      // Mock database returning the first fingerprint as existing
      mockSupabase.in.mockResolvedValue({
        data: [{ fingerprint: pairsWithFp[0]!.fingerprint }],
        error: null,
      });

      const result = await filterDuplicates(userId, pairs, mockSupabase as any);

      expect(result.newPairs).toHaveLength(1);
      expect(result.duplicateCount).toBe(1);
      expect(result.newPairs[0]!.prompt.text).toBe('Fix a bug');
    });

    it('should handle all prompts being duplicates', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
      ];

      const pairsWithFp = addFingerprints(userId, pairs);

      mockSupabase.in.mockResolvedValue({
        data: [{ fingerprint: pairsWithFp[0]!.fingerprint }],
        error: null,
      });

      const result = await filterDuplicates(userId, pairs, mockSupabase as any);

      expect(result.newPairs).toHaveLength(0);
      expect(result.duplicateCount).toBe(1);
    });

    it('should deduplicate within the batch itself', async () => {
      mockSupabase.in.mockResolvedValue({ data: [], error: null });

      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
        {
          prompt: {
            text: 'write a function', // Same text (case insensitive)
            timestamp: '2025-01-15T10:30:00Z', // Same timestamp
          },
        },
        {
          prompt: {
            text: '  Write  a  function  ', // Same text (whitespace normalized)
            timestamp: '2025-01-15T10:30:30Z', // Same minute
          },
        },
      ];

      const result = await filterDuplicates(userId, pairs, mockSupabase as any);

      // All three should have the same fingerprint, so only 1 should remain
      expect(result.newPairs).toHaveLength(1);
      expect(result.duplicateCount).toBe(2);
    });

    it('should handle empty pairs array', async () => {
      const result = await filterDuplicates(
        'user-id',
        [],
        mockSupabase as any
      );

      expect(result.newPairs).toEqual([]);
      expect(result.duplicateCount).toBe(0);
    });

    it('should preserve prompt data through filtering', async () => {
      mockSupabase.in.mockResolvedValue({ data: [], error: null });

      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function',
            timestamp: '2025-01-15T10:30:00Z',
            metadata: { source: 'import' },
          },
          response: {
            text: 'Here is your function...',
            timestamp: '2025-01-15T10:30:05Z',
          },
        },
      ];

      const result = await filterDuplicates(userId, pairs, mockSupabase as any);

      expect(result.newPairs[0]!.prompt.metadata).toEqual({ source: 'import' });
      expect(result.newPairs[0]!.response?.text).toBe('Here is your function...');
      expect(result.newPairs[0]!.fingerprint).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle hook-captured prompt blocking import duplicate', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';

      // Simulate a prompt that was already captured by the hook
      const hookCapturedPair: PromptResponsePair = {
        prompt: {
          text: 'Help me debug this code',
          timestamp: '2025-01-15T10:30:00Z',
        },
      };

      // Same prompt in historical import (from transcript)
      const importPairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Help me debug this code',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
        {
          prompt: {
            text: 'A different prompt',
            timestamp: '2025-01-15T10:31:00Z',
          },
        },
      ];

      // Calculate what fingerprint the hook-captured prompt would have
      const hookFingerprint = addFingerprints(userId, [hookCapturedPair])[0]!.fingerprint;

      // Mock database returning the hook-captured fingerprint
      mockSupabase.in.mockResolvedValue({
        data: [{ fingerprint: hookFingerprint }],
        error: null,
      });

      const result = await filterDuplicates(userId, importPairs, mockSupabase as any);

      // The first prompt should be skipped (duplicate of hook capture)
      // The second prompt should be imported
      expect(result.newPairs).toHaveLength(1);
      expect(result.duplicateCount).toBe(1);
      expect(result.newPairs[0]!.prompt.text).toBe('A different prompt');
    });

    it('should treat similar but not identical prompts as different', async () => {
      mockSupabase.in.mockResolvedValue({ data: [], error: null });

      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'Write a function to calculate sum',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
        {
          prompt: {
            text: 'Write a function to calculate average',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
      ];

      const result = await filterDuplicates(userId, pairs, mockSupabase as any);

      // Both should be imported - they're similar but not identical
      expect(result.newPairs).toHaveLength(2);
      expect(result.duplicateCount).toBe(0);
    });

    it('should handle prompts with same text but different timestamps', async () => {
      mockSupabase.in.mockResolvedValue({ data: [], error: null });

      const userId = '11111111-1111-1111-1111-111111111111';
      const pairs: PromptResponsePair[] = [
        {
          prompt: {
            text: 'How do I fix this bug?',
            timestamp: '2025-01-15T10:30:00Z',
          },
        },
        {
          prompt: {
            text: 'How do I fix this bug?',
            timestamp: '2025-01-15T11:30:00Z', // Different hour
          },
        },
      ];

      const result = await filterDuplicates(userId, pairs, mockSupabase as any);

      // Both should be imported - same text but different times
      expect(result.newPairs).toHaveLength(2);
      expect(result.duplicateCount).toBe(0);
    });
  });
});
