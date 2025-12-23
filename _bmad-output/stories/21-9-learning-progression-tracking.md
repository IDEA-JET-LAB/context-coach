# Story 21.9: Learning Progression Tracking

Status: Ready

## Story

**As a** developer using Contextor,
**I want** week-over-week tracking of my prompting skill improvement,
**So that** I can see my progress over time and receive motivation through achievements.

## Acceptance Criteria

1. **Given** a user has been prompting for multiple weeks
   **When** learning progression is calculated
   **Then** current week metrics are compared against previous week

2. **Given** weekly metrics exist
   **When** compared
   **Then** improvement percentages are calculated for: prompt score, frustration rate, efficiency (prompts per goal), and context management

3. **Given** prompt score improved >5% week-over-week
   **When** achievements are generated
   **Then** an achievement message is shown: "Prompt quality improved X%!"

4. **Given** frustration rate decreased >10% week-over-week
   **When** achievements are generated
   **Then** an achievement message is shown: "Frustration levels decreased - great communication!"

5. **Given** prompts per goal decreased >10% (more efficient)
   **When** achievements are generated
   **Then** an achievement message is shown: "Workflow efficiency improved - fewer prompts per goal!"

6. **Given** context exhaustion rate decreased >20%
   **When** achievements are generated
   **Then** an achievement message is shown: "Context management mastery - fewer resets!"

7. **Given** metrics declined (negative improvement)
   **When** suggestions are generated
   **Then** relevant improvement suggestions are provided

8. **Given** this is the user's first week
   **When** progression is calculated
   **Then** a welcome message is shown instead of comparisons

## Tasks / Subtasks

