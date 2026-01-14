# Story 31-8: Project Stage Timeline Visualization

## Story Info
- **Epic:** 31 - Project Stage Analytics
- **Priority:** P2
- **Points:** 5
- **Status:** Done

## Description

Create a timeline visualization showing stage distribution over time for a project. This allows users to see how their work patterns change over days/weeks.

## Acceptance Criteria

- [x] Horizontal timeline with dates on X-axis
- [x] Stacked area or bar chart showing stage distribution
- [x] Hover for detailed breakdown per day/week
- [x] Filter by date range (7 days, 30 days, all time)
- [x] Toggle between daily and weekly granularity
- [x] Responsive design for different screen sizes
- [x] Use existing design system colors for stages
- [x] Loading and empty states

## Technical Details

### Component Structure

```
components/analytics/stage-timeline/
├── StageTimeline.tsx          # Main container
├── StageTimelineChart.tsx     # Chart component (Recharts)
├── StageTimelineLegend.tsx    # Legend with stage colors
├── StageTimelineControls.tsx  # Date range / granularity controls
└── index.ts
```

### Main Component

```typescript
// components/analytics/stage-timeline/StageTimeline.tsx

"use client";

import { useState } from "react";
import { useStageTimelineData } from "@/lib/hooks/use-stage-timeline";
import { StageTimelineChart } from "./StageTimelineChart";
import { StageTimelineLegend } from "./StageTimelineLegend";
import { StageTimelineControls } from "./StageTimelineControls";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StageTimelineProps {
  projectId: string;
  className?: string;
}

export function StageTimeline({ projectId, className }: StageTimelineProps) {
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");
  const [granularity, setGranularity] = useState<"day" | "week">("day");

  const { data, isLoading, error } = useStageTimelineData(
    projectId,
    range,
    granularity
  );

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">
          Stage Distribution Over Time
        </CardTitle>
        <StageTimelineControls
          range={range}
          onRangeChange={setRange}
          granularity={granularity}
          onGranularityChange={setGranularity}
        />
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : error ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Failed to load timeline data
          </div>
        ) : !data || data.dataPoints.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No stage data available. Run stage analysis first.
          </div>
        ) : (
          <>
            <StageTimelineChart data={data.dataPoints} />
            <StageTimelineLegend stages={getUniqueStages(data.dataPoints)} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

### Chart Component (using Recharts)

```typescript
// components/analytics/stage-timeline/StageTimelineChart.tsx

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ProjectStage } from "@/lib/types/conversations";
import { STAGE_COLORS } from "./constants";
import { format, parseISO } from "date-fns";

interface DataPoint {
  date: string;
  stages: Record<ProjectStage, { activeMinutes: number; promptCount: number }>;
  totalMinutes: number;
}

interface StageTimelineChartProps {
  data: DataPoint[];
}

