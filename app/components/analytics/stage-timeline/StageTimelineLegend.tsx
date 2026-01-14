"use client";

/**
 * Stage Timeline Legend - Story 31-8
 *
 * Displays a legend showing stage colors for the timeline chart.
 */

import { STAGE_CONFIG, type ProjectStage } from "@/components/conversations/types";
import { STAGE_COLORS } from "./constants";

interface StageTimelineLegendProps {
  /** Stages to display in the legend */
  stages: ProjectStage[];
  /** Optional class name for styling */
  className?: string;
}

/**
 * Renders a horizontal legend showing stage names with their corresponding colors.
 */
export function StageTimelineLegend({ stages, className }: StageTimelineLegendProps) {
  if (stages.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap gap-3 text-sm ${className || ""}`}
      data-testid="stage-timeline-legend"
    >
      {stages.map((stage) => {
        const config = STAGE_CONFIG[stage];
        const colors = STAGE_COLORS[stage];

        return (
          <div
            key={stage}
            className="flex items-center gap-1.5"
            data-testid={`legend-item-${stage}`}
          >
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: colors.stroke }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        );
      })}
    </div>
  );
}
