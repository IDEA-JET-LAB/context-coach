# Story 21.1: Context Window Management

Status: Ready

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

- [ ] **Task 1: Database Schema Updates** (AC: #5)
  - [ ] Create migration file `20251223100000_epic21_context_management.sql`
  - [ ] Add `context_exhausted BOOLEAN DEFAULT false` to sessions table
  - [ ] Add `exhaustion_detected_at TIMESTAMPTZ` to sessions table
  - [ ] Add `context_usage_estimate DECIMAL(3,2)` to sessions table
  - [ ] Apply migration to local and production databases

- [ ] **Task 2: Implement Context Exhaustion Detector** (AC: #1, #2, #4)
  - [ ] Create `/app/lib/analysis/context-management.ts`
  - [ ] Define exhaustion patterns array with regex patterns
  - [ ] Implement `detectContextExhaustion(promptText, sessionDurationMinutes)` function
  - [ ] Return interface with `isExhausted`, `confidence`, `detectionMethod`
  - [ ] Add unit tests for all exhaustion patterns

- [ ] **Task 3: Integrate Detection into Capture Flow** (AC: #1)
  - [ ] Modify prompt capture API to call context exhaustion detector
  - [ ] Update session record when exhaustion is detected
  - [ ] Set `exhaustion_detected_at` timestamp on first detection
  - [ ] Log detection events for monitoring

- [ ] **Task 4: Session Health Integration** (AC: #3)
  - [ ] Add context exhaustion check to session health calculation
  - [ ] Generate appropriate warning message when exhaustion detected
  - [ ] Generate suggestion to start fresh session
  - [ ] Ensure warnings appear in session health API response

- [ ] **Task 5: Testing** (AC: #1, #2, #4)
  - [ ] Write unit tests for keyword detection (high confidence cases)
  - [ ] Write unit tests for duration-based detection (moderate confidence)
  - [ ] Write performance tests ensuring <1ms execution
  - [ ] Write integration tests for capture flow with context detection

- [ ] **Task 6: User Exhaustion Rate Analytics** (AC: #6, #7)
  - [ ] Create `/app/lib/analytics/exhaustion-metrics.ts`
  - [ ] Implement `calculateUserExhaustionRate(userId)` returning `sessions_with_exhaustion / total_sessions`
  - [ ] Implement `calculateAvgDurationBeforeExhaustion(userId)` returning average session duration for exhausted sessions
  - [ ] Add database query to aggregate exhaustion metrics per user
  - [ ] Write unit tests for rate and duration calculations

- [ ] **Task 7: Team-Level Exhaustion Aggregation** (AC: #8)
  - [ ] Create `/app/lib/analytics/team-exhaustion-metrics.ts`
  - [ ] Implement `calculateTeamExhaustionRate(teamId)` aggregating all team members
  - [ ] Implement `calculateTeamAvgDurationBeforeExhaustion(teamId)`
  - [ ] Add API endpoint for team exhaustion analytics
  - [ ] Write integration tests for team aggregation

- [ ] **Task 8: Dynamic Feedback Messages** (AC: #9)
  - [ ] Create feedback message generator in `/app/lib/analysis/exhaustion-feedback.ts`
  - [ ] Implement `generateExhaustionFeedback(exhaustionRate)` returning dynamic message
  - [ ] Format message as "You hit context limits in X% of sessions"
  - [ ] Add thresholds for severity (e.g., >50% = concerning, >25% = moderate)
  - [ ] Integrate feedback into session health dashboard component
  - [ ] Write unit tests for message generation and thresholds

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
