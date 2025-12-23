/**
 * Timing Analyzer Tests
 * Story 21-5: Interaction Timing Analysis
 *
 * Tests for:
 * - Time since previous prompt calculation
 * - Rapid-fire detection (< 30 seconds)
 * - Long-pause detection (> 300 seconds)
 * - Follow-up pattern detection
 * - Sequence numbering
 * - Performance requirements (< 1ms)
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type TimingMetrics,
  // Constants
  RAPID_FIRE_THRESHOLD_SECONDS,
  LONG_PAUSE_THRESHOLD_SECONDS,
  FOLLOW_UP_PATTERNS,
  // Functions
  isFollowUpPrompt,
  analyzeTimingWithContext,
} from '../timing-analyzer';

// ============================================================================
// Test Data
// ============================================================================

const NOW = new Date('2025-01-15T14:00:00Z');

// Helper to create a date offset from NOW by seconds
function dateOffset(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000);
}

// ============================================================================
// Constants Tests
// ============================================================================

describe('Timing Constants', () => {
  it('should define RAPID_FIRE_THRESHOLD_SECONDS as 30', () => {
    expect(RAPID_FIRE_THRESHOLD_SECONDS).toBe(30);
  });

  it('should define LONG_PAUSE_THRESHOLD_SECONDS as 300', () => {
    expect(LONG_PAUSE_THRESHOLD_SECONDS).toBe(300);
  });

  it('should define FOLLOW_UP_PATTERNS as array of regex patterns', () => {
    expect(Array.isArray(FOLLOW_UP_PATTERNS)).toBe(true);
    expect(FOLLOW_UP_PATTERNS.length).toBeGreaterThan(0);
    expect(FOLLOW_UP_PATTERNS.every((p) => p instanceof RegExp)).toBe(true);
  });
});

// ============================================================================
// Follow-up Pattern Detection Tests
// ============================================================================

describe('isFollowUpPrompt', () => {
  describe('should detect "also/and/additionally/furthermore" patterns', () => {
    it('detects "also" at start', () => {
      expect(isFollowUpPrompt('Also add error handling')).toBe(true);
      expect(isFollowUpPrompt('also, update the tests')).toBe(true);
      expect(isFollowUpPrompt('ALSO fix the bug')).toBe(true);
    });

    it('detects "and" at start', () => {
      expect(isFollowUpPrompt('And make sure to test it')).toBe(true);
      expect(isFollowUpPrompt('and update the docs')).toBe(true);
    });

    it('detects "additionally" at start', () => {
      expect(isFollowUpPrompt('Additionally, please add validation')).toBe(true);
    });

    it('detects "furthermore" at start', () => {
      expect(isFollowUpPrompt('Furthermore, we need logging')).toBe(true);
    });
  });

  describe('should detect "now/next/then" patterns', () => {
    it('detects "now" at start', () => {
      expect(isFollowUpPrompt('Now update the component')).toBe(true);
      expect(isFollowUpPrompt('now let us move on')).toBe(true);
    });

    it('detects "next" at start', () => {
      expect(isFollowUpPrompt('Next, add the API route')).toBe(true);
    });

    it('detects "then" at start', () => {
      expect(isFollowUpPrompt('Then create the tests')).toBe(true);
    });
  });

  describe('should detect "one more thing/another thing" patterns', () => {
    it('detects "one more thing"', () => {
      expect(isFollowUpPrompt('One more thing, add caching')).toBe(true);
      expect(isFollowUpPrompt('one more thing - fix the types')).toBe(true);
    });

    it('detects "another thing"', () => {
      expect(isFollowUpPrompt('Another thing, update the readme')).toBe(true);
    });
  });

  describe('should detect "oh/wait" patterns', () => {
    it('detects "oh" at start', () => {
      expect(isFollowUpPrompt('Oh, I forgot to mention')).toBe(true);
      expect(isFollowUpPrompt('oh wait, also add')).toBe(true);
    });

    it('detects "wait" at start', () => {
      expect(isFollowUpPrompt('Wait, before you do that')).toBe(true);
    });
  });

  describe('should NOT detect patterns not at start', () => {
    it('does not match patterns in the middle of text', () => {
      expect(isFollowUpPrompt('Please also add error handling')).toBe(false);
      expect(isFollowUpPrompt('Can you now update the tests')).toBe(false);
      expect(isFollowUpPrompt('I think and then we should')).toBe(false);
    });
  });

  describe('should handle edge cases', () => {
    it('handles empty string', () => {
      expect(isFollowUpPrompt('')).toBe(false);
    });

    it('handles whitespace only', () => {
      expect(isFollowUpPrompt('   ')).toBe(false);
    });

    it('handles leading whitespace before pattern', () => {
      expect(isFollowUpPrompt('  Also add tests')).toBe(true);
      expect(isFollowUpPrompt('\n  Now update it')).toBe(true);
    });

    it('handles patterns with punctuation after', () => {
      expect(isFollowUpPrompt('Also, please')).toBe(true);
      expect(isFollowUpPrompt('And:')).toBe(true);
    });
  });
});

// ============================================================================
// Timing Analysis Tests
// ============================================================================

describe('analyzeTimingWithContext', () => {
  describe('first prompt in session (null previousTimestamp)', () => {
    it('should return null timeSincePrevious', () => {
      const result = analyzeTimingWithContext('Hello', NOW, null, 1);
      expect(result.timeSincePrevious).toBeNull();
    });

    it('should set isRapidFire to false', () => {
      const result = analyzeTimingWithContext('Hello', NOW, null, 1);
      expect(result.isRapidFire).toBe(false);
    });

    it('should set isLongPause to false', () => {
      const result = analyzeTimingWithContext('Hello', NOW, null, 1);
      expect(result.isLongPause).toBe(false);
    });

    it('should correctly set sequenceNumber to 1', () => {
      const result = analyzeTimingWithContext('Hello', NOW, null, 1);
      expect(result.sequenceNumber).toBe(1);
    });
  });

  describe('rapid-fire detection (< 30 seconds)', () => {
    it('should detect rapid-fire at 1 second', () => {
      const previousTime = dateOffset(-1);
      const result = analyzeTimingWithContext('Fast reply', NOW, previousTime, 2);
      expect(result.isRapidFire).toBe(true);
      expect(result.timeSincePrevious).toBe(1);
    });

    it('should detect rapid-fire at 15 seconds', () => {
      const previousTime = dateOffset(-15);
      const result = analyzeTimingWithContext('Still quick', NOW, previousTime, 2);
      expect(result.isRapidFire).toBe(true);
      expect(result.timeSincePrevious).toBe(15);
    });

    it('should detect rapid-fire at 29 seconds', () => {
      const previousTime = dateOffset(-29);
      const result = analyzeTimingWithContext('Almost threshold', NOW, previousTime, 2);
      expect(result.isRapidFire).toBe(true);
      expect(result.timeSincePrevious).toBe(29);
    });

    it('should NOT detect rapid-fire at exactly 30 seconds', () => {
      const previousTime = dateOffset(-30);
      const result = analyzeTimingWithContext('At threshold', NOW, previousTime, 2);
      expect(result.isRapidFire).toBe(false);
      expect(result.timeSincePrevious).toBe(30);
    });

    it('should NOT detect rapid-fire at 31 seconds', () => {
      const previousTime = dateOffset(-31);
      const result = analyzeTimingWithContext('Past threshold', NOW, previousTime, 2);
      expect(result.isRapidFire).toBe(false);
    });

    it('should NOT set isLongPause when rapid-fire', () => {
      const previousTime = dateOffset(-10);
      const result = analyzeTimingWithContext('Quick', NOW, previousTime, 2);
      expect(result.isRapidFire).toBe(true);
      expect(result.isLongPause).toBe(false);
    });
  });

  describe('long-pause detection (> 300 seconds)', () => {
    it('should NOT detect long-pause at 300 seconds exactly', () => {
      const previousTime = dateOffset(-300);
      const result = analyzeTimingWithContext('At threshold', NOW, previousTime, 2);
      expect(result.isLongPause).toBe(false);
      expect(result.timeSincePrevious).toBe(300);
    });

    it('should detect long-pause at 301 seconds', () => {
      const previousTime = dateOffset(-301);
      const result = analyzeTimingWithContext('Past threshold', NOW, previousTime, 2);
      expect(result.isLongPause).toBe(true);
      expect(result.timeSincePrevious).toBe(301);
    });

    it('should detect long-pause at 10 minutes', () => {
      const previousTime = dateOffset(-600);
      const result = analyzeTimingWithContext('Long wait', NOW, previousTime, 2);
      expect(result.isLongPause).toBe(true);
      expect(result.timeSincePrevious).toBe(600);
    });

    it('should detect long-pause at 1 hour', () => {
      const previousTime = dateOffset(-3600);
      const result = analyzeTimingWithContext('Very long wait', NOW, previousTime, 2);
      expect(result.isLongPause).toBe(true);
      expect(result.timeSincePrevious).toBe(3600);
    });

    it('should NOT set isRapidFire when long-pause', () => {
      const previousTime = dateOffset(-600);
      const result = analyzeTimingWithContext('Long wait', NOW, previousTime, 2);
      expect(result.isLongPause).toBe(true);
      expect(result.isRapidFire).toBe(false);
    });
  });

  describe('normal timing (30-300 seconds)', () => {
    it('should set neither flag at 60 seconds', () => {
      const previousTime = dateOffset(-60);
      const result = analyzeTimingWithContext('Normal pace', NOW, previousTime, 2);
      expect(result.isRapidFire).toBe(false);
      expect(result.isLongPause).toBe(false);
      expect(result.timeSincePrevious).toBe(60);
    });

    it('should set neither flag at 150 seconds', () => {
      const previousTime = dateOffset(-150);
      const result = analyzeTimingWithContext('Normal pace', NOW, previousTime, 2);
      expect(result.isRapidFire).toBe(false);
      expect(result.isLongPause).toBe(false);
    });

    it('should set neither flag at 299 seconds', () => {
      const previousTime = dateOffset(-299);
      const result = analyzeTimingWithContext('Still normal', NOW, previousTime, 2);
      expect(result.isRapidFire).toBe(false);
      expect(result.isLongPause).toBe(false);
    });
  });

  describe('follow-up detection integration', () => {
    it('should detect follow-up in timed prompts', () => {
      const previousTime = dateOffset(-45);
      const result = analyzeTimingWithContext('Also add tests', NOW, previousTime, 2);
      expect(result.isFollowUp).toBe(true);
    });

    it('should NOT detect follow-up in regular prompts', () => {
      const previousTime = dateOffset(-45);
      const result = analyzeTimingWithContext(
        'Create a new component',
        NOW,
        previousTime,
        2
      );
      expect(result.isFollowUp).toBe(false);
    });

    it('should correctly combine timing and follow-up analysis', () => {
      const previousTime = dateOffset(-10);
      const result = analyzeTimingWithContext(
        'And also fix the bug',
        NOW,
        previousTime,
        5
      );
      expect(result.timeSincePrevious).toBe(10);
      expect(result.isRapidFire).toBe(true);
      expect(result.isLongPause).toBe(false);
      expect(result.isFollowUp).toBe(true);
      expect(result.sequenceNumber).toBe(5);
    });
  });

  describe('sequence number handling', () => {
    it('should preserve sequence number 1', () => {
      const result = analyzeTimingWithContext('First', NOW, null, 1);
      expect(result.sequenceNumber).toBe(1);
    });

    it('should preserve sequence number 5', () => {
      const previousTime = dateOffset(-30);
      const result = analyzeTimingWithContext('Fifth', NOW, previousTime, 5);
      expect(result.sequenceNumber).toBe(5);
    });

    it('should preserve large sequence numbers', () => {
      const previousTime = dateOffset(-30);
      const result = analyzeTimingWithContext('Many prompts', NOW, previousTime, 100);
      expect(result.sequenceNumber).toBe(100);
    });
  });

  describe('return type validation', () => {
    it('should return all required TimingMetrics fields', () => {
      const result = analyzeTimingWithContext('Test', NOW, dateOffset(-60), 3);
      expect(result).toHaveProperty('timeSincePrevious');
      expect(result).toHaveProperty('isRapidFire');
      expect(result).toHaveProperty('isLongPause');
      expect(result).toHaveProperty('isFollowUp');
      expect(result).toHaveProperty('sequenceNumber');
    });

    it('should return correct types for each field', () => {
      const result = analyzeTimingWithContext('Test', NOW, dateOffset(-60), 3);
      expect(typeof result.timeSincePrevious).toBe('number');
      expect(typeof result.isRapidFire).toBe('boolean');
      expect(typeof result.isLongPause).toBe('boolean');
      expect(typeof result.isFollowUp).toBe('boolean');
      expect(typeof result.sequenceNumber).toBe('number');
    });
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('performance', () => {
  it('should analyze timing in under 1ms', () => {
    const testCases = [
      'Hello world',
      'Also add tests',
      'Now update the component with better error handling',
      'One more thing, please make sure to validate all inputs and handle edge cases appropriately',
    ];

    const previousTime = dateOffset(-45);

    for (const testCase of testCases) {
      const start = performance.now();
      analyzeTimingWithContext(testCase, NOW, previousTime, 5);
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(1);
    }
  });

  it('should handle rapid consecutive calls efficiently', () => {
    const previousTime = dateOffset(-60);

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      analyzeTimingWithContext('Test prompt', NOW, previousTime, i + 1);
    }
    const end = performance.now();
    const totalDuration = end - start;

    // 1000 calls should complete in well under 100ms (avg < 0.1ms each)
    expect(totalDuration).toBeLessThan(100);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty prompt text', () => {
    const result = analyzeTimingWithContext('', NOW, dateOffset(-60), 2);
    expect(result.isFollowUp).toBe(false);
    expect(result.timeSincePrevious).toBe(60);
  });

  it('should handle very long prompt text', () => {
    const longPrompt = 'Also '.repeat(1000) + 'do this';
    const start = performance.now();
    const result = analyzeTimingWithContext(longPrompt, NOW, dateOffset(-60), 2);
    const end = performance.now();

    expect(result.isFollowUp).toBe(true);
    expect(end - start).toBeLessThan(1); // Still under 1ms
  });

  it('should handle timestamps in the past correctly', () => {
    const futureNow = new Date('2030-01-01T00:00:00Z');
    const past = new Date('2025-01-01T00:00:00Z');

    const result = analyzeTimingWithContext('Test', futureNow, past, 2);
    // Should be ~5 years in seconds
    expect(result.timeSincePrevious).toBeGreaterThan(100000000);
    expect(result.isLongPause).toBe(true);
  });

  it('should handle zero time difference', () => {
    const result = analyzeTimingWithContext('Same instant', NOW, NOW, 2);
    expect(result.timeSincePrevious).toBe(0);
    expect(result.isRapidFire).toBe(true);
    expect(result.isLongPause).toBe(false);
  });

  it('should floor fractional seconds', () => {
    // 10.9 seconds should be floored to 10
    const previousTime = new Date(NOW.getTime() - 10900);
    const result = analyzeTimingWithContext('Test', NOW, previousTime, 2);
    expect(result.timeSincePrevious).toBe(10);
  });

  it('should handle unicode in prompt text', () => {
    const result = analyzeTimingWithContext(
      'Also add support',
      NOW,
      dateOffset(-60),
      2
    );
    expect(result.isFollowUp).toBe(true);
  });
});
