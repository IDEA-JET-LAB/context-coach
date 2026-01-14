# Epic 31: Project Stage Analytics

## Overview

Analyze conversations to detect project stages (development, testing, debugging, planning, etc.) and visualize how time and effort are distributed across stages within a project.

**Key Insight**: Stage detection requires conversation context - a single prompt like "yes" or "continue" can't be classified in isolation. We need to track the conversation flow to detect when stages begin and end, then propagate that context.

## Goals

1. Detect project stage for each prompt using conversation context
2. Track stage transitions within conversations (development → debugging → testing)
3. Calculate actual active time per stage (excluding gaps > 30 minutes)
4. Visualize stage distribution at conversation and project levels
5. Enable on-demand analysis via UI button (real-time integration later)

## User Stories

### Story 31-1: Conversation-Aware Stage Detector (5 points)

**Description**: Create a service that analyzes an entire conversation to detect stages and transitions, then assigns a stage to each prompt.

**Acceptance Criteria**:
- [ ] Analyze prompts in sequence (not isolation)
- [ ] Detect stage transitions based on signal prompts
- [ ] Propagate stage forward until new stage detected
- [ ] Handle ambiguous prompts (confirmations, selections) by inheriting previous stage
- [ ] Return array of `{ promptId, detectedStage, confidence, isTransitionPoint }`
- [ ] Unit tests with real conversation examples

**Technical Approach**:
```typescript
interface StageDetectionResult {
  promptId: string;
  detectedStage: ProjectStage;
  confidence: number;
  isTransitionPoint: boolean; // True if this prompt started a new stage
}

// Algorithm:
// 1. Iterate through prompts in sequence
// 2. For each prompt, check if it signals a stage transition
// 3. If yes, update current stage
// 4. If no (confirmation, continuation), inherit previous stage
// 5. Track confidence based on signal strength
```

**Stage Signal Patterns**:
| Stage | Signal Patterns |
|-------|-----------------|
| planning | "let's plan", "how should we", "what's the approach", "architecture" |
| development | "implement", "create", "add feature", "build", file creation signals |
| testing | "test", "spec", "e2e", "playwright", "jest", "run tests" |
| debugging | "fix", "bug", "error", "not working", "broken", "why is" |
| refactoring | "refactor", "clean up", "improve", "optimize" |
| documentation | "document", "readme", "comments", "explain" |
| deployment | "deploy", "release", "production", "ci/cd" |
| review | "review", "check", "looks good", "lgtm" |

---

### Story 31-2: Stage Persistence & Backfill (3 points)

**Description**: Store detected stages on prompts and create a batch job to backfill existing conversations.

**Acceptance Criteria**:
- [ ] Update `detected_stage` column on prompts table
- [ ] Create batch processing function for a session
- [ ] Create batch processing function for a project (all sessions)
- [ ] Track processing status (pending, processing, complete, error)
- [ ] Handle partial failures gracefully
- [ ] API endpoint: `POST /api/projects/{id}/analyze-stages`

**Database Changes**:
```sql
-- Add processing tracking
ALTER TABLE sessions ADD COLUMN stage_analysis_status TEXT DEFAULT 'pending';
ALTER TABLE sessions ADD COLUMN stage_analysis_at TIMESTAMPTZ;

-- Index for faster queries
CREATE INDEX idx_prompts_detected_stage ON prompts(detected_stage) WHERE detected_stage IS NOT NULL;
```

---

### Story 31-3: Active Time Calculator (3 points)

**Description**: Calculate actual active work time per stage, excluding gaps > 30 minutes.

**Acceptance Criteria**:
- [ ] Detect time gaps between consecutive prompts
- [ ] Exclude gaps > 30 minutes from active time
- [ ] Calculate active time per stage within a session
- [ ] Aggregate active time per stage across project
- [ ] Return breakdown: `{ stage: string, activeMinutes: number, promptCount: number }`

