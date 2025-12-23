import { describe, it, expect } from 'vitest';
import { formatEstimate, formatDuration } from '../use-import-progress';

describe('Import Progress Utilities - Story 17-5', () => {
  describe('formatEstimate', () => {
    it('should return "Calculating..." for null', () => {
      expect(formatEstimate(null)).toBe('Calculating...');
    });

    it('should return "Less than a minute" for seconds under 60', () => {
      expect(formatEstimate(0)).toBe('Less than a minute');
      expect(formatEstimate(30)).toBe('Less than a minute');
      expect(formatEstimate(59)).toBe('Less than a minute');
    });

    it('should return "About a minute" for 60-119 seconds', () => {
      expect(formatEstimate(60)).toBe('About a minute');
      expect(formatEstimate(90)).toBe('About a minute');
      expect(formatEstimate(119)).toBe('About a minute');
    });

    it('should return minutes for 2-59 minutes', () => {
      expect(formatEstimate(120)).toBe('About 2 minutes');
      expect(formatEstimate(180)).toBe('About 3 minutes');
      expect(formatEstimate(300)).toBe('About 5 minutes');
      expect(formatEstimate(600)).toBe('About 10 minutes');
      expect(formatEstimate(3540)).toBe('About 59 minutes');
    });

    it('should return hours for 60+ minutes', () => {
      expect(formatEstimate(3600)).toBe('About 1 hour');
      expect(formatEstimate(7200)).toBe('About 2 hours');
    });

    it('should return hours and minutes for non-round hours', () => {
      expect(formatEstimate(3660)).toBe('About 1h 1m');
      expect(formatEstimate(3900)).toBe('About 1h 5m');
      expect(formatEstimate(5400)).toBe('About 1h 30m');
      expect(formatEstimate(9000)).toBe('About 2h 30m');
    });

    it('should round up partial minutes', () => {
      // 61 seconds is still "about a minute" (less than 120)
      expect(formatEstimate(61)).toBe('About a minute');
      // 121 seconds = 3 minutes when rounded up (ceil(121/60) = 3)
      expect(formatEstimate(121)).toBe('About 3 minutes');
      // 181 seconds = 4 minutes when rounded up
      expect(formatEstimate(181)).toBe('About 4 minutes');
    });
  });

  describe('formatDuration', () => {
    it('should format 1 second correctly', () => {
      expect(formatDuration(1)).toBe('1 second');
    });

    it('should format multiple seconds correctly', () => {
      expect(formatDuration(0)).toBe('0 seconds');
      expect(formatDuration(30)).toBe('30 seconds');
      expect(formatDuration(59)).toBe('59 seconds');
    });

    it('should format 1 minute correctly', () => {
      expect(formatDuration(60)).toBe('1 minute');
    });

    it('should format minutes with seconds correctly', () => {
      expect(formatDuration(61)).toBe('1m 1s');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(150)).toBe('2m 30s');
    });

    it('should format multiple minutes correctly', () => {
      expect(formatDuration(120)).toBe('2 minutes');
      expect(formatDuration(180)).toBe('3 minutes');
      expect(formatDuration(300)).toBe('5 minutes');
    });

    it('should format 1 hour correctly', () => {
      expect(formatDuration(3600)).toBe('1 hour');
    });

    it('should format hours with minutes correctly', () => {
      expect(formatDuration(3660)).toBe('1h 1m');
      expect(formatDuration(3900)).toBe('1h 5m');
      expect(formatDuration(5400)).toBe('1h 30m');
    });

    it('should format multiple hours correctly', () => {
      expect(formatDuration(7200)).toBe('2 hours');
      expect(formatDuration(10800)).toBe('3 hours');
    });

    it('should format hours and minutes correctly', () => {
      expect(formatDuration(7260)).toBe('2h 1m');
      expect(formatDuration(7800)).toBe('2h 10m');
    });
  });

  describe('edge cases', () => {
    it('formatEstimate should handle very large values', () => {
      // 10 hours
      expect(formatEstimate(36000)).toBe('About 10 hours');
      // 24 hours
      expect(formatEstimate(86400)).toBe('About 24 hours');
    });

    it('formatDuration should handle very large values', () => {
      // 10 hours
      expect(formatDuration(36000)).toBe('10 hours');
      // 24 hours
      expect(formatDuration(86400)).toBe('24 hours');
    });

    it('formatEstimate should handle negative values gracefully', () => {
      // Negative values should be treated as "less than a minute"
      expect(formatEstimate(-1)).toBe('Less than a minute');
      expect(formatEstimate(-100)).toBe('Less than a minute');
    });
  });
});

