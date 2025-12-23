/**
 * Session Overlap Detection - Story 16-5: Multi-Terminal Awareness
 *
 * Functions to detect and analyze overlapping (concurrent) sessions.
 * Enables identification of multi-terminal workflows and parallel work patterns.
 */

/**
 * Time range for a session, used for overlap calculations.
 */
export interface SessionTimeRange {
  /** Database UUID of the session */
  id: string;
  /** When the session started */
  startedAt: Date;
  /** When the session ended (null if still active) */
  endedAt: Date | null;
  /** Optional: Context for distinguishing sessions */
  context?: {
    cwd?: string | null;
    git_branch?: string | null;
    project_id?: string | null;
  };
}

/**
 * Information about overlap between two sessions.
 */
export interface OverlapInfo {
  /** ID of the first session */
  session1: string;
  /** ID of the second session */
  session2: string;
  /** When the overlap started */
  overlapStart: Date;
  /** When the overlap ended (null if still overlapping) */
  overlapEnd: Date | null;
  /** Duration of overlap in minutes (null if still overlapping) */
  overlapMinutes: number | null;
}

/**
 * A group of sessions that were active at the same time.
 */
export interface ConcurrentSessionGroup {
  /** Sessions in this concurrent group */
  sessions: SessionTimeRange[];
  /** When the concurrent period started */
  concurrentStart: Date;
  /** When the concurrent period ended (null if still concurrent) */
  concurrentEnd: Date | null;
}

/**
 * Detect overlapping (concurrent) sessions from a list of sessions.
 *
 * Two sessions overlap if one started before the other ended.
 * For active sessions (endedAt = null), we use current time for comparison.
 *
 * @param sessions - Array of session time ranges to analyze
 * @returns Array of overlap information objects
 *
 * @example
 * const sessions = [
 *   { id: 'a', startedAt: new Date('2025-01-15T10:00:00Z'), endedAt: new Date('2025-01-15T12:00:00Z') },
 *   { id: 'b', startedAt: new Date('2025-01-15T11:00:00Z'), endedAt: new Date('2025-01-15T13:00:00Z') },
 * ];
 * const overlaps = detectOverlappingSessions(sessions);
 * // [{ session1: 'a', session2: 'b', overlapStart: 11:00, overlapEnd: 12:00, overlapMinutes: 60 }]
 */
export function detectOverlappingSessions(sessions: SessionTimeRange[]): OverlapInfo[] {
  if (sessions.length < 2) {
    return [];
  }

  const overlaps: OverlapInfo[] = [];
  const now = new Date();

  // Compare each pair of sessions
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const s1 = sessions[i]!;
      const s2 = sessions[j]!;

      // Use current time for active sessions
      const s1End = s1.endedAt ?? now;
      const s2End = s2.endedAt ?? now;

      // Sessions overlap if: start1 < end2 AND start2 < end1
      const hasOverlap = s1.startedAt < s2End && s2.startedAt < s1End;

      if (hasOverlap) {
        // Calculate overlap period
        const overlapStart = new Date(Math.max(s1.startedAt.getTime(), s2.startedAt.getTime()));

        // Overlap ends at the earlier of the two end times
        const actualEnd1 = s1.endedAt;
        const actualEnd2 = s2.endedAt;

        let overlapEnd: Date | null;
        let overlapMinutes: number | null;

        if (actualEnd1 === null && actualEnd2 === null) {
          // Both sessions still active
          overlapEnd = null;
          overlapMinutes = null;
        } else if (actualEnd1 === null) {
          // Only s1 is still active
          overlapEnd = actualEnd2;
          overlapMinutes = Math.round((actualEnd2!.getTime() - overlapStart.getTime()) / 60000);
        } else if (actualEnd2 === null) {
          // Only s2 is still active
          overlapEnd = actualEnd1;
          overlapMinutes = Math.round((actualEnd1.getTime() - overlapStart.getTime()) / 60000);
        } else {
          // Both ended
          overlapEnd = new Date(Math.min(actualEnd1.getTime(), actualEnd2.getTime()));
          overlapMinutes = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
        }

        overlaps.push({
          session1: s1.id,
          session2: s2.id,
          overlapStart,
          overlapEnd,
          overlapMinutes,
        });
      }
    }
  }

  return overlaps;
}

/**
 * Group sessions by concurrent activity periods.
 *
 * Returns groups of sessions that were active at the same time.
 * A session can appear in multiple groups if it overlaps with different
 * sessions at different times.
 *
 * @param sessions - Array of session time ranges to analyze
 * @returns Array of concurrent session groups, sorted by start time
 *
 * @example
 * const groups = groupConcurrentSessions(sessions);
 * groups.forEach(g => {
 *   console.log(`${g.sessions.length} sessions active from ${g.concurrentStart}`);
 * });
 */
