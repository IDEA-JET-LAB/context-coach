# Story 31-7: Conversation Stage Badges

## Story Info
- **Epic:** 31 - Project Stage Analytics
- **Priority:** P2
- **Points:** 3
- **Status:** Done

## Description

Display multiple stage badges on conversation cards showing stages present in that conversation. Unlike the current single-stage display, this shows all stages that occurred during a conversation.

## Acceptance Criteria

- [x] Show up to 3 stage badges on conversation card
- [x] Order by time spent (primary stage first)
- [x] Show "+N" indicator if more than 3 stages
- [x] Tooltip showing full breakdown on hover
- [x] Update existing `StageBadge` component for multiple badges
- [x] Handle conversations with no stage data gracefully
- [x] Visual distinction for transition-heavy conversations

## Technical Details

### Component

```typescript
// components/conversations/ConversationStageBadges.tsx

"use client";

import { StageBadge } from "./StageBadge";
import { ProjectStage, StageBreakdown } from "./types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ConversationStageBadgesProps {
  stageBreakdown: StageBreakdown | null;
  primaryStage: ProjectStage | null;
  maxBadges?: number;
  size?: "sm" | "md";
  className?: string;
}

export function ConversationStageBadges({
  stageBreakdown,
  primaryStage,
  maxBadges = 3,
  size = "sm",
  className,
}: ConversationStageBadgesProps) {
  // No stage data
  if (!stageBreakdown || !stageBreakdown.stages) {
    if (primaryStage) {
      return <StageBadge stage={primaryStage} size={size} />;
    }
    return null;
  }

  // Get stages sorted by active time
  const stages = Object.entries(stageBreakdown.stages)
    .map(([stage, data]) => ({
      stage: stage as ProjectStage,
      ...data,
    }))
    .sort((a, b) => b.activeMinutes - a.activeMinutes);

  if (stages.length === 0) {
    return null;
  }

  const visibleStages = stages.slice(0, maxBadges);
  const hiddenCount = stages.length - maxBadges;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1 flex-wrap", className)}>
        {visibleStages.map((stage) => (
          <Tooltip key={stage.stage}>
            <TooltipTrigger asChild>
              <div>
                <StageBadge stage={stage.stage} size={size} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="space-y-1">
                <div className="font-medium capitalize">{stage.stage}</div>
                <div className="text-muted-foreground">
                  {stage.activeMinutes} min • {stage.promptCount} prompts
                </div>
                <div className="text-muted-foreground">
                  {stage.percentage}% of session
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {hiddenCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground font-medium px-1.5 py-0.5 bg-muted rounded">
                +{hiddenCount}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="space-y-1">
                {stages.slice(maxBadges).map((stage) => (
                  <div key={stage.stage} className="flex justify-between gap-4">
                    <span className="capitalize">{stage.stage}</span>
                    <span className="text-muted-foreground">
                      {stage.activeMinutes} min
                    </span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
```

### Full Breakdown Tooltip

```typescript
// components/conversations/StageBreakdownTooltip.tsx

"use client";

import { ProjectStage, StageBreakdown } from "./types";
import { STAGE_CONFIG } from "./types";

interface StageBreakdownTooltipProps {
  breakdown: StageBreakdown;
}

export function StageBreakdownTooltip({ breakdown }: StageBreakdownTooltipProps) {
  const stages = Object.entries(breakdown.stages)
    .map(([stage, data]) => ({
      stage: stage as ProjectStage,
      ...data,
    }))
    .sort((a, b) => b.activeMinutes - a.activeMinutes);

  return (
    <div className="space-y-2 min-w-[200px]">
      <div className="font-medium text-sm">Stage Breakdown</div>

      <div className="space-y-1">
        {stages.map((stage) => {
          const config = STAGE_CONFIG[stage.stage];
          return (
            <div key={stage.stage} className="flex items-center gap-2">
              {/* Color indicator */}
              <div
                className={cn("w-2 h-2 rounded-full", config?.bgColor || "bg-muted")}
              />
              {/* Stage name */}
              <span className="capitalize text-xs flex-1">
                {config?.label || stage.stage}
              </span>
              {/* Time */}
              <span className="text-xs text-muted-foreground">
                {stage.activeMinutes}m
              </span>
              {/* Percentage bar */}
              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full", config?.bgColor || "bg-primary")}
                  style={{ width: `${stage.percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="pt-2 border-t border-border text-xs text-muted-foreground">
        <div>Total: {breakdown.totalActiveMinutes} min active</div>
        {breakdown.transitionCount > 0 && (
          <div>{breakdown.transitionCount} stage transitions</div>
        )}
      </div>
    </div>
  );
}
```

### Integration with Conversation Card

Update `ConversationCard.tsx` to use the new component:

```typescript
// In ConversationCard.tsx

import { ConversationStageBadges } from "./ConversationStageBadges";

// Replace single StageBadge with:
<ConversationStageBadges
  stageBreakdown={conversation.stageBreakdown}
  primaryStage={conversation.primaryStage}
  maxBadges={3}
  size="sm"
/>
```

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│ Implement authentication feature                                 │
│ 2h 15m • 34 prompts                                             │
│ [Development] [Debugging] [Testing] +2                          │
│         ↑            ↑         ↑      ↑                         │
│      Primary      45 min    30 min   (refactoring, review)      │
│      (60 min)                                                   │
│ Started: Jan 9, 2026 10:30 AM                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Tests

### Component Tests

```typescript
describe('ConversationStageBadges', () => {
  it('should show up to 3 stage badges');
  it('should show +N indicator for additional stages');
  it('should order by activeMinutes descending');
  it('should show tooltip on hover');
  it('should handle null stageBreakdown');
  it('should fallback to primaryStage when no breakdown');
});

describe('StageBreakdownTooltip', () => {
  it('should show all stages with times');
  it('should show percentage bars');
  it('should show total active time');
  it('should show transition count');
});
```

### E2E Tests

```typescript
describe('Conversation Stage Badges', () => {
  it('should display multiple stage badges on conversation card');
  it('should show tooltip with details on hover');
  it('should show +N indicator for many stages');
});
```

## Dependencies

- Story 31-4: Session Stage Summary (provides stageBreakdown data)
- Existing StageBadge component

## Definition of Done

- [x] ConversationStageBadges component implemented
- [x] Tooltip with full breakdown
- [x] +N indicator for overflow
- [x] Integration with ConversationCard
- [x] Component tests passing
- [x] E2E test passing
