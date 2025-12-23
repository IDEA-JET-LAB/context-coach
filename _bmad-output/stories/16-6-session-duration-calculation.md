# Story 16-6: Session Duration Calculation

Status: ✅ COMPLETED (2025-12-23)

## PRD Alignment Note

This story was added for modularity beyond the PRD's original 4 stories for Epic 16. The PRD covers session schema, detection, metadata, and threading. Duration calculation was separated into its own story because:
1. Duration metrics are a distinct concern from session detection
2. Aggregate calculations and summaries require dedicated SQL functions
3. Efficiency metrics build on top of basic session data
4. This separation allows parallel development with Story 16-4 and 16-5

## Story

**As a** user analyzing my productivity,
**I want** accurate session duration metrics,
**So that** I can understand how much time I spend in AI-assisted development sessions.

## Dependencies

This story requires:
- Story 16-1: Sessions Database Schema (sessions table with timing columns)
- Story 16-3: Session Metadata Capture (started_at, ended_at values)
- Story 16-5: Multi-Terminal Awareness (handling concurrent sessions)

## Acceptance Criteria

**AC 1: Basic Duration Calculation**
- **Given** a session with `started_at` and `ended_at`
- **When** the duration is calculated
- **Then** the result is in minutes (rounded)
- **And** the calculation handles timezone differences correctly

**AC 2: Active Session Duration**
- **Given** an active session (ended_at is NULL)
- **When** the duration is requested
- **Then** the duration is calculated from `started_at` to now
- **And** the result is marked as "ongoing"

**AC 3: Session Duration Aggregates**
- **Given** multiple sessions for a user
- **When** aggregate metrics are requested
- **Then** the following are available:
  - Total session time (sum of all durations)
  - Average session duration
  - Longest session
  - Shortest session

**AC 4: Daily/Weekly/Monthly Summaries**
- **Given** sessions over a time period
- **When** summary metrics are requested
- **Then** durations are grouped by day/week/month
- **And** each period shows total time and session count

**AC 5: Session Duration by Context**
- **Given** sessions with different contexts (project, branch)
- **When** duration analysis is performed
- **Then** time can be broken down by:
  - Project
  - Git branch
  - Hour of day
  - Day of week

**AC 6: Efficiency Metrics**
- **Given** session duration and prompt count
- **When** efficiency metrics are calculated
- **Then** the following are available:
  - Prompts per hour
  - Average time between prompts
  - Session "density" (active time vs total time)

## Tasks / Subtasks

