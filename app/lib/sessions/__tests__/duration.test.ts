import { describe, it, expect } from 'vitest';
import {
  calculateSessionDuration,
  formatDuration,
  formatDurationLong,
  calculateInterPromptDuration,
  isSessionStale,
  filterStaleSessions,
  getTotalDuration,
  MAX_SESSION_MINUTES,
} from '../duration';

describe('calculateSessionDuration', () => {
  describe('completed sessions', () => {
    it('should calculate duration for a completed session', () => {
      const result = calculateSessionDuration({
        started_at: '2025-01-15T10:00:00Z',
        ended_at: '2025-01-15T11:30:00Z',
      });

      expect(result.minutes).toBe(90);
      expect(result.hours).toBe(1.5);
      expect(result.formatted).toBe('1h 30m');
      expect(result.isOngoing).toBe(false);
    });

    it('should handle short sessions', () => {
      const result = calculateSessionDuration({
        started_at: '2025-01-15T10:00:00Z',
        ended_at: '2025-01-15T10:05:00Z',
      });

      expect(result.minutes).toBe(5);
      expect(result.formatted).toBe('5m');
    });

    it('should handle exactly one hour', () => {
      const result = calculateSessionDuration({
        started_at: '2025-01-15T10:00:00Z',
        ended_at: '2025-01-15T11:00:00Z',
      });

      expect(result.minutes).toBe(60);
      expect(result.formatted).toBe('1h');
    });

    it('should handle Date objects', () => {
      const result = calculateSessionDuration({
        started_at: new Date('2025-01-15T10:00:00Z'),
        ended_at: new Date('2025-01-15T10:45:00Z'),
      });

      expect(result.minutes).toBe(45);
    });
  });

  describe('active sessions', () => {
    it('should use current time for active sessions', () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

      const result = calculateSessionDuration({
        started_at: startedAt,
        ended_at: null,
      });

      expect(result.minutes).toBe(30);
      expect(result.isOngoing).toBe(true);
    });

    it('should use asOf parameter when provided', () => {
      const result = calculateSessionDuration(
        {
          started_at: '2025-01-15T10:00:00Z',
          ended_at: null,
        },
        new Date('2025-01-15T10:45:00Z')
      );

      expect(result.minutes).toBe(45);
      expect(result.isOngoing).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return 0 for negative duration', () => {
      const result = calculateSessionDuration({
        started_at: '2025-01-15T11:00:00Z',
        ended_at: '2025-01-15T10:00:00Z', // Before start (invalid)
      });

      expect(result.minutes).toBe(0);
    });

    it('should cap duration at 24 hours', () => {
      const result = calculateSessionDuration({
        started_at: '2025-01-15T10:00:00Z',
        ended_at: '2025-01-17T10:00:00Z', // 48 hours later
      });

      expect(result.minutes).toBe(MAX_SESSION_MINUTES);
      expect(result.hours).toBe(24);
    });

    it('should handle same start and end time', () => {
      const result = calculateSessionDuration({
        started_at: '2025-01-15T10:00:00Z',
        ended_at: '2025-01-15T10:00:00Z',
      });

      expect(result.minutes).toBe(0);
      expect(result.formatted).toBe('< 1 min');
    });
  });
});

describe('formatDuration', () => {
  it('should format 0 minutes as "< 1 min"', () => {
    expect(formatDuration(0)).toBe('< 1 min');
  });

  it('should format minutes under 60', () => {
    expect(formatDuration(5)).toBe('5m');
    expect(formatDuration(30)).toBe('30m');
    expect(formatDuration(59)).toBe('59m');
  });

  it('should format exactly 60 minutes as "1h"', () => {
    expect(formatDuration(60)).toBe('1h');
  });

  it('should format hours with remaining minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(125)).toBe('2h 5m');
    expect(formatDuration(180)).toBe('3h');
  });

  it('should handle large durations', () => {
    expect(formatDuration(600)).toBe('10h');
    expect(formatDuration(615)).toBe('10h 15m');
  });
});

