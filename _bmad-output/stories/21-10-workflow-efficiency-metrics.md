# Story 21.10: Workflow Efficiency Metrics

Status: Complete

## Story

**As a** developer using Contextor,
**I want** efficiency metrics that measure how effectively I achieve goals,
**So that** I can benchmark my performance against team averages and identify improvement opportunities.

## Acceptance Criteria

1. **Given** a user's prompting history
   **When** efficiency is calculated
   **Then** metrics include: prompts per task, context resets per session, debugging loop average, and time to resolution

2. **Given** efficiency metrics
   **When** an efficiency score (0-100) is calculated
   **Then** it starts at 50 and adjusts based on comparison to team benchmarks

3. **Given** prompts per task < 80% of team average
   **When** scoring
   **Then** +20 points are added to efficiency score

4. **Given** context resets per session < 50% of team average
   **When** scoring
   **Then** +15 points are added to efficiency score

5. **Given** debugging loop average < 70% of team average
   **When** scoring
   **Then** +15 points are added to efficiency score

6. **Given** an efficiency score
   **When** benchmark level is determined
   **Then** >=80 = "excellent", >=60 = "above_average", >=40 = "average", <40 = "below_average"

7. **Given** efficiency metrics exceed team benchmarks negatively
   **When** scoring
   **Then** points are deducted (up to -15 per metric)

## Tasks / Subtasks

