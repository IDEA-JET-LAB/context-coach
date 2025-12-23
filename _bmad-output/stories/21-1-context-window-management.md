# Story 21.1: Context Window Management

Status: Complete

## Story

**As a** developer using Claude Code,
**I want** the system to detect when my session is approaching or has exhausted its context window,
**So that** I can proactively manage my sessions and maintain high-quality AI responses.

## Acceptance Criteria

1. **Given** a prompt contains context exhaustion keywords (e.g., "continued from previous conversation", "context limit", "start fresh")
   **When** the prompt is captured
   **Then** the session is flagged with `context_exhausted = true` and `exhaustion_detected_at` is set

2. **Given** a session duration exceeds 90 minutes
   **When** session health is calculated
   **Then** the system returns a moderate confidence context exhaustion warning

3. **Given** context exhaustion is detected
   **When** the user views session health
   **Then** they see a warning suggesting to summarize context and start a fresh session

4. **Given** a prompt matches exhaustion patterns
   **When** detection runs
   **Then** it completes in under 1ms

5. **Given** the context_usage_estimate field exists
   **When** sessions are tracked over time
   **Then** the field can store values from 0.00 to 1.00 representing estimated context usage

6. **Given** a user has completed multiple sessions
   **When** analytics are calculated
   **Then** the exhaustion rate is computed as `exhaustion_rate = sessions_with_exhaustion / total_sessions`

7. **Given** sessions exist with `context_exhausted = true`
   **When** analytics are calculated
   **Then** the average session duration before exhaustion is tracked and displayed

8. **Given** a team has multiple members with exhaustion data
   **When** team analytics are viewed
   **Then** aggregated exhaustion metrics (team exhaustion rate, avg duration before exhaustion) are displayed

9. **Given** a user's exhaustion rate is calculated
   **When** the user views their session health dashboard
   **Then** they see a dynamic feedback message: "You hit context limits in X% of sessions"

## Tasks / Subtasks

