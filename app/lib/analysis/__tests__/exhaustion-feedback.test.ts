/**
 * Exhaustion Feedback Tests
 * Story 21-1: Context Window Management (AC #9)
 */

import { describe, it, expect } from 'vitest';
import {
  generateExhaustionFeedback,
  determineExhaustionSeverity,
  generateSessionWarning,
  EXHAUSTION_THRESHOLDS,
} from '../exhaustion-feedback';

describe('Exhaustion Feedback', () => {
  describe('determineExhaustionSeverity', () => {
    it('should return "high" for rates above 50%', () => {
      expect(determineExhaustionSeverity(0.51)).toBe('high');
      expect(determineExhaustionSeverity(0.6)).toBe('high');
      expect(determineExhaustionSeverity(0.8)).toBe('high');
      expect(determineExhaustionSeverity(1.0)).toBe('high');
    });

    it('should return "moderate" for rates above 25% but below 50%', () => {
      expect(determineExhaustionSeverity(0.26)).toBe('moderate');
      expect(determineExhaustionSeverity(0.35)).toBe('moderate');
      expect(determineExhaustionSeverity(0.5)).toBe('moderate');
    });

    it('should return "low" for rates at or below 25%', () => {
      expect(determineExhaustionSeverity(0)).toBe('low');
      expect(determineExhaustionSeverity(0.1)).toBe('low');
      expect(determineExhaustionSeverity(0.25)).toBe('low');
    });

    it('should handle edge cases', () => {
      // Exactly at thresholds
      expect(determineExhaustionSeverity(0.25)).toBe('low');
      expect(determineExhaustionSeverity(0.5)).toBe('moderate');
      // Just above thresholds
      expect(determineExhaustionSeverity(0.251)).toBe('moderate');
      expect(determineExhaustionSeverity(0.501)).toBe('high');
    });
  });

  describe('generateExhaustionFeedback', () => {
    it('should generate correct message format', () => {
      const feedback = generateExhaustionFeedback(0.35);
      expect(feedback.message).toBe('You hit context limits in 35% of sessions');
    });

    it('should round percentage to whole number', () => {
      const feedback = generateExhaustionFeedback(0.333);
      expect(feedback.message).toBe('You hit context limits in 33% of sessions');

      const feedback2 = generateExhaustionFeedback(0.337);
      expect(feedback2.message).toBe('You hit context limits in 34% of sessions');
    });

    it('should return high severity feedback for rates above 50%', () => {
      const feedback = generateExhaustionFeedback(0.6);
      expect(feedback.severity).toBe('high');
      expect(feedback.message).toBe('You hit context limits in 60% of sessions');
      expect(feedback.suggestion).toContain('breaking large tasks');
    });

    it('should return moderate severity feedback for rates above 25%', () => {
      const feedback = generateExhaustionFeedback(0.35);
      expect(feedback.severity).toBe('moderate');
      expect(feedback.message).toBe('You hit context limits in 35% of sessions');
      expect(feedback.suggestion).toContain('summarizing progress');
    });

    it('should return low severity feedback for rates at or below 25%', () => {
      const feedback = generateExhaustionFeedback(0.1);
      expect(feedback.severity).toBe('low');
      expect(feedback.message).toBe('You hit context limits in 10% of sessions');
      expect(feedback.suggestion).toContain('good');
    });

    it('should handle zero rate', () => {
      const feedback = generateExhaustionFeedback(0);
      expect(feedback.severity).toBe('low');
      expect(feedback.message).toBe('You hit context limits in 0% of sessions');
    });

    it('should handle 100% rate', () => {
      const feedback = generateExhaustionFeedback(1.0);
      expect(feedback.severity).toBe('high');
      expect(feedback.message).toBe('You hit context limits in 100% of sessions');
    });

    it('should clamp rates above 1.0', () => {
      const feedback = generateExhaustionFeedback(1.5);
      expect(feedback.message).toBe('You hit context limits in 100% of sessions');
    });

    it('should clamp negative rates', () => {
      const feedback = generateExhaustionFeedback(-0.5);
      expect(feedback.message).toBe('You hit context limits in 0% of sessions');
    });
  });

  describe('generateSessionWarning', () => {
    it('should generate high confidence warning for confidence >= 0.9', () => {
      const warning = generateSessionWarning(0.95);
      expect(warning.warning).toContain('reached its context window limit');
      expect(warning.action).toContain('starting a fresh session');
    });

    it('should generate moderate warning for confidence >= 0.6', () => {
      const warning = generateSessionWarning(0.65);
      expect(warning.warning).toContain('approaching');
      expect(warning.action).toContain('checkpoint');
    });

    it('should generate positive message for low confidence', () => {
      const warning = generateSessionWarning(0.3);
      expect(warning.warning).toContain('good');
      expect(warning.action).toContain('Continue');
    });

    it('should handle edge cases at thresholds', () => {
      const warning90 = generateSessionWarning(0.9);
      expect(warning90.warning).toContain('reached');

      const warning60 = generateSessionWarning(0.6);
      expect(warning60.warning).toContain('approaching');

      const warning59 = generateSessionWarning(0.59);
      expect(warning59.warning).toContain('good');
    });
  });

  describe('EXHAUSTION_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(EXHAUSTION_THRESHOLDS.HIGH).toBe(0.5);
      expect(EXHAUSTION_THRESHOLDS.MODERATE).toBe(0.25);
    });
  });
});