export function groupConcurrentSessions(
  sessions: SessionTimeRange[]
): ConcurrentSessionGroup[] {
  if (sessions.length === 0) {
    return [];
  }

  if (sessions.length === 1) {
    const session = sessions[0]!;
    return [
      {
        sessions: [session],
        concurrentStart: session.startedAt,
        concurrentEnd: session.endedAt,
      },
    ];
  }

  // Create events for session starts and ends
  interface TimeEvent {
    time: Date;
    type: "start" | "end";
    sessionId: string;
    session: SessionTimeRange;
  }

  const events: TimeEvent[] = [];
  const now = new Date();

  for (const session of sessions) {
    events.push({
      time: session.startedAt,
      type: "start",
      sessionId: session.id,
      session,
    });

    // Use far future time for active sessions
    const endTime = session.endedAt ?? new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365);
    events.push({
      time: endTime,
      type: "end",
      sessionId: session.id,
      session,
    });
  }

  // Sort events by time, starts before ends at same time
  events.sort((a, b) => {
    const timeDiff = a.time.getTime() - b.time.getTime();
    if (timeDiff !== 0) return timeDiff;
    // Starts come before ends at the same time
    return a.type === "start" ? -1 : 1;
  });

  const groups: ConcurrentSessionGroup[] = [];
  const activeSessions: Map<string, SessionTimeRange> = new Map();
  let groupStart: Date | null = null;

  for (const event of events) {
    if (event.type === "start") {
      // If going from 1 to 2+ sessions, start a new concurrent group
      if (activeSessions.size === 1 && !groupStart) {
        groupStart = event.time;
      } else if (activeSessions.size === 0) {
        groupStart = event.time;
      }
      activeSessions.set(event.sessionId, event.session);
    } else {
      // End event
      if (activeSessions.size >= 2 && groupStart) {
        // Check if this ends a concurrent period
        activeSessions.delete(event.sessionId);

        if (activeSessions.size < 2) {
          // Concurrent period ending - need to capture all sessions that were concurrent
          const sessionsInGroup = Array.from(activeSessions.values());
          sessionsInGroup.push(event.session);

          // Only record if there were actually 2+ sessions
          if (sessionsInGroup.length >= 2) {
            groups.push({
              sessions: sessionsInGroup,
              concurrentStart: groupStart,
              concurrentEnd: event.session.endedAt === null ? null : event.time,
            });
          }
          groupStart = null;
        }
      } else {
        activeSessions.delete(event.sessionId);
      }
    }
  }

  // Handle case where sessions are still concurrent (active)
  if (activeSessions.size >= 2 && groupStart) {
    groups.push({
      sessions: Array.from(activeSessions.values()),
      concurrentStart: groupStart,
      concurrentEnd: null,
    });
  }

  return groups;
}

/**
 * Find session IDs that overlap with a given session.
 *
 * Useful for showing "concurrent with" indicators in the UI.
 *
 * @param sessionId - The session to find overlaps for
 * @param sessions - All sessions to check against
 * @returns Array of session IDs that overlap with the given session
 *
 * @example
 * const concurrentIds = findConcurrentSessionIds('session-a', allSessions);
 * // ['session-b', 'session-c']
 */
export function findConcurrentSessionIds(
  sessionId: string,
  sessions: SessionTimeRange[]
): string[] {
  const overlaps = detectOverlappingSessions(sessions);

  const concurrentIds: Set<string> = new Set();

  for (const overlap of overlaps) {
    if (overlap.session1 === sessionId) {
      concurrentIds.add(overlap.session2);
    } else if (overlap.session2 === sessionId) {
      concurrentIds.add(overlap.session1);
    }
  }

  return Array.from(concurrentIds);
}

/**
 * Calculate the maximum number of concurrent sessions at any point.
 *
 * Useful for analytics and understanding peak concurrency.
 *
 * @param sessions - Array of session time ranges to analyze
 * @returns Maximum concurrent session count
 *
 * @example
 * const maxConcurrency = getMaxConcurrentSessions(sessions);
 * console.log(`Peak concurrency: ${maxConcurrency} terminals`);
 */
export function getMaxConcurrentSessions(sessions: SessionTimeRange[]): number {
  if (sessions.length === 0) {
    return 0;
  }

  // Create events for session starts and ends
  interface TimeEvent {
    time: number;
    delta: number;
  }

  const events: TimeEvent[] = [];
  const now = Date.now();

  for (const session of sessions) {
    events.push({
      time: session.startedAt.getTime(),
      delta: 1,
    });

    const endTime = session.endedAt?.getTime() ?? now;
    events.push({
      time: endTime,
      delta: -1,
    });
  }

  // Sort events by time
  events.sort((a, b) => a.time - b.time);

  let currentCount = 0;
  let maxCount = 0;

  for (const event of events) {
    currentCount += event.delta;
    maxCount = Math.max(maxCount, currentCount);
  }

  return maxCount;
}

/**
 * Check if a session has any concurrent sessions.
 *
 * Quick boolean check without computing full overlap details.
 *
 * @param sessionId - The session to check
 * @param sessions - All sessions to check against
 * @returns true if the session overlaps with any other session
 */
export function hasConcurrentSessions(
  sessionId: string,
  sessions: SessionTimeRange[]
): boolean {
  const target = sessions.find(s => s.id === sessionId);
  if (!target) {
    return false;
  }

  const now = new Date();
  const targetEnd = target.endedAt ?? now;

  for (const other of sessions) {
    if (other.id === sessionId) continue;

    const otherEnd = other.endedAt ?? now;

    // Check for overlap
    if (target.startedAt < otherEnd && other.startedAt < targetEnd) {
      return true;
    }
  }

  return false;
}