**Algorithm**:
```typescript
interface TimeSegment {
  stage: ProjectStage;
  startTime: Date;
  endTime: Date;
  activeMinutes: number;
  promptCount: number;
  gapsExcluded: number; // Count of gaps filtered out
}

function calculateActiveTime(prompts: Prompt[]): TimeSegment[] {
  const GAP_THRESHOLD_MINUTES = 30;
  // Group consecutive prompts by stage
  // For each group, sum time between prompts (excluding gaps > threshold)
}
```

---

### Story 31-4: Session Stage Summary (2 points)

**Description**: Update session records with stage breakdown summary after analysis.

**Acceptance Criteria**:
- [ ] Update `stage_breakdown` JSONB on sessions table
- [ ] Update `primary_stage` (most time spent)
- [ ] Store active time per stage in breakdown
- [ ] Trigger summary update after stage detection completes

**Data Structure**:
```typescript
interface SessionStageBreakdown {
  stages: {
    [stage: string]: {
      promptCount: number;
      activeMinutes: number;
      percentage: number; // Of total active time
    };
  };
  totalActiveMinutes: number;
  primaryStage: ProjectStage;
  transitionCount: number; // How many times stage changed
}
```

---

### Story 31-5: Project Stage Analytics API (3 points)

**Description**: Create API endpoints for project-level stage analytics.

**Acceptance Criteria**:
- [ ] `GET /api/projects/{id}/stage-analytics` - Get aggregated stage data
- [ ] `POST /api/projects/{id}/analyze-stages` - Trigger analysis job
- [ ] `GET /api/projects/{id}/stage-analytics/timeline` - Timeline data for visualization
- [ ] Include time range filtering (last 7 days, 30 days, all time)
- [ ] Return processing status for in-progress analysis

**Response Structure**:
```typescript
interface ProjectStageAnalytics {
  projectId: string;
  analysisStatus: 'pending' | 'processing' | 'complete';
  lastAnalyzedAt: string | null;

  summary: {
    totalActiveMinutes: number;
    totalPrompts: number;
    sessionsAnalyzed: number;
    stageBreakdown: {
      [stage: string]: {
        activeMinutes: number;
        promptCount: number;
        percentage: number;
      };
    };
  };

  timeline: Array<{
    date: string;
    stages: { [stage: string]: { minutes: number; prompts: number } };
  }>;
}
```

---

### Story 31-6: Stage Analysis UI Trigger (2 points)

**Description**: Add button to conversations view to trigger stage analysis for a project.

**Acceptance Criteria**:
- [ ] Add "Analyze Stages" button to project conversations page
- [ ] Show processing state while analysis runs
- [ ] Show success/error feedback
- [ ] Disable button while analysis in progress
- [ ] Show "Last analyzed: X" timestamp

**UI Location**: Conversations page header, near filters

---

### Story 31-7: Conversation Stage Badges (3 points)

**Description**: Display multiple stage badges on conversation cards showing stages present in that conversation.

**Acceptance Criteria**:
- [ ] Show up to 3 stage badges on conversation card
- [ ] Order by time spent (primary stage first)
- [ ] Show "+" indicator if more than 3 stages
- [ ] Tooltip showing full breakdown on hover
- [ ] Update existing `StageBadge` component for multiple badges

**UI Mockup**:
```
┌─────────────────────────────────────────────────────┐
│ Implement auth feature                               │
│ 2h 15m • 34 prompts                                 │
│ [Development] [Debugging] [Testing]                  │
│ Started: Jan 9, 2026 10:30 AM                       │
└─────────────────────────────────────────────────────┘
```

---

### Story 31-8: Project Stage Timeline Visualization (5 points)

**Description**: Create a timeline visualization showing stage distribution over time for a project.

**Acceptance Criteria**:
- [ ] Horizontal timeline with dates on X-axis
- [ ] Stacked bar or area chart showing stage distribution
- [ ] Hover for detailed breakdown per day/week
- [ ] Filter by date range
- [ ] Responsive design for different screen sizes
- [ ] Use existing design system colors for stages

