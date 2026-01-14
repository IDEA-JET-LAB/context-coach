# Story 31-3: Active Time Calculator

## Story Info
- **Epic:** 31 - Project Stage Analytics
- **Priority:** P0 (Foundation)
- **Points:** 3
- **Status:** Done

## Description

Calculate actual active work time per stage, excluding gaps longer than 30 minutes. This ensures time metrics reflect actual work rather than sessions left open overnight or during long breaks.

## Acceptance Criteria

- [x] Detect time gaps between consecutive prompts
- [x] Exclude gaps > 30 minutes from active time calculation
- [x] Calculate active time per stage within a session
- [x] Aggregate active time per stage across all project sessions
- [x] Return breakdown: `{ stage, activeMinutes, promptCount, gapsExcluded }`
- [x] Configurable gap threshold (default 30 minutes)
- [x] Handle edge cases (single prompt, all gaps, etc.)

## Technical Details

### File Structure

```
app/lib/analysis/
├── active-time-calculator.ts   # Main calculator
├── __tests__/
│   └── active-time-calculator.test.ts
```

### Types

```typescript
// lib/analysis/active-time-calculator.ts

import type { ProjectStage } from '@/lib/types/conversations';

export interface TimeSegment {
  stage: ProjectStage;
  startTime: Date;
  endTime: Date;
  activeMinutes: number;
  promptCount: number;
}

export interface StageTimeBreakdown {
  stage: ProjectStage;
  activeMinutes: number;
  promptCount: number;
  percentage: number;        // Of total active time
  gapsExcluded: number;      // Count of gaps filtered out
}

export interface SessionTimeResult {
  sessionId: string;
  totalActiveMinutes: number;
  totalPrompts: number;
  gapsExcluded: number;
  totalGapMinutes: number;   // Time excluded due to gaps
  stages: StageTimeBreakdown[];
  segments: TimeSegment[];   // Chronological segments
}

export interface ProjectTimeResult {
  projectId: string;
  totalActiveMinutes: number;
  totalPrompts: number;
  sessionsAnalyzed: number;
  stages: StageTimeBreakdown[];
  dailyBreakdown: Array<{
    date: string;
    stages: Record<ProjectStage, { minutes: number; prompts: number }>;
  }>;
}

export interface ActiveTimeOptions {
  gapThresholdMinutes?: number;  // Default: 30
}
```

### Algorithm