- [ ] **Task 1: Database Schema** (AC: #1, #2)
  - [ ] Create `user_weekly_metrics` table
  - [ ] Add columns: user_id, week_start, avg_prompt_score, frustration_rate, prompts_per_goal, context_exhaustion_rate, total_prompts, total_sessions
  - [ ] Add unique constraint on (user_id, week_start)
  - [ ] Add indexes for user and week queries
  - [ ] Enable RLS and create policies

- [ ] **Task 2: Implement Weekly Metrics Interface** (AC: #1, #2)
  - [ ] Create `/app/lib/analysis/learning-progression.ts`
  - [ ] Define `WeeklyMetrics` interface
  - [ ] Define `LearningProgression` interface
  - [ ] Define `improvements` object structure

- [ ] **Task 3: Implement Progression Calculator** (AC: #2)
  - [ ] Implement `calculateProgression(current, previous)` function
  - [ ] Calculate percentage changes for each metric
  - [ ] Handle null previous week case
  - [ ] Handle zero baseline values (avoid division by zero)

- [ ] **Task 4: Implement Achievement Generator** (AC: #3, #4, #5, #6, #8)
  - [ ] Check prompt score improvement > 5%
  - [ ] Check frustration rate decrease > 10%
  - [ ] Check efficiency improvement > 10%
  - [ ] Check context management improvement > 20%
  - [ ] Generate first-week welcome message

- [ ] **Task 5: Implement Suggestion Generator** (AC: #7)
  - [ ] Check for declining prompt score
  - [ ] Check for increasing frustration
  - [ ] Provide actionable suggestions for each decline
  - [ ] Prioritize suggestions by severity

- [ ] **Task 6: Create Weekly Aggregation Function** (AC: #1)
  - [ ] Create SQL function `aggregate_user_weekly_metrics(week_start_date)`
  - [ ] Aggregate from user_daily_analytics
  - [ ] Calculate rates from counts
  - [ ] Schedule weekly cron job (Sunday 01:00 UTC)

- [ ] **Task 7: Create Learning Progression API** (AC: #1, #2, #3)
  - [ ] Create `GET /api/analytics/learning` endpoint
  - [ ] Return current week, previous week, improvements, achievements, suggestions
  - [ ] Include 12-week history for trend visualization
  - [ ] Apply RLS for user data access

- [ ] **Task 8: Testing** (AC: #2, #3, #4, #5, #6, #7, #8)
  - [ ] Write unit tests for progression calculation
  - [ ] Write unit tests for achievement generation
  - [ ] Write unit tests for suggestion generation
  - [ ] Write unit tests for first-week handling
  - [ ] Write integration tests for API endpoint

## Dev Notes

### WeeklyMetrics Interface

```typescript
export interface WeeklyMetrics {
  weekStart: string;  // ISO date
  avgPromptScore: number;
  frustrationRate: number;
  promptsPerGoal: number;
  contextExhaustionRate: number;
  totalPrompts: number;
  totalSessions: number;
}
```

### LearningProgression Interface

```typescript
export interface LearningProgression {
  currentWeek: WeeklyMetrics;
  previousWeek: WeeklyMetrics | null;
  improvements: {
    promptScore: number;        // Percentage change
    frustration: number;        // Percentage change (negative = improvement)
    efficiency: number;         // Percentage change (positive = improvement)
    contextManagement: number;  // Percentage change (positive = improvement)
  } | null;
  achievements: string[];
  suggestions: string[];
}
```

### Progression Calculation

```typescript
export function calculateProgression(
  current: WeeklyMetrics,
  previous: WeeklyMetrics | null
): LearningProgression {
  if (!previous) {
    return {
      currentWeek: current,
      previousWeek: null,
      improvements: null,
      achievements: ['First week tracked! Keep prompting to see your progress.'],
      suggestions: [],
    };
  }

  const improvements = {
    promptScore: previous.avgPromptScore > 0
      ? ((current.avgPromptScore - previous.avgPromptScore) / previous.avgPromptScore) * 100
      : 0,
    frustration: previous.frustrationRate > 0
      ? ((current.frustrationRate - previous.frustrationRate) / previous.frustrationRate) * 100
      : 0,
    efficiency: previous.promptsPerGoal > 0
      ? ((previous.promptsPerGoal - current.promptsPerGoal) / previous.promptsPerGoal) * 100
      : 0,
    contextManagement: previous.contextExhaustionRate > 0
      ? ((previous.contextExhaustionRate - current.contextExhaustionRate) / previous.contextExhaustionRate) * 100
      : 0,
  };

  const achievements: string[] = [];
  const suggestions: string[] = [];

  // Achievement checks
  if (improvements.promptScore > 5) {
    achievements.push(`Prompt quality improved ${improvements.promptScore.toFixed(0)}%!`);
  }
  if (improvements.frustration < -10) {
    achievements.push('Frustration levels decreased - great communication!');
  }
  if (improvements.efficiency > 10) {
    achievements.push('Workflow efficiency improved - fewer prompts per goal!');
  }
  if (improvements.contextManagement > 20) {
    achievements.push('Context management mastery - fewer resets!');
  }

  // Suggestion checks
  if (improvements.promptScore < -5) {
    suggestions.push('Focus on prompt clarity this week');
  }
  if (improvements.frustration > 10) {
    suggestions.push('Try shorter sessions or clearer initial requirements');
  }

  return {
    currentWeek: current,
    previousWeek: previous,
    improvements,
    achievements,
    suggestions,
  };
}
```

### Database Schema

```sql
CREATE TABLE user_weekly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  avg_prompt_score DECIMAL(4,2),
  frustration_rate DECIMAL(4,3),
  prompts_per_goal DECIMAL(5,2),
  context_exhaustion_rate DECIMAL(4,3),
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_week UNIQUE (user_id, week_start)
);

CREATE INDEX idx_user_weekly_user ON user_weekly_metrics(user_id);
CREATE INDEX idx_user_weekly_week ON user_weekly_metrics(week_start);
```

### Weekly Aggregation SQL

```sql
CREATE OR REPLACE FUNCTION aggregate_user_weekly_metrics(week_start_date DATE)
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER := 0;
  week_end_date DATE := week_start_date + INTERVAL '6 days';
BEGIN
  DELETE FROM user_weekly_metrics WHERE week_start = week_start_date;

  INSERT INTO user_weekly_metrics (
    user_id, week_start, avg_prompt_score, frustration_rate,
    prompts_per_goal, context_exhaustion_rate, total_prompts, total_sessions
  )
  SELECT
    user_id,
    week_start_date,
    AVG(avg_prompt_score),
    SUM(frustration_count)::DECIMAL / NULLIF(SUM(total_prompts), 0),
    SUM(total_prompts)::DECIMAL / NULLIF(SUM(total_sessions), 0),
    -- context_exhaustion_rate calculated from sessions table
    NULL,
    SUM(total_prompts),
    SUM(total_sessions)
  FROM user_daily_analytics
  WHERE date >= week_start_date AND date <= week_end_date
  GROUP BY user_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### API Response

```typescript
// GET /api/analytics/learning
interface LearningProgressionResponse {
  currentWeek: WeeklyMetrics;
  previousWeek: WeeklyMetrics | null;
  weeklyHistory: WeeklyMetrics[];  // Last 12 weeks
  improvements: { ... } | null;
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    earnedAt: string | null;
    progress: number;
  }>;
  milestones: Array<{
    metric: string;
    baseline: number;
    current: number;
    target: number;
    progress: number;
  }>;
  recommendations: string[];
}
```

### Dependencies

- Story 21.3 (Sentiment) - for frustration rate calculation
- Story 21.1 (Context Management) - for context exhaustion tracking
- User daily analytics aggregation

### Cron Schedule

```yaml
- name: weekly-user-metrics
  schedule: "0 1 * * 0"  # Sunday 01:00 UTC
  function: aggregate-user-weekly
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
