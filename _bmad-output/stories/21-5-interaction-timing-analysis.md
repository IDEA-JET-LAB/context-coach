# Story 21.5: Interaction Timing Analysis

Status: Ready

## Story

**As a** developer using Contextor,
**I want** the time between my prompts tracked and analyzed for patterns,
**So that** I can understand my prompting rhythm and identify rapid-fire or long-pause patterns.

## Acceptance Criteria

1. **Given** a prompt is captured within a session
   **When** timing analysis runs
   **Then** the time since the previous prompt (in seconds) is calculated and stored

2. **Given** a prompt is submitted less than 30 seconds after the previous prompt
   **When** analyzed
   **Then** `is_rapid_fire` is set to true

3. **Given** a prompt is submitted more than 5 minutes (300 seconds) after the previous prompt
   **When** analyzed
   **Then** `is_long_pause` is set to true

4. **Given** a prompt starts with "also", "and", "additionally", "now", "next", "then"
   **When** analyzed
   **Then** `is_follow_up` is set to true

5. **Given** prompts are captured within a session
   **When** each is processed
   **Then** it receives an incrementing `sequence_number` within that session

6. **Given** this is the first prompt in a session
   **When** timing analysis runs
   **Then** `time_since_previous_seconds` is null and `sequence_number` is 1

7. **Given** any prompt
   **When** timing analysis runs
   **Then** it completes in under 1ms

8. **Given** a user or session has multiple prompts
   **When** interval statistics are requested
   **Then** the average time between prompts (in seconds) is calculated and returned

9. **Given** a user or session has multiple prompts
   **When** interval statistics are requested
   **Then** the median time between prompts (in seconds) is calculated and returned

10. **Given** prompts are captured with timestamps throughout the day
    **When** productivity patterns are analyzed
    **Then** time-of-day distribution is calculated showing morning (6am-12pm), afternoon (12pm-6pm), evening (6pm-12am), and night (12am-6am) activity levels

## Tasks / Subtasks

