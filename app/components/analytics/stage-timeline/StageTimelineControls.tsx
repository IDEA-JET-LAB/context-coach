"use client";

/**
 * Stage Timeline Controls - Story 31-8
 *
 * Filter controls for date range and granularity selection.
 */

import { Button } from "@/components/ui/button";
import { TIME_RANGE_OPTIONS, GRANULARITY_OPTIONS } from "./constants";
import type { TimeRangeFilter, TimelineGranularity } from "@/lib/types/stage-analytics";

interface StageTimelineControlsProps {
  /** Currently selected time range */
  range: TimeRangeFilter;
  /** Currently selected granularity */
  granularity: TimelineGranularity;
  /** Callback when range changes */
  onRangeChange: (range: TimeRangeFilter) => void;
  /** Callback when granularity changes */
  onGranularityChange: (granularity: TimelineGranularity) => void;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Renders filter controls for the stage timeline chart.
 */
export function StageTimelineControls({
  range,
  granularity,
  onRangeChange,
  onGranularityChange,
  className,
}: StageTimelineControlsProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-4 ${className || ""}`}
      data-testid="stage-timeline-controls"
    >
      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Range:</span>
        <div className="flex gap-1" role="group" aria-label="Time range">
          {TIME_RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={range === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => onRangeChange(option.value)}
              data-testid={`range-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Granularity Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">View:</span>
        <div className="flex gap-1" role="group" aria-label="Granularity">
          {GRANULARITY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={granularity === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => onGranularityChange(option.value)}
              data-testid={`granularity-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