```typescript
// lib/analysis/active-time-calculator.ts

const DEFAULT_GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface PromptWithStage {
  id: string;
  timestamp: string;
  detectedStage: ProjectStage;
}

/**
 * Calculates active time per stage for a session.
 * Excludes gaps > threshold from time calculations.
 */
export function calculateSessionActiveTime(
  prompts: PromptWithStage[],
  options: ActiveTimeOptions = {}
): SessionTimeResult {
  const gapThresholdMs = (options.gapThresholdMinutes || 30) * 60 * 1000;

  if (prompts.length === 0) {
    return {
      sessionId: '',
      totalActiveMinutes: 0,
      totalPrompts: 0,
      gapsExcluded: 0,
      totalGapMinutes: 0,
      stages: [],
      segments: [],
    };
  }

  // Sort by timestamp
  const sorted = [...prompts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const segments: TimeSegment[] = [];
  const stageAccumulator: Map<ProjectStage, { minutes: number; prompts: number; gaps: number }> = new Map();

  let gapsExcluded = 0;
  let totalGapMinutes = 0;
  let currentSegmentStart = new Date(sorted[0].timestamp);
  let currentStage = sorted[0].detectedStage;
  let currentSegmentPrompts = 1;
  let lastPromptTime = new Date(sorted[0].timestamp);

  for (let i = 1; i < sorted.length; i++) {
    const prompt = sorted[i];
    const promptTime = new Date(prompt.timestamp);
    const timeSinceLastPrompt = promptTime.getTime() - lastPromptTime.getTime();

    const isGap = timeSinceLastPrompt > gapThresholdMs;
    const isStageChange = prompt.detectedStage !== currentStage;

    if (isGap || isStageChange) {
      // Close current segment
      const segmentEnd = isGap ? lastPromptTime : promptTime;
      const segmentMinutes = (segmentEnd.getTime() - currentSegmentStart.getTime()) / 60000;

      if (segmentMinutes > 0) {
        segments.push({
          stage: currentStage,
          startTime: currentSegmentStart,
          endTime: segmentEnd,
          activeMinutes: Math.max(0, segmentMinutes),
          promptCount: currentSegmentPrompts,
        });

        // Accumulate to stage totals
        const existing = stageAccumulator.get(currentStage) || { minutes: 0, prompts: 0, gaps: 0 };
        existing.minutes += segmentMinutes;
        existing.prompts += currentSegmentPrompts;
        stageAccumulator.set(currentStage, existing);
      }

      if (isGap) {
        gapsExcluded++;
        totalGapMinutes += timeSinceLastPrompt / 60000;

        // Track gap in stage accumulator
        const existing = stageAccumulator.get(currentStage) || { minutes: 0, prompts: 0, gaps: 0 };
        existing.gaps++;
        stageAccumulator.set(currentStage, existing);
      }

      // Start new segment
      currentSegmentStart = promptTime;
      currentStage = prompt.detectedStage;
      currentSegmentPrompts = 1;
    } else {
      currentSegmentPrompts++;
    }

    lastPromptTime = promptTime;
  }

  // Close final segment (add small buffer for last prompt)
  const finalSegmentMinutes = Math.max(
    1, // At least 1 minute for final segment
    (lastPromptTime.getTime() - currentSegmentStart.getTime()) / 60000
  );

  segments.push({
    stage: currentStage,
    startTime: currentSegmentStart,
    endTime: lastPromptTime,
    activeMinutes: finalSegmentMinutes,
    promptCount: currentSegmentPrompts,
  });

  const existing = stageAccumulator.get(currentStage) || { minutes: 0, prompts: 0, gaps: 0 };
  existing.minutes += finalSegmentMinutes;
  existing.prompts += currentSegmentPrompts;
  stageAccumulator.set(currentStage, existing);

  // Calculate totals and percentages
  const totalActiveMinutes = Array.from(stageAccumulator.values())
    .reduce((sum, s) => sum + s.minutes, 0);

  const stages: StageTimeBreakdown[] = Array.from(stageAccumulator.entries())
    .map(([stage, data]) => ({
      stage,
      activeMinutes: Math.round(data.minutes * 10) / 10,
      promptCount: data.prompts,
      percentage: totalActiveMinutes > 0
        ? Math.round((data.minutes / totalActiveMinutes) * 100)
        : 0,
      gapsExcluded: data.gaps,
    }))
    .sort((a, b) => b.activeMinutes - a.activeMinutes);

  return {
    sessionId: '',
    totalActiveMinutes: Math.round(totalActiveMinutes * 10) / 10,
    totalPrompts: sorted.length,
    gapsExcluded,
    totalGapMinutes: Math.round(totalGapMinutes),
    stages,
    segments,
  };
}

/**
 * Aggregates active time across multiple sessions for a project.
 */
export function calculateProjectActiveTime(
  sessionResults: SessionTimeResult[]
): Omit<ProjectTimeResult, 'projectId' | 'dailyBreakdown'> {
  const stageAccumulator: Map<ProjectStage, { minutes: number; prompts: number; gaps: number }> = new Map();

  let totalMinutes = 0;
  let totalPrompts = 0;

  for (const session of sessionResults) {
    totalMinutes += session.totalActiveMinutes;
    totalPrompts += session.totalPrompts;

    for (const stage of session.stages) {
      const existing = stageAccumulator.get(stage.stage) || { minutes: 0, prompts: 0, gaps: 0 };
      existing.minutes += stage.activeMinutes;
      existing.prompts += stage.promptCount;
      existing.gaps += stage.gapsExcluded;
      stageAccumulator.set(stage.stage, existing);
    }
  }

  const stages: StageTimeBreakdown[] = Array.from(stageAccumulator.entries())
    .map(([stage, data]) => ({
      stage,
      activeMinutes: Math.round(data.minutes * 10) / 10,
      promptCount: data.prompts,
      percentage: totalMinutes > 0
        ? Math.round((data.minutes / totalMinutes) * 100)
        : 0,
      gapsExcluded: data.gaps,
    }))
    .sort((a, b) => b.activeMinutes - a.activeMinutes);

  return {
    totalActiveMinutes: Math.round(totalMinutes * 10) / 10,
    totalPrompts,
    sessionsAnalyzed: sessionResults.length,
    stages,
  };
}
```

### Example

```
Session Timeline:
10:00 [development] - Prompt 1
10:05 [development] - Prompt 2
10:10 [development] - Prompt 3
10:15 [debugging]   - Prompt 4 (transition!)
10:20 [debugging]   - Prompt 5
----- 2 hour gap (lunch) -----
12:25 [debugging]   - Prompt 6
12:30 [testing]     - Prompt 7 (transition!)
12:35 [testing]     - Prompt 8

Result:
- Development: 15 min (prompts 1-3)
- Debugging: 5 min (prompts 4-5) + 5 min (prompt 6) = 10 min
- Testing: 10 min (prompts 7-8)
- Gap excluded: 1 (2 hour lunch)
- Total active: 35 min
```

## Tests

### Unit Tests

```typescript
describe('ActiveTimeCalculator', () => {
  describe('calculateSessionActiveTime', () => {
    it('should calculate time for continuous prompts');
    it('should exclude gaps > 30 minutes');
    it('should handle stage transitions');
    it('should handle single prompt');
    it('should handle empty prompts array');
    it('should respect custom gap threshold');
    it('should calculate correct percentages');
  });

  describe('calculateProjectActiveTime', () => {
    it('should aggregate across multiple sessions');
    it('should handle sessions with different stages');
    it('should maintain accurate totals');
  });

  describe('gap detection', () => {
    it('should detect 31 minute gap as excluded');
    it('should include 29 minute gap in active time');
    it('should handle multiple gaps in one session');
    it('should handle overnight sessions correctly');
  });
});
```

## Dependencies

- Story 31-1: Stage Detector (provides detected_stage data)

## Definition of Done

- [x] `calculateSessionActiveTime()` implemented
- [x] `calculateProjectActiveTime()` implemented
- [x] Gap detection working correctly
- [x] Stage transitions handled
- [x] Edge cases covered (single prompt, all gaps, etc.)
- [x] Unit tests passing (>90% coverage)
- [x] Performance: <50ms for 1000-prompt session
