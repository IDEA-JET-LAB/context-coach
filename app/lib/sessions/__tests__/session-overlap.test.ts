/**
 * Session Overlap Tests - Story 16-5: Multi-Terminal Awareness
 */

import { describe, it, expect } from 'vitest';
import {
  detectOverlappingSessions,
  groupConcurrentSessions,
  findConcurrentSessionIds,
  getMaxConcurrentSessions,
  hasConcurrentSessions,
  type SessionTimeRange,
} from '../session-overlap';

describe('detectOverlappingSessions', () => {
  it('should return empty array for empty input', () => {
    const result = detectOverlappingSessions([]);
    expect(result).toEqual([]);
  });

  it('should return empty array for single session', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
    ];

    const result = detectOverlappingSessions(sessions);
    expect(result).toEqual([]);
  });

  it('should detect overlap between two sessions', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
    ];

    const result = detectOverlappingSessions(sessions);

    expect(result).toHaveLength(1);
    expect(result[0]!.session1).toBe('a');
    expect(result[0]!.session2).toBe('b');
    expect(result[0]!.overlapStart).toEqual(new Date('2025-01-15T11:00:00Z'));
    expect(result[0]!.overlapEnd).toEqual(new Date('2025-01-15T12:00:00Z'));
    expect(result[0]!.overlapMinutes).toBe(60);
  });

  it('should not detect overlap for non-overlapping sessions', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T11:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T12:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
    ];

    const result = detectOverlappingSessions(sessions);
    expect(result).toHaveLength(0);
  });

  it('should handle adjacent sessions (no gap, no overlap)', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T11:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
    ];

    const result = detectOverlappingSessions(sessions);
    expect(result).toHaveLength(0);
  });

  it('should detect overlap with active session (null endedAt)', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: null, // Still active
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
    ];

    const result = detectOverlappingSessions(sessions);

    expect(result).toHaveLength(1);
    expect(result[0]!.overlapEnd).toEqual(new Date('2025-01-15T13:00:00Z'));
    // Overlap is from 11:00 to 13:00 = 120 minutes
    expect(result[0]!.overlapMinutes).toBe(120);
  });

  it('should handle two active sessions overlapping', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: null,
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: null,
      },
    ];

    const result = detectOverlappingSessions(sessions);

    expect(result).toHaveLength(1);
    expect(result[0]!.overlapEnd).toBeNull();
    expect(result[0]!.overlapMinutes).toBeNull();
  });

  it('should detect multiple overlaps', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T14:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
      {
        id: 'c',
        startedAt: new Date('2025-01-15T12:00:00Z'),
        endedAt: new Date('2025-01-15T15:00:00Z'),
      },
    ];

    const result = detectOverlappingSessions(sessions);

    // a overlaps b, a overlaps c, b overlaps c
    expect(result).toHaveLength(3);

    const overlap_ab = result.find(o => o.session1 === 'a' && o.session2 === 'b');
    const overlap_ac = result.find(o => o.session1 === 'a' && o.session2 === 'c');
    const overlap_bc = result.find(o => o.session1 === 'b' && o.session2 === 'c');

    expect(overlap_ab).toBeDefined();
    expect(overlap_ac).toBeDefined();
    expect(overlap_bc).toBeDefined();
  });

  it('should handle session contained within another', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'outer',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T16:00:00Z'),
      },
      {
        id: 'inner',
        startedAt: new Date('2025-01-15T12:00:00Z'),
        endedAt: new Date('2025-01-15T14:00:00Z'),
      },
    ];

    const result = detectOverlappingSessions(sessions);

    expect(result).toHaveLength(1);
    expect(result[0]!.overlapStart).toEqual(new Date('2025-01-15T12:00:00Z'));
    expect(result[0]!.overlapEnd).toEqual(new Date('2025-01-15T14:00:00Z'));
    expect(result[0]!.overlapMinutes).toBe(120);
  });
});

