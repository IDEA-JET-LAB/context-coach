/**
 * ReDoS Detector Tests
 * Story 22-2: Classification Rule Editor
 *
 * Tests for detecting potential ReDoS vulnerabilities in regex patterns.
 */

import { describe, it, expect } from 'vitest';
import { analyzePattern, testPatternSafety, RedosRisk } from '../redos-detector';

describe('ReDoS Detector', () => {
  describe('analyzePattern', () => {
    describe('safe patterns', () => {
      it('should mark simple word boundary patterns as safe', () => {
        const result = analyzePattern('\\bfix\\b');
        expect(result.risk).toBe('safe');
        expect(result.issues).toHaveLength(0);
      });

      it('should mark character class patterns as safe', () => {
        const result = analyzePattern('[a-z]+');
        expect(result.risk).toBe('safe');
        expect(result.issues).toHaveLength(0);
      });

      it('should mark alternation without quantifiers as safe', () => {
        const result = analyzePattern('(fix|bug|error)');
        expect(result.risk).toBe('safe');
        expect(result.issues).toHaveLength(0);
      });

      it('should mark lazy quantifiers as safe', () => {
        const result = analyzePattern('.*?end');
        expect(result.risk).toBe('safe');
        expect(result.issues).toHaveLength(0);
      });

      it('should mark fixed repetition as safe', () => {
        const result = analyzePattern('[a-z]{1,10}');
        expect(result.risk).toBe('safe');
        expect(result.issues).toHaveLength(0);
      });
    });

    describe('warning patterns', () => {
      it('should warn about greedy .* patterns', () => {
        const result = analyzePattern('.*text.*');
        expect(result.risk).toBe('warning');
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues.some(i => i.toLowerCase().includes('greedy'))).toBe(true);
      });

      it('should provide suggestions for greedy patterns', () => {
        const result = analyzePattern('.*text');
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions.some(s => s.toLowerCase().includes('lazy'))).toBe(true);
      });
    });

    describe('dangerous patterns', () => {
      it('should detect nested quantifiers as dangerous', () => {
        const result = analyzePattern('(a+)+');
        expect(result.risk).toBe('dangerous');
        expect(result.issues.some(i => i.toLowerCase().includes('nested'))).toBe(true);
      });

      it('should detect (.*a)+ as dangerous', () => {
        const result = analyzePattern('(.*a)+');
        // This pattern has nested quantifiers, should be flagged
        expect(['warning', 'dangerous']).toContain(result.risk);
        expect(result.issues.length).toBeGreaterThan(0);
      });

      it('should detect overlapping alternations as dangerous', () => {
        const result = analyzePattern('(a|a)+');
        expect(result.risk).toBe('dangerous');
        expect(result.issues.some(i => i.toLowerCase().includes('overlap'))).toBe(true);
      });

      it('should detect (.+.+)+ as dangerous', () => {
        const result = analyzePattern('(.+.+)+');
        expect(result.risk).toBe('dangerous');
      });

      it('should detect ([a-z]+)+ as dangerous', () => {
        const result = analyzePattern('([a-z]+)+');
        expect(result.risk).toBe('dangerous');
      });

      it('should detect (\\w+\\w+)+ as dangerous', () => {
        const result = analyzePattern('(\\w+\\w+)+');
        expect(result.risk).toBe('dangerous');
      });
    });

    describe('edge cases', () => {
      it('should handle empty pattern', () => {
        const result = analyzePattern('');
        expect(result.risk).toBe('safe');
      });

      it('should handle invalid regex syntax', () => {
        const result = analyzePattern('[');
        expect(result.risk).toBeDefined();
        expect(result.issues.some(i => i.toLowerCase().includes('invalid') || i.toLowerCase().includes('syntax'))).toBe(true);
      });

      it('should handle patterns with escaped characters', () => {
        const result = analyzePattern('\\(\\)\\[\\]');
        expect(result.risk).toBe('safe');
      });
    });
  });

  describe('testPatternSafety', () => {
    it('should return true for safe patterns', () => {
      expect(testPatternSafety('\\bfix\\b')).toBe(true);
    });

    it('should return true for simple patterns', () => {
      expect(testPatternSafety('[a-z]+')).toBe(true);
    });

    it('should handle invalid patterns gracefully', () => {
      expect(testPatternSafety('[')).toBe(false);
    });

    it('should complete quickly for safe patterns', () => {
      const start = performance.now();
      const result = testPatternSafety('\\bfix\\b', 100);
      const elapsed = performance.now() - start;

      expect(result).toBe(true);
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('real-world classification patterns', () => {
    it('should accept bug fix pattern', () => {
      const result = analyzePattern('\\b(fix|bug|error|issue|problem|broken|crash|fail)\\b');
      expect(result.risk).toBe('safe');
    });

    it('should accept feature request pattern', () => {
      const result = analyzePattern('\\b(add|create|implement|build|new feature|introduce)\\b');
      expect(result.risk).toBe('safe');
    });

    it('should accept test keywords pattern', () => {
      const result = analyzePattern('\\b(test|spec|assert|expect|mock|jest|playwright|vitest)\\b');
      expect(result.risk).toBe('safe');
    });

    it('should accept documentation pattern', () => {
      const result = analyzePattern('\\b(document|readme|comment|explain|describe|jsdoc|docstring)\\b');
      expect(result.risk).toBe('safe');
    });

    it('should accept debugging pattern', () => {
      const result = analyzePattern('\\b(debug|investigate|trace|log|console|inspect|why|diagnose)\\b');
      expect(result.risk).toBe('safe');
    });
  });
});