export function StageTimelineChart({ data }: StageTimelineChartProps) {
  // Transform data for Recharts
  const chartData = data.map((point) => {
    const entry: Record<string, any> = {
      date: point.date,
      dateFormatted: format(parseISO(point.date), "MMM d"),
    };

    // Add each stage's minutes
    for (const [stage, stageData] of Object.entries(point.stages)) {
      entry[stage] = stageData.activeMinutes;
    }

    return entry;
  });

  // Get all unique stages across data points
  const allStages = new Set<string>();
  for (const point of data) {
    for (const stage of Object.keys(point.stages)) {
      allStages.add(stage);
    }
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="dateFormatted"
          tick={{ fontSize: 12 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke="hsl(var(--muted-foreground))"
          tickFormatter={(value) => `${value}m`}
        />
        <Tooltip content={<CustomTooltip />} />

        {Array.from(allStages).map((stage) => (
          <Area
            key={stage}
            type="monotone"
            dataKey={stage}
            stackId="1"
            stroke={STAGE_COLORS[stage as ProjectStage]?.stroke || "hsl(var(--primary))"}
            fill={STAGE_COLORS[stage as ProjectStage]?.fill || "hsl(var(--primary) / 0.3)"}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;

  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <div className="font-medium mb-2">{label}</div>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: p.fill }}
            />
            <span className="capitalize flex-1">{p.dataKey}</span>
            <span className="font-mono">{p.value}m</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-border text-sm font-medium">
        Total: {Math.round(total)} min
      </div>
    </div>
  );
}
```

### Stage Colors

```typescript
// components/analytics/stage-timeline/constants.ts

import type { ProjectStage } from "@/lib/types/conversations";

export const STAGE_COLORS: Record<ProjectStage, { fill: string; stroke: string }> = {
  development: {
    fill: "hsl(var(--score-high) / 0.6)",
    stroke: "hsl(var(--score-high))",
  },
  debugging: {
    fill: "hsl(var(--score-low) / 0.6)",
    stroke: "hsl(var(--score-low))",
  },
  testing: {
    fill: "hsl(var(--info) / 0.6)",
    stroke: "hsl(var(--info))",
  },
  planning: {
    fill: "hsl(var(--secondary) / 0.6)",
    stroke: "hsl(var(--secondary))",
  },
  refactoring: {
    fill: "hsl(var(--score-medium) / 0.6)",
    stroke: "hsl(var(--score-medium))",
  },
  documentation: {
    fill: "hsl(var(--muted-foreground) / 0.4)",
    stroke: "hsl(var(--muted-foreground))",
  },
  deployment: {
    fill: "hsl(var(--score-growth) / 0.6)",
    stroke: "hsl(var(--score-growth))",
  },
  review: {
    fill: "hsl(var(--primary) / 0.4)",
    stroke: "hsl(var(--primary))",
  },
  // ... other stages
};
```

### Data Hook

```typescript
// lib/hooks/use-stage-timeline.ts

import { useQuery } from "@tanstack/react-query";
import type { StageTimelineData } from "@/lib/types/stage-analytics";

export function useStageTimelineData(
  projectId: string,
  range: "7d" | "30d" | "all",
  granularity: "day" | "week"
) {
  return useQuery<StageTimelineData>({
    queryKey: ["stage-timeline", projectId, range, granularity],
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/stage-analytics/timeline?range=${range}&granularity=${granularity}`
      );
      if (!response.ok) throw new Error("Failed to fetch timeline data");
      const json = await response.json();
      return json.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

## UI Mockup

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage Distribution Over Time                    [7d] [30d] [All]       │
│                                                 [Daily ▼]              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  60m ─┼─────────────────────────────────────────────────────────        │
│       │    ████                                                         │
│       │    ████  ████                           ████                    │
│  40m ─┼────████──████──████─────────────────────████────────────        │
│       │    ████  ████  ████  ████         ████  ████  ████              │
│       │    ████  ████  ████  ████  ████   ████  ████  ████              │
│  20m ─┼────████──████──████──████──████───████──████──████──────        │
│       │    ████  ████  ████  ████  ████   ████  ████  ████              │
│   0m ─┼────████──████──████──████──████───████──████──████──────        │
│       └─────Jan 1──Jan 2──Jan 3──Jan 4──Jan 5───Jan 6──Jan 7──Jan 8─    │
│                                                                         │
│  Legend: [■ Development] [■ Debugging] [■ Testing] [■ Refactoring]      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Tests

### Component Tests

```typescript
describe('StageTimeline', () => {
  it('should render chart with data');
  it('should show loading skeleton');
  it('should show empty state when no data');
  it('should update when range changes');
  it('should update when granularity changes');
});

describe('StageTimelineChart', () => {
  it('should render stacked areas for each stage');
  it('should show tooltip on hover');
  it('should use correct colors for stages');
});
```

### E2E Tests

```typescript
describe('Stage Timeline', () => {
  it('should display timeline chart');
  it('should filter by date range');
  it('should toggle between daily and weekly');
  it('should show details on hover');
});
```

## Dependencies

- Story 31-5: Project Stage API (timeline endpoint)
- Recharts library (already in project)

## Definition of Done

- [x] Timeline chart component implemented
- [x] Range and granularity controls working
- [x] Responsive design
- [x] Hover tooltips with details
- [x] Loading and empty states
- [x] Component tests passing
- [x] E2E test passing