describe('findConcurrentSessionIds', () => {
  it('should return empty array for session with no overlaps', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T11:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T12:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
    ];

    const result = findConcurrentSessionIds('a', sessions);
    expect(result).toEqual([]);
  });

  it('should return concurrent session IDs', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T14:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
      {
        id: 'c',
        startedAt: new Date('2025-01-15T12:00:00Z'),
        endedAt: new Date('2025-01-15T15:00:00Z'),
      },
    ];

    const result = findConcurrentSessionIds('a', sessions);
    expect(result).toContain('b');
    expect(result).toContain('c');
    expect(result).toHaveLength(2);
  });

  it('should return empty for non-existent session', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
    ];

    const result = findConcurrentSessionIds('x', sessions);
    expect(result).toEqual([]);
  });
});

describe('getMaxConcurrentSessions', () => {
  it('should return 0 for empty input', () => {
    expect(getMaxConcurrentSessions([])).toBe(0);
  });

  it('should return 1 for single session', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
    ];

    expect(getMaxConcurrentSessions(sessions)).toBe(1);
  });

  it('should return 2 for two overlapping sessions', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
    ];

    expect(getMaxConcurrentSessions(sessions)).toBe(2);
  });

  it('should return correct max for three sessions with peak of 3', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T14:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: new Date('2025-01-15T15:00:00Z'),
      },
      {
        id: 'c',
        startedAt: new Date('2025-01-15T12:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
    ];

    // At 12:00-13:00, all three sessions are active
    expect(getMaxConcurrentSessions(sessions)).toBe(3);
  });

  it('should return 2 for non-overlapping pairs', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T11:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T12:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
      {
        id: 'c',
        startedAt: new Date('2025-01-15T14:00:00Z'),
        endedAt: new Date('2025-01-15T15:00:00Z'),
      },
    ];

    // Never more than 1 session active at a time
    expect(getMaxConcurrentSessions(sessions)).toBe(1);
  });
});

describe('hasConcurrentSessions', () => {
  it('should return false for session with no overlaps', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T11:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T12:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
    ];

    expect(hasConcurrentSessions('a', sessions)).toBe(false);
    expect(hasConcurrentSessions('b', sessions)).toBe(false);
  });

  it('should return true for session with overlaps', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
    ];

    expect(hasConcurrentSessions('a', sessions)).toBe(true);
    expect(hasConcurrentSessions('b', sessions)).toBe(true);
  });

  it('should return false for non-existent session', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
    ];

    expect(hasConcurrentSessions('x', sessions)).toBe(false);
  });
});

describe('groupConcurrentSessions', () => {
  it('should return empty array for empty input', () => {
    const result = groupConcurrentSessions([]);
    expect(result).toEqual([]);
  });

  it('should return single group for single session', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
    ];

    const result = groupConcurrentSessions(sessions);

    expect(result).toHaveLength(1);
    expect(result[0]!.sessions).toHaveLength(1);
    expect(result[0]!.sessions[0]!.id).toBe('a');
  });

  it('should group overlapping sessions', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: new Date('2025-01-15T12:00:00Z'),
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: new Date('2025-01-15T13:00:00Z'),
      },
    ];

    const result = groupConcurrentSessions(sessions);

    // Should have at least one group with both sessions
    const groupWithBoth = result.find(
      g => g.sessions.length >= 2 &&
           g.sessions.some(s => s.id === 'a') &&
           g.sessions.some(s => s.id === 'b')
    );

    expect(groupWithBoth).toBeDefined();
  });

  it('should handle currently active concurrent sessions', () => {
    const sessions: SessionTimeRange[] = [
      {
        id: 'a',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        endedAt: null, // Still active
      },
      {
        id: 'b',
        startedAt: new Date('2025-01-15T11:00:00Z'),
        endedAt: null, // Still active
      },
    ];

    const result = groupConcurrentSessions(sessions);

    // Should have a group where concurrentEnd is null (still active)
    const activeGroup = result.find(g => g.concurrentEnd === null);

    expect(activeGroup).toBeDefined();
    expect(activeGroup?.sessions).toHaveLength(2);
  });
});
