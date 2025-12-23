# Story 21.7: Session Health Score

Status: Ready

## Story

**As a** developer using Contextor,
**I want** each session assigned a health score (0-100) based on multiple factors,
**So that** I can see real-time feedback on session quality and receive actionable suggestions.

## Acceptance Criteria

1. **Given** a session exists with prompts
   **When** health is calculated
   **Then** it produces a score from 0-100 based on duration, context usage, frustration rate, retry rate, and tool error rate

2. **Given** a session health score
   **When** level is determined
   **Then** score >=75 = "healthy", >=50 = "warning", <50 = "critical"

3. **Given** session duration is calculated
   **When** scoring
   **Then** <=60min = 25pts, <=90min = 20pts, <=120min = 15pts, <=180min = 10pts, >180min = 5pts

4. **Given** context usage estimate
   **When** scoring
   **Then** <=50% = 25pts, <=70% = 20pts, <=80% = 15pts, <=90% = 10pts, >90% = 5pts

5. **Given** frustration rate is calculated
   **When** scoring
   **Then** <=2% = 25pts, <=5% = 20pts, <=10% = 15pts, <=15% = 10pts, >15% = 5pts

6. **Given** retry rate is calculated
   **When** scoring
   **Then** <=5% = 20pts, <=10% = 16pts, <=15% = 12pts, <=20% = 8pts, >20% = 4pts

7. **Given** tool error rate is calculated
   **When** scoring
   **Then** <=2% = 20pts, <=5% = 16pts, <=10% = 12pts, <=20% = 8pts, >20% = 4pts

8. **Given** any factor scores below threshold (12 for 20pt factors, 15 for 25pt factors)
   **When** health is returned
   **Then** relevant warnings and suggestions are included

9. **Given** a new prompt is added to a session
   **When** capture completes
   **Then** session health is recalculated and updated

10. **Given** a session with multiple health calculations over time
    **When** viewing session analytics
    **Then** health trend is displayed showing score changes across the session timeline

11. **Given** session health drops below a configurable threshold (default: 50)
    **When** the health score decreases below threshold
    **Then** an alert is triggered with notification to the user and recommended actions

## Tasks / Subtasks

