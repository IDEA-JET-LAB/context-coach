"use client";

/**
 * Stage Timeline - Story 31-8
 *
 * Main container component for the stage timeline visualization.
 * Shows stage distribution over time for a project.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useStageTimelineData } from "@/lib/hooks/use-stage-timeline";
import { StageTimelineChart } from "./StageTimelineChart";
import { StageTimelineLegend } from "./StageTimelineLegend";
import { StageTimelineControls } from "./StageTimelineControls";
import { TIMELINE_CHART_HEIGHT } from "./constants";
import type { ProjectStage } from "@/components/conversations/types";
import type { TimeRangeFilter, TimelineGranularity } from "@/lib/types/stage-analytics";

export interface StageTimelineProps {
  /** Project ID to display timeline for */
  projectId: string;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Extracts unique stages from timeline data points.
 */
function extractUniqueStages(
  dataPoints: Array<{ stages: Record<string, unknown> }>
): ProjectStage[] {
  const stageSet = new Set<string>();

  for (const dp of dataPoints) {
    for (const stage of Object.keys(dp.stages)) {
      stageSet.add(stage);
    }
  }

  // Sort stages alphabetically for consistent legend order
  return Array.from(stageSet).sort() as ProjectStage[];
}

/**
 * Renders a loading skeleton for the timeline.
 */
function TimelineSkeleton() {
  return (
    <div data-testid="stage-timeline-skeleton">
      <div className="mb-4 flex justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="mb-4" style={{ height: TIMELINE_CHART_HEIGHT }} />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

/**
 * Renders an error state for the timeline.
 */
function TimelineError({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-8 text-center"
      style={{ minHeight: TIMELINE_CHART_HEIGHT }}
      data-testid="stage-timeline-error"
    >
      <p className="text-destructive font-medium">Failed to load timeline</p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Renders an empty state when no data is available.
 */
function TimelineEmpty() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-8 text-center"
      style={{ minHeight: TIMELINE_CHART_HEIGHT }}
      data-testid="stage-timeline-empty"
    >
      <p className="text-muted-foreground">No stage data available</p>
      <p className="text-sm text-muted-foreground">
        Stage analysis data will appear here once sessions are analyzed.
      </p>
    </div>
  );
}

/**
 * Stage Timeline component showing stage distribution over time.
 *
 * @example
 * <StageTimeline projectId="uuid-here" className="mt-4" />
 */
export function StageTimeline({ projectId, className }: StageTimelineProps) {
  const [range, setRange] = useState<TimeRangeFilter>("30d");
  const [granularity, setGranularity] = useState<TimelineGranularity>("day");

  const { data, isPending, isError, error } = useStageTimelineData(
    projectId,
    range,
    granularity
  );

  // Extract unique stages from data
  const stages = useMemo(() => {
    if (!data?.dataPoints) return [];
    return extractUniqueStages(data.dataPoints);
  }, [data?.dataPoints]);

  return (
    <Card className={cn(className)} data-testid="stage-timeline">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Stage Timeline</CardTitle>
        {!isPending && !isError && (
          <StageTimelineControls
            range={range}
            granularity={granularity}
            onRangeChange={setRange}
            onGranularityChange={setGranularity}
          />
        )}
      </CardHeader>
      <CardContent>
        {isPending && <TimelineSkeleton />}

        {isError && (
          <TimelineError message={error?.message || "An unexpected error occurred"} />
        )}

        {!isPending && !isError && (!data?.dataPoints || data.dataPoints.length === 0) && (
          <TimelineEmpty />
        )}

        {!isPending && !isError && data?.dataPoints && data.dataPoints.length > 0 && (
          <>
            <StageTimelineChart
              dataPoints={data.dataPoints}
              stages={stages}
              className="mb-4"
            />
            <StageTimelineLegend stages={stages} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