- [ ] **Task 1: Create duration calculation utilities** (AC: #1, #2)
  - [ ] Create `lib/sessions/duration.ts`
  - [ ] Implement `calculateSessionDuration(session: Session): DurationResult`
  - [ ] Handle null `ended_at` for active sessions
  - [ ] Return both minutes and formatted string

- [ ] **Task 2: Implement aggregate calculations** (AC: #3)
  - [ ] Create `lib/sessions/duration-aggregates.ts`
  - [ ] Implement `getSessionDurationStats(userId: string, dateRange?: DateRange)`
  - [ ] Calculate sum, average, min, max
  - [ ] Exclude outliers option for average

- [ ] **Task 3: Create time-period summaries** (AC: #4)
  - [ ] Implement `getDailySummary(userId: string, days: number)`
  - [ ] Implement `getWeeklySummary(userId: string, weeks: number)`
  - [ ] Implement `getMonthlySummary(userId: string, months: number)`
  - [ ] Use database aggregation for efficiency

- [ ] **Task 4: Implement context-based breakdown** (AC: #5)
  - [ ] Create `lib/sessions/duration-breakdown.ts`
  - [ ] Implement `getDurationByProject(userId: string)`
  - [ ] Implement `getDurationByBranch(userId: string)`
  - [ ] Implement `getDurationByTimeOfDay(userId: string)`

- [ ] **Task 5: Create efficiency metrics** (AC: #6)
  - [ ] Create `lib/sessions/efficiency.ts`
  - [ ] Implement `calculatePromptsPerHour(session: Session)`
  - [ ] Implement `calculateAverageTimeBetweenPrompts(session: Session)`
  - [ ] Implement `calculateSessionDensity(session: Session)`

- [ ] **Task 6: Create duration API endpoint** (AC: #1-6)
  - [ ] Create `app/api/analytics/sessions/duration/route.ts`
  - [ ] Support various aggregation levels
  - [ ] Include all calculated metrics
  - [ ] Add caching for expensive calculations

- [ ] **Task 7: Add database views/functions** (AC: #3, #4)
  - [ ] Create `session_duration_view` materialized view
  - [ ] Create `refresh_session_duration_view()` function
  - [ ] Schedule periodic refresh

- [ ] **Task 8: Add comprehensive tests** (AC: #1-6)
  - [ ] Test duration calculation edge cases
  - [ ] Test aggregate accuracy
  - [ ] Test timezone handling
  - [ ] Test efficiency calculations

## Dev Notes

### Duration Calculation Utilities

```typescript
// lib/sessions/duration.ts

export interface DurationResult {
  minutes: number;
  hours: number;
  formatted: string;
  isOngoing: boolean;
}

export interface SessionTimings {
  started_at: string;
  ended_at: string | null;
}

/**
 * Calculate session duration.
 * For active sessions, calculates from started_at to now.
 */
export function calculateSessionDuration(
  session: SessionTimings,
  asOf: Date = new Date()
): DurationResult {
  const startedAt = new Date(session.started_at);
  const endedAt = session.ended_at ? new Date(session.ended_at) : asOf;

  const durationMs = endedAt.getTime() - startedAt.getTime();
  const minutes = Math.round(durationMs / 60000);
  const hours = minutes / 60;

  return {
    minutes,
    hours: Math.round(hours * 100) / 100, // 2 decimal places
    formatted: formatDuration(minutes),
    isOngoing: session.ended_at === null,
  };
}

/**
 * Format duration in minutes to human-readable string.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return '< 1 min';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Calculate duration between two prompts in a session.
 */
export function calculateInterPromptDuration(
  prompt1CreatedAt: string,
  prompt2CreatedAt: string
): number {
  const t1 = new Date(prompt1CreatedAt).getTime();
  const t2 = new Date(prompt2CreatedAt).getTime();
  return Math.abs(t2 - t1) / 60000; // minutes
}
```

### Duration Aggregates

```typescript
// lib/sessions/duration-aggregates.ts

import { createServerClient } from '@/lib/supabase/server';

export interface DurationStats {
  totalMinutes: number;
  totalHours: number;
  averageMinutes: number;
  longestMinutes: number;
  shortestMinutes: number;
  sessionCount: number;
  activeCount: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Get duration statistics for a user's sessions.
 */
export async function getSessionDurationStats(
  userId: string,
  dateRange?: DateRange
): Promise<DurationStats> {
  const supabase = await createServerClient();

  let query = supabase
    .from('sessions')
    .select('started_at, ended_at')
    .eq('user_id', userId);

  if (dateRange) {
    query = query
      .gte('started_at', dateRange.start.toISOString())
      .lte('started_at', dateRange.end.toISOString());
  }

  const { data: sessions, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  if (!sessions || sessions.length === 0) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      averageMinutes: 0,
      longestMinutes: 0,
      shortestMinutes: 0,
      sessionCount: 0,
      activeCount: 0,
    };
  }

  const now = new Date();
  const durations: number[] = [];
  let activeCount = 0;

  for (const session of sessions) {
    const startedAt = new Date(session.started_at);
    const endedAt = session.ended_at ? new Date(session.ended_at) : now;

    if (!session.ended_at) {
      activeCount++;
    }

    const durationMinutes = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 60000
    );

    // Filter out unreasonable durations (> 24 hours likely indicates stale session)
    if (durationMinutes <= 24 * 60) {
      durations.push(durationMinutes);
    }
  }

  const totalMinutes = durations.reduce((sum, d) => sum + d, 0);
  const sortedDurations = [...durations].sort((a, b) => a - b);

  return {
    totalMinutes,
    totalHours: Math.round(totalMinutes / 60 * 100) / 100,
    averageMinutes: durations.length > 0
      ? Math.round(totalMinutes / durations.length)
      : 0,
    longestMinutes: sortedDurations[sortedDurations.length - 1] ?? 0,
    shortestMinutes: sortedDurations[0] ?? 0,
    sessionCount: sessions.length,
    activeCount,
  };
}

/**
 * Get trimmed mean (excluding top/bottom 10%) for more accurate average.
 */
export function calculateTrimmedMean(
  durations: number[],
  trimPercent: number = 0.1
): number {
  if (durations.length < 5) {
    // Not enough data to trim
    return durations.reduce((a, b) => a + b, 0) / durations.length || 0;
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trimPercent);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);

  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}
```

### Time Period Summaries

```typescript
// lib/sessions/duration-summaries.ts

import { createServerClient } from '@/lib/supabase/server';

export interface PeriodSummary {
  period: string; // ISO date or period identifier
  periodLabel: string; // Human-readable label
  totalMinutes: number;
  sessionCount: number;
  averageMinutes: number;
}

/**
 * Get daily session summaries.
 */
export async function getDailySummary(
  userId: string,
  days: number = 30
): Promise<PeriodSummary[]> {
  const supabase = await createServerClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .rpc('get_session_duration_by_day', {
      p_user_id: userId,
      p_start_date: startDate.toISOString(),
    });

  if (error) {
    throw new Error(`Failed to fetch daily summary: ${error.message}`);
  }

  return (data ?? []).map((row: {
    day: string;
    total_minutes: number;
    session_count: number;
  }) => ({
    period: row.day,
    periodLabel: formatDateLabel(new Date(row.day)),
    totalMinutes: row.total_minutes,
    sessionCount: row.session_count,
    averageMinutes: row.session_count > 0
      ? Math.round(row.total_minutes / row.session_count)
      : 0,
  }));
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get weekly session summaries.
 */
export async function getWeeklySummary(
  userId: string,
  weeks: number = 12
): Promise<PeriodSummary[]> {
  const supabase = await createServerClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);

  const { data, error } = await supabase
    .rpc('get_session_duration_by_week', {
      p_user_id: userId,
      p_start_date: startDate.toISOString(),
    });

  if (error) {
    throw new Error(`Failed to fetch weekly summary: ${error.message}`);
  }

  return (data ?? []).map((row: {
    week_start: string;
    total_minutes: number;
    session_count: number;
  }) => ({
    period: row.week_start,
    periodLabel: `Week of ${new Date(row.week_start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}`,
    totalMinutes: row.total_minutes,
    sessionCount: row.session_count,
    averageMinutes: row.session_count > 0
      ? Math.round(row.total_minutes / row.session_count)
      : 0,
  }));
}

/**
 * Get monthly session summaries.
 */
export async function getMonthlySummary(
  userId: string,
  months: number = 12
): Promise<PeriodSummary[]> {
  const supabase = await createServerClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data, error } = await supabase
    .rpc('get_session_duration_by_month', {
      p_user_id: userId,
      p_start_date: startDate.toISOString(),
    });

  if (error) {
    throw new Error(`Failed to fetch monthly summary: ${error.message}`);
  }

  return (data ?? []).map((row: {
    month_start: string;
    total_minutes: number;
    session_count: number;
  }) => ({
    period: row.month_start,
    periodLabel: new Date(row.month_start).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
    totalMinutes: row.total_minutes,
    sessionCount: row.session_count,
    averageMinutes: row.session_count > 0
      ? Math.round(row.total_minutes / row.session_count)
      : 0,
  }));
}
```

### Database Functions for Summaries

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_session_duration_functions.sql

-- Daily duration aggregation
CREATE OR REPLACE FUNCTION get_session_duration_by_day(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ
)
RETURNS TABLE (
  day DATE,
  total_minutes INTEGER,
  session_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(s.started_at) as day,
    SUM(
      EXTRACT(EPOCH FROM (
        COALESCE(s.ended_at, NOW()) - s.started_at
      )) / 60
    )::INTEGER as total_minutes,
    COUNT(*)::INTEGER as session_count
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.started_at >= p_start_date
  GROUP BY DATE(s.started_at)
  ORDER BY day DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Weekly duration aggregation
CREATE OR REPLACE FUNCTION get_session_duration_by_week(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ
)
RETURNS TABLE (
  week_start DATE,
  total_minutes INTEGER,
  session_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('week', s.started_at)::DATE as week_start,
    SUM(
      EXTRACT(EPOCH FROM (
        COALESCE(s.ended_at, NOW()) - s.started_at
      )) / 60
    )::INTEGER as total_minutes,
    COUNT(*)::INTEGER as session_count
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.started_at >= p_start_date
  GROUP BY DATE_TRUNC('week', s.started_at)
  ORDER BY week_start DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monthly duration aggregation
CREATE OR REPLACE FUNCTION get_session_duration_by_month(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ
)
RETURNS TABLE (
  month_start DATE,
  total_minutes INTEGER,
  session_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', s.started_at)::DATE as month_start,
    SUM(
      EXTRACT(EPOCH FROM (
        COALESCE(s.ended_at, NOW()) - s.started_at
      )) / 60
    )::INTEGER as total_minutes,
    COUNT(*)::INTEGER as session_count
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.started_at >= p_start_date
  GROUP BY DATE_TRUNC('month', s.started_at)
  ORDER BY month_start DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_session_duration_by_day(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_duration_by_week(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_duration_by_month(UUID, TIMESTAMPTZ) TO authenticated;
```

### Efficiency Metrics

```typescript
// lib/sessions/efficiency.ts

import { createServerClient } from '@/lib/supabase/server';

export interface EfficiencyMetrics {
  promptsPerHour: number;
  averageTimeBetweenPrompts: number; // minutes
  sessionDensity: number; // 0-1 (ratio of "active" time)
  peakHour: number; // 0-23
}

/**
 * Calculate prompts per hour for a session.
 */
export function calculatePromptsPerHour(
  totalPrompts: number,
  durationMinutes: number
): number {
  if (durationMinutes === 0) return 0;
  return Math.round((totalPrompts / durationMinutes) * 60 * 100) / 100;
}

/**
 * Calculate average time between prompts.
 */
export async function calculateAverageTimeBetweenPrompts(
  sessionUuid: string
): Promise<number> {
  const supabase = await createServerClient();

  const { data: prompts, error } = await supabase
    .from('prompts')
    .select('created_at')
    .eq('session_uuid', sessionUuid)
    .order('created_at', { ascending: true });

  if (error || !prompts || prompts.length < 2) {
    return 0;
  }

  let totalGap = 0;
  for (let i = 1; i < prompts.length; i++) {
    const prev = new Date(prompts[i - 1].created_at).getTime();
    const curr = new Date(prompts[i].created_at).getTime();
    totalGap += (curr - prev) / 60000; // minutes
  }

  return Math.round(totalGap / (prompts.length - 1));
}

/**
 * Calculate session density.
 * Density = active time / total time
 * Active time is estimated as sum of (prompt duration + thinking time)
 */
export async function calculateSessionDensity(
  sessionUuid: string,
  sessionDurationMinutes: number
): Promise<number> {
  if (sessionDurationMinutes === 0) return 0;

  const supabase = await createServerClient();

  const { data: prompts, error } = await supabase
    .from('prompts')
    .select('created_at, char_count')
    .eq('session_uuid', sessionUuid)
    .order('created_at', { ascending: true });

  if (error || !prompts || prompts.length === 0) {
    return 0;
  }

  // Estimate active time:
  // - Each prompt takes ~30 seconds to compose (per 100 chars)
  // - Response reading takes ~60 seconds average
  let estimatedActiveMinutes = 0;

  for (const prompt of prompts) {
    const compositionTime = (prompt.char_count / 100) * 0.5; // minutes
    const readingTime = 1; // minute average
    estimatedActiveMinutes += compositionTime + readingTime;
  }

  const density = Math.min(1, estimatedActiveMinutes / sessionDurationMinutes);
  return Math.round(density * 100) / 100;
}

/**
 * Find peak usage hour.
 */
export async function findPeakHour(userId: string): Promise<number> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .rpc('get_prompt_count_by_hour', { p_user_id: userId });

  if (error || !data || data.length === 0) {
    return 9; // Default to 9 AM
  }

  let maxCount = 0;
  let peakHour = 9;

  for (const row of data as { hour: number; prompt_count: number }[]) {
    if (row.prompt_count > maxCount) {
      maxCount = row.prompt_count;
      peakHour = row.hour;
    }
  }

  return peakHour;
}
```

### Duration API Endpoint

```typescript
// app/api/analytics/sessions/duration/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getSessionDurationStats } from '@/lib/sessions/duration-aggregates';
import { getDailySummary, getWeeklySummary, getMonthlySummary } from '@/lib/sessions/duration-summaries';

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();

  // Authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') ?? 'daily';
  const count = parseInt(searchParams.get('count') ?? '30', 10);

  try {
    const stats = await getSessionDurationStats(user.id);

    let periodData;
    if (period === 'monthly') {
      periodData = await getMonthlySummary(user.id, count);
    } else if (period === 'weekly') {
      periodData = await getWeeklySummary(user.id, count);
    } else {
      periodData = await getDailySummary(user.id, count);
    }

    return NextResponse.json({
      data: {
        overall: stats,
        byPeriod: periodData,
      },
    });
  } catch (error) {
    console.error('[API] session duration error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate duration' } },
      { status: 500 }
    );
  }
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Duration Utils | `app/lib/sessions/duration.ts` |
| Duration Aggregates | `app/lib/sessions/duration-aggregates.ts` |
| Duration Summaries | `app/lib/sessions/duration-summaries.ts` |
| Efficiency Metrics | `app/lib/sessions/efficiency.ts` |
| Duration Functions | `app/supabase/migrations/YYYYMMDDHHMMSS_session_duration_functions.sql` |
| Duration API | `app/app/api/analytics/sessions/duration/route.ts` |

### Testing Guidance

**Duration Calculation Tests:**
```typescript
describe('calculateSessionDuration', () => {
  it('calculates duration for ended session', () => {
    const session = {
      started_at: '2025-01-01T10:00:00Z',
      ended_at: '2025-01-01T11:30:00Z',
    };
    const result = calculateSessionDuration(session);
    expect(result.minutes).toBe(90);
    expect(result.hours).toBe(1.5);
    expect(result.formatted).toBe('1h 30m');
    expect(result.isOngoing).toBe(false);
  });

  it('calculates duration for active session', () => {
    const now = new Date();
    const startedAt = new Date(now.getTime() - 45 * 60000); // 45 min ago
    const session = {
      started_at: startedAt.toISOString(),
      ended_at: null,
    };
    const result = calculateSessionDuration(session, now);
    expect(result.minutes).toBe(45);
    expect(result.isOngoing).toBe(true);
  });
});

describe('formatDuration', () => {
  it('formats minutes under 60', () => {
    expect(formatDuration(45)).toBe('45 min');
  });

  it('formats hours without remainder', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats hours with minutes', () => {
    expect(formatDuration(135)).toBe('2h 15m');
  });
});
```

**Aggregate Tests:**
```typescript
describe('getSessionDurationStats', () => {
  it('calculates correct totals', async () => {
    // Setup: Create sessions with known durations
    const stats = await getSessionDurationStats(userId);
    expect(stats.sessionCount).toBe(3);
    expect(stats.totalMinutes).toBe(180); // 3 sessions x 60 min
  });

  it('excludes unreasonably long sessions', async () => {
    // Setup: Create a 48-hour session (stale)
    const stats = await getSessionDurationStats(userId);
    expect(stats.longestMinutes).toBeLessThanOrEqual(24 * 60);
  });
});
```

**Period Summary Tests (AC4):**
```typescript
describe('getDailySummary', () => {
  it('groups sessions by date correctly', async () => {
    // Setup: Create sessions on different days
    const summaries = await getDailySummary(userId, 7);
    expect(summaries).toHaveLength(3); // 3 days with sessions
    expect(summaries[0].periodLabel).toMatch(/Today|Yesterday|\w+, \w+ \d+/);
  });

  it('calculates per-day averages', async () => {
    // Setup: Day 1 has 2 sessions (60 min each), Day 2 has 1 session (30 min)
    const summaries = await getDailySummary(userId, 7);
    const day1 = summaries.find(s => s.sessionCount === 2);
    expect(day1?.averageMinutes).toBe(60);
  });
});

describe('getWeeklySummary', () => {
  it('groups by week starting Monday', async () => {
    const summaries = await getWeeklySummary(userId, 4);
    summaries.forEach(s => {
      expect(s.periodLabel).toMatch(/^Week of \w+ \d+$/);
    });
  });
});

describe('getMonthlySummary', () => {
  it('groups by calendar month', async () => {
    const summaries = await getMonthlySummary(userId, 3);
    summaries.forEach(s => {
      expect(s.periodLabel).toMatch(/^\w+ \d{4}$/); // e.g., "January 2025"
    });
  });

  it('handles month boundaries correctly', async () => {
    // Setup: Sessions on Dec 31 and Jan 1
    const summaries = await getMonthlySummary(userId, 2);
    expect(summaries.length).toBeGreaterThanOrEqual(2);
  });
});
```

**Context Breakdown Tests (AC5):**
```typescript
describe('getDurationByProject', () => {
  it('breaks down time by project', async () => {
    // Setup: Sessions with different project_id values
    const breakdown = await getDurationByProject(userId);
    expect(breakdown).toContainEqual(
      expect.objectContaining({
        projectId: expect.any(String),
        totalMinutes: expect.any(Number),
        sessionCount: expect.any(Number),
      })
    );
  });
});

describe('getDurationByBranch', () => {
  it('groups time by git branch', async () => {
    // Setup: Sessions with branch metadata
    const breakdown = await getDurationByBranch(userId);
    expect(breakdown.some(b => b.branch === 'main')).toBe(true);
  });
});

describe('getDurationByTimeOfDay', () => {
  it('groups sessions into hour buckets (0-23)', async () => {
    const breakdown = await getDurationByTimeOfDay(userId);
    breakdown.forEach(b => {
      expect(b.hour).toBeGreaterThanOrEqual(0);
      expect(b.hour).toBeLessThanOrEqual(23);
    });
  });

  it('identifies peak productivity hours', async () => {
    const breakdown = await getDurationByTimeOfDay(userId);
    const sorted = [...breakdown].sort((a, b) => b.sessionCount - a.sessionCount);
    expect(sorted[0].hour).toBeDefined(); // Peak hour exists
  });
});
```

### Common Pitfalls to Avoid

1. **DO NOT** forget timezone handling - always use ISO strings with Z suffix
2. **DO NOT** count active sessions with 24+ hours as valid duration data
3. **DO NOT** divide by zero when no sessions exist
4. **DO NOT** calculate duration client-side for large datasets - use database aggregation
5. **DO NOT** include ongoing sessions in "shortest session" calculations

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Completion Notes List
*To be filled by dev agent after implementation*

### Change Log
| Date | Change | Author |
|------|--------|--------|

### File List
*To be filled by dev agent - list all files created/modified*
