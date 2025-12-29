/**
 * Prompt Classification Service Tests
 * Story 27-1: Prompt Classification Service
 *
 * Tests for the main classification orchestrator that:
 * 1. Uses heuristics first (fast path)
 * 2. Falls back to LLM when confidence is low
 * 3. Returns proper scoring weights
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyPrompt,
  getScoringWeight,
  shouldSkipScoring,
  SCORING_WEIGHTS,
  HEURISTIC_CONFIDENCE_THRESHOLD,
} from '../promptClassifier';
import * as classificationPatterns from '../classificationPatterns';
import * as llmClassifier from '../llmClassifier';
import type { ConversationContext, ConversationClassificationResult } from '@/lib/types/conversation-classification';
import type { ClassificationResult, PromptType } from '@/lib/types/classification';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../classificationPatterns', () => ({
  classifyByHeuristics: vi.fn(),
}));

vi.mock('../llmClassifier', () => ({
  classifyByLLM: vi.fn(),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    messageIndex: 1,
    ...overrides,
  };
}

function createHeuristicResult(
  promptType: PromptType,
  confidence: number
): ConversationClassificationResult {
  return {
    promptType,
    confidence,
    method: 'heuristic',
    matchedPattern: `test:${promptType}`,
  };
}

// ============================================================================
// Tests: Result Structure (AC #1)
// ============================================================================

describe('classifyPrompt - Result Structure (AC #1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all required fields in ClassificationResult', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('confirmation', 0.95)
    );

    const result = await classifyPrompt('yes', createContext());

    expect(result).toHaveProperty('promptType');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('scoringWeight');
    expect(result).toHaveProperty('method');
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.scoringWeight).toBe('number');
    expect(['heuristic', 'llm']).toContain(result.method);
  });

  it('should return confidence between 0 and 1', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.6)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockResolvedValue({
      promptType: 'initiating',
      confidence: 0.85,
      reasoning: 'test',
    });

    const result = await classifyPrompt('test prompt', createContext());

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should return valid prompt type', async () => {
    const validTypes = [
      'initiating',
      'continuation',
      'selection',
      'correction',
      'confirmation',
      'clarification',
    ];

    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('selection', 0.95)
    );

    const result = await classifyPrompt('Option 2', createContext());

    expect(validTypes).toContain(result.promptType);
  });
});

// ============================================================================
// Tests: Heuristic-First Strategy (AC #2)
// ============================================================================

describe('classifyPrompt - Heuristic-First Strategy (AC #2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use heuristic result when confidence > threshold', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('confirmation', 0.95)
    );

    const result = await classifyPrompt('yes', createContext());

    expect(result.promptType).toBe('confirmation');
    expect(result.method).toBe('heuristic');
    expect(llmClassifier.classifyByLLM).not.toHaveBeenCalled();
  });

  it('should NOT call LLM when heuristic confidence > 0.9', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('selection', 0.95)
    );

    await classifyPrompt('Option 1', createContext());

    expect(llmClassifier.classifyByLLM).not.toHaveBeenCalled();
  });

  it('should pass prompt and context to heuristic classifier', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('confirmation', 0.95)
    );

    const context = createContext({ messageIndex: 5 });
    await classifyPrompt('test prompt', context);

    expect(classificationPatterns.classifyByHeuristics).toHaveBeenCalledWith('test prompt', context);
  });

  it('should use heuristic for first message (initiating)', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('initiating', 0.95)
    );

    const result = await classifyPrompt('Help me build an API', createContext({ messageIndex: 0 }));

    expect(result.promptType).toBe('initiating');
    expect(result.method).toBe('heuristic');
  });
});

// ============================================================================
// Tests: LLM Fallback (AC #3)
// ============================================================================

describe('classifyPrompt - LLM Fallback (AC #3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call LLM when heuristic confidence <= threshold', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.6)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockResolvedValue({
      promptType: 'initiating',
      confidence: 0.85,
      reasoning: 'This starts a new task',
    });

    const result = await classifyPrompt('now add error handling', createContext());

    expect(llmClassifier.classifyByLLM).toHaveBeenCalled();
    expect(result.promptType).toBe('initiating');
    expect(result.method).toBe('llm');
  });

  it('should pass prompt and context to LLM classifier', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.5)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockResolvedValue({
      promptType: 'correction',
      confidence: 0.8,
      reasoning: 'test',
    });

    const context = createContext({
      messageIndex: 3,
      lastResponseOptions: ['option 1', 'option 2'],
    });
    await classifyPrompt('not quite right', context);

    expect(llmClassifier.classifyByLLM).toHaveBeenCalledWith('not quite right', context);
  });

  it('should include LLM reasoning in result when available', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.5)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockResolvedValue({
      promptType: 'clarification',
      confidence: 0.9,
      reasoning: 'User is asking for explanation',
    });

    const result = await classifyPrompt('why does this work?', createContext());

    expect(result.reasoning).toBe('User is asking for explanation');
  });

  it('should fall back to heuristic result if LLM fails', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.6)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockRejectedValue(new Error('API error'));

    const result = await classifyPrompt('some prompt', createContext());

    expect(result.promptType).toBe('continuation');
    expect(result.method).toBe('heuristic');
  });

  it('should use lower confidence when falling back from LLM error', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.6)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockRejectedValue(new Error('Timeout'));

    const result = await classifyPrompt('some prompt', createContext());

    // Confidence should be reduced to indicate lower certainty
    expect(result.confidence).toBeLessThanOrEqual(0.6);
  });
});

// ============================================================================
// Tests: Scoring Weight (AC #5)
// ============================================================================

describe('classifyPrompt - Scoring Weights (AC #5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return scoringWeight: 1.0 for initiating', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('initiating', 0.95)
    );

    const result = await classifyPrompt('Build an API', createContext({ messageIndex: 0 }));

    expect(result.scoringWeight).toBe(1.0);
  });

  it('should return scoringWeight: 0.7 for continuation', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.95)
    );

    const result = await classifyPrompt('add error handling', createContext());

    expect(result.scoringWeight).toBe(0.7);
  });

  it('should return scoringWeight: 0 for selection', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('selection', 0.95)
    );

    const result = await classifyPrompt('Option 2', createContext());

    expect(result.scoringWeight).toBe(0);
  });

  it('should return scoringWeight: 0.8 for correction', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('correction', 0.85)
    );

    const result = await classifyPrompt('no, use the other one', createContext());

    expect(result.scoringWeight).toBe(0.8);
  });

  it('should return scoringWeight: 0 for confirmation', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('confirmation', 0.9)
    );

    const result = await classifyPrompt('yes', createContext());

    expect(result.scoringWeight).toBe(0);
  });

  it('should return scoringWeight: 0.6 for clarification', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('clarification', 0.8)
    );

    const result = await classifyPrompt('why did you do that?', createContext());

    expect(result.scoringWeight).toBe(0.6);
  });
});

// ============================================================================
// Tests: getScoringWeight Helper
// ============================================================================

describe('getScoringWeight', () => {
  it('should return correct weight for each prompt type', () => {
    expect(getScoringWeight('initiating')).toBe(1.0);
    expect(getScoringWeight('continuation')).toBe(0.7);
    expect(getScoringWeight('selection')).toBe(0);
    expect(getScoringWeight('correction')).toBe(0.8);
    expect(getScoringWeight('confirmation')).toBe(0);
    expect(getScoringWeight('clarification')).toBe(0.6);
  });
});

// ============================================================================
// Tests: shouldSkipScoring Helper
// ============================================================================

describe('shouldSkipScoring', () => {
  it('should return true for selection', () => {
    expect(shouldSkipScoring('selection')).toBe(true);
  });

  it('should return true for confirmation', () => {
    expect(shouldSkipScoring('confirmation')).toBe(true);
  });

  it('should return false for initiating', () => {
    expect(shouldSkipScoring('initiating')).toBe(false);
  });

  it('should return false for continuation', () => {
    expect(shouldSkipScoring('continuation')).toBe(false);
  });

  it('should return false for correction', () => {
    expect(shouldSkipScoring('correction')).toBe(false);
  });

  it('should return false for clarification', () => {
    expect(shouldSkipScoring('clarification')).toBe(false);
  });
});

// ============================================================================
// Tests: Constants
// ============================================================================

describe('Constants', () => {
  it('should have HEURISTIC_CONFIDENCE_THRESHOLD of 0.9', () => {
    expect(HEURISTIC_CONFIDENCE_THRESHOLD).toBe(0.9);
  });

  it('should have all prompt types in SCORING_WEIGHTS', () => {
    const expectedTypes = [
      'initiating',
      'continuation',
      'selection',
      'correction',
      'confirmation',
      'clarification',
    ];

    for (const type of expectedTypes) {
      expect(SCORING_WEIGHTS).toHaveProperty(type);
    }
  });

  it('should have SCORING_WEIGHTS matching story spec', () => {
    expect(SCORING_WEIGHTS.initiating).toBe(1.0);
    expect(SCORING_WEIGHTS.continuation).toBe(0.7);
    expect(SCORING_WEIGHTS.selection).toBe(0);
    expect(SCORING_WEIGHTS.correction).toBe(0.8);
    expect(SCORING_WEIGHTS.confirmation).toBe(0);
    expect(SCORING_WEIGHTS.clarification).toBe(0.6);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty prompt', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.6)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockResolvedValue({
      promptType: 'continuation',
      confidence: 0.7,
      reasoning: 'Empty prompt',
    });

    const result = await classifyPrompt('', createContext());

    expect(result).toBeDefined();
    expect(result.promptType).toBeDefined();
  });

  it('should handle very long prompt', async () => {
    const longPrompt = 'a'.repeat(10000);
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.5)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockResolvedValue({
      promptType: 'continuation',
      confidence: 0.8,
      reasoning: 'Long continuation',
    });

    const result = await classifyPrompt(longPrompt, createContext());

    expect(result).toBeDefined();
  });

  it('should handle context with all fields', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('selection', 0.95)
    );

    const context: ConversationContext = {
      messageIndex: 5,
      lastResponseOptions: ['A', 'B', 'C'],
      lastResponseText: 'Choose an option',
      sessionId: 'session-123',
    };

    const result = await classifyPrompt('B', context);

    expect(result.promptType).toBe('selection');
  });

  it('should handle confidence exactly at threshold', async () => {
    // Confidence at exactly 0.9 should use LLM (threshold check is > 0.9, not >=)
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('correction', 0.9)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockResolvedValue({
      promptType: 'correction',
      confidence: 0.85,
      reasoning: 'test',
    });

    await classifyPrompt('test', createContext());

    // At exactly 0.9, should fall back to LLM (threshold is > 0.9, so 0.9 triggers LLM)
    expect(llmClassifier.classifyByLLM).toHaveBeenCalled();
  });

  it('should handle confidence just below threshold', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('correction', 0.89)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockResolvedValue({
      promptType: 'correction',
      confidence: 0.85,
      reasoning: 'test',
    });

    await classifyPrompt('test', createContext());

    expect(llmClassifier.classifyByLLM).toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: Logging
// ============================================================================

describe('Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should log heuristic classification with [ANALYSIS] prefix', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('confirmation', 0.95)
    );

    await classifyPrompt('yes', createContext());

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[ANALYSIS\].*confirmation.*0\.95/)
    );
  });

  it('should log LLM fallback with [ANALYSIS] prefix', async () => {
    vi.mocked(classificationPatterns.classifyByHeuristics).mockReturnValue(
      createHeuristicResult('continuation', 0.5)
    );
    vi.mocked(llmClassifier.classifyByLLM).mockResolvedValue({
      promptType: 'initiating',
      confidence: 0.85,
      reasoning: 'test',
    });

    await classifyPrompt('test prompt', createContext());

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[ANALYSIS\].*low.*LLM/)
    );
  });
});
