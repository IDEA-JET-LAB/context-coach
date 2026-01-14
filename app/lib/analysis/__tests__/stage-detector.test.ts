/**
 * Stage Detector Tests - Story 31-1
 */

import { describe, it, expect } from 'vitest';
import {
  detectConversationStages,
  detectStageFromPrompt,
  detectSinglePromptStage,
  countStageTransitions,
  getUniqueStages,
  calculateStageDistribution,
  findPrimaryStage,
  getAverageConfidence,
  type ConversationPromptInput,
  type StageDetectionResult,
} from '../stage-detector';
import type { ProjectStage } from '@/lib/types/conversations';

describe('stage-detector', () => {
  // Helper to create test prompts
  function createPrompt(
    id: string,
    text: string,
    sequenceNumber: number
  ): ConversationPromptInput {
    return {
      id,
      text,
      sequenceNumber,
      timestamp: new Date().toISOString(),
    };
  }

  describe('detectConversationStages', () => {
    it('should return empty array for empty input', () => {
      expect(detectConversationStages([])).toEqual([]);
    });

    it('should handle null/undefined input', () => {
      expect(detectConversationStages(null as any)).toEqual([]);
      expect(detectConversationStages(undefined as any)).toEqual([]);
    });

    it('should detect development stage from implementation prompts', () => {
      const prompts = [
        createPrompt('1', 'implement the authentication feature', 1),
      ];

      const results = detectConversationStages(prompts);

      expect(results).toHaveLength(1);
      expect(results[0].detectedStage).toBe('development');
      expect(results[0].confidence).toBeGreaterThan(0.7);
    });

    it('should detect debugging stage from error prompts', () => {
      const prompts = [createPrompt('1', 'fix this bug, it keeps crashing', 1)];

      const results = detectConversationStages(prompts);

      expect(results).toHaveLength(1);
      expect(results[0].detectedStage).toBe('debugging');
    });

    it('should detect testing stage from test-related prompts', () => {
      const prompts = [createPrompt('1', 'add unit tests for the auth module', 1)];

      const results = detectConversationStages(prompts);

      expect(results).toHaveLength(1);
      expect(results[0].detectedStage).toBe('testing');
    });

    it('should propagate stage through confirmation prompts', () => {
      const prompts = [
        createPrompt('1', 'implement the login feature', 1),
        createPrompt('2', 'yes', 2),
        createPrompt('3', 'ok', 3),
        createPrompt('4', 'sounds good', 4),
      ];

      const results = detectConversationStages(prompts);

      expect(results).toHaveLength(4);
      // All should be development since confirmations inherit
      expect(results[0].detectedStage).toBe('development');
      expect(results[1].detectedStage).toBe('development');
      expect(results[2].detectedStage).toBe('development');
      expect(results[3].detectedStage).toBe('development');

      // First prompt is NOT a transition since default stage is already development
      // A transition only occurs when the stage CHANGES
      expect(results[0].isTransitionPoint).toBe(false);
      expect(results[1].isTransitionPoint).toBe(false);
      expect(results[2].isTransitionPoint).toBe(false);
      expect(results[3].isTransitionPoint).toBe(false);
    });

    it('should detect stage transitions within conversation', () => {
      const prompts = [
        createPrompt('1', 'implement the auth feature', 1),
        createPrompt('2', 'yes, proceed', 2),
        createPrompt('3', 'fix this error', 3),
        createPrompt('4', 'ok, thanks', 4),
        createPrompt('5', 'add unit tests for auth', 5),
      ];

      const results = detectConversationStages(prompts);

      expect(results).toHaveLength(5);

      // Development → Debugging → Testing
      expect(results[0].detectedStage).toBe('development');
      // First prompt is NOT a transition if it matches the default stage
      expect(results[0].isTransitionPoint).toBe(false);

      expect(results[1].detectedStage).toBe('development'); // inherited
      expect(results[1].isTransitionPoint).toBe(false);

      expect(results[2].detectedStage).toBe('debugging');
      expect(results[2].isTransitionPoint).toBe(true); // THIS is a transition

      expect(results[3].detectedStage).toBe('debugging'); // inherited
      expect(results[3].isTransitionPoint).toBe(false);

      expect(results[4].detectedStage).toBe('testing');
      expect(results[4].isTransitionPoint).toBe(true); // THIS is a transition
    });

    it('should handle slash commands', () => {
      const prompts = [
        createPrompt('1', '/commit', 1),
        createPrompt('2', '/test', 2),
        createPrompt('3', '/deploy', 3),
      ];

      const results = detectConversationStages(prompts);

      expect(results[0].detectedStage).toBe('development');
      expect(results[1].detectedStage).toBe('testing');
      expect(results[2].detectedStage).toBe('deployment');
    });

    it('should respect sequence order', () => {
      // Out of order input
      const prompts = [
        createPrompt('3', 'add unit tests for the module', 3),
        createPrompt('1', 'implement the login feature', 1),
        createPrompt('2', 'yes', 2),
      ];

      const results = detectConversationStages(prompts);

      // Should be sorted by sequence
      expect(results[0].promptId).toBe('1');
      expect(results[1].promptId).toBe('2');
      expect(results[2].promptId).toBe('3');

      expect(results[0].detectedStage).toBe('development');
      expect(results[1].detectedStage).toBe('development'); // inherited
      expect(results[2].detectedStage).toBe('testing');
    });

    it('should use default stage when no signals found', () => {
      const prompts = [createPrompt('1', 'hi', 1)];

      const results = detectConversationStages(prompts, {
        defaultStage: 'exploration',
      });

      expect(results[0].detectedStage).toBe('exploration');
    });

    it('should decay confidence for inherited stages', () => {
      const prompts = [
        createPrompt('1', 'implement feature', 1),
        createPrompt('2', 'yes', 2),
        createPrompt('3', 'ok', 3),
        createPrompt('4', 'sure', 4),
      ];

      const results = detectConversationStages(prompts);

      // Each inherited stage should have slightly lower confidence
      expect(results[0].confidence).toBeGreaterThan(results[1].confidence);
      expect(results[1].confidence).toBeGreaterThanOrEqual(results[2].confidence);
      expect(results[2].confidence).toBeGreaterThanOrEqual(results[3].confidence);
    });

    it('should handle long conversations (50+ prompts)', () => {
      const prompts: ConversationPromptInput[] = [];
      for (let i = 1; i <= 60; i++) {
        const text =
          i % 10 === 1
            ? 'implement something'
            : i % 10 === 5
            ? 'fix this bug'
            : 'yes';
        prompts.push(createPrompt(String(i), text, i));
      }

      const startTime = performance.now();
      const results = detectConversationStages(prompts);
      const endTime = performance.now();

      expect(results).toHaveLength(60);
      expect(endTime - startTime).toBeLessThan(100); // <100ms
    });

    it('should correctly classify a development → debugging → testing flow', () => {
      const prompts = [
        createPrompt('1', "let's implement the user registration feature", 1),
        createPrompt('2', 'create a new component for the form', 2),
        createPrompt('3', 'yes, with email and password fields', 3),
        createPrompt('4', "there's an error when I submit", 4),
        createPrompt('5', 'the validation is not working', 5),
        createPrompt('6', 'why does it keep failing?', 6),
        createPrompt('7', 'ok that fixed it', 7),
        createPrompt('8', 'now add unit tests for the registration', 8),
        createPrompt('9', 'yes, test the happy path', 9),
        createPrompt('10', 'and also error cases', 10),
      ];

      const results = detectConversationStages(prompts);

      // Should see development → debugging → testing
      const stages = results.map((r) => r.detectedStage);
      expect(stages.slice(0, 3)).toContain('development');
      expect(stages.slice(3, 7)).toContain('debugging');
      expect(stages.slice(7, 10)).toContain('testing');
    });
  });

  describe('detectStageFromPrompt', () => {
    it('should return null for confirmation prompts', () => {
      expect(detectStageFromPrompt('yes')).toBeNull();
      expect(detectStageFromPrompt('ok')).toBeNull();
      expect(detectStageFromPrompt('sure')).toBeNull();
      expect(detectStageFromPrompt('1')).toBeNull();
    });

    it('should return null for very short prompts', () => {
      expect(detectStageFromPrompt('hi')).toBeNull();
      expect(detectStageFromPrompt('...')).toBeNull();
    });

    it('should detect debugging from error descriptions', () => {
      const result = detectStageFromPrompt('I got an error when running this');
      expect(result?.stage).toBe('debugging');
    });

    it('should detect testing from test keywords', () => {
      const result = detectStageFromPrompt('write unit tests for this');
      expect(result?.stage).toBe('testing');
    });

    it('should detect planning from planning keywords', () => {
      const result = detectStageFromPrompt("let's plan how to implement this");
      expect(result?.stage).toBe('planning');
    });

    it('should detect deployment from deploy keywords', () => {
      const result = detectStageFromPrompt('deploy this to production');
      expect(result?.stage).toBe('deployment');
    });

    it('should detect refactoring from refactor keywords', () => {
      const result = detectStageFromPrompt('refactor this function');
      expect(result?.stage).toBe('refactoring');
    });

    it('should handle case-insensitive matching', () => {
      expect(detectStageFromPrompt('FIX THIS BUG')?.stage).toBe('debugging');
      expect(detectStageFromPrompt('ADD UNIT TESTS')?.stage).toBe('testing');
      expect(detectStageFromPrompt('DEPLOY TO PRODUCTION')?.stage).toBe('deployment');
    });

    it('should respect pattern priority', () => {
      // "fix test error" has both debugging and testing signals
      // debugging has higher priority
      const result = detectStageFromPrompt('fix the test error');
      expect(result?.stage).toBe('debugging');
    });

    it('should detect slash commands with high confidence', () => {
      const result = detectStageFromPrompt('/commit');
      expect(result?.stage).toBe('development');
      expect(result?.confidence).toBeGreaterThan(0.9);
    });

    it('should include matched pattern in result', () => {
      const result = detectStageFromPrompt('fix this bug');
      expect(result?.matchedPattern).toBeDefined();
      expect(result?.matchedPattern.length).toBeGreaterThan(0);
    });
  });

  describe('detectSinglePromptStage', () => {
    it('should return detected stage', () => {
      expect(detectSinglePromptStage('fix this bug')).toBe('debugging');
      expect(detectSinglePromptStage('write unit tests')).toBe('testing');
    });

    it('should return default stage when no detection', () => {
      expect(detectSinglePromptStage('yes', 'exploration')).toBe('exploration');
    });

    it('should use development as default', () => {
      expect(detectSinglePromptStage('ok')).toBe('development');
    });
  });

  describe('countStageTransitions', () => {
    it('should count transitions correctly', () => {
      const results: StageDetectionResult[] = [
        { promptId: '1', detectedStage: 'development', confidence: 0.8, isTransitionPoint: true },
        { promptId: '2', detectedStage: 'development', confidence: 0.7, isTransitionPoint: false },
        { promptId: '3', detectedStage: 'debugging', confidence: 0.8, isTransitionPoint: true },
        { promptId: '4', detectedStage: 'debugging', confidence: 0.7, isTransitionPoint: false },
        { promptId: '5', detectedStage: 'testing', confidence: 0.85, isTransitionPoint: true },
      ];

      expect(countStageTransitions(results)).toBe(3);
    });

    it('should return 0 for empty array', () => {
      expect(countStageTransitions([])).toBe(0);
    });
  });

  describe('getUniqueStages', () => {
    it('should return unique stages', () => {
      const results: StageDetectionResult[] = [
        { promptId: '1', detectedStage: 'development', confidence: 0.8, isTransitionPoint: true },
        { promptId: '2', detectedStage: 'development', confidence: 0.7, isTransitionPoint: false },
        { promptId: '3', detectedStage: 'debugging', confidence: 0.8, isTransitionPoint: true },
        { promptId: '4', detectedStage: 'testing', confidence: 0.85, isTransitionPoint: true },
        { promptId: '5', detectedStage: 'testing', confidence: 0.8, isTransitionPoint: false },
      ];

      const unique = getUniqueStages(results);
      expect(unique).toHaveLength(3);
      expect(unique).toContain('development');
      expect(unique).toContain('debugging');
      expect(unique).toContain('testing');
    });

    it('should return empty array for empty input', () => {
      expect(getUniqueStages([])).toEqual([]);
    });
  });

  describe('calculateStageDistribution', () => {
    it('should calculate distribution correctly', () => {
      const results: StageDetectionResult[] = [
        { promptId: '1', detectedStage: 'development', confidence: 0.8, isTransitionPoint: true },
        { promptId: '2', detectedStage: 'development', confidence: 0.7, isTransitionPoint: false },
        { promptId: '3', detectedStage: 'development', confidence: 0.7, isTransitionPoint: false },
        { promptId: '4', detectedStage: 'debugging', confidence: 0.8, isTransitionPoint: true },
        { promptId: '5', detectedStage: 'testing', confidence: 0.85, isTransitionPoint: true },
      ];

      const dist = calculateStageDistribution(results);
      expect(dist.development).toBe(3);
      expect(dist.debugging).toBe(1);
      expect(dist.testing).toBe(1);
    });

    it('should return empty object for empty input', () => {
      expect(calculateStageDistribution([])).toEqual({});
    });
  });

  describe('findPrimaryStage', () => {
    it('should find most common stage', () => {
      const results: StageDetectionResult[] = [
        { promptId: '1', detectedStage: 'development', confidence: 0.8, isTransitionPoint: true },
        { promptId: '2', detectedStage: 'development', confidence: 0.7, isTransitionPoint: false },
        { promptId: '3', detectedStage: 'development', confidence: 0.7, isTransitionPoint: false },
        { promptId: '4', detectedStage: 'debugging', confidence: 0.8, isTransitionPoint: true },
        { promptId: '5', detectedStage: 'testing', confidence: 0.85, isTransitionPoint: true },
      ];

      expect(findPrimaryStage(results)).toBe('development');
    });

    it('should return null for empty input', () => {
      expect(findPrimaryStage([])).toBeNull();
    });
  });

  describe('getAverageConfidence', () => {
    it('should calculate average correctly', () => {
      const results: StageDetectionResult[] = [
        { promptId: '1', detectedStage: 'development', confidence: 0.8, isTransitionPoint: true },
        { promptId: '2', detectedStage: 'development', confidence: 0.6, isTransitionPoint: false },
        { promptId: '3', detectedStage: 'debugging', confidence: 1.0, isTransitionPoint: true },
      ];

      expect(getAverageConfidence(results)).toBeCloseTo(0.8, 2);
    });

    it('should return 0 for empty input', () => {
      expect(getAverageConfidence([])).toBe(0);
    });
  });

  describe('Real conversation examples', () => {
    it('should handle BMAD workflow conversation', () => {
      const prompts = [
        createPrompt('1', '/commit', 1), // Slash command
        createPrompt('2', 'DS', 2), // Menu selection - inherits
        createPrompt('3', 'implement the auth feature as described in the story', 3),
        createPrompt('4', 'yes', 4),
        createPrompt('5', 'continue', 5),
        createPrompt('6', 'the tests are failing', 6),
        createPrompt('7', 'why is this error happening?', 7),
        createPrompt('8', 'ok that makes sense', 8),
        createPrompt('9', 'run the e2e tests again', 9),
      ];

      const results = detectConversationStages(prompts);

      // Should see development → debugging → testing pattern
      expect(results[0].detectedStage).toBe('development'); // slash command
      expect(results[2].detectedStage).toBe('development'); // implement feature
      expect(results[5].detectedStage).toBe('debugging'); // failing
      expect(results[6].detectedStage).toBe('debugging'); // error
      expect(results[8].detectedStage).toBe('testing'); // run tests
    });

    it('should handle planning-first conversation', () => {
      const prompts = [
        createPrompt('1', "let's plan the implementation", 1),
        createPrompt('2', "what's the best approach?", 2),
        createPrompt('3', 'sounds good', 3),
        createPrompt('4', 'build the first component now', 4),
      ];

      const results = detectConversationStages(prompts);

      expect(results[0].detectedStage).toBe('planning');
      expect(results[1].detectedStage).toBe('planning');
      expect(results[2].detectedStage).toBe('planning'); // inherited
      expect(results[3].detectedStage).toBe('development'); // transition - "build" triggers development
    });

    it('should handle deployment workflow', () => {
      const prompts = [
        createPrompt('1', 'build the docker image', 1),
        createPrompt('2', 'push to gcr', 2),
        createPrompt('3', 'deploy to cloud run', 3),
        createPrompt('4', 'yes', 4),
        createPrompt('5', 'check the health endpoint', 5),
      ];

      const results = detectConversationStages(prompts);

      expect(results[0].detectedStage).toBe('deployment');
      expect(results[1].detectedStage).toBe('deployment');
      expect(results[2].detectedStage).toBe('deployment');
      expect(results[4].detectedStage).toBe('deployment'); // still deployment context
    });
  });
});