**Chart Options**:
- Stacked area chart (shows flow over time)
- Stacked bar chart (discrete time periods)
- Swimlane view (stages as horizontal lanes)

---

### Story 31-9: Stage Analytics Dashboard (3 points)

**Description**: Create a dashboard view for project stage analytics.

**Acceptance Criteria**:
- [ ] Summary cards: Total time, Primary stage, Stage count
- [ ] Pie/donut chart: Time distribution by stage
- [ ] Bar chart: Prompt count by stage
- [ ] Recent activity: Last 5 conversations with stages
- [ ] Link to timeline view

**Dashboard Location**: New tab in project view or dedicated analytics page

---

## Technical Considerations

### Detection Algorithm

The stage detector should work like a state machine:

```
Initial State: "unknown"

For each prompt in sequence:
  1. Check if prompt contains strong stage signals
  2. If yes → transition to new stage, mark as transition point
  3. If no → inherit previous stage
  4. Store: { promptId, stage, confidence, isTransition }
```

**Handling Edge Cases**:
- First prompt: Use signal detection or default to "development"
- Slash commands: `/commit` → development, `/test` → testing
- Confirmations ("yes", "ok"): Inherit previous stage
- Mixed signals: Use confidence scores, pick highest

### Performance

- Analyze conversations in batches (not all at once)
- Use database transactions for consistency
- Consider background job queue for large projects
- Cache project-level aggregates

### Gap Detection

```typescript
const GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

function isGap(prevTimestamp: Date, currTimestamp: Date): boolean {
  return currTimestamp.getTime() - prevTimestamp.getTime() > GAP_THRESHOLD_MS;
}
```

---

## Story Dependencies

```
31-1 (Detector) ─────┬──→ 31-2 (Persistence) ──→ 31-4 (Session Summary)
                     │                              │
                     │                              ▼
                     └──→ 31-3 (Time Calculator) ──→ 31-5 (Project API)
                                                       │
                                                       ▼
31-6 (UI Trigger) ◄────────────────────────────────────┘
       │
       ▼
31-7 (Badges) ──→ 31-8 (Timeline) ──→ 31-9 (Dashboard)
```

**Recommended Order**:
1. 31-1: Stage Detector (foundation)
2. 31-3: Time Calculator (can parallelize with 31-2)
3. 31-2: Persistence & Backfill
4. 31-4: Session Summary
5. 31-5: Project API
6. 31-6: UI Trigger
7. 31-7: Conversation Badges
8. 31-8: Timeline Visualization
9. 31-9: Dashboard

---

## Success Metrics

- Stage detection accuracy: >85% agreement with manual classification
- Processing speed: <5 seconds for a 100-prompt conversation
- Active time accuracy: Within 5% of manual calculation
- User adoption: >50% of projects have run stage analysis within 30 days

---

## Future Enhancements

1. **Real-time classification**: Detect stage during prompt capture
2. **Stage predictions**: Suggest likely next stage based on patterns
3. **Team comparisons**: Compare stage distribution across team members
4. **Anomaly detection**: Flag unusual patterns (too much debugging?)
5. **AI-powered refinement**: Use LLM to improve classification for ambiguous cases

---

## Total Points: 29

| Story | Points | Priority |
|-------|--------|----------|
| 31-1: Stage Detector | 5 | P0 |
| 31-2: Persistence & Backfill | 3 | P0 |
| 31-3: Active Time Calculator | 3 | P0 |
| 31-4: Session Summary | 2 | P1 |
| 31-5: Project Stage API | 3 | P1 |
| 31-6: UI Trigger | 2 | P1 |
| 31-7: Conversation Badges | 3 | P2 |
| 31-8: Timeline Visualization | 5 | P2 |
| 31-9: Stage Dashboard | 3 | P2 |