- [ ] **Task 1: Database Schema Updates** (AC: #1, #2, #3, #4, #5)
  - [ ] Add `time_since_previous_seconds INTEGER` to prompts table
  - [ ] Add `is_rapid_fire BOOLEAN DEFAULT false` to prompts table
  - [ ] Add `is_long_pause BOOLEAN DEFAULT false` to prompts table
  - [ ] Add `is_follow_up BOOLEAN DEFAULT false` to prompts table
  - [ ] Add `sequence_number INTEGER` to prompts table
  - [ ] Add composite index on (session_id, sequence_number)
  - [ ] Add partial index for rapid_fire queries

- [ ] **Task 2: Implement Timing Analyzer** (AC: #1, #2, #3, #4, #6, #7)
  - [ ] Create `/app/lib/analysis/timing-analyzer.ts`
  - [ ] Define `TimingMetrics` interface
  - [ ] Define timing constants (RAPID_FIRE_THRESHOLD = 30, LONG_PAUSE_THRESHOLD = 300)
  - [ ] Implement `analyzeTimingWithContext()` function
  - [ ] Implement follow-up detection with pattern matching

- [ ] **Task 3: Define Follow-up Patterns** (AC: #4)
  - [ ] Pattern: /^(also|and|additionally|furthermore)/i
  - [ ] Pattern: /^(now|next|then)/i
  - [ ] Pattern: /^(one more thing|another thing)/i
  - [ ] Pattern: /^(oh|wait)/i

- [ ] **Task 4: Integrate into Capture Flow** (AC: #1, #5, #6)
  - [ ] Query previous prompt timestamp in session before insert
  - [ ] Calculate time difference in seconds
  - [ ] Determine sequence_number from MAX(sequence_number) + 1 in session
  - [ ] Handle first prompt case (null previous, sequence = 1)
  - [ ] Store all timing metrics

- [ ] **Task 5: Database Trigger (Optional Optimization)** (AC: #1, #5)
  - [ ] Create `analyze_prompt_timing()` trigger function
  - [ ] Calculate timing metrics in BEFORE INSERT trigger
  - [ ] Ensure idempotency for re-inserts

- [ ] **Task 6: Implement Interval Aggregations** (AC: #8, #9)
  - [ ] Create `calculateAverageInterval()` function for user/session
  - [ ] Create `calculateMedianInterval()` function for user/session
  - [ ] Add SQL functions for AVG and percentile_cont calculations
  - [ ] Create `/app/lib/analysis/interval-stats.ts`
  - [ ] Add API endpoint for interval statistics

- [ ] **Task 7: Implement Productivity Patterns Analysis** (AC: #10)
  - [ ] Create `analyzeTimeOfDayDistribution()` function
  - [ ] Define time-of-day buckets (morning, afternoon, evening, night)
  - [ ] Create SQL view/function for hourly distribution
  - [ ] Calculate peak productivity hours
  - [ ] Create `/app/lib/analysis/productivity-patterns.ts`

- [ ] **Task 8: Testing** (AC: #2, #3, #4, #6, #7, #8, #9, #10)
  - [ ] Write unit tests for rapid-fire detection (< 30s)
  - [ ] Write unit tests for long-pause detection (> 300s)
  - [ ] Write unit tests for follow-up pattern matching
  - [ ] Write unit tests for sequence numbering
  - [ ] Write unit tests for first prompt in session
  - [ ] Write unit tests for average interval calculation
  - [ ] Write unit tests for median interval calculation
  - [ ] Write unit tests for time-of-day distribution
  - [ ] Write performance tests ensuring <1ms

## Dev Notes

### TimingMetrics Interface

```typescript
export interface TimingMetrics {
  timeSincePrevious: number | null;  // seconds
  isRapidFire: boolean;              // <30 seconds
  isLongPause: boolean;              // >5 minutes
  isFollowUp: boolean;               // pattern match
  sequenceNumber: number;            // within session
}
```

### Timing Constants

```typescript
const RAPID_FIRE_THRESHOLD_SECONDS = 30;
const LONG_PAUSE_THRESHOLD_SECONDS = 300; // 5 minutes
```

### Follow-up Patterns

```typescript
const FOLLOW_UP_PATTERNS = [
  /^(also|and|additionally|furthermore)/i,
  /^(now|next|then)/i,
  /^(one more thing|another thing)/i,
  /^(oh|wait)/i,
];
```

### Analysis Function

```typescript
export function analyzeTimingWithContext(
  promptText: string,
  currentTimestamp: Date,
  previousTimestamp: Date | null,
  sequenceNumber: number
): TimingMetrics {
  let timeSincePrevious: number | null = null;
  let isRapidFire = false;
  let isLongPause = false;

  if (previousTimestamp) {
    timeSincePrevious = Math.floor(
      (currentTimestamp.getTime() - previousTimestamp.getTime()) / 1000
    );
    isRapidFire = timeSincePrevious < RAPID_FIRE_THRESHOLD_SECONDS;
    isLongPause = timeSincePrevious > LONG_PAUSE_THRESHOLD_SECONDS;
  }

  const isFollowUp = FOLLOW_UP_PATTERNS.some(p => p.test(promptText.trim()));

  return {
    timeSincePrevious,
    isRapidFire,
    isLongPause,
    isFollowUp,
    sequenceNumber,
  };
}
```

### Database Migration

```sql
ALTER TABLE prompts ADD COLUMN time_since_previous_seconds INTEGER;
ALTER TABLE prompts ADD COLUMN is_rapid_fire BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN is_long_pause BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN is_follow_up BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN sequence_number INTEGER;

-- Composite index for session queries
CREATE INDEX idx_prompts_session_seq ON prompts(session_id, sequence_number);

-- Partial index for rapid-fire analysis
CREATE INDEX idx_prompts_rapid_fire ON prompts(session_id, created_at)
  WHERE is_rapid_fire = true;
```

### Database Trigger (Optional)

```sql
CREATE OR REPLACE FUNCTION analyze_prompt_timing()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT
      EXTRACT(EPOCH FROM (NEW.created_at - MAX(p.created_at)))::INTEGER,
      COALESCE(MAX(p.sequence_number), 0) + 1
    INTO
      NEW.time_since_previous_seconds,
      NEW.sequence_number
    FROM prompts p
    WHERE p.session_id = NEW.session_id
      AND p.created_at < NEW.created_at;

    NEW.is_rapid_fire := NEW.time_since_previous_seconds IS NOT NULL
      AND NEW.time_since_previous_seconds < 30;
    NEW.is_long_pause := NEW.time_since_previous_seconds IS NOT NULL
      AND NEW.time_since_previous_seconds > 300;
  END IF;

  NEW.is_follow_up := NEW.text ~* '^(also|and|additionally|now|next|then)';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Interval Statistics Interface

```typescript
export interface IntervalStats {
  averageIntervalSeconds: number | null;
  medianIntervalSeconds: number | null;
  minIntervalSeconds: number | null;
  maxIntervalSeconds: number | null;
  totalPrompts: number;
}
```

### Interval Aggregation Functions

```typescript
export async function calculateIntervalStats(
  supabase: SupabaseClient,
  userId: string,
  sessionId?: string
): Promise<IntervalStats> {
  const { data, error } = await supabase
    .rpc('calculate_interval_stats', {
      p_user_id: userId,
      p_session_id: sessionId ?? null
    });

  if (error) throw error;
  return data;
}
```

### SQL Function for Interval Statistics

```sql
CREATE OR REPLACE FUNCTION calculate_interval_stats(
  p_user_id UUID,
  p_session_id UUID DEFAULT NULL
)
RETURNS TABLE (
  average_interval_seconds NUMERIC,
  median_interval_seconds NUMERIC,
  min_interval_seconds INTEGER,
  max_interval_seconds INTEGER,
  total_prompts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(time_since_previous_seconds)::NUMERIC AS average_interval_seconds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_since_previous_seconds)::NUMERIC AS median_interval_seconds,
    MIN(time_since_previous_seconds) AS min_interval_seconds,
    MAX(time_since_previous_seconds) AS max_interval_seconds,
    COUNT(*) AS total_prompts
  FROM prompts
  WHERE user_id = p_user_id
    AND (p_session_id IS NULL OR session_id = p_session_id)
    AND time_since_previous_seconds IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Productivity Patterns Interface

```typescript
export interface TimeOfDayDistribution {
  morning: number;    // 6am-12pm (count)
  afternoon: number;  // 12pm-6pm
  evening: number;    // 6pm-12am
  night: number;      // 12am-6am
  peakHour: number;   // 0-23, hour with most prompts
  morningPct: number; // percentage
  afternoonPct: number;
  eveningPct: number;
  nightPct: number;
}

export type TimeOfDayBucket = 'morning' | 'afternoon' | 'evening' | 'night';
```

### Time-of-Day Analysis Function

```typescript
const TIME_BUCKETS: Record<TimeOfDayBucket, [number, number]> = {
  morning: [6, 12],    // 6:00 - 11:59
  afternoon: [12, 18], // 12:00 - 17:59
  evening: [18, 24],   // 18:00 - 23:59
  night: [0, 6],       // 00:00 - 05:59
};

export function getTimeOfDayBucket(hour: number): TimeOfDayBucket {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 24) return 'evening';
  return 'night';
}

export async function analyzeTimeOfDayDistribution(
  supabase: SupabaseClient,
  userId: string,
  dateRange?: { start: Date; end: Date }
): Promise<TimeOfDayDistribution> {
  const { data, error } = await supabase
    .rpc('get_time_of_day_distribution', {
      p_user_id: userId,
      p_start_date: dateRange?.start?.toISOString() ?? null,
      p_end_date: dateRange?.end?.toISOString() ?? null
    });

  if (error) throw error;
  return data;
}
```

### SQL Function for Time-of-Day Distribution

```sql
CREATE OR REPLACE FUNCTION get_time_of_day_distribution(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  morning_count INTEGER;
  afternoon_count INTEGER;
  evening_count INTEGER;
  night_count INTEGER;
  total_count INTEGER;
  peak_hour INTEGER;
BEGIN
  -- Count by time-of-day bucket
  SELECT
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 6 AND EXTRACT(HOUR FROM created_at) < 12),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 12 AND EXTRACT(HOUR FROM created_at) < 18),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 18 AND EXTRACT(HOUR FROM created_at) < 24),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 0 AND EXTRACT(HOUR FROM created_at) < 6),
    COUNT(*)
  INTO morning_count, afternoon_count, evening_count, night_count, total_count
  FROM prompts
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);

  -- Find peak hour
  SELECT EXTRACT(HOUR FROM created_at)::INTEGER
  INTO peak_hour
  FROM prompts
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
  GROUP BY EXTRACT(HOUR FROM created_at)
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  result := json_build_object(
    'morning', morning_count,
    'afternoon', afternoon_count,
    'evening', evening_count,
    'night', night_count,
    'peakHour', COALESCE(peak_hour, 12),
    'morningPct', CASE WHEN total_count > 0 THEN ROUND(morning_count::NUMERIC / total_count * 100, 1) ELSE 0 END,
    'afternoonPct', CASE WHEN total_count > 0 THEN ROUND(afternoon_count::NUMERIC / total_count * 100, 1) ELSE 0 END,
    'eveningPct', CASE WHEN total_count > 0 THEN ROUND(evening_count::NUMERIC / total_count * 100, 1) ELSE 0 END,
    'nightPct', CASE WHEN total_count > 0 THEN ROUND(night_count::NUMERIC / total_count * 100, 1) ELSE 0 END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Dependencies

- Requires session_id on prompts (Epic 16)
- Capture API must provide session context

### Performance Requirements

- Pattern matching: <1ms
- Database query for previous timestamp: handled by index
- Interval aggregations: Use database functions to avoid loading all prompts into memory
- Time-of-day analysis: Indexed on user_id + created_at for efficient date range queries


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

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