describe('formatDurationLong', () => {
  it('should format 0 minutes', () => {
    expect(formatDurationLong(0)).toBe('less than 1 minute');
  });

  it('should format 1 minute singular', () => {
    expect(formatDurationLong(1)).toBe('1 minute');
  });

  it('should format minutes plural', () => {
    expect(formatDurationLong(45)).toBe('45 minutes');
  });

  it('should format 1 hour singular', () => {
    expect(formatDurationLong(60)).toBe('1 hour');
  });

  it('should format hours and minutes', () => {
    expect(formatDurationLong(90)).toBe('1 hour 30 minutes');
    expect(formatDurationLong(121)).toBe('2 hours 1 minute');
    expect(formatDurationLong(180)).toBe('3 hours');
  });
});

describe('calculateInterPromptDuration', () => {
  it('should calculate duration between two prompts', () => {
    const result = calculateInterPromptDuration(
      '2025-01-15T10:00:00Z',
      '2025-01-15T10:15:00Z'
    );

    expect(result).toBe(15);
  });

  it('should return positive value regardless of order', () => {
    const result = calculateInterPromptDuration(
      '2025-01-15T10:15:00Z',
      '2025-01-15T10:00:00Z'
    );

    expect(result).toBe(15);
  });

  it('should handle Date objects', () => {
    const result = calculateInterPromptDuration(
      new Date('2025-01-15T10:00:00Z'),
      new Date('2025-01-15T10:30:00Z')
    );

    expect(result).toBe(30);
  });

  it('should return 0 for same timestamp', () => {
    const result = calculateInterPromptDuration(
      '2025-01-15T10:00:00Z',
      '2025-01-15T10:00:00Z'
    );

    expect(result).toBe(0);
  });
});

describe('isSessionStale', () => {
  it('should return true for sessions exceeding 24 hours', () => {
    const result = isSessionStale({
      started_at: '2025-01-15T10:00:00Z',
      ended_at: '2025-01-17T10:00:00Z', // 48 hours
    });

    expect(result).toBe(true);
  });

  it('should return false for sessions under 24 hours', () => {
    const result = isSessionStale({
      started_at: '2025-01-15T10:00:00Z',
      ended_at: '2025-01-15T20:00:00Z', // 10 hours
    });

    expect(result).toBe(false);
  });

  it('should use asOf for active sessions', () => {
    const now = new Date();
    const startedAt = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

    const result = isSessionStale({
      started_at: startedAt,
      ended_at: null,
    });

    expect(result).toBe(true);
  });
});

describe('filterStaleSessions', () => {
  it('should remove stale sessions', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T12:00:00Z' }, // 2 hours
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-17T10:00:00Z' }, // 48 hours - stale
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T18:00:00Z' }, // 8 hours
    ];

    const result = filterStaleSessions(sessions);

    expect(result).toHaveLength(2);
    expect(result[0]?.ended_at).toBe('2025-01-15T12:00:00Z');
    expect(result[1]?.ended_at).toBe('2025-01-15T18:00:00Z');
  });

  it('should keep all sessions if none are stale', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' },
      { started_at: '2025-01-15T12:00:00Z', ended_at: '2025-01-15T13:00:00Z' },
    ];

    const result = filterStaleSessions(sessions);

    expect(result).toHaveLength(2);
  });

  it('should handle empty array', () => {
    expect(filterStaleSessions([])).toEqual([]);
  });
});

describe('getTotalDuration', () => {
  it('should sum up all session durations', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' }, // 60 min
      { started_at: '2025-01-15T12:00:00Z', ended_at: '2025-01-15T13:30:00Z' }, // 90 min
    ];

    const result = getTotalDuration(sessions);

    expect(result).toBe(150);
  });

  it('should exclude stale sessions by default', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' }, // 60 min
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-17T10:00:00Z' }, // 48 hours - stale
    ];

    const result = getTotalDuration(sessions);

    expect(result).toBe(60);
  });

  it('should include stale sessions when excludeStale is false', () => {
    const sessions = [
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' }, // 60 min
      { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-17T10:00:00Z' }, // 48 hours (capped to 24h = 1440 min)
    ];

    const result = getTotalDuration(sessions, { excludeStale: false });

    expect(result).toBe(60 + MAX_SESSION_MINUTES);
  });

  it('should return 0 for empty array', () => {
    expect(getTotalDuration([])).toBe(0);
  });
});
