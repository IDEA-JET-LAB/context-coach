/**
 * Skipped Storage Tests
 * Story 27-4: Context-Aware Scoring
 *
 * Tests for the skipped analysis storage module.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  storeSkippedAnalysis,
  storeSkippedAnalysesBatch,
  hasSkippedAnalysis,
  getSkipReason,
  getSkippedAnalysisStats,
  type SkippedAnalysisInput,
} from '../skippedStorage';

// ============================================================================
// Mock Setup
// ============================================================================

function createMockSupabase(overrides: {
  rpcResult?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
} = {}): SupabaseClient {
  const mockRpc = vi.fn().mockResolvedValue(
    overrides.rpcResult ?? { data: 'mock-analysis-id', error: null }
  );

  const mockMaybeSingle = vi.fn().mockResolvedValue(
    overrides.selectResult ?? { data: null, error: null }
  );

  const mockEq = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: mockMaybeSingle,
    }),
    maybeSingle: mockMaybeSingle,
    gte: vi.fn().mockResolvedValue(
      overrides.selectResult ?? { data: [], error: null }
    ),
  });

  const mockSelect = vi.fn().mockReturnValue({
    eq: mockEq,
  });

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
  });

  return {
    rpc: mockRpc,
    from: mockFrom,
  } as unknown as SupabaseClient;
}

function createSkippedInput(overrides: Partial<SkippedAnalysisInput> = {}): SkippedAnalysisInput {
  return {
    promptId: 'test-prompt-id',
    promptType: 'selection',
    skipReason: 'Selection prompts do not require quality scoring',
    confidence: 0.95,
    ...overrides,
  };
}

// ============================================================================
// Tests: storeSkippedAnalysis
// ============================================================================

describe('storeSkippedAnalysis', () => {
  it('should store skipped analysis successfully', async () => {
    const mockSupabase = createMockSupabase();
    const input = createSkippedInput();

    const result = await storeSkippedAnalysis(input, { supabase: mockSupabase });

    expect(result.analysisId).toBe('mock-analysis-id');
    expect(result.isNew).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('store_skipped_analysis', {
      p_prompt_id: 'test-prompt-id',
      p_prompt_type: 'selection',
      p_skip_reason: 'Selection prompts do not require quality scoring',
      p_confidence: 0.95,
    });
  });

  it('should store skipped analysis for confirmation type', async () => {
    const mockSupabase = createMockSupabase();
    const input = createSkippedInput({
      promptType: 'confirmation',
      skipReason: 'Confirmation prompts do not require quality scoring',
    });

    const result = await storeSkippedAnalysis(input, { supabase: mockSupabase });

    expect(result.analysisId).toBe('mock-analysis-id');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('store_skipped_analysis', {
      p_prompt_id: 'test-prompt-id',
      p_prompt_type: 'confirmation',
      p_skip_reason: 'Confirmation prompts do not require quality scoring',
      p_confidence: 0.95,
    });
  });

  it('should handle null confidence', async () => {
    const mockSupabase = createMockSupabase();
    const input = createSkippedInput({ confidence: undefined });

    await storeSkippedAnalysis(input, { supabase: mockSupabase });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('store_skipped_analysis', {
      p_prompt_id: 'test-prompt-id',
      p_prompt_type: 'selection',
      p_skip_reason: 'Selection prompts do not require quality scoring',
      p_confidence: null,
    });
  });

  it('should throw error when RPC fails', async () => {
    const mockSupabase = createMockSupabase({
      rpcResult: { data: null, error: { message: 'Database error' } },
    });
    const input = createSkippedInput();

    await expect(
      storeSkippedAnalysis(input, { supabase: mockSupabase })
    ).rejects.toThrow('Failed to store skipped analysis: Database error');
  });

  it('should throw error when prompt not found', async () => {
    const mockSupabase = createMockSupabase({
      rpcResult: { data: null, error: { message: 'Foreign key violation' } },
    });
    const input = createSkippedInput({ promptId: 'non-existent' });

    await expect(
      storeSkippedAnalysis(input, { supabase: mockSupabase })
    ).rejects.toThrow('Foreign key violation');
  });

  it('should truncate long skip reason in logs', async () => {
    const mockSupabase = createMockSupabase();
    const longReason = 'A'.repeat(100);
    const input = createSkippedInput({ skipReason: longReason });

    // Should not throw
    const result = await storeSkippedAnalysis(input, { supabase: mockSupabase });
    expect(result.analysisId).toBe('mock-analysis-id');
  });
});

// ============================================================================
// Tests: storeSkippedAnalysesBatch
// ============================================================================

describe('storeSkippedAnalysesBatch', () => {
  it('should store multiple skipped analyses', async () => {
    const mockSupabase = createMockSupabase();
    const inputs = [
      createSkippedInput({ promptId: 'prompt-1' }),
      createSkippedInput({ promptId: 'prompt-2' }),
      createSkippedInput({ promptId: 'prompt-3' }),
    ];

    const results = await storeSkippedAnalysesBatch(inputs, { supabase: mockSupabase });

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result).not.toBeInstanceOf(Error);
      if (!(result instanceof Error)) {
        expect(result.analysisId).toBe('mock-analysis-id');
      }
    }
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
  });

  it('should handle partial failures', async () => {
    // Create a mock that fails on second call
    const mockRpc = vi.fn()
      .mockResolvedValueOnce({ data: 'id-1', error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed' } })
      .mockResolvedValueOnce({ data: 'id-3', error: null });

    const mockSupabase = {
      rpc: mockRpc,
    } as unknown as SupabaseClient;

    const inputs = [
      createSkippedInput({ promptId: 'prompt-1' }),
      createSkippedInput({ promptId: 'prompt-2' }),
      createSkippedInput({ promptId: 'prompt-3' }),
    ];

    const results = await storeSkippedAnalysesBatch(inputs, { supabase: mockSupabase });

    expect(results).toHaveLength(3);
    expect(results[0]).not.toBeInstanceOf(Error);
    expect(results[1]).toBeInstanceOf(Error);
    expect(results[2]).not.toBeInstanceOf(Error);
  });

  it('should handle empty input array', async () => {
    const mockSupabase = createMockSupabase();

    const results = await storeSkippedAnalysesBatch([], { supabase: mockSupabase });

    expect(results).toHaveLength(0);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: hasSkippedAnalysis
// ============================================================================

describe('hasSkippedAnalysis', () => {
  it('should return true when prompt has skipped analysis', async () => {
    const mockSupabase = createMockSupabase({
      selectResult: { data: { id: 'analysis-id', skipped: true }, error: null },
    });

    const result = await hasSkippedAnalysis('prompt-id', { supabase: mockSupabase });

    expect(result).toBe(true);
  });

  it('should return false when prompt has no skipped analysis', async () => {
    const mockSupabase = createMockSupabase({
      selectResult: { data: null, error: null },
    });

    const result = await hasSkippedAnalysis('prompt-id', { supabase: mockSupabase });

    expect(result).toBe(false);
  });

  it('should return false on database error', async () => {
    const mockSupabase = createMockSupabase({
      selectResult: { data: null, error: { message: 'Query failed' } },
    });

    const result = await hasSkippedAnalysis('prompt-id', { supabase: mockSupabase });

    expect(result).toBe(false);
  });
});

// ============================================================================
// Tests: getSkipReason
// ============================================================================

describe('getSkipReason', () => {
  it('should return skip reason when prompt was skipped', async () => {
    const mockSupabase = createMockSupabase({
      selectResult: {
        data: { skip_reason: 'Selection prompts do not require scoring' },
        error: null,
      },
    });

    const result = await getSkipReason('prompt-id', { supabase: mockSupabase });

    expect(result).toBe('Selection prompts do not require scoring');
  });

  it('should return null when prompt was not skipped', async () => {
    const mockSupabase = createMockSupabase({
      selectResult: { data: null, error: null },
    });

    const result = await getSkipReason('prompt-id', { supabase: mockSupabase });

    expect(result).toBeNull();
  });

  it('should return null on database error', async () => {
    const mockSupabase = createMockSupabase({
      selectResult: { data: null, error: { message: 'Query failed' } },
    });

    const result = await getSkipReason('prompt-id', { supabase: mockSupabase });

    expect(result).toBeNull();
  });
});

// ============================================================================
// Tests: getSkippedAnalysisStats
// ============================================================================

describe('getSkippedAnalysisStats', () => {
  it('should return stats for skipped analyses', async () => {
    const mockData = [
      { prompt_type: 'selection' },
      { prompt_type: 'selection' },
      { prompt_type: 'confirmation' },
      { prompt_type: 'selection' },
    ];

    // Create custom mock for stats query
    const mockGte = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await getSkippedAnalysisStats({
      supabase: mockSupabase,
      since: new Date('2024-01-01'),
    });

    expect(result.total).toBe(4);
    expect(result.byPromptType.selection).toBe(3);
    expect(result.byPromptType.confirmation).toBe(1);
    expect(result.byPromptType.initiating).toBe(0);
  });

  it('should return empty stats on error', async () => {
    const mockGte = vi.fn().mockResolvedValue({ data: null, error: { message: 'Failed' } });
    const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await getSkippedAnalysisStats({ supabase: mockSupabase });

    expect(result.total).toBe(0);
    expect(result.byPromptType.selection).toBe(0);
  });

  it('should handle empty results', async () => {
    const mockGte = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase = {
      rpc: vi.fn(),
      from: mockFrom,
    } as unknown as SupabaseClient;

    const result = await getSkippedAnalysisStats({ supabase: mockSupabase });

    expect(result.total).toBe(0);
    Object.values(result.byPromptType).forEach((count) => {
      expect(count).toBe(0);
    });
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle special characters in skip reason', async () => {
    const mockSupabase = createMockSupabase();
    const input = createSkippedInput({
      skipReason: "Skip reason with 'quotes' and \"double quotes\" and émojis 🎉",
    });

    const result = await storeSkippedAnalysis(input, { supabase: mockSupabase });

    expect(result.analysisId).toBe('mock-analysis-id');
  });

  it('should handle empty skip reason', async () => {
    const mockSupabase = createMockSupabase();
    const input = createSkippedInput({ skipReason: '' });

    // Should not throw (validation is at database level)
    const result = await storeSkippedAnalysis(input, { supabase: mockSupabase });

    expect(result.analysisId).toBe('mock-analysis-id');
  });

  it('should handle UUID format prompt ID', async () => {
    const mockSupabase = createMockSupabase();
    const input = createSkippedInput({
      promptId: '550e8400-e29b-41d4-a716-446655440000',
    });

    const result = await storeSkippedAnalysis(input, { supabase: mockSupabase });

    expect(result.analysisId).toBe('mock-analysis-id');
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'store_skipped_analysis',
      expect.objectContaining({
        p_prompt_id: '550e8400-e29b-41d4-a716-446655440000',
      })
    );
  });

  it('should handle confidence at boundary values', async () => {
    const mockSupabase = createMockSupabase();

    // Test confidence = 0
    await storeSkippedAnalysis(
      createSkippedInput({ confidence: 0 }),
      { supabase: mockSupabase }
    );
    expect(mockSupabase.rpc).toHaveBeenLastCalledWith(
      'store_skipped_analysis',
      expect.objectContaining({ p_confidence: 0 })
    );

    // Test confidence = 1
    await storeSkippedAnalysis(
      createSkippedInput({ confidence: 1 }),
      { supabase: mockSupabase }
    );
    expect(mockSupabase.rpc).toHaveBeenLastCalledWith(
      'store_skipped_analysis',
      expect.objectContaining({ p_confidence: 1 })
    );
  });

  it('should handle all skippable prompt types', async () => {
    const mockSupabase = createMockSupabase();
    const skippableTypes = ['selection', 'confirmation'] as const;

    for (const promptType of skippableTypes) {
      const input = createSkippedInput({ promptType });
      const result = await storeSkippedAnalysis(input, { supabase: mockSupabase });

      expect(result.analysisId).toBe('mock-analysis-id');
    }
  });
});

// ============================================================================
// Tests: Type Safety
// ============================================================================

describe('Type Safety', () => {
  it('should accept valid PromptType values', async () => {
    const mockSupabase = createMockSupabase();
    const validTypes = [
      'initiating',
      'continuation',
      'selection',
      'correction',
      'confirmation',
      'clarification',
    ] as const;

    for (const promptType of validTypes) {
      const input = createSkippedInput({ promptType });
      const result = await storeSkippedAnalysis(input, { supabase: mockSupabase });
      expect(result.analysisId).toBeDefined();
    }
  });
});