- [ ] **Task 1: Database Schema Updates** (AC: #1, #2, #10)
  - [ ] Add `health_score INTEGER` to sessions table (0-100)
  - [ ] Add `health_level VARCHAR(20)` to sessions table
  - [ ] Add `frustration_count INTEGER DEFAULT 0` to sessions table
  - [ ] Add `retry_count INTEGER DEFAULT 0` to sessions table
  - [ ] Add `tool_error_count INTEGER DEFAULT 0` to sessions table
  - [ ] Add `last_health_update_at TIMESTAMPTZ` to sessions table
  - [ ] Add CHECK constraints for valid ranges
  - [ ] Create `session_health_history` table for trend tracking (session_id, health_score, calculated_at)

- [ ] **Task 2: Implement Session Health Calculator** (AC: #1, #3, #4, #5, #6, #7)
  - [ ] Create `/app/lib/analysis/session-health.ts`
  - [ ] Define `SessionHealthMetrics` interface
  - [ ] Implement `calculateDurationScore(minutes)` function
  - [ ] Implement `calculateContextScore(usage)` function
  - [ ] Implement `calculateFrustrationScore(rate)` function
  - [ ] Implement `calculateRetryScore(rate)` function
  - [ ] Implement `calculateToolErrorScore(rate)` function
  - [ ] Implement `calculateSessionHealth(data)` main function

- [ ] **Task 3: Implement Warning and Suggestion Generator** (AC: #8)
  - [ ] Define warning messages for each low-scoring factor (including tool errors)
  - [ ] Define actionable suggestions for each warning
  - [ ] Return warnings and suggestions in health response
  - [ ] Prioritize suggestions by factor severity

- [ ] **Task 4: Implement Health Level Classification** (AC: #2)
  - [ ] Calculate total score from five factors (max 100)
  - [ ] Apply thresholds: >=75 healthy, >=50 warning, <50 critical
  - [ ] Return health level with score

- [ ] **Task 5: Integrate into Capture Flow** (AC: #9, #10)
  - [ ] Call session health update after prompt insert
  - [ ] Increment frustration_count if sentiment is frustrated
  - [ ] Increment tool_error_count when tool execution fails
  - [ ] Update retry_count based on pattern detection
  - [ ] Store updated health_score and health_level
  - [ ] Insert health snapshot into session_health_history for trend tracking
  - [ ] Set last_health_update_at timestamp

- [ ] **Task 6: Create Session Health API** (AC: #1, #8, #10)
  - [ ] Create `GET /api/analytics/session/:id/health` endpoint
  - [ ] Return health score, level, factors, warnings, suggestions
  - [ ] Include health trend data from session_health_history
  - [ ] Apply RLS for team member access
  - [ ] Cache with 30-second stale time

- [ ] **Task 7: Implement Health Alert System** (AC: #11)
  - [ ] Create health threshold configuration (default: 50, configurable per user/team)
  - [ ] Implement health drop detection logic (compare current vs previous score)
  - [ ] Create alert notification mechanism (in-app notification)
  - [ ] Include recommended actions in alert based on lowest-scoring factors
  - [ ] Store alert history for analytics

- [ ] **Task 8: Testing** (AC: #2, #3, #4, #5, #6, #7, #10, #11)
  - [ ] Write unit tests for each scoring function (including tool error)
  - [ ] Write unit tests for health level classification
  - [ ] Write unit tests for warning generation
  - [ ] Write unit tests for health trend calculation
  - [ ] Write unit tests for alert triggering logic
  - [ ] Write integration tests for API endpoint
  - [ ] Test edge cases (new session, empty session, rapid health changes)

## Dev Notes

### SessionHealthMetrics Interface

```typescript
export interface SessionHealthMetrics {
  healthScore: number;           // 0-100
  healthLevel: 'healthy' | 'warning' | 'critical';
  factors: {
    durationScore: number;       // 0-25
    contextScore: number;        // 0-25
    frustrationScore: number;    // 0-25
    retryScore: number;          // 0-20
    toolErrorScore: number;      // 0-20
  };
  warnings: string[];
  suggestions: string[];
  trend?: HealthTrendPoint[];    // Historical health scores for trend visualization
}

export interface HealthTrendPoint {
  timestamp: string;
  healthScore: number;
  healthLevel: 'healthy' | 'warning' | 'critical';
}
```

### Session Input Data

```typescript
interface SessionData {
  durationMinutes: number;
  contextUsageEstimate: number;  // 0-1
  frustrationRate: number;       // frustrated prompts / total
  retryRate: number;             // retry prompts / total
  toolErrorRate: number;         // failed tool executions / total tool calls
  promptCount: number;
  toolCallCount: number;
}
```

### Scoring Functions

```typescript
function calculateDurationScore(minutes: number): number {
  if (minutes <= 60) return 25;
  if (minutes <= 90) return 20;
  if (minutes <= 120) return 15;
  if (minutes <= 180) return 10;
  return 5;
}

function calculateContextScore(usage: number): number {
  if (usage <= 0.5) return 25;
  if (usage <= 0.7) return 20;
  if (usage <= 0.8) return 15;
  if (usage <= 0.9) return 10;
  return 5;
}

function calculateFrustrationScore(rate: number): number {
  if (rate <= 0.02) return 25;
  if (rate <= 0.05) return 20;
  if (rate <= 0.10) return 15;
  if (rate <= 0.15) return 10;
  return 5;
}

function calculateRetryScore(rate: number): number {
  if (rate <= 0.05) return 20;
  if (rate <= 0.10) return 16;
  if (rate <= 0.15) return 12;
  if (rate <= 0.20) return 8;
  return 4;
}

function calculateToolErrorScore(rate: number): number {
  if (rate <= 0.02) return 20;
  if (rate <= 0.05) return 16;
  if (rate <= 0.10) return 12;
  if (rate <= 0.20) return 8;
  return 4;
}
```

### Warning Messages

| Factor | Threshold | Warning | Suggestion |
|--------|-----------|---------|------------|
| Duration | < 15 | Session duration is getting long | Consider starting a fresh session for complex new tasks |
| Context | < 15 | Context window usage is high | Summarize key context and start fresh to maintain quality |
| Frustration | < 15 | Frustration signals detected | Take a short break or try a different approach |
| Retry | < 12 | High retry rate detected | Clarify requirements before retrying |
| Tool Error | < 12 | High tool execution failure rate | Check tool configurations and permissions; simplify complex tool chains |

### Database Migration

```sql
-- Sessions table updates
ALTER TABLE sessions ADD COLUMN health_score INTEGER;
ALTER TABLE sessions ADD COLUMN health_level VARCHAR(20);
ALTER TABLE sessions ADD COLUMN frustration_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN tool_error_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN tool_call_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN last_health_update_at TIMESTAMPTZ;

ALTER TABLE sessions ADD CONSTRAINT valid_health_level CHECK (
  health_level IS NULL OR health_level IN ('healthy', 'warning', 'critical')
);

ALTER TABLE sessions ADD CONSTRAINT valid_health_score CHECK (
  health_score IS NULL OR (health_score >= 0 AND health_score <= 100)
);

-- Health history table for trend tracking
CREATE TABLE session_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  health_level VARCHAR(20) NOT NULL CHECK (health_level IN ('healthy', 'warning', 'critical')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  factors JSONB NOT NULL -- Store factor breakdown for historical analysis
);

CREATE INDEX idx_health_history_session ON session_health_history(session_id, calculated_at DESC);

-- Health alerts table
CREATE TABLE session_health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_score INTEGER NOT NULL,
  current_score INTEGER NOT NULL,
  threshold INTEGER NOT NULL,
  alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('warning', 'critical')),
  recommended_actions JSONB NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_alerts_user ON session_health_alerts(user_id, created_at DESC);
CREATE INDEX idx_health_alerts_unacknowledged ON session_health_alerts(user_id) WHERE acknowledged_at IS NULL;
```

### API Response

```typescript
// GET /api/analytics/session/:id/health
interface SessionHealthResponse {
  sessionId: string;
  health: SessionHealthMetrics;
  promptCount: number;
  toolCallCount: number;
  durationMinutes: number;
  lastUpdated: string;
  alerts?: HealthAlert[];  // Unacknowledged alerts for this session
}

interface HealthAlert {
  id: string;
  previousScore: number;
  currentScore: number;
  alertLevel: 'warning' | 'critical';
  recommendedActions: string[];
  createdAt: string;
}
```

### Tool Error Rate Calculation

Tool error rate is calculated from tool execution results captured during the session:

```typescript
// Tool error detection from prompt analysis
interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  errorType?: 'timeout' | 'permission' | 'not_found' | 'execution_error' | 'unknown';
}

function calculateToolErrorRate(session: SessionData): number {
  if (session.toolCallCount === 0) {
    return 0; // No tool calls = perfect score (no errors possible)
  }
  return session.toolErrorCount / session.toolCallCount;
}

// Tool error detection patterns in prompts/responses
const TOOL_ERROR_PATTERNS = [
  /tool.*(?:failed|error|timeout)/i,
  /command.*(?:not found|permission denied)/i,
  /execution.*(?:failed|aborted)/i,
  /could not.*(?:execute|run|find)/i,
];
```

### Health Alert Logic

Alerts are triggered when health drops below threshold:

```typescript
interface AlertConfig {
  threshold: number;           // Default: 50
  minDropForAlert: number;     // Minimum score drop to trigger (default: 10)
  cooldownMinutes: number;     // Prevent alert spam (default: 5)
}

function shouldTriggerAlert(
  previousScore: number,
  currentScore: number,
  config: AlertConfig,
  lastAlertTime?: Date
): boolean {
  // Check if score dropped below threshold
  if (currentScore >= config.threshold) return false;

  // Check if this is a significant drop
  const drop = previousScore - currentScore;
  if (drop < config.minDropForAlert) return false;

  // Check cooldown period
  if (lastAlertTime) {
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    if (Date.now() - lastAlertTime.getTime() < cooldownMs) return false;
  }

  return true;
}

function generateRecommendedActions(health: SessionHealthMetrics): string[] {
  const actions: string[] = [];
  const factors = health.factors;

  // Sort factors by score (lowest first) to prioritize actions
  const sortedFactors = [
    { name: 'duration', score: factors.durationScore, max: 25 },
    { name: 'context', score: factors.contextScore, max: 25 },
    { name: 'frustration', score: factors.frustrationScore, max: 25 },
    { name: 'retry', score: factors.retryScore, max: 20 },
    { name: 'toolError', score: factors.toolErrorScore, max: 20 },
  ].sort((a, b) => (a.score / a.max) - (b.score / b.max));

  // Generate actions for top 2 lowest-scoring factors
  for (const factor of sortedFactors.slice(0, 2)) {
    actions.push(getActionForFactor(factor.name));
  }

  return actions;
}
```

### Dependencies

- Epic 16 (Sessions) - sessions table must exist
- Story 21.3 (Sentiment) - for frustration detection
- Story 15.7 (Tool Execution Capture) - for tool error tracking
- Context usage estimate may come from Story 21.1

### Performance Considerations

- Health calculation runs on each prompt insert (async recommended)
- Update throttling: recalculate max once per 30 seconds
- API endpoint cached with React Query (30s stale time)


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