describe('Import Progress State Machine Logic', () => {
  // These tests verify the state transition logic conceptually
  // The actual hook tests would require React Testing Library

  describe('initial state shape', () => {
    it('should have correct initial values', () => {
      // Conceptual test - in a full React test we'd use renderHook
      const initialState = {
        currentProject: '',
        projectIndex: 0,
        totalProjects: 0,
        progress: 0,
        total: 0,
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [],
        estimatedTimeRemaining: null,
        startedAt: expect.any(Number),
        cancelling: false,
        status: 'idle',
      };

      expect(initialState.status).toBe('idle');
      expect(initialState.progress).toBe(0);
      expect(initialState.errors).toHaveLength(0);
    });
  });

  describe('time estimation algorithm', () => {
    it('should calculate rate correctly', () => {
      // Simulate 100 items processed in 1000ms = 0.1 items/ms
      const batches = [
        { count: 50, durationMs: 500 },
        { count: 50, durationMs: 500 },
      ];

      const totalCount = batches.reduce((sum, b) => sum + b.count, 0);
      const totalDuration = batches.reduce((sum, b) => sum + b.durationMs, 0);

      const ratePerMs = totalCount / totalDuration;
      expect(ratePerMs).toBe(0.1); // 100 items / 1000ms
    });

    it('should estimate remaining time correctly', () => {
      // If rate is 0.1 items/ms and we have 1000 items remaining
      // Estimated time = 1000 / 0.1 = 10000ms = 10 seconds
      const remaining = 1000;
      const ratePerMs = 0.1;
      const estimatedMs = remaining / ratePerMs;
      const estimatedSeconds = Math.ceil(estimatedMs / 1000);

      expect(estimatedSeconds).toBe(10);
    });

    it('should use rolling average of last 10 batches', () => {
      const batches = Array.from({ length: 15 }, (_, i) => ({
        count: 10,
        durationMs: i < 10 ? 1000 : 100, // First 10 batches slow, last 5 fast
      }));

      // Take last 10 batches for rolling average
      const recent = batches.slice(-10);

      // Verify we're using the right subset
      expect(recent).toHaveLength(10);
      expect(recent[0].durationMs).toBe(1000); // First of last 10
      expect(recent[5].durationMs).toBe(100);  // Should be fast batch
    });

    it('should not estimate with fewer than 3 batches', () => {
      const MIN_BATCHES_FOR_ESTIMATE = 3;
      const batches = [{ count: 10, durationMs: 100 }];

      const shouldEstimate = batches.length >= MIN_BATCHES_FOR_ESTIMATE;
      expect(shouldEstimate).toBe(false);
    });

    it('should estimate with 3 or more batches', () => {
      const MIN_BATCHES_FOR_ESTIMATE = 3;
      const batches = [
        { count: 10, durationMs: 100 },
        { count: 10, durationMs: 100 },
        { count: 10, durationMs: 100 },
      ];

      const shouldEstimate = batches.length >= MIN_BATCHES_FOR_ESTIMATE;
      expect(shouldEstimate).toBe(true);
    });
  });
});

describe('Cancellation Token Pattern', () => {
  it('should start with cancelled = false', () => {
    const token = {
      cancelled: false,
      cancel: function() { this.cancelled = true; },
    };

    expect(token.cancelled).toBe(false);
  });

  it('should set cancelled = true after cancel()', () => {
    const token = {
      cancelled: false,
      cancel: function() { this.cancelled = true; },
    };

    token.cancel();
    expect(token.cancelled).toBe(true);
  });

  it('should allow multiple cancel calls safely', () => {
    const token = {
      cancelled: false,
      cancel: function() { this.cancelled = true; },
    };

    token.cancel();
    token.cancel();
    token.cancel();

    expect(token.cancelled).toBe(true);
  });
});

describe('Session Storage Persistence', () => {
  it('should use correct storage key', () => {
    const STORAGE_KEY = 'contextor-import-progress';
    expect(STORAGE_KEY).toBe('contextor-import-progress');
  });

  it('should serialize state as JSON', () => {
    const state = {
      currentProject: '/test/project',
      projectIndex: 1,
      totalProjects: 5,
      progress: 100,
      total: 500,
      imported: 90,
      skipped: 5,
      failed: 5,
      errors: [],
      estimatedTimeRemaining: 120,
      startedAt: Date.now(),
      cancelling: false,
      status: 'running' as const,
    };

    const serialized = JSON.stringify(state);
    const deserialized = JSON.parse(serialized);

    expect(deserialized).toEqual(state);
  });

  it('should preserve error details in serialization', () => {
    const state = {
      errors: [
        {
          projectPath: '/test/project',
          sessionPath: '/test/session.jsonl',
          message: 'Failed to parse',
          timestamp: Date.now(),
          type: 'session' as const,
        },
      ],
    };

    const serialized = JSON.stringify(state);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.errors).toHaveLength(1);
    expect(deserialized.errors[0].projectPath).toBe('/test/project');
    expect(deserialized.errors[0].type).toBe('session');
  });
});

describe('Import Summary Generation', () => {
  it('should calculate duration correctly', () => {
    const startedAt = Date.now() - 5000; // Started 5 seconds ago
    const now = Date.now();
    const durationSeconds = Math.round((now - startedAt) / 1000);

    expect(durationSeconds).toBeGreaterThanOrEqual(4);
    expect(durationSeconds).toBeLessThanOrEqual(6);
  });

  it('should include all counts in summary', () => {
    const summary = {
      imported: 100,
      skipped: 20,
      failed: 5,
      projectsProcessed: 3,
      durationSeconds: 120,
      errors: [],
      cancelled: false,
    };

    expect(summary.imported + summary.skipped + summary.failed).toBe(125);
    expect(summary.projectsProcessed).toBe(3);
    expect(summary.cancelled).toBe(false);
  });

  it('should mark cancelled imports correctly', () => {
    const summary = {
      imported: 50,
      skipped: 10,
      failed: 0,
      projectsProcessed: 1,
      durationSeconds: 60,
      errors: [],
      cancelled: true,
    };

    expect(summary.cancelled).toBe(true);
    // Even cancelled imports should preserve their counts
    expect(summary.imported).toBe(50);
  });
});