- [x] **Task 1: Database Schema Updates** (AC: #5)
  - [x] Create migration file `20251223210000_epic21_context_management.sql`
  - [x] Add `context_exhausted BOOLEAN DEFAULT false` to sessions table
  - [x] Add `exhaustion_detected_at TIMESTAMPTZ` to sessions table
  - [x] Add `context_usage_estimate DECIMAL(3,2)` to sessions table
  - [x] Apply migration to local database

- [x] **Task 2: Implement Context Exhaustion Detector** (AC: #1, #2, #4)
  - [x] Create `/app/lib/analysis/context-management.ts`
  - [x] Define exhaustion patterns array with 10 regex patterns
  - [x] Implement `detectContextExhaustion(promptText, sessionDurationMinutes)` function
  - [x] Return interface with `isExhausted`, `confidence`, `detectionMethod`
  - [x] Add 21 unit tests for all exhaustion patterns

- [x] **Task 3: Integrate Detection into Capture Flow** (AC: #1)
  - [x] Modify prompt capture API to call context exhaustion detector
  - [x] Update session record when exhaustion is detected via `markContextExhausted()`
  - [x] Set `exhaustion_detected_at` timestamp on first detection
  - [x] Log detection events for monitoring

- [x] **Task 4: Session Health Integration** (AC: #3)
  - [x] Add context exhaustion check to session health calculation in team-intelligence.ts
  - [x] Generate appropriate warning message via `generateSessionWarning()`
  - [x] Generate suggestion to start fresh session
  - [x] Context exhausted sessions get -2 health score penalty

- [x] **Task 5: Testing** (AC: #1, #2, #4)
  - [x] Write 21 unit tests for keyword detection (high confidence cases)
  - [x] Write unit tests for duration-based detection (moderate confidence)
  - [x] Write performance tests ensuring <1ms execution
  - [x] 39 total context management tests passing

- [x] **Task 6: User Exhaustion Rate Analytics** (AC: #6, #7)
  - [x] Create `/app/lib/analytics/exhaustion-metrics.ts`
  - [x] Implement `calculateUserExhaustionRate(userId)` returning `sessions_with_exhaustion / total_sessions`
  - [x] Implement `calculateAvgDurationBeforeExhaustion(userId)` returning average session duration for exhausted sessions
  - [x] Add database query to aggregate exhaustion metrics per user

- [x] **Task 7: Team-Level Exhaustion Aggregation** (AC: #8)
  - [x] Implement `calculateTeamExhaustionRate(teamId)` in exhaustion-metrics.ts
  - [x] Implement `calculateTeamAvgDurationBeforeExhaustion(teamId)`
  - [x] Implement `getTeamMemberExhaustionBreakdown(teamId)` for per-member breakdown
  - [x] Add API endpoint `/api/analytics/exhaustion` for user and team exhaustion analytics

- [x] **Task 8: Dynamic Feedback Messages** (AC: #9)
  - [x] Create feedback message generator in `/app/lib/analysis/exhaustion-feedback.ts`
  - [x] Implement `generateExhaustionFeedback(exhaustionRate)` returning dynamic message
  - [x] Format message as "You hit context limits in X% of sessions"
  - [x] Add thresholds for severity (>50% = high, >25% = moderate, else low)
  - [x] Feedback returned via exhaustion API endpoint
  - [x] Write 18 unit tests for message generation and thresholds

## Dev Notes

### Exhaustion Pattern Definitions

```typescript
const EXHAUSTION_PATTERNS = [
  /continued from a previous conversation/i,
  /ran out of context/i,
  /context limit/i,
  /start fresh/i,
  /new conversation/i,
  /let me summarize where we were/i,
  /picking up from/i,
];
```

### Detection Logic

```typescript
interface ContextExhaustionResult {
  isExhausted: boolean;
  confidence: number;
  detectionMethod: 'keyword' | 'session_duration' | 'pattern';
}

// Priority:
// 1. Keyword match = 95% confidence
// 2. Session > 90 minutes = 60% confidence warning
// 3. Default = no exhaustion detected
```

### Database Migration

```sql
ALTER TABLE sessions ADD COLUMN context_exhausted BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN exhaustion_detected_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN context_usage_estimate DECIMAL(3,2);
```

### Dependencies

- Epic 16 (Sessions) must be complete - sessions table must exist
- Capture API must support session tracking

### Performance Requirements

- Pattern matching: <1ms per prompt
- No external API calls required
- Runs synchronously on prompt insert

### Exhaustion Rate Calculation (AC #6)

```typescript
interface ExhaustionMetrics {
  exhaustionRate: number;      // 0.0 to 1.0
  totalSessions: number;
  exhaustedSessions: number;
  avgDurationBeforeExhaustion: number; // in minutes
}

async function calculateUserExhaustionRate(userId: string): Promise<ExhaustionMetrics> {
  const { data } = await supabase
    .from('sessions')
    .select('id, context_exhausted, duration_minutes')
    .eq('user_id', userId);

  const totalSessions = data.length;
  const exhaustedSessions = data.filter(s => s.context_exhausted).length;
  const exhaustionRate = totalSessions > 0 ? exhaustedSessions / totalSessions : 0;

  const avgDuration = data
    .filter(s => s.context_exhausted)
    .reduce((sum, s) => sum + s.duration_minutes, 0) / (exhaustedSessions || 1);

  return { exhaustionRate, totalSessions, exhaustedSessions, avgDurationBeforeExhaustion: avgDuration };
}
```

### Team-Level Aggregation (AC #8)

```typescript
async function calculateTeamExhaustionRate(teamId: string): Promise<ExhaustionMetrics> {
  // Aggregate across all team members
  const { data } = await supabase
    .from('sessions')
    .select('id, context_exhausted, duration_minutes, user_id')
    .eq('team_id', teamId);

  // Same calculation logic as user-level, but for entire team
}
```

### Dynamic Feedback Message (AC #9)

```typescript
interface ExhaustionFeedback {
  message: string;
  severity: 'low' | 'moderate' | 'high';
}

function generateExhaustionFeedback(exhaustionRate: number): ExhaustionFeedback {
  const percentage = Math.round(exhaustionRate * 100);

  if (exhaustionRate > 0.5) {
    return {
      message: `You hit context limits in ${percentage}% of sessions`,
      severity: 'high'
    };
  } else if (exhaustionRate > 0.25) {
    return {
      message: `You hit context limits in ${percentage}% of sessions`,
      severity: 'moderate'
    };
  } else {
    return {
      message: `You hit context limits in ${percentage}% of sessions`,
      severity: 'low'
    };
  }
}
```


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [x] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [x] Checked `/design` route for component examples
- [x] Identified required components from the inventory below
- [x] Confirmed no hardcoded colors - using semantic tokens only
- [x] No new UI patterns needed (backend-only story)

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
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List
1. Created database migration for context management columns with constraints and indexes
2. Implemented context exhaustion detector with 10 regex patterns and dual detection methods (keyword + duration)
3. Integrated detection into prompt capture flow via non-blocking async call
4. Added context exhaustion penalty (-2) to session health score calculation
5. Created exhaustion metrics module for user and team-level analytics
6. Created exhaustion feedback module with severity-based messaging
7. Added `/api/analytics/exhaustion` API endpoint for user/team exhaustion metrics
8. All 39 context management tests passing, 602 total analysis tests passing
9. Build passes with no TypeScript errors

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2024-12-23 | Initial implementation of Story 21-1 | Claude Opus 4.5 |

### File List

**New Files Created:**
- `/app/supabase/migrations/20251223210000_epic21_context_management.sql` - Database migration for context exhaustion columns
- `/app/lib/analysis/context-management.ts` - Context exhaustion detector (10 patterns, dual detection methods)
- `/app/lib/analysis/exhaustion-feedback.ts` - Dynamic feedback message generator
- `/app/lib/analysis/__tests__/context-management.test.ts` - 21 unit tests for context management
- `/app/lib/analysis/__tests__/exhaustion-feedback.test.ts` - 18 unit tests for exhaustion feedback
- `/app/lib/analytics/exhaustion-metrics.ts` - User/team exhaustion rate calculators
- `/app/app/api/analytics/exhaustion/route.ts` - API endpoint for exhaustion analytics

**Modified Files:**
- `/app/lib/analysis/index.ts` - Added exports for context management and exhaustion feedback modules
- `/app/lib/analysis/interval-stats.ts` - Fixed TypeScript error with undefined array access
- `/app/lib/sessions/session-update.ts` - Added `markContextExhausted()`, `updateContextUsageEstimate()`, `getSessionDurationMinutes()`
- `/app/lib/sessions/index.ts` - Added exports for new session update functions
- `/app/app/api/prompts/capture/route.ts` - Integrated context exhaustion detection into capture flow
- `/app/lib/analytics/team-intelligence.ts` - Added context exhaustion penalty to session health calculation
