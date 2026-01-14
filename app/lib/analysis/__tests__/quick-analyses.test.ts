/**
 * Quick Analyses Tests
 * Story 30-8: Quick Analysis Buttons
 *
 * Tests for quick analysis definitions and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  QUICK_ANALYSES,
  getAnalysisDescription,
  getQuickAnalysisById,
  type QuickAnalysis,
  type QuickAnalysisContentSettings,
  type QuestionType,
  type RecommendedModel,
} from '../quick-analyses';

// ============================================================================
// QUICK_ANALYSES Array Tests
// ============================================================================

describe('QUICK_ANALYSES', () => {
  describe('array structure', () => {
    it('should have exactly 4 quick analysis presets', () => {
      expect(QUICK_ANALYSES).toHaveLength(4);
    });

    it('should have unique IDs', () => {
      const ids = QUICK_ANALYSES.map((qa) => qa.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique labels', () => {
      const labels = QUICK_ANALYSES.map((qa) => qa.label);
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });
  });

  describe('required fields', () => {
    it.each(QUICK_ANALYSES)('$id should have all required fields', (analysis) => {
      expect(analysis).toHaveProperty('id');
      expect(analysis).toHaveProperty('label');
      expect(analysis).toHaveProperty('icon');
      expect(analysis).toHaveProperty('prompt');
      expect(analysis).toHaveProperty('questionType');
      expect(analysis).toHaveProperty('contentSettings');
      expect(analysis).toHaveProperty('recommendedModel');
    });

    it.each(QUICK_ANALYSES)('$id should have non-empty id', (analysis) => {
      expect(typeof analysis.id).toBe('string');
      expect(analysis.id.length).toBeGreaterThan(0);
    });

    it.each(QUICK_ANALYSES)('$id should have non-empty label', (analysis) => {
      expect(typeof analysis.label).toBe('string');
      expect(analysis.label.length).toBeGreaterThan(0);
    });

    it.each(QUICK_ANALYSES)('$id should have a valid icon component', (analysis) => {
      expect(analysis.icon).toBeDefined();
      // Lucide icons can be either functions (React components) or ForwardRef objects
      expect(['function', 'object']).toContain(typeof analysis.icon);
    });

    it.each(QUICK_ANALYSES)('$id should have non-empty prompt', (analysis) => {
      expect(typeof analysis.prompt).toBe('string');
      expect(analysis.prompt.length).toBeGreaterThan(10);
    });
  });

  describe('question types', () => {
    const validQuestionTypes: QuestionType[] = [
      'summarize',
      'find_issues',
      'suggestions',
      'deep_dive',
    ];

    it.each(QUICK_ANALYSES)('$id should have valid questionType', (analysis) => {
      expect(validQuestionTypes).toContain(analysis.questionType);
    });

    it('should have all question types represented', () => {
      const questionTypes = QUICK_ANALYSES.map((qa) => qa.questionType);
      for (const type of validQuestionTypes) {
        expect(questionTypes).toContain(type);
      }
    });
  });

  describe('recommended models', () => {
    const validModels: RecommendedModel[] = ['haiku', 'sonnet', 'opus'];

    it.each(QUICK_ANALYSES)('$id should have valid recommendedModel', (analysis) => {
      expect(validModels).toContain(analysis.recommendedModel);
    });
  });

  describe('content settings', () => {
    it.each(QUICK_ANALYSES)(
      '$id should have valid contentSettings structure',
      (analysis) => {
        const settings = analysis.contentSettings;
        expect(settings).toHaveProperty('includePrompts');
        expect(settings).toHaveProperty('includeResponses');
        expect(settings).toHaveProperty('includeThinking');
        expect(settings).toHaveProperty('includeTools');
      }
    );

    it.each(QUICK_ANALYSES)(
      '$id contentSettings should have boolean values',
      (analysis) => {
        const settings = analysis.contentSettings;
        expect(typeof settings.includePrompts).toBe('boolean');
        expect(typeof settings.includeResponses).toBe('boolean');
        expect(typeof settings.includeThinking).toBe('boolean');
        expect(typeof settings.includeTools).toBe('boolean');
      }
    );

    it('all analyses should include prompts (essential for analysis)', () => {
      for (const analysis of QUICK_ANALYSES) {
        expect(analysis.contentSettings.includePrompts).toBe(true);
      }
    });

    it('all analyses should include responses (essential for analysis)', () => {
      for (const analysis of QUICK_ANALYSES) {
        expect(analysis.contentSettings.includeResponses).toBe(true);
      }
    });
  });

  describe('warning field', () => {
    it('warning should be optional', () => {
      const withWarning = QUICK_ANALYSES.filter((qa) => qa.warning !== undefined);
      const withoutWarning = QUICK_ANALYSES.filter((qa) => qa.warning === undefined);

      expect(withWarning.length + withoutWarning.length).toBe(QUICK_ANALYSES.length);
    });

    it('deep_dive should have a warning about thinking blocks', () => {
      const deepDive = QUICK_ANALYSES.find((qa) => qa.id === 'deep_dive');
      expect(deepDive?.warning).toBeDefined();
      expect(deepDive?.warning?.toLowerCase()).toContain('thinking');
    });

    it('warning should be a string when present', () => {
      for (const analysis of QUICK_ANALYSES) {
        if (analysis.warning !== undefined) {
          expect(typeof analysis.warning).toBe('string');
          expect(analysis.warning.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

// ============================================================================
// Specific Analysis Tests
// ============================================================================

describe('individual quick analyses', () => {
  describe('summarize', () => {
    const summarize = QUICK_ANALYSES.find((qa) => qa.id === 'summarize');

    it('should exist', () => {
      expect(summarize).toBeDefined();
    });

    it('should use haiku model (fast and cheap)', () => {
      expect(summarize?.recommendedModel).toBe('haiku');
    });

    it('should not include thinking or tools (minimal tokens)', () => {
      expect(summarize?.contentSettings.includeThinking).toBe(false);
      expect(summarize?.contentSettings.includeTools).toBe(false);
    });

    it('should have summarize question type', () => {
      expect(summarize?.questionType).toBe('summarize');
    });
  });

  describe('find_issues', () => {
    const findIssues = QUICK_ANALYSES.find((qa) => qa.id === 'find_issues');

    it('should exist', () => {
      expect(findIssues).toBeDefined();
    });

    it('should use sonnet model (good balance)', () => {
      expect(findIssues?.recommendedModel).toBe('sonnet');
    });

    it('should include tools (important for issue detection)', () => {
      expect(findIssues?.contentSettings.includeTools).toBe(true);
    });

    it('should have find_issues question type', () => {
      expect(findIssues?.questionType).toBe('find_issues');
    });
  });

  describe('suggestions', () => {
    const suggestions = QUICK_ANALYSES.find((qa) => qa.id === 'suggestions');

    it('should exist', () => {
      expect(suggestions).toBeDefined();
    });

    it('should use sonnet model', () => {
      expect(suggestions?.recommendedModel).toBe('sonnet');
    });

    it('should not include thinking (focus on outcome)', () => {
      expect(suggestions?.contentSettings.includeThinking).toBe(false);
    });

    it('should have suggestions question type', () => {
      expect(suggestions?.questionType).toBe('suggestions');
    });
  });

  describe('deep_dive', () => {
    const deepDive = QUICK_ANALYSES.find((qa) => qa.id === 'deep_dive');

    it('should exist', () => {
      expect(deepDive).toBeDefined();
    });

    it('should use opus model (best quality)', () => {
      expect(deepDive?.recommendedModel).toBe('opus');
    });

    it('should include all content types', () => {
      expect(deepDive?.contentSettings.includePrompts).toBe(true);
      expect(deepDive?.contentSettings.includeResponses).toBe(true);
      expect(deepDive?.contentSettings.includeThinking).toBe(true);
      expect(deepDive?.contentSettings.includeTools).toBe(true);
    });

    it('should have deep_dive question type', () => {
      expect(deepDive?.questionType).toBe('deep_dive');
    });

    it('should have a warning', () => {
      expect(deepDive?.warning).toBeDefined();
    });
  });
});

// ============================================================================
// getAnalysisDescription Tests
// ============================================================================

describe('getAnalysisDescription', () => {
  describe('valid IDs', () => {
    it('should return description for summarize', () => {
      const desc = getAnalysisDescription('summarize');
      expect(desc).toBe('Get a quick 2-3 sentence summary of what happened.');
    });

    it('should return description for find_issues', () => {
      const desc = getAnalysisDescription('find_issues');
      expect(desc).toBe(
        'Identify context-engineering mistakes and areas for improvement.'
      );
    });

    it('should return description for suggestions', () => {
      const desc = getAnalysisDescription('suggestions');
      expect(desc).toBe('Get actionable tips for improving your prompting skills.');
    });

    it('should return description for deep_dive', () => {
      const desc = getAnalysisDescription('deep_dive');
      expect(desc).toBe(
        'Full analysis including AI reasoning - best for complex conversations.'
      );
    });
  });

  describe('invalid IDs', () => {
    it('should return empty string for unknown ID', () => {
      expect(getAnalysisDescription('unknown')).toBe('');
    });

    it('should return empty string for empty ID', () => {
      expect(getAnalysisDescription('')).toBe('');
    });

    it('should return empty string for null-like values', () => {
      expect(getAnalysisDescription(null as unknown as string)).toBe('');
      expect(getAnalysisDescription(undefined as unknown as string)).toBe('');
    });
  });

  describe('description quality', () => {
    it.each(QUICK_ANALYSES)(
      'description for $id should be non-empty',
      (analysis) => {
        const desc = getAnalysisDescription(analysis.id);
        expect(desc.length).toBeGreaterThan(0);
      }
    );

    it.each(QUICK_ANALYSES)(
      'description for $id should end with period',
      (analysis) => {
        const desc = getAnalysisDescription(analysis.id);
        expect(desc.endsWith('.')).toBe(true);
      }
    );
  });
});

// ============================================================================
// getQuickAnalysisById Tests
// ============================================================================

describe('getQuickAnalysisById', () => {
  describe('valid IDs', () => {
    it.each(QUICK_ANALYSES)('should find $id by ID', (analysis) => {
      const found = getQuickAnalysisById(analysis.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(analysis.id);
    });

    it('should return the exact object from QUICK_ANALYSES', () => {
      const summarize = getQuickAnalysisById('summarize');
      const fromArray = QUICK_ANALYSES.find((qa) => qa.id === 'summarize');
      expect(summarize).toBe(fromArray);
    });
  });

  describe('invalid IDs', () => {
    it('should return undefined for unknown ID', () => {
      expect(getQuickAnalysisById('unknown')).toBeUndefined();
    });

    it('should return undefined for empty ID', () => {
      expect(getQuickAnalysisById('')).toBeUndefined();
    });

    it('should return undefined for null-like values', () => {
      expect(getQuickAnalysisById(null as unknown as string)).toBeUndefined();
      expect(getQuickAnalysisById(undefined as unknown as string)).toBeUndefined();
    });
  });
});

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('type safety', () => {
  it('should accept valid QuickAnalysis type', () => {
    const analysis: QuickAnalysis = QUICK_ANALYSES[0];
    expect(analysis.id).toBeDefined();
  });

  it('should accept valid QuickAnalysisContentSettings type', () => {
    const settings: QuickAnalysisContentSettings = {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    };
    expect(settings.includePrompts).toBe(true);
  });

  it('should accept valid QuestionType values', () => {
    const types: QuestionType[] = ['summarize', 'find_issues', 'suggestions', 'deep_dive'];
    expect(types).toHaveLength(4);
  });

  it('should accept valid RecommendedModel values', () => {
    const models: RecommendedModel[] = ['haiku', 'sonnet', 'opus'];
    expect(models).toHaveLength(3);
  });
});

// ============================================================================
// Immutability Tests
// ============================================================================

describe('immutability', () => {
  it('QUICK_ANALYSES should be an array', () => {
    expect(Array.isArray(QUICK_ANALYSES)).toBe(true);
  });

  it('getQuickAnalysisById should return the same reference', () => {
    const first = getQuickAnalysisById('summarize');
    const second = getQuickAnalysisById('summarize');
    expect(first).toBe(second);
  });
});
