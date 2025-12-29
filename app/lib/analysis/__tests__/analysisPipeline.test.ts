/**
 * Analysis Pipeline Tests
 * Story 27-5: Update Analysis Pipeline
 *
 * Tests for the pipeline orchestration module that integrates
 * classification, context building, and scoring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  runAnalysisPipeline,
  runAnalysisPipelineBatch,
  getPendingPrompts,
  type PipelineResult,
  type PipelineOptions,
} from '../analysisPipeline';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the dependencies
vi.mock('../buildAnalysisContext', () => ({
  buildAnalysisContext: vi.fn(),
}));

vi.mock('../promptClassifier', () => ({
  classifyPrompt: vi.fn(),
  shouldSkipScoring: vi.fn(),
}));

vi.mock('../contextAwareScoring', () => ({
  scorePromptWithContext: vi.fn(),
}));

vi.mock('../skippedStorage', () => ({
  storeSkippedAnalysis: vi.fn(),
}));

vi.mock('../dimensionAdjustments', () => ({
  getSkipReason: vi.fn(),
}));

import { buildAnalysisContext } from '../buildAnalysisContext';
import { classifyPrompt, shouldSkipScoring } from '../promptClassifier';
import { scorePromptWithContext } from '../contextAwareScoring';
import { storeSkippedAnalysis } from '../skippedStorage';
import { getSkipReason } from '../dimensionAdjustments';

const mockBuildContext = buildAnalysisContext as ReturnType<typeof vi.fn>;
const mockClassify = classifyPrompt as ReturnType<typeof vi.fn>;
const mockShouldSkip = shouldSkipScoring as ReturnType<typeof vi.fn>;
const mockScore = scorePromptWithContext as ReturnType<typeof vi.fn>;
const mockStoreSkipped = storeSkippedAnalysis as ReturnType<typeof vi.fn>;
const mockGetSkipReason = getSkipReason as ReturnType<typeof vi.fn>;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSupabase(overrides: {
  promptData?: Record<string, unknown> | null;
  promptError?: { message: string } | null;
  updateError?: { message: string } | null;
  configData?: { id: string } | null;
  rpcError?: { message: string } | null;
  pendingPrompts?: Array<{ id: string }>;
} = {}): SupabaseClient {
  const mockSingle = vi.fn().mockResolvedValue({
    data: overrides.promptData ?? {
      id: 'test-prompt-id',
      text: 'Help me understand this code',
      analyzed_text: null,
      session_uuid: 'test-session-id',
      analysis_status: 'pending',
      prompt_classification: null,
    },
    error: overrides.promptError ?? null,
  });

  const mockEq = vi.fn().mockReturnValue({
    single: mockSingle,
    maybeSingle: mockSingle,
  });

  const mockSelect = vi.fn().mockReturnValue({
    eq: mockEq,
  });

  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({
      data: null,
      error: overrides.updateError ?? null,
    }),
  });

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'analysis_configs') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: overrides.configData ?? { id: 'config-123' },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'prompts') {
      return {
        select: mockSelect,
        update: mockUpdate,
      };
    }
    return { select: mockSelect, update: mockUpdate };
  });

  const mockRpc = vi.fn().mockResolvedValue({
    data: 'stored',
    error: overrides.rpcError ?? null,
  });

  // For getPendingPrompts
  if (overrides.pendingPrompts) {
    const mockOrder = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: overrides.pendingPrompts,
        error: null,
      }),
    });

    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
        }),
        update: mockUpdate,
      }),
      rpc: mockRpc,
    } as unknown as SupabaseClient;
  }

  return {
    from: mockFrom,
    rpc: mockRpc,
  } as unknown as SupabaseClient;
}

function createMockContext() {
  return {
    sessionId: 'test-session-id',
    messageIndex: 3,
    messages: [
      { role: 'user' as const, content: 'Previous message', timestamp: new Date() },
    ],
    lastResponse: { text: 'AI response', tokenCount: 100 },
    tokenBudget: 10000,
    totalTokens: 500,
    sessionMetadata: undefined,
  };
}

function createMockScoringResult(skipped = false) {
  if (skipped) {
    return {
      skipped: true as const,
      skipReason: 'Selection prompt',
      promptType: 'selection' as const,
      confidence: 0.95,
    };
  }

  return {
    skipped: false as const,
    promptType: 'initiating' as const,
    confidence: 0.92,
    overallWeight: 1.0,
    rawOverallScore: 7.5,
    weightedOverallScore: 7.5,
    rawDimensionScores: {
      Clarity: { score: 8, reasoning: 'Clear' },
      Context: { score: 7, reasoning: 'Good context' },
      Goal: { score: 8, reasoning: 'Clear goal' },
      Specificity: { score: 7, reasoning: 'Specific' },
      Constraints: { score: 6, reasoning: 'Some constraints' },
    },
    adjustedDimensions: [
      { dimension: 'Clarity' as const, rawScore: 8, reasoning: 'Clear', adjustmentPercent: 0, adjustedWeight: 0.2, weightedContribution: 1.6 },
      { dimension: 'Context' as const, rawScore: 7, reasoning: 'Good context', adjustmentPercent: 0, adjustedWeight: 0.2, weightedContribution: 1.4 },
      { dimension: 'Goal' as const, rawScore: 8, reasoning: 'Clear goal', adjustmentPercent: 0, adjustedWeight: 0.2, weightedContribution: 1.6 },
      { dimension: 'Specificity' as const, rawScore: 7, reasoning: 'Specific', adjustmentPercent: 0, adjustedWeight: 0.2, weightedContribution: 1.4 },
      { dimension: 'Constraints' as const, rawScore: 6, reasoning: 'Some constraints', adjustmentPercent: 0, adjustedWeight: 0.2, weightedContribution: 1.2 },
    ],
    configUsed: {
      promptType: 'initiating' as const,
      overallWeight: 1.0,
      skipScoring: false,
      dimensionAdjustments: {},
    },
  };
}

// ============================================================================
// Tests: runAnalysisPipeline - Basic Flow
// ============================================================================

describe('runAnalysisPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Flow', () => {
    it('should analyze a prompt successfully', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = createMockContext();
      const mockResult = createMockScoringResult(false);

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'initiating',
        confidence: 0.92,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(false);
      mockScore.mockResolvedValue(mockResult);

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(result.promptId).toBe('test-prompt-id');
      expect(result.promptType).toBe('initiating');
      expect(result.skipped).toBe(false);
      expect(result.scores).toBeDefined();
      expect(result.scores?.clarity).toBe(8);
      expect(result.scores?.context).toBe(7);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should skip scoring for selection prompts', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = createMockContext();

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'selection',
        confidence: 0.95,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(true);
      mockGetSkipReason.mockReturnValue('Selection prompts do not require scoring');
      mockStoreSkipped.mockResolvedValue({ analysisId: 'skip-123', isNew: true });

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('Selection prompts do not require scoring');
      expect(result.promptType).toBe('selection');
      expect(result.scores).toBeUndefined();
      expect(mockStoreSkipped).toHaveBeenCalled();
    });

    it('should skip scoring for confirmation prompts', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = createMockContext();

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'confirmation',
        confidence: 0.90,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(true);
      mockGetSkipReason.mockReturnValue('Confirmation prompts do not require scoring');
      mockStoreSkipped.mockResolvedValue({ analysisId: 'skip-456', isNew: true });

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(result.skipped).toBe(true);
      expect(result.promptType).toBe('confirmation');
    });

    it('should return early for already processed prompts', async () => {
      const mockSupabase = createMockSupabase({
        promptData: {
          id: 'test-prompt-id',
          text: 'Already processed',
          analyzed_text: null,
          session_uuid: 'test-session-id',
          analysis_status: 'complete',
          prompt_classification: 'initiating',
        },
      });

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('Already processed');
      expect(mockBuildContext).not.toHaveBeenCalled();
      expect(mockClassify).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Tests: Pipeline Options
  // ============================================================================

  describe('Pipeline Options', () => {
    it('should force scoring when forceScore is true', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = createMockContext();
      const mockResult = createMockScoringResult(false);

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'selection',
        confidence: 0.95,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(true);
      mockScore.mockResolvedValue(mockResult);

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id', {
        forceScore: true,
      });

      expect(result.skipped).toBe(false);
      expect(mockScore).toHaveBeenCalled();
    });

    it('should not store results in dry run mode', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = createMockContext();

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'selection',
        confidence: 0.95,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(true);
      mockGetSkipReason.mockReturnValue('Selection prompt');

      await runAnalysisPipeline(mockSupabase, 'test-prompt-id', {
        dryRun: true,
      });

      expect(mockStoreSkipped).not.toHaveBeenCalled();
    });

    it('should use custom analyze function when provided', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = createMockContext();
      const mockResult = createMockScoringResult(false);
      const customAnalyze = vi.fn();

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'initiating',
        confidence: 0.90,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(false);
      mockScore.mockResolvedValue(mockResult);

      await runAnalysisPipeline(mockSupabase, 'test-prompt-id', {
        analyzeFunction: customAnalyze,
      });

      expect(mockScore).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        customAnalyze
      );
    });
  });

  // ============================================================================
  // Tests: Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw error when prompt not found', async () => {
      const mockSupabase = createMockSupabase({
        promptData: null,
        promptError: { message: 'Not found' },
      });

      await expect(
        runAnalysisPipeline(mockSupabase, 'nonexistent-id')
      ).rejects.toThrow('Prompt not found');
    });

    it('should use fallback when context building fails', async () => {
      const mockSupabase = createMockSupabase();
      const mockResult = createMockScoringResult(false);

      mockBuildContext.mockRejectedValue(new Error('Context failed'));
      mockClassify.mockResolvedValue({
        promptType: 'initiating',
        confidence: 0.85,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(false);
      mockScore.mockResolvedValue(mockResult);

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(result.contextUsed.messageCount).toBe(0);
      expect(result.contextUsed.tokenCount).toBe(0);
    });

    it('should use fallback when classification fails', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = createMockContext();
      const mockResult = createMockScoringResult(false);

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockRejectedValue(new Error('Classification failed'));
      mockShouldSkip.mockReturnValue(false);
      mockScore.mockResolvedValue(mockResult);

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(result.promptType).toBe('continuation');
      expect(result.classificationMethod).toBe('fallback');
      expect(result.confidence).toBe(0.5);
    });

    it('should reset status on pipeline error', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'prompts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'test-prompt-id',
                    text: 'Test',
                    analyzed_text: null,
                    session_uuid: 'session-1',
                    analysis_status: 'pending',
                    prompt_classification: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return {};
      });

      const mockSupabase = { from: mockFrom, rpc: vi.fn() } as unknown as SupabaseClient;
      const mockContext = createMockContext();

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'initiating',
        confidence: 0.90,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(false);
      mockScore.mockRejectedValue(new Error('Scoring failed'));

      await expect(
        runAnalysisPipeline(mockSupabase, 'test-prompt-id')
      ).rejects.toThrow('Scoring failed');

      // Verify update was called multiple times (once for 'processing', once for error reset)
      const updateCalls = mockFrom.mock.calls.filter(
        (call: [string]) => call[0] === 'prompts'
      );
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Tests: Context Usage
  // ============================================================================

  describe('Context Usage', () => {
    it('should report context statistics in result', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = {
        sessionId: 'test-session-id',
        messageIndex: 5,
        messages: [
          { role: 'user' as const, content: 'Msg 1', timestamp: new Date() },
          { role: 'assistant' as const, content: 'Msg 2', timestamp: new Date() },
          { role: 'user' as const, content: 'Msg 3', timestamp: new Date() },
        ],
        lastResponse: undefined,
        tokenBudget: 10000,
        totalTokens: 1500,
        sessionMetadata: undefined,
      };
      const mockResult = createMockScoringResult(false);

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'continuation',
        confidence: 0.88,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(false);
      mockScore.mockResolvedValue(mockResult);

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(result.contextUsed.messageCount).toBe(3);
      expect(result.contextUsed.tokenCount).toBe(1500);
    });

    it('should use analyzed_text when available', async () => {
      const mockSupabase = createMockSupabase({
        promptData: {
          id: 'test-prompt-id',
          text: 'Original text with noise',
          analyzed_text: 'Clean analyzed text',
          session_uuid: 'test-session-id',
          analysis_status: 'pending',
          prompt_classification: null,
        },
      });
      const mockContext = createMockContext();
      const mockResult = createMockScoringResult(false);

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'initiating',
        confidence: 0.90,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(false);
      mockScore.mockResolvedValue(mockResult);

      await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(mockClassify).toHaveBeenCalledWith('Clean analyzed text', expect.any(Object));
    });
  });

  // ============================================================================
  // Tests: Classification Methods
  // ============================================================================

  describe('Classification Methods', () => {
    it('should report heuristic classification method', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = createMockContext();
      const mockResult = createMockScoringResult(false);

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'initiating',
        confidence: 0.95,
        method: 'heuristic',
      });
      mockShouldSkip.mockReturnValue(false);
      mockScore.mockResolvedValue(mockResult);

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(result.classificationMethod).toBe('heuristic');
    });

    it('should report llm classification method', async () => {
      const mockSupabase = createMockSupabase();
      const mockContext = createMockContext();
      const mockResult = createMockScoringResult(false);

      mockBuildContext.mockResolvedValue(mockContext);
      mockClassify.mockResolvedValue({
        promptType: 'continuation',
        confidence: 0.88,
        method: 'llm',
      });
      mockShouldSkip.mockReturnValue(false);
      mockScore.mockResolvedValue(mockResult);

      const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

      expect(result.classificationMethod).toBe('llm');
    });
  });
});

// ============================================================================
// Tests: runAnalysisPipelineBatch
// ============================================================================

describe('runAnalysisPipelineBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process multiple prompts', async () => {
    const mockSupabase = createMockSupabase();
    const mockContext = createMockContext();
    const mockResult = createMockScoringResult(false);

    mockBuildContext.mockResolvedValue(mockContext);
    mockClassify.mockResolvedValue({
      promptType: 'initiating',
      confidence: 0.90,
      method: 'heuristic',
    });
    mockShouldSkip.mockReturnValue(false);
    mockScore.mockResolvedValue(mockResult);

    const results = await runAnalysisPipelineBatch(
      mockSupabase,
      ['prompt-1', 'prompt-2', 'prompt-3']
    );

    expect(results).toHaveLength(3);
    expect(results.every((r) => !(r instanceof Error))).toBe(true);
  });

  it('should handle partial failures', async () => {
    const mockSupabase = createMockSupabase();
    const mockContext = createMockContext();
    const mockResult = createMockScoringResult(false);

    mockBuildContext
      .mockResolvedValueOnce(mockContext)
      .mockRejectedValueOnce(new Error('Context failed'))
      .mockResolvedValueOnce(mockContext);

    mockClassify.mockResolvedValue({
      promptType: 'initiating',
      confidence: 0.90,
      method: 'heuristic',
    });
    mockShouldSkip.mockReturnValue(false);
    mockScore
      .mockResolvedValueOnce(mockResult)
      .mockRejectedValueOnce(new Error('Scoring failed'))
      .mockResolvedValueOnce(mockResult);

    const results = await runAnalysisPipelineBatch(
      mockSupabase,
      ['prompt-1', 'prompt-2', 'prompt-3']
    );

    expect(results).toHaveLength(3);
    // First succeeds
    expect(results[0]).not.toBeInstanceOf(Error);
    // Second fails during scoring (context fails but fallback is used, then scoring fails)
    expect(results[1]).toBeInstanceOf(Error);
    // Third succeeds
    expect(results[2]).not.toBeInstanceOf(Error);
  });

  it('should handle empty input array', async () => {
    const mockSupabase = createMockSupabase();

    const results = await runAnalysisPipelineBatch(mockSupabase, []);

    expect(results).toHaveLength(0);
  });
});

// ============================================================================
// Tests: getPendingPrompts
// ============================================================================

describe('getPendingPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return pending prompt IDs', async () => {
    const mockSupabase = createMockSupabase({
      pendingPrompts: [
        { id: 'prompt-1' },
        { id: 'prompt-2' },
        { id: 'prompt-3' },
      ],
    });

    const result = await getPendingPrompts(mockSupabase);

    expect(result).toEqual(['prompt-1', 'prompt-2', 'prompt-3']);
  });

  it('should respect limit parameter', async () => {
    const mockOrder = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [{ id: 'prompt-1' }],
        error: null,
      }),
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await getPendingPrompts(mockSupabase, 50);

    expect(mockOrder().limit).toHaveBeenCalledWith(50);
  });

  it('should return empty array on error', async () => {
    const mockOrder = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await getPendingPrompts(mockSupabase);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// Tests: Score Extraction
// ============================================================================

describe('Score Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract all dimension scores correctly', async () => {
    const mockSupabase = createMockSupabase();
    const mockContext = createMockContext();
    const mockResult = createMockScoringResult(false);

    mockBuildContext.mockResolvedValue(mockContext);
    mockClassify.mockResolvedValue({
      promptType: 'initiating',
      confidence: 0.90,
      method: 'heuristic',
    });
    mockShouldSkip.mockReturnValue(false);
    mockScore.mockResolvedValue(mockResult);

    const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

    expect(result.scores).toBeDefined();
    expect(result.scores?.clarity).toBe(8);
    expect(result.scores?.context).toBe(7);
    expect(result.scores?.goal).toBe(8);
    expect(result.scores?.specificity).toBe(7);
    expect(result.scores?.constraints).toBe(6);
    expect(result.scores?.overall).toBe(7.5);
    expect(result.scores?.weightedOverall).toBe(7.5);
  });

  it('should handle missing dimensions with defaults', async () => {
    const mockSupabase = createMockSupabase();
    const mockContext = createMockContext();
    const mockResult = {
      skipped: false as const,
      promptType: 'initiating' as const,
      confidence: 0.90,
      overallWeight: 1.0,
      rawOverallScore: 5.0,
      weightedOverallScore: 5.0,
      rawDimensionScores: {},
      adjustedDimensions: [
        { dimension: 'Clarity' as const, rawScore: 5, reasoning: 'Ok', adjustmentPercent: 0, adjustedWeight: 0.5, weightedContribution: 2.5 },
      ],
      configUsed: {
        promptType: 'initiating' as const,
        overallWeight: 1.0,
        skipScoring: false,
        dimensionAdjustments: {},
      },
    };

    mockBuildContext.mockResolvedValue(mockContext);
    mockClassify.mockResolvedValue({
      promptType: 'initiating',
      confidence: 0.90,
      method: 'heuristic',
    });
    mockShouldSkip.mockReturnValue(false);
    mockScore.mockResolvedValue(mockResult);

    const result = await runAnalysisPipeline(mockSupabase, 'test-prompt-id');

    expect(result.scores?.clarity).toBe(5);
    expect(result.scores?.context).toBe(0);
    expect(result.scores?.goal).toBe(0);
  });
});