- [x] **Task 1: Define Team Benchmarks** (AC: #3, #4, #5, #7)
  - [x] Define default benchmark values in configuration
  - [x] promptsPerTask baseline: 5.8
  - [x] contextResetsPerSession baseline: 0.5
  - [x] debuggingLoopAverage baseline: 3.0
  - [ ] Allow team-specific benchmark overrides (future - deferred)

- [x] **Task 2: Implement Efficiency Calculator** (AC: #1, #2)
  - [x] Create `/app/lib/analysis/workflow-efficiency.ts`
  - [x] Define `EfficiencyMetrics` interface
  - [x] Implement `calculateEfficiency(userMetrics)` function
  - [x] Calculate each efficiency metric from input data

- [x] **Task 3: Implement Scoring Algorithm** (AC: #2, #3, #4, #5, #6, #7)
  - [x] Start with baseline score of 50
  - [x] Add/subtract points based on metric comparisons
  - [x] Cap score between 0 and 100
  - [x] Determine benchmark level from score

- [x] **Task 4: Implement Metric Calculations** (AC: #1)
  - [x] promptsPerTask = totalPrompts / completedTasks
  - [x] contextResetsPerSession = contextResets / totalSessions
  - [x] debuggingLoopAverage = debuggingPrompts / debuggingResolutions
  - [x] timeToResolutionMinutes = totalTimeMinutes / completedTasks
  - [x] Handle zero denominators gracefully

- [x] **Task 5: Integrate into Analytics APIs** (AC: #1, #2)
  - [x] Add efficiency metrics to personal insights API
  - [ ] Add efficiency metrics to team intelligence API (future)
  - [x] Calculate from aggregated analytics data
  - [ ] Cache results appropriately (future)

- [x] **Task 6: Testing** (AC: #2, #3, #4, #5, #6, #7)
  - [x] Write unit tests for each metric calculation
  - [x] Write unit tests for scoring algorithm
  - [x] Write unit tests for benchmark level determination
  - [x] Test edge cases (zero tasks, zero sessions)
  - [x] Test boundary conditions for scoring

## Dev Notes

### EfficiencyMetrics Interface

```typescript
export interface EfficiencyMetrics {
  promptsPerTask: number;
  contextResetsPerSession: number;
  debuggingLoopAverage: number;
  timeToResolutionMinutes: number;
  efficiencyScore: number;  // 0-100
  benchmark: 'below_average' | 'average' | 'above_average' | 'excellent';
}
```

### Team Benchmarks

```typescript
const TEAM_BENCHMARKS = {
  promptsPerTask: 5.8,
  contextResetsPerSession: 0.5,
  debuggingLoopAverage: 3.0,
};
```

### Input Metrics Interface

```typescript
interface UserEfficiencyInput {
  totalPrompts: number;
  completedTasks: number;      // Derived from session goals
  contextResets: number;
  totalSessions: number;
  debuggingPrompts: number;
  debuggingResolutions: number;
  totalTimeMinutes: number;
}
```

### Scoring Algorithm

```typescript
export function calculateEfficiency(userMetrics: UserEfficiencyInput): EfficiencyMetrics {
  const promptsPerTask = userMetrics.completedTasks > 0
    ? userMetrics.totalPrompts / userMetrics.completedTasks
    : 0;

  const contextResetsPerSession = userMetrics.totalSessions > 0
    ? userMetrics.contextResets / userMetrics.totalSessions
    : 0;

  const debuggingLoopAverage = userMetrics.debuggingResolutions > 0
    ? userMetrics.debuggingPrompts / userMetrics.debuggingResolutions
    : 0;

  const timeToResolutionMinutes = userMetrics.completedTasks > 0
    ? userMetrics.totalTimeMinutes / userMetrics.completedTasks
    : 0;

  // Calculate efficiency score
  let efficiencyScore = 50; // Start at baseline

  // Prompts per task (lower is better)
  if (promptsPerTask < TEAM_BENCHMARKS.promptsPerTask * 0.8) {
    efficiencyScore += 20;
  } else if (promptsPerTask < TEAM_BENCHMARKS.promptsPerTask) {
    efficiencyScore += 10;
  } else if (promptsPerTask > TEAM_BENCHMARKS.promptsPerTask * 1.5) {
    efficiencyScore -= 15;
  }

  // Context resets (lower is better)
  if (contextResetsPerSession < TEAM_BENCHMARKS.contextResetsPerSession * 0.5) {
    efficiencyScore += 15;
  } else if (contextResetsPerSession < TEAM_BENCHMARKS.contextResetsPerSession) {
    efficiencyScore += 8;
  } else if (contextResetsPerSession > TEAM_BENCHMARKS.contextResetsPerSession * 2) {
    efficiencyScore -= 10;
  }

  // Debugging loops (lower is better)
  if (debuggingLoopAverage < TEAM_BENCHMARKS.debuggingLoopAverage * 0.7) {
    efficiencyScore += 15;
  } else if (debuggingLoopAverage < TEAM_BENCHMARKS.debuggingLoopAverage) {
    efficiencyScore += 8;
  }

  // Cap score
  efficiencyScore = Math.max(0, Math.min(100, efficiencyScore));

  // Determine benchmark level
  const benchmark: EfficiencyBenchmark =
    efficiencyScore >= 80 ? 'excellent' :
    efficiencyScore >= 60 ? 'above_average' :
    efficiencyScore >= 40 ? 'average' : 'below_average';

  return {
    promptsPerTask,
    contextResetsPerSession,
    debuggingLoopAverage,
    timeToResolutionMinutes,
    efficiencyScore,
    benchmark,
  };
}
```

### Benchmark Comparison Table

| Metric | Excellent (<) | Good (<) | Poor (>) | Very Poor (>) |
|--------|---------------|----------|----------|---------------|
| promptsPerTask | 4.6 (80%) | 5.8 (100%) | 8.7 (150%) | - |
| contextResetsPerSession | 0.25 (50%) | 0.5 (100%) | 1.0 (200%) | - |
| debuggingLoopAverage | 2.1 (70%) | 3.0 (100%) | - | - |

### Scoring Points Summary

| Condition | Points |
|-----------|--------|
| promptsPerTask < 80% benchmark | +20 |
| promptsPerTask < 100% benchmark | +10 |
| promptsPerTask > 150% benchmark | -15 |
| contextResets < 50% benchmark | +15 |
| contextResets < 100% benchmark | +8 |
| contextResets > 200% benchmark | -10 |
| debuggingLoop < 70% benchmark | +15 |
| debuggingLoop < 100% benchmark | +8 |

### Dependencies

- Story 21.1 (Context Management) - for context reset tracking
- Story 21.2 (Work Style) - for debugging prompt detection
- Session/task tracking for completed task counts

### Future Enhancements

- Dynamic team benchmarks (calculated from actual team data)
- Project-specific benchmarks
- Role-adjusted benchmarks (different expectations for senior vs junior)


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
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Team Benchmarks Configuration**: Created TEAM_BENCHMARKS constant with:
   - promptsPerTask: 5.8
   - contextResetsPerSession: 0.5
   - debuggingLoopAverage: 3.0

2. **Efficiency Calculator**: Implemented `calculateWorkflowEfficiency()` function that takes `UserEfficiencyInput` and returns `WorkflowEfficiencyMetrics` including:
   - promptsPerTask, contextResetsPerSession, debuggingLoopAverage, timeToResolutionMinutes
   - efficiencyScore (0-100), benchmark level

3. **Scoring Algorithm**: Implemented per story spec:
   - Base score of 50
   - +20 for promptsPerTask < 80% benchmark
   - +10 for promptsPerTask < 100% benchmark
   - -15 for promptsPerTask > 150% benchmark
   - +15 for contextResets < 50% benchmark
   - +8 for contextResets < 100% benchmark
   - -10 for contextResets > 200% benchmark
   - +15 for debuggingLoop < 70% benchmark
   - +8 for debuggingLoop < 100% benchmark
   - Score capped between 0 and 100

4. **Benchmark Levels**: Implemented `determineBenchmarkLevel()`:
   - >= 80: 'excellent'
   - >= 60: 'above_average'
   - >= 40: 'average'
   - < 40: 'below_average'

5. **Zero Denominator Handling**: All metric calculations return 0 when denominator is zero

6. **API Integration**: Created `/api/analytics/workflow` endpoint with:
   - Date range filtering (default: last 30 days)
   - Returns metrics, benchmarks, and input data

7. **Tests**: 40 comprehensive unit tests covering all acceptance criteria

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2025-12-23 | Initial implementation - Story 21-10 complete | Claude Opus 4.5 |

### File List

**Created:**
- `/app/lib/analysis/workflow-efficiency.ts` - Core efficiency calculator
- `/app/lib/analysis/__tests__/workflow-efficiency.test.ts` - 40 unit tests
- `/app/app/api/analytics/workflow/route.ts` - Workflow efficiency API endpoint

**Modified:**
- `/app/lib/analysis/index.ts` - Added exports for workflow efficiency module
