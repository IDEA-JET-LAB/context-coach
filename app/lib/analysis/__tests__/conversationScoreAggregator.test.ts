/**
 * Conversation Score Aggregator Tests
 * Story 27-6: Conversation Score Aggregation
 *
 * Tests for session-level score aggregation functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateConversationScore,
  updateSessionStats,
  getSessionStats,
  getScoreBreakdown,
  refreshSessionStats,
  refreshSessionStatsBatch,
  getSessionsNeedingRecalculation,
} from '../conversationScoreAggregator';

// ============================================================================
// Mock Setup
// ============================================================================

function createMockSupabase(overrides: {
  rpcResult?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
} = {}): SupabaseClient {
  const mockRpc = vi.fn().mockResolvedValue(
    overrides.rpcResult ?? { data: 7.5, error: null }
  );

  const mockSingle = vi.fn().mockResolvedValue(
    overrides.selectResult ?? {
      data: {
        id: 'session-123',
        conversation_score: 7.5,
        user_message_count: 10,
        primary_stage: 'development',
        has_debugging_loop: false,
      },
      error: null,
    }
  );

  const mockOrder = vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue(
      overrides.selectResult ?? { data: [], error: null }
    ),
  });

  const mockEq = vi.fn().mockReturnValue({
    single: mockSingle,
    order: mockOrder,
  });

  const mockIs = vi.fn().mockReturnValue({
    order: mockOrder,
  });

  const mockSelect = vi.fn().mockReturnValue({
    eq: mockEq,
    is: mockIs,
  });

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
  });

  return {
    rpc: mockRpc,
    from: mockFrom,
  } as unknown as SupabaseClient;
}

// ============================================================================
// Tests: calculateConversationScore
// ============================================================================

describe('calculateConversationScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate conversation score successfully', async () => {
    const mockSupabase = createMockSupabase({
      rpcResult: { data: 7.5, error: null },
    });

    const result = await calculateConversationScore(
      '550e8400-e29b-41d4-a716-446655440000',
      { supabase: mockSupabase }
    );

    expect(result).toBe(7.5);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_conversation_score', {
      p_session_uuid: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('should return null when no scorable prompts', async () => {
    const mockSupabase = createMockSupabase({
      rpcResult: { data: null, error: null },
    });

    const result = await calculateConversationScore(
      '550e8400-e29b-41d4-a716-446655440000',
      { supabase: mockSupabase }
    );

    expect(result).toBeNull();
  });

  it('should throw error for invalid UUID', async () => {
    const mockSupabase = createMockSupabase();

    await expect(
      calculateConversationScore('invalid-uuid', { supabase: mockSupabase })
    ).rejects.toThrow('Invalid session UUID');
  });

  it('should throw error on RPC failure', async () => {
    const mockSupabase = createMockSupabase({
      rpcResult: { data: null, error: { message: 'Database error' } },
    });

    await expect(
      calculateConversationScore('550e8400-e29b-41d4-a716-446655440000', {
        supabase: mockSupabase,
      })
    ).rejects.toThrow('Failed to calculate conversation score');
  });
});

// ============================================================================
// Tests: updateSessionStats
// ============================================================================

describe('updateSessionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update session stats successfully', async () => {
    const mockSupabase = createMockSupabase({
      rpcResult: { data: null, error: null },
    });

    await updateSessionStats('550e8400-e29b-41d4-a716-446655440000', {
      supabase: mockSupabase,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_session_stats', {
      p_session_uuid: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('should throw error for invalid UUID', async () => {
    const mockSupabase = createMockSupabase();

    await expect(
      updateSessionStats('not-a-uuid', { supabase: mockSupabase })
    ).rejects.toThrow('Invalid session UUID');
  });

  it('should throw error on RPC failure', async () => {
    const mockSupabase = createMockSupabase({
      rpcResult: { data: null, error: { message: 'Update failed' } },
    });

    await expect(
      updateSessionStats('550e8400-e29b-41d4-a716-446655440000', {
        supabase: mockSupabase,
      })
    ).rejects.toThrow('Failed to update session stats');
  });
});

// ============================================================================
// Tests: getSessionStats
// ============================================================================

describe('getSessionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return session stats', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'session-123',
        conversation_score: 7.5,
        user_message_count: 10,
        primary_stage: 'development',
        has_debugging_loop: false,
      },
      error: null,
    });

    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    // Mock for counting prompts
    const mockPromptEq = vi.fn().mockResolvedValue({
      data: [
        { id: 'p1', prompt_analyses: [{ skipped: false }] },
        { id: 'p2', prompt_analyses: [{ skipped: true }] },
        { id: 'p3', prompt_analyses: [{ skipped: false }] },
      ],
      error: null,
    });
    const mockPromptSelect = vi.fn().mockReturnValue({ eq: mockPromptEq });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'sessions') {
        return { select: mockSelect };
      }
      return { select: mockPromptSelect };
    });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await getSessionStats('550e8400-e29b-41d4-a716-446655440000', {
      supabase: mockSupabase,
    });

    expect(result.sessionId).toBe('session-123');
    expect(result.conversationScore).toBe(7.5);
    expect(result.userMessageCount).toBe(10);
    expect(result.scoredPromptCount).toBe(2);
    expect(result.skippedPromptCount).toBe(1);
  });

  it('should throw error for invalid UUID', async () => {
    const mockSupabase = createMockSupabase();

    await expect(
      getSessionStats('bad-id', { supabase: mockSupabase })
    ).rejects.toThrow('Invalid session UUID');
  });

  it('should throw error when session not found', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    await expect(
      getSessionStats('550e8400-e29b-41d4-a716-446655440000', {
        supabase: mockSupabase,
      })
    ).rejects.toThrow('Session not found');
  });
});

// ============================================================================
// Tests: getScoreBreakdown
// ============================================================================

describe('getScoreBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return score breakdown for all prompts', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'prompt-1',
          prompt_classification: 'initiating',
          sequence_number: 1,
          prompt_analyses: [{ overall_score: 8, scoring_weight: 1.0, skipped: false }],
        },
        {
          id: 'prompt-2',
          prompt_classification: 'selection',
          sequence_number: 2,
          prompt_analyses: [{ overall_score: null, scoring_weight: 0, skipped: true }],
        },
        {
          id: 'prompt-3',
          prompt_classification: 'continuation',
          sequence_number: 3,
          prompt_analyses: [{ overall_score: 7, scoring_weight: 0.7, skipped: false }],
        },
      ],
      error: null,
    });

    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await getScoreBreakdown('550e8400-e29b-41d4-a716-446655440000', {
      supabase: mockSupabase,
    });

    expect(result).toHaveLength(3);

    expect(result[0].promptId).toBe('prompt-1');
    expect(result[0].promptType).toBe('initiating');
    expect(result[0].score).toBe(8);
    expect(result[0].weight).toBe(1.0);
    expect(result[0].skipped).toBe(false);

    expect(result[1].promptId).toBe('prompt-2');
    expect(result[1].promptType).toBe('selection');
    expect(result[1].score).toBeNull();
    expect(result[1].weight).toBe(0);
    expect(result[1].skipped).toBe(true);

    expect(result[2].promptId).toBe('prompt-3');
    expect(result[2].promptType).toBe('continuation');
    expect(result[2].score).toBe(7);
    expect(result[2].weight).toBe(0.7);
    expect(result[2].skipped).toBe(false);
  });

  it('should return empty array for session with no prompts', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await getScoreBreakdown('550e8400-e29b-41d4-a716-446655440000', {
      supabase: mockSupabase,
    });

    expect(result).toHaveLength(0);
  });

  it('should handle prompts without analysis', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'prompt-1',
          prompt_classification: 'initiating',
          sequence_number: 1,
          prompt_analyses: [], // No analysis yet
        },
      ],
      error: null,
    });

    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await getScoreBreakdown('550e8400-e29b-41d4-a716-446655440000', {
      supabase: mockSupabase,
    });

    expect(result[0].score).toBeNull();
    expect(result[0].weight).toBe(0);
    expect(result[0].skipped).toBe(false);
  });
});

// ============================================================================
// Tests: refreshSessionStats
// ============================================================================

describe('refreshSessionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call update and calculate functions', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'session-123',
        conversation_score: 7.5,
        user_message_count: 10,
        primary_stage: 'development',
        has_debugging_loop: false,
      },
      error: null,
    });

    const mockPromptEq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockPromptSelect = vi.fn().mockReturnValue({ eq: mockPromptEq });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'sessions') {
        return { select: mockSelect };
      }
      return { select: mockPromptSelect };
    });

    const mockSupabase = {
      rpc: mockRpc,
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await refreshSessionStats(
      '550e8400-e29b-41d4-a716-446655440000',
      { supabase: mockSupabase }
    );

    // Should call both RPC functions
    expect(mockRpc).toHaveBeenCalledWith('update_session_stats', expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith(
      'calculate_conversation_score',
      expect.any(Object)
    );

    // Should return stats
    expect(result.sessionId).toBe('session-123');
    expect(result.conversationScore).toBe(7.5);
  });
});

// ============================================================================
// Tests: refreshSessionStatsBatch
// ============================================================================

describe('refreshSessionStatsBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process multiple sessions', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'session-123',
        conversation_score: 7.5,
        user_message_count: 10,
        primary_stage: null,
        has_debugging_loop: false,
      },
      error: null,
    });

    const mockPromptEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockPromptSelect = vi.fn().mockReturnValue({ eq: mockPromptEq });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'sessions') {
        return { select: mockSelect };
      }
      return { select: mockPromptSelect };
    });

    const mockSupabase = {
      rpc: mockRpc,
      from: mockFrom,
    } as unknown as SupabaseClient;

    const results = await refreshSessionStatsBatch(
      [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
      ],
      { supabase: mockSupabase }
    );

    expect(results).toHaveLength(2);
    expect(results[0]).not.toBeInstanceOf(Error);
    expect(results[1]).not.toBeInstanceOf(Error);
  });

  it('should handle partial failures', async () => {
    const mockRpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed' } });

    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'session-123',
        conversation_score: 7.5,
        user_message_count: 10,
        primary_stage: null,
        has_debugging_loop: false,
      },
      error: null,
    });

    const mockPromptEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockPromptSelect = vi.fn().mockReturnValue({ eq: mockPromptEq });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'sessions') {
        return { select: mockSelect };
      }
      return { select: mockPromptSelect };
    });

    const mockSupabase = {
      rpc: mockRpc,
      from: mockFrom,
    } as unknown as SupabaseClient;

    const results = await refreshSessionStatsBatch(
      [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
      ],
      { supabase: mockSupabase }
    );

    expect(results).toHaveLength(2);
    expect(results[0]).not.toBeInstanceOf(Error);
    expect(results[1]).toBeInstanceOf(Error);
  });
});

// ============================================================================
// Tests: getSessionsNeedingRecalculation
// ============================================================================

describe('getSessionsNeedingRecalculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return sessions with null conversation_score', async () => {
    const mockLimit = vi.fn().mockResolvedValue({
      data: [{ id: 'session-1' }, { id: 'session-2' }],
      error: null,
    });

    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ is: mockIs });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await getSessionsNeedingRecalculation(50, {
      supabase: mockSupabase,
    });

    expect(result).toEqual(['session-1', 'session-2']);
  });

  it('should return empty array on error', async () => {
    const mockLimit = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Query failed' },
    });

    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ is: mockIs });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await getSessionsNeedingRecalculation(50, {
      supabase: mockSupabase,
    });

    expect(result).toEqual([]);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle zero conversation score (valid)', async () => {
    const mockSupabase = createMockSupabase({
      rpcResult: { data: 0, error: null },
    });

    const result = await calculateConversationScore(
      '550e8400-e29b-41d4-a716-446655440000',
      { supabase: mockSupabase }
    );

    expect(result).toBe(0);
    expect(result).not.toBeNull();
  });

  it('should handle decimal scores', async () => {
    const mockSupabase = createMockSupabase({
      rpcResult: { data: 7.24, error: null },
    });

    const result = await calculateConversationScore(
      '550e8400-e29b-41d4-a716-446655440000',
      { supabase: mockSupabase }
    );

    expect(result).toBe(7.24);
  });

  it('should validate UUID format strictly', async () => {
    const mockSupabase = createMockSupabase();

    // Missing dashes
    await expect(
      calculateConversationScore('550e8400e29b41d4a716446655440000', {
        supabase: mockSupabase,
      })
    ).rejects.toThrow('Invalid session UUID');

    // Too short
    await expect(
      calculateConversationScore('550e8400-e29b-41d4-a716', {
        supabase: mockSupabase,
      })
    ).rejects.toThrow('Invalid session UUID');

    // Empty string
    await expect(
      calculateConversationScore('', { supabase: mockSupabase })
    ).rejects.toThrow('Invalid session UUID');
  });
});

// ============================================================================
// Tests: Weighted Average Calculation (Conceptual)
// ============================================================================

describe('Weighted Average (Conceptual Tests)', () => {
  it('should document the weighted average formula', () => {
    // The database function calculates:
    // conversation_score = SUM(score_i * weight_i) / SUM(weight_i)
    //
    // Example from story:
    // Prompt 1: initiating, score=8.0, weight=1.0 -> contributes 8.0
    // Prompt 2: confirmation, skipped=true -> excluded
    // Prompt 3: continuation, score=7.0, weight=0.7 -> contributes 4.9
    // Prompt 4: selection, skipped=true -> excluded
    // Prompt 5: correction, score=6.5, weight=0.8 -> contributes 5.2
    //
    // conversation_score = (8.0 + 4.9 + 5.2) / (1.0 + 0.7 + 0.8) = 18.1 / 2.5 = 7.24 -> 7.2

    const scores = [
      { score: 8.0, weight: 1.0 },
      { score: 7.0, weight: 0.7 },
      { score: 6.5, weight: 0.8 },
    ];

    const totalWeightedScore = scores.reduce(
      (sum, s) => sum + s.score * s.weight,
      0
    );
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const average = totalWeightedScore / totalWeight;

    expect(totalWeightedScore).toBeCloseTo(18.1, 1);
    expect(totalWeight).toBe(2.5);
    expect(average).toBeCloseTo(7.24, 2);
  });

  it('should handle all-skipped sessions', () => {
    // When all prompts are selection/confirmation (weight=0),
    // the denominator is 0 and we return null (not 0)
    const scores: Array<{ score: number; weight: number }> = [];
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);

    expect(totalWeight).toBe(0);
    // Database function returns NULL in this case
  });

  it('should handle single prompt session', () => {
    const scores = [{ score: 8.0, weight: 1.0 }];

    const totalWeightedScore = scores.reduce(
      (sum, s) => sum + s.score * s.weight,
      0
    );
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const average = totalWeightedScore / totalWeight;

    expect(average).toBe(8.0);
  });
});
