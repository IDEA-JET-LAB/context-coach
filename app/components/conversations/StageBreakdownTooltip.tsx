"use client";

import { cn } from "@/lib/utils";
import {
  SessionStageBreakdown,
  ProjectStage,
  STAGE_CONFIG,
  formatDuration,
} from "./types";

interface StageBreakdownTooltipProps {
  breakdown: SessionStageBreakdown;
  className?: string;
}

/**
 * StageBreakdownTooltip - Displays detailed stage breakdown information
 *
 * Shows all stages with:
 * - Stage name and time
 * - Percentage bar visualization
 * - Total active time
 * - Transition count
 */
export function StageBreakdownTooltip({
  breakdown,
  className,
}: StageBreakdownTooltipProps) {
  // Sort stages by active minutes (descending)
  const sortedStages = Object.entries(breakdown.stages)
    .filter(([, data]) => data.activeMinutes > 0 || data.promptCount > 0)
    .sort(([, a], [, b]) => b.activeMinutes - a.activeMinutes);

  if (sortedStages.length === 0) {
    return (
      <div className={cn("p-2 text-xs", className)}>
        No stage data available
      </div>
    );
  }

  return (
    <div
      className={cn("p-3 min-w-[200px] max-w-[280px]", className)}
      data-testid="stage-breakdown-tooltip"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-border/50">
        <span className="font-medium text-xs">Stage Breakdown</span>
        <span className="text-[10px] text-muted-foreground">
          {breakdown.transitionCount} transition
          {breakdown.transitionCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Stage List */}
      <div className="space-y-2">
        {sortedStages.map(([stage, data]) => {
          const config = STAGE_CONFIG[stage as ProjectStage] || STAGE_CONFIG.unknown;

          return (
            <div key={stage} className="space-y-0.5">
              {/* Stage name and time */}
              <div className="flex justify-between items-center text-xs">
                <span className={cn("font-medium", config.color)}>
                  {config.label}
                </span>
                <span className="text-muted-foreground">
                  {formatDuration(Math.round(data.activeMinutes))}
                  <span className="ml-1 text-[10px]">
                    ({data.promptCount} prompt{data.promptCount !== 1 ? "s" : ""})
                  </span>
                </span>
              </div>

              {/* Percentage bar */}
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", config.bgColor)}
                  style={{
                    width: `${Math.max(data.percentage, 2)}%`,
                    backgroundColor:
                      config.color === "text-muted-foreground"
                        ? "hsl(var(--muted-foreground) / 0.5)"
                        : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with totals */}
      <div className="mt-3 pt-2 border-t border-border/50 flex justify-between text-[10px] text-muted-foreground">
        <span>
          Total: {formatDuration(Math.round(breakdown.totalActiveMinutes))}
        </span>
        <span>{breakdown.totalPrompts} prompts</span>
      </div>
    </div>
  );
}

export default StageBreakdownTooltip;
