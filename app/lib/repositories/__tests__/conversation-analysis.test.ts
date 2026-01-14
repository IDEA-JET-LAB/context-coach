/**
 * Conversation Analysis Repository Tests
 * Story 30-3: Analysis Storage Schema
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAnalysis,
  getAnalysesForSession,
  getAnalysisById,
  deleteAnalysis,
  mapToConversationAnalysis,
  getAnalysesForUser,
  getTeamUsageStats,
} from '../conversation-analysis';
import type {
  CreateAnalysisInput,
  ConversationAnalysisRow,
} from '@/lib/types/conversation-analysis';

// Mock Supabase client
function createMockSupabase() {
  const mock = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return mock;
}

const mockAnalysisRow: ConversationAnalysisRow = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  session_id: 'test-session-123',
  team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  question: 'Summarize this conversation',
  question_type: 'summarize',
  response: 'This conversation covered...',
  model: 'sonnet',
  input_tokens: 1500,
  output_tokens: 500,
  estimated_cost_cents: 0.0125,
  included_prompts: true,
  included_responses: true,
  included_thinking: false,
  included_tools: false,
  created_at: '2026-01-09T18:00:00Z',
};

describe('Conversation Analysis Repository - Story 30-3', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  describe('mapToConversationAnalysis', () => {
    it('should convert snake_case row to camelCase object', () => {
      const result = mapToConversationAnalysis(mockAnalysisRow);

      expect(result).toEqual({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        sessionId: 'test-session-123',
        teamId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        question: 'Summarize this conversation',
        questionType: 'summarize',
        response: 'This conversation covered...',
        model: 'sonnet',
        inputTokens: 1500,
        outputTokens: 500,
        estimatedCostCents: 0.0125,
        includedPrompts: true,
        includedResponses: true,
        includedThinking: false,
        includedTools: false,
        createdAt: '2026-01-09T18:00:00Z',
      });
    });

    it('should handle string cost value from database', () => {
      const rowWithStringCost = {
        ...mockAnalysisRow,
        estimated_cost_cents: '0.0125',
      };

      const result = mapToConversationAnalysis(rowWithStringCost);

      expect(result.estimatedCostCents).toBe(0.0125);
      expect(typeof result.estimatedCostCents).toBe('number');
    });

    it('should handle null question_type', () => {
      const rowWithNullType = {
        ...mockAnalysisRow,
        question_type: null,
      };

      const result = mapToConversationAnalysis(rowWithNullType);

      expect(result.questionType).toBeNull();
    });

    it('should handle custom question type', () => {
      const rowWithCustomType = {
        ...mockAnalysisRow,
        question_type: 'custom',
      };

      const result = mapToConversationAnalysis(rowWithCustomType);

      expect(result.questionType).toBe('custom');
    });
  });

  describe('createAnalysis', () => {
    it('should create and return analysis record', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockAnalysisRow,
        error: null,
      });

      const input: CreateAnalysisInput = {
        sessionId: 'test-session-123',
        teamId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        question: 'Summarize this conversation',
        questionType: 'summarize',
        response: 'This conversation covered...',
        model: 'sonnet',
        inputTokens: 1500,
        outputTokens: 500,
        estimatedCostCents: 0.0125,
        includedPrompts: true,
        includedResponses: true,
        includedThinking: false,
        includedTools: false,
      };

      const result = await createAnalysis(
        mockSupabase as any,
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        input
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('conversation_analyses');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        session_id: 'test-session-123',
        team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        question: 'Summarize this conversation',
        question_type: 'summarize',
        response: 'This conversation covered...',
        model: 'sonnet',
        input_tokens: 1500,
        output_tokens: 500,
        estimated_cost_cents: 0.0125,
        included_prompts: true,
        included_responses: true,
        included_thinking: false,
        included_tools: false,
      });
      expect(result.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(result.sessionId).toBe('test-session-123');
    });

    it('should handle undefined questionType as null', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { ...mockAnalysisRow, question_type: null },
        error: null,
      });

      const input: CreateAnalysisInput = {
        sessionId: 'test-session-123',
        teamId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        question: 'Custom question',
        response: 'Response...',
        model: 'haiku',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostCents: 0.001,
        includedPrompts: true,
        includedResponses: false,
        includedThinking: false,
        includedTools: false,
      };

      await createAnalysis(
        mockSupabase as any,
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        input
      );

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          question_type: null,
        })
      );
    });

    it('should throw error on insert failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Foreign key violation' },
      });

      const input: CreateAnalysisInput = {
        sessionId: 'invalid-session',
        teamId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        question: 'Question',
        response: 'Response',
        model: 'sonnet',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostCents: 0.01,
        includedPrompts: true,
        includedResponses: true,
        includedThinking: false,
        includedTools: false,
      };

      await expect(
        createAnalysis(mockSupabase as any, 'user-id', input)
      ).rejects.toThrow('Failed to create analysis: Foreign key violation');
    });
  });

  describe('getAnalysesForSession', () => {
    it('should return analyses ordered by created_at desc', async () => {
      const olderRow = {
        ...mockAnalysisRow,
        id: 'older-id',
        created_at: '2026-01-09T17:00:00Z',
      };
      const newerRow = {
        ...mockAnalysisRow,
        id: 'newer-id',
        created_at: '2026-01-09T19:00:00Z',
      };

      mockSupabase.order.mockResolvedValue({
        data: [newerRow, olderRow],
        error: null,
      });

      const result = await getAnalysesForSession(
        mockSupabase as any,
        'test-session-123'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('conversation_analyses');
      expect(mockSupabase.eq).toHaveBeenCalledWith(
        'session_id',
        'test-session-123'
      );
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('newer-id');
      expect(result[1]!.id).toBe('older-id');
    });

    it('should return empty array when no analyses exist', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await getAnalysesForSession(
        mockSupabase as any,
        'no-analyses-session'
      );

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Connection error' },
      });

      await expect(
        getAnalysesForSession(mockSupabase as any, 'test-session')
      ).rejects.toThrow('Failed to get analyses for session: Connection error');
    });
  });

  describe('getAnalysisById', () => {
    it('should return analysis when found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockAnalysisRow,
        error: null,
      });

      const result = await getAnalysisById(
        mockSupabase as any,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('conversation_analyses');
      expect(mockSupabase.eq).toHaveBeenCalledWith(
        'id',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    });

    it('should return null for non-existent analysis', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'The result contains 0 rows' },
      });

      const result = await getAnalysisById(
        mockSupabase as any,
        'non-existent-id'
      );

      expect(result).toBeNull();
    });

    it('should throw error on other query failures', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: '500', message: 'Internal server error' },
      });

      await expect(
        getAnalysisById(mockSupabase as any, 'some-id')
      ).rejects.toThrow('Failed to get analysis: Internal server error');
    });
  });

  describe('deleteAnalysis', () => {
    it('should delete analysis successfully', async () => {
      mockSupabase.eq.mockResolvedValue({
        error: null,
      });

      await expect(
        deleteAnalysis(
          mockSupabase as any,
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        )
      ).resolves.toBeUndefined();

      expect(mockSupabase.from).toHaveBeenCalledWith('conversation_analyses');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith(
        'id',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      );
    });

    it('should throw error on delete failure', async () => {
      mockSupabase.eq.mockResolvedValue({
        error: { message: 'Permission denied' },
      });

      await expect(
        deleteAnalysis(mockSupabase as any, 'some-id')
      ).rejects.toThrow('Failed to delete analysis: Permission denied');
    });
  });

  describe('getAnalysesForUser', () => {
    it('should return user analyses with default limit', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: [mockAnalysisRow],
        error: null,
      });

      const result = await getAnalysesForUser(
        mockSupabase as any,
        'cccccccc-cccc-cccc-cccc-cccccccccccc'
      );

      expect(mockSupabase.eq).toHaveBeenCalledWith(
        'user_id',
        'cccccccc-cccc-cccc-cccc-cccccccccccc'
      );
      expect(mockSupabase.limit).toHaveBeenCalledWith(50);
      expect(result).toHaveLength(1);
    });

    it('should respect custom limit', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      await getAnalysesForUser(mockSupabase as any, 'user-id', 10);

      expect(mockSupabase.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('getTeamUsageStats', () => {
    it('should calculate team usage statistics', async () => {
      const rows = [
        { input_tokens: 1000, output_tokens: 500, estimated_cost_cents: 0.01 },
        { input_tokens: 2000, output_tokens: 800, estimated_cost_cents: 0.02 },
        { input_tokens: 500, output_tokens: 200, estimated_cost_cents: '0.005' },
      ];

      mockSupabase.eq.mockResolvedValue({
        data: rows,
        error: null,
      });

      const result = await getTeamUsageStats(
        mockSupabase as any,
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      );

      expect(result.totalAnalyses).toBe(3);
      expect(result.totalInputTokens).toBe(3500);
      expect(result.totalOutputTokens).toBe(1500);
      expect(result.totalCostCents).toBeCloseTo(0.035, 10);
    });

    it('should return zeros for team with no analyses', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await getTeamUsageStats(mockSupabase as any, 'empty-team');

      expect(result).toEqual({
        totalAnalyses: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostCents: 0,
      });
    });

    it('should throw error on query failure', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        getTeamUsageStats(mockSupabase as any, 'team-id')
      ).rejects.toThrow('Failed to get team usage stats: Database error');
    });
  });
});
