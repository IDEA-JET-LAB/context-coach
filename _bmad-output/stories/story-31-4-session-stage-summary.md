# Story 31-4: Session Stage Summary

## Story Info
- **Epic:** 31 - Project Stage Analytics
- **Priority:** P1
- **Points:** 2
- **Status:** Done

## Description

Update session records with stage breakdown summary after analysis. This stores aggregated stage data on the session for fast retrieval without re-computing.

## Acceptance Criteria

- [x] Update `stage_breakdown` JSONB on sessions table after stage analysis
- [x] Update `primary_stage` to stage with most active time
- [x] Store active time per stage in breakdown
- [x] Trigger summary update after stage detection completes
- [x] Handle re-analysis (overwrite existing data)

## Technical Details

### Data Structure

```typescript
// Stored in sessions.stage_breakdown JSONB column

interface SessionStageBreakdown {
  stages: {
    [stage: string]: {
      promptCount: number;
      activeMinutes: number;
      percentage: number;  // Of total active time
    };
  };
  totalActiveMinutes: number;
  totalPrompts: number;
  transitionCount: number;  // How many times stage changed
  gapsExcluded: number;     // Gaps > 30 min filtered out
  analyzedAt: string;       // ISO timestamp
}
```

### Implementation

```typescript
// lib/analysis/stage-summary.ts

import { createServerClient } from '@/lib/supabase/server';
import { calculateSessionActiveTime, SessionTimeResult } from './active-time-calculator';
import type { ProjectStage } from '@/lib/types/conversations';

export interface SessionStageSummary {
  primaryStage: ProjectStage;
  stageBreakdown: SessionStageBreakdown;
}

/**
 * Calculates and stores session stage summary.
 */
export async function updateSessionStageSummary(
  sessionId: string,
  timeResult: SessionTimeResult
): Promise<void> {
  const supabase = await createServerClient();

  // Determine primary stage (most active time)
  const primaryStage = timeResult.stages.length > 0
    ? timeResult.stages[0].stage  // Already sorted by activeMinutes desc
    : 'unknown';

  // Build breakdown structure
  const breakdown: SessionStageBreakdown = {
    stages: {},
    totalActiveMinutes: timeResult.totalActiveMinutes,
    totalPrompts: timeResult.totalPrompts,
    transitionCount: timeResult.segments.length - 1,  // Transitions = segments - 1
    gapsExcluded: timeResult.gapsExcluded,
    analyzedAt: new Date().toISOString(),
  };

  for (const stage of timeResult.stages) {
    breakdown.stages[stage.stage] = {
      promptCount: stage.promptCount,
      activeMinutes: stage.activeMinutes,
      percentage: stage.percentage,
    };
  }

  // Update session
  const { error } = await supabase
    .from('sessions')
    .update({
      primary_stage: primaryStage,
      stage_breakdown: breakdown,
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to update session stage summary: ${error.message}`);
  }
}

/**
 * Batch update summaries after project analysis.
 */
export async function updateProjectStageSummaries(
  sessionResults: Map<string, SessionTimeResult>
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  for (const [sessionId, result] of sessionResults) {
    try {
      await updateSessionStageSummary(sessionId, result);
      updated++;
    } catch (error) {
      errors.push(`Session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { updated, errors };
}
```

### Integration with Stage Persistence

Update `story-31-2` persistence to call summary update:

```typescript
// In stage-persistence.ts, after detectConversationStages():

// Calculate active time
const timeResult = calculateSessionActiveTime(
  results.map(r => ({
    id: r.promptId,
    timestamp: prompts.find(p => p.id === r.promptId)!.created_at,
    detectedStage: r.detectedStage,
  }))
);
timeResult.sessionId = sessionId;

// Update session summary
await updateSessionStageSummary(sessionId, timeResult);
```

## Tests

### Unit Tests

```typescript
describe('SessionStageSummary', () => {
  describe('updateSessionStageSummary', () => {
    it('should determine correct primary stage');
    it('should calculate transition count');
    it('should store all stage data');
    it('should handle single-stage sessions');
    it('should overwrite existing breakdown on re-analysis');
  });

  describe('updateProjectStageSummaries', () => {
    it('should update all sessions');
    it('should continue on individual failures');
    it('should return accurate counts');
  });
});
```

## Dependencies

- Story 31-1: Stage Detector
- Story 31-2: Stage Persistence
- Story 31-3: Active Time Calculator

## Definition of Done

- [x] `updateSessionStageSummary()` implemented
- [x] Integration with stage persistence pipeline
- [x] Session fields updated correctly
- [x] Unit tests passing
- [x] Re-analysis overwrites correctly
