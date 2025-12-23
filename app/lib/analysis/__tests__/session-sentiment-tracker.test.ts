/**
 * Session Sentiment Tracker Tests
 * Story 21-3: Sentiment Analysis
 *
 * Tests for session-level sentiment metrics:
 * - Frustration trend calculation
 * - Rising frustration detection
 * - Politeness ratio calculation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFrustrationTrend,
  detectRisingFrustration,
  calculatePolitenessRatio,
  calculateSessionSentimentMetrics,
  PromptWithSentiment,
  SessionSentimentMetrics,
  FrustrationTrend,
} from '../session-sentiment-tracker';

// ============================================================================
// Helper: Create test prompts
// ============================================================================

function createPrompt(
  sentiment: 'polite' | 'frustrated' | 'neutral' | 'directive' | 'collaborative',
  frustratedScore: number = 0
): PromptWithSentiment {
  return {
    id: crypto.randomUUID(),
    sentiment,
    sentiment_scores: {
      polite: sentiment === 'polite' ? 0.4 : 0,
      frustrated: frustratedScore,
      directive: sentiment === 'directive' ? 0.4 : 0,
      collaborative: sentiment === 'collaborative' ? 0.4 : 0,
    },
  };
}

// ============================================================================
// Tests: Frustration Trend Calculation (AC #9)
// ============================================================================

describe('Frustration Trend Calculation (AC #9)', () => {
  it('should return stable for less than 3 prompts', () => {
    expect(calculateFrustrationTrend([])).toBe('stable');
    expect(calculateFrustrationTrend([createPrompt('neutral')])).toBe('stable');
    expect(calculateFrustrationTrend([
      createPrompt('neutral'),
      createPrompt('neutral'),
    ])).toBe('stable');
  });

  it('should detect increasing frustration trend', () => {
    const prompts = [
      createPrompt('neutral', 0.1),
      createPrompt('neutral', 0.2),
      createPrompt('neutral', 0.3),
      createPrompt('frustrated', 0.5),
      createPrompt('frustrated', 0.6),
      createPrompt('frustrated', 0.7),
    ];
    expect(calculateFrustrationTrend(prompts)).toBe('increasing');
  });

  it('should detect decreasing frustration trend', () => {
    const prompts = [
      createPrompt('frustrated', 0.7),
      createPrompt('frustrated', 0.6),
      createPrompt('frustrated', 0.5),
      createPrompt('neutral', 0.3),
      createPrompt('neutral', 0.2),
      createPrompt('polite', 0.1),
    ];
    expect(calculateFrustrationTrend(prompts)).toBe('decreasing');
  });

  it('should detect stable frustration trend', () => {
    const prompts = [
      createPrompt('neutral', 0.3),
      createPrompt('neutral', 0.3),
      createPrompt('neutral', 0.35),
      createPrompt('neutral', 0.3),
      createPrompt('neutral', 0.32),
      createPrompt('neutral', 0.31),
    ];
    expect(calculateFrustrationTrend(prompts)).toBe('stable');
  });

  it('should compare first half to second half', () => {
    // First 2 prompts avg: (0.1 + 0.2) / 2 = 0.15
    // Second 2 prompts avg: (0.5 + 0.6) / 2 = 0.55
    // Diff = 0.55 - 0.15 = 0.4 > 0.1, so increasing
    const prompts = [
      createPrompt('neutral', 0.1),
      createPrompt('neutral', 0.2),
      createPrompt('frustrated', 0.5),
      createPrompt('frustrated', 0.6),
    ];
    expect(calculateFrustrationTrend(prompts)).toBe('increasing');
  });

  it('should handle odd number of prompts', () => {
    // First 2 prompts, second 3 prompts
    const prompts = [
      createPrompt('neutral', 0.1),
      createPrompt('neutral', 0.2),
      createPrompt('neutral', 0.3),
      createPrompt('neutral', 0.35),
      createPrompt('frustrated', 0.5),
    ];
    expect(calculateFrustrationTrend(prompts)).toBe('increasing');
  });
});

// ============================================================================
// Tests: Rising Frustration Detection (AC #10)
// ============================================================================

describe('Rising Frustration Detection (AC #10)', () => {
  it('should return false for less than 3 prompts', () => {
    expect(detectRisingFrustration([])).toBe(false);
    expect(detectRisingFrustration([createPrompt('frustrated', 0.8)])).toBe(false);
    expect(detectRisingFrustration([
      createPrompt('frustrated', 0.8),
      createPrompt('frustrated', 0.8),
    ])).toBe(false);
  });

  it('should detect 3 consecutive frustrated prompts', () => {
    const prompts = [
      createPrompt('neutral', 0.1),
      createPrompt('frustrated', 0.5),
      createPrompt('frustrated', 0.6),
      createPrompt('frustrated', 0.7),
      createPrompt('neutral', 0.2),
    ];
    expect(detectRisingFrustration(prompts)).toBe(true);
  });

  it('should not flag when frustrated prompts are not consecutive', () => {
    const prompts = [
      createPrompt('frustrated', 0.5),
      createPrompt('neutral', 0.1),
      createPrompt('frustrated', 0.6),
      createPrompt('neutral', 0.1),
      createPrompt('frustrated', 0.7),
    ];
    expect(detectRisingFrustration(prompts)).toBe(false);
  });

  it('should detect frustration score increase > 0.3 from start to end', () => {
    const prompts = [
      createPrompt('neutral', 0.1),
      createPrompt('neutral', 0.2),
      createPrompt('neutral', 0.3),
      createPrompt('neutral', 0.45), // 0.45 - 0.1 = 0.35 > 0.3
    ];
    expect(detectRisingFrustration(prompts)).toBe(true);
  });

  it('should not flag when frustration increase is <= 0.3', () => {
    const prompts = [
      createPrompt('neutral', 0.1),
      createPrompt('neutral', 0.2),
      createPrompt('neutral', 0.3),
      createPrompt('neutral', 0.35), // 0.35 - 0.1 = 0.25 <= 0.3
    ];
    expect(detectRisingFrustration(prompts)).toBe(false);
  });

  it('should flag when either condition is met', () => {
    // Only consecutive frustrated condition
    const prompts1 = [
      createPrompt('frustrated', 0.5),
      createPrompt('frustrated', 0.5),
      createPrompt('frustrated', 0.5),
    ];
    expect(detectRisingFrustration(prompts1)).toBe(true);

    // Only score increase condition
    const prompts2 = [
      createPrompt('neutral', 0.1),
      createPrompt('polite', 0.0),
      createPrompt('neutral', 0.2),
      createPrompt('frustrated', 0.5), // 0.5 - 0.1 = 0.4 > 0.3
    ];
    expect(detectRisingFrustration(prompts2)).toBe(true);
  });
});

// ============================================================================
// Tests: Politeness Ratio Calculation (AC #11)
// ============================================================================

describe('Politeness Ratio Calculation (AC #11)', () => {
  it('should return 0.5 when no polite or frustrated prompts', () => {
    const prompts = [
      createPrompt('neutral'),
      createPrompt('directive'),
      createPrompt('collaborative'),
    ];
    expect(calculatePolitenessRatio(prompts)).toBe(0.5);
  });

  it('should return 1.0 when all polite, no frustrated', () => {
    const prompts = [
      createPrompt('polite'),
      createPrompt('polite'),
      createPrompt('polite'),
    ];
    expect(calculatePolitenessRatio(prompts)).toBe(1);
  });

  it('should return 0.0 when all frustrated, no polite', () => {
    const prompts = [
      createPrompt('frustrated', 0.5),
      createPrompt('frustrated', 0.6),
      createPrompt('frustrated', 0.7),
    ];
    expect(calculatePolitenessRatio(prompts)).toBe(0);
  });

  it('should calculate ratio correctly with mixed prompts', () => {
    const prompts = [
      createPrompt('polite'),
      createPrompt('polite'),
      createPrompt('frustrated', 0.5),
      createPrompt('neutral'),
      createPrompt('frustrated', 0.6),
    ];
    // 2 polite, 2 frustrated = 2 / (2 + 2) = 0.5
    expect(calculatePolitenessRatio(prompts)).toBe(0.5);
  });

  it('should ignore neutral, directive, and collaborative prompts', () => {
    const prompts = [
      createPrompt('polite'),
      createPrompt('neutral'),
      createPrompt('directive'),
      createPrompt('collaborative'),
      createPrompt('frustrated', 0.5),
    ];
    // 1 polite, 1 frustrated = 1 / (1 + 1) = 0.5
    expect(calculatePolitenessRatio(prompts)).toBe(0.5);
  });

  it('should handle empty array', () => {
    expect(calculatePolitenessRatio([])).toBe(0.5);
  });
});

// ============================================================================
// Tests: Session Sentiment Metrics (All combined)
// ============================================================================

describe('Session Sentiment Metrics', () => {
  it('should calculate all metrics correctly', () => {
    const prompts = [
      createPrompt('polite', 0.1),
      createPrompt('neutral', 0.2),
      createPrompt('frustrated', 0.5),
      createPrompt('frustrated', 0.6),
      createPrompt('frustrated', 0.7),
    ];

    const metrics = calculateSessionSentimentMetrics(prompts);

    expect(metrics.frustrationTrend).toBe('increasing');
    expect(metrics.frustrationRising).toBe(true);
    expect(metrics.politenessRatio).toBeCloseTo(0.25, 2); // 1 polite, 3 frustrated
    expect(metrics.sentimentBreakdown).toEqual({
      polite: 1,
      frustrated: 3,
      neutral: 1,
      directive: 0,
      collaborative: 0,
    });
  });

  it('should return correct breakdown counts', () => {
    const prompts = [
      createPrompt('polite'),
      createPrompt('polite'),
      createPrompt('frustrated', 0.5),
      createPrompt('neutral'),
      createPrompt('directive'),
      createPrompt('collaborative'),
    ];

    const metrics = calculateSessionSentimentMetrics(prompts);

    expect(metrics.sentimentBreakdown).toEqual({
      polite: 2,
      frustrated: 1,
      neutral: 1,
      directive: 1,
      collaborative: 1,
    });
  });

  it('should handle empty prompts', () => {
    const metrics = calculateSessionSentimentMetrics([]);

    expect(metrics.frustrationTrend).toBe('stable');
    expect(metrics.frustrationRising).toBe(false);
    expect(metrics.politenessRatio).toBe(0.5);
    expect(metrics.sentimentBreakdown).toEqual({
      polite: 0,
      frustrated: 0,
      neutral: 0,
      directive: 0,
      collaborative: 0,
    });
  });
});

// ============================================================================
// Tests: Performance
// ============================================================================

describe('Performance', () => {
  it('should process 100 prompts in under 5ms', () => {
    const prompts = Array.from({ length: 100 }, (_, i) =>
      createPrompt(
        i % 5 === 0 ? 'frustrated' : 'neutral',
        i % 5 === 0 ? 0.6 : 0.2
      )
    );

    const start = performance.now();
    calculateSessionSentimentMetrics(prompts);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5);
  });
});
