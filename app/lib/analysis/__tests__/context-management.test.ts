/**
 * Context Management Tests
 * Story 21-1: Context Window Management
 *
 * Tests for context exhaustion detection functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  detectContextExhaustion,
  EXHAUSTION_PATTERNS,
  type ContextExhaustionResult,
} from '../context-management';

describe('Context Exhaustion Detection', () => {
  describe('detectContextExhaustion', () => {
    // ============================================================
    // AC #1: Keyword-based detection (high confidence)
    // ============================================================
    describe('keyword-based detection', () => {
      it('should detect "continued from previous conversation" pattern', () => {
        const result = detectContextExhaustion(
          'This is continued from a previous conversation where we were working on the auth module.',
          30
        );

        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.detectionMethod).toBe('keyword');
      });

      it('should detect "ran out of context" pattern', () => {
        const result = detectContextExhaustion(
          'We ran out of context in the last session, so let me catch you up.',
          45
        );

        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.detectionMethod).toBe('keyword');
      });

      it('should detect "context limit" pattern', () => {
        const result = detectContextExhaustion(
          'I think we hit the context limit. Let me summarize.',
          60
        );

        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.detectionMethod).toBe('keyword');
      });

      it('should detect "start fresh" pattern', () => {
        const result = detectContextExhaustion(
          "Let's start fresh with the authentication implementation.",
          20
        );

        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.detectionMethod).toBe('keyword');
      });

      it('should detect "new conversation" pattern', () => {
        const result = detectContextExhaustion(
          "Starting a new conversation to continue the project.",
          15
        );

        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.detectionMethod).toBe('keyword');
      });

      it('should detect "let me summarize where we were" pattern', () => {
        const result = detectContextExhaustion(
          'Let me summarize where we were with the refactoring effort.',
          50
        );

        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.detectionMethod).toBe('keyword');
      });

      it('should detect "picking up from" pattern', () => {
        const result = detectContextExhaustion(
          "Picking up from where we left off with the database migration.",
          35
        );

        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.detectionMethod).toBe('keyword');
      });

      it('should be case-insensitive for keyword detection', () => {
        const result = detectContextExhaustion(
          'CONTINUED FROM A PREVIOUS CONVERSATION about testing.',
          40
        );

        expect(result.isExhausted).toBe(true);
        expect(result.detectionMethod).toBe('keyword');
      });
    });

    // ============================================================
    // AC #2: Duration-based detection (moderate confidence)
    // ============================================================
    describe('duration-based detection', () => {
      it('should detect exhaustion for sessions > 90 minutes', () => {
        const result = detectContextExhaustion(
          'Can you help me fix this bug?',
          91
        );

        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.6);
        expect(result.detectionMethod).toBe('session_duration');
      });

      it('should detect exhaustion for sessions exactly at 90 minutes', () => {
        const result = detectContextExhaustion(
          'Add a new endpoint to the API.',
          90
        );

        // 90 minutes is the threshold - detection starts above 90
        expect(result.isExhausted).toBe(false);
      });

      it('should detect exhaustion for very long sessions (2+ hours)', () => {
        const result = detectContextExhaustion(
          'Continue with the implementation.',
          150
        );

        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.6);
        expect(result.detectionMethod).toBe('session_duration');
      });

      it('should not trigger for sessions under 90 minutes without keywords', () => {
        const result = detectContextExhaustion(
          'Help me write a unit test.',
          60
        );

        expect(result.isExhausted).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.detectionMethod).toBeNull();
      });
    });

    // ============================================================
    // Priority: Keyword detection takes precedence over duration
    // ============================================================
    describe('detection priority', () => {
      it('should prioritize keyword detection over duration', () => {
        const result = detectContextExhaustion(
          'Continued from a previous conversation where we were debugging.',
          120 // Over 90 minutes AND has keyword
        );

        // Keyword detection should win (higher confidence)
        expect(result.isExhausted).toBe(true);
        expect(result.confidence).toBe(0.95);
        expect(result.detectionMethod).toBe('keyword');
      });
    });

    // ============================================================
    // No detection cases
    // ============================================================
    describe('no exhaustion detected', () => {
      it('should return no exhaustion for normal prompts', () => {
        const result = detectContextExhaustion(
          'Help me implement a login form with email and password fields.',
          30
        );

        expect(result.isExhausted).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.detectionMethod).toBeNull();
      });

      it('should return no exhaustion for short sessions', () => {
        const result = detectContextExhaustion(
          'What is the best way to structure a React component?',
          5
        );

        expect(result.isExhausted).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.detectionMethod).toBeNull();
      });

      it('should return no exhaustion for empty prompts', () => {
        const result = detectContextExhaustion('', 45);

        expect(result.isExhausted).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.detectionMethod).toBeNull();
      });

      it('should handle null/undefined session duration', () => {
        const result = detectContextExhaustion(
          'Help me debug this issue.',
          undefined as unknown as number
        );

        expect(result.isExhausted).toBe(false);
      });
    });

    // ============================================================
    // AC #4: Performance requirement (<1ms per prompt)
    // ============================================================
    describe('performance', () => {
      it('should complete detection in under 1ms', () => {
        const testPrompts = [
          'This is continued from a previous conversation where we were working on something.',
          'We ran out of context in the last session.',
          'Help me write a unit test for the authentication module.',
          'Can you review this code for best practices?',
          'Let me summarize where we were with the implementation.',
        ];

        // Run detection multiple times to get a reliable measurement
        const iterations = 1000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          for (const prompt of testPrompts) {
            detectContextExhaustion(prompt, 45 + i % 100);
          }
        }

        const end = performance.now();
        const totalTime = end - start;
        const avgTimePerDetection = totalTime / (iterations * testPrompts.length);

        // Should be under 1ms per detection (with comfortable margin)
        expect(avgTimePerDetection).toBeLessThan(1);
      });
    });
  });

  describe('EXHAUSTION_PATTERNS', () => {
    it('should have all required patterns defined', () => {
      expect(EXHAUSTION_PATTERNS).toBeDefined();
      expect(EXHAUSTION_PATTERNS.length).toBeGreaterThanOrEqual(7);
    });

    it('should include pattern for "continued from previous"', () => {
      const hasPattern = EXHAUSTION_PATTERNS.some(
        pattern => pattern.test('continued from a previous conversation')
      );
      expect(hasPattern).toBe(true);
    });

    it('should include pattern for "context limit"', () => {
      const hasPattern = EXHAUSTION_PATTERNS.some(
        pattern => pattern.test('hit the context limit')
      );
      expect(hasPattern).toBe(true);
    });
  });
});
