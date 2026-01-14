# Story 31-9: Stage Analytics Dashboard

## Story Info
- **Epic:** 31 - Project Stage Analytics
- **Priority:** P2
- **Points:** 3
- **Status:** Done

## Description

Create a dashboard view for project stage analytics, providing a comprehensive overview of how time is distributed across project stages.

## Acceptance Criteria

- [x] Summary cards: Total time, Primary stage, Stage count, Avg session
- [x] Pie/donut chart: Time distribution by stage
- [x] Bar chart: Prompt count by stage
- [x] Recent activity: Last 5 conversations with stages
- [x] Link to timeline view (Story 31-8)
- [x] Responsive design
- [x] Handle projects with no stage data

## Technical Details

### Component Structure

```
components/analytics/stage-dashboard/
├── StageDashboard.tsx           # Main container
├── StageSummaryCards.tsx        # Summary metric cards
├── StageDistributionChart.tsx   # Pie/donut chart
├── StagePromptChart.tsx         # Bar chart
├── RecentStagedConversations.tsx # Recent activity list
└── index.ts
```

### Main Dashboard Component

```typescript
// components/analytics/stage-dashboard/StageDashboard.tsx

"use client";

import { useStageAnalytics } from "@/lib/hooks/use-stage-analytics";
import { StageSummaryCards } from "./StageSummaryCards";
import { StageDistributionChart } from "./StageDistributionChart";
import { StagePromptChart } from "./StagePromptChart";
import { RecentStagedConversations } from "./RecentStagedConversations";
import { StageTimeline } from "../stage-timeline/StageTimeline";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StageDashboardProps {
  projectId: string;
  className?: string;
}

export function StageDashboard({ projectId, className }: StageDashboardProps) {
  const { data, isLoading, error } = useStageAnalytics(projectId);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load stage analytics</AlertDescription>
      </Alert>
    );
  }

  const needsAnalysis = data?.analysisStatus.pendingSessions > 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Analysis status banner */}
      {needsAnalysis && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {data.analysisStatus.pendingSessions} sessions haven't been analyzed yet.
            Run stage analysis to get complete data.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <StageSummaryCards
        totalMinutes={data?.summary.totalActiveMinutes || 0}
        primaryStage={data?.primaryStage || "unknown"}
        stageCount={data?.summary.stageBreakdown.length || 0}
        avgSessionMinutes={data?.averageSessionMinutes || 0}
        sessionsAnalyzed={data?.analysisStatus.analyzedSessions || 0}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Time by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <StageDistributionChart
              stages={data?.summary.stageBreakdown || []}
            />
          </CardContent>
        </Card>

        {/* Prompt Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prompts by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <StagePromptChart
              stages={data?.summary.stageBreakdown || []}
            />
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <StageTimeline projectId={projectId} />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentStagedConversations projectId={projectId} limit={5} />
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
      <Skeleton className="h-[350px]" />
    </div>
  );
}
```

### Summary Cards

```typescript
// components/analytics/stage-dashboard/StageSummaryCards.tsx

import { Card, CardContent } from "@/components/ui/card";
import { Clock, Target, Layers, BarChart3 } from "lucide-react";
import { STAGE_CONFIG } from "@/components/conversations/types";
import type { ProjectStage } from "@/lib/types/conversations";

interface StageSummaryCardsProps {
  totalMinutes: number;
  primaryStage: ProjectStage;
  stageCount: number;
  avgSessionMinutes: number;
  sessionsAnalyzed: number;
}

export function StageSummaryCards({
  totalMinutes,
  primaryStage,
  stageCount,
  avgSessionMinutes,
  sessionsAnalyzed,
}: StageSummaryCardsProps) {
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const stageConfig = STAGE_CONFIG[primaryStage];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Active Time */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Time</p>
              <p className="text-2xl font-bold">{formatTime(totalMinutes)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Primary Stage */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", stageConfig?.bgColor || "bg-muted")}>
              <Target className={cn("h-5 w-5", stageConfig?.color || "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Primary Stage</p>
              <p className="text-2xl font-bold capitalize">
                {stageConfig?.label || primaryStage}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage Count */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Layers className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stages Used</p>
              <p className="text-2xl font-bold">{stageCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avg Session */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-score-medium/10 rounded-lg">
              <BarChart3 className="h-5 w-5 text-score-medium" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Session</p>
              <p className="text-2xl font-bold">{formatTime(avgSessionMinutes)}</p>
              <p className="text-xs text-muted-foreground">
                {sessionsAnalyzed} sessions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Distribution Chart (Pie/Donut)

```typescript
// components/analytics/stage-dashboard/StageDistributionChart.tsx

"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { STAGE_COLORS } from "../stage-timeline/constants";
import type { ProjectStage } from "@/lib/types/conversations";

interface StageData {
  stage: ProjectStage;
  activeMinutes: number;
  percentage: number;
}

interface StageDistributionChartProps {
  stages: StageData[];
}

export function StageDistributionChart({ stages }: StageDistributionChartProps) {
  if (stages.length === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        No stage data available
      </div>
    );
  }

  const data = stages.map((s) => ({
    name: s.stage,
    value: s.activeMinutes,
    percentage: s.percentage,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percentage }) => `${percentage}%`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={STAGE_COLORS[entry.name as ProjectStage]?.fill || "hsl(var(--muted))"}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span className="capitalize text-sm">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium capitalize">{data.name}</p>
      <p className="text-sm text-muted-foreground">
        {Math.round(data.value)} minutes ({data.percentage}%)
      </p>
    </div>
  );
}
```

### Page Integration

```typescript
// app/(dashboard)/projects/[id]/stages/page.tsx

import { StageDashboard } from "@/components/analytics/stage-dashboard/StageDashboard";
import { StageAnalysisButton } from "@/components/conversations/StageAnalysisButton";

export default async function ProjectStagesPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Stage Analytics</h1>
        <StageAnalysisButton projectId={params.id} />
      </div>

      <StageDashboard projectId={params.id} />
    </div>
  );
}
```

## UI Mockup

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage Analytics                                   [Analyze Stages]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Active Time  │  │ Primary      │  │ Stages Used  │  │ Avg Session  │ │
│  │   12h 45m    │  │ Development  │  │      6       │  │    45m       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                                         │
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │ Time by Stage              │  │ Prompts by Stage                   │ │
│  │       [Donut Chart]        │  │       [Bar Chart]                  │ │
│  │    Development: 45%        │  │       ████████████  Development    │ │
│  │    Debugging: 25%          │  │       ██████       Debugging       │ │
│  │    Testing: 20%            │  │       █████        Testing         │ │
│  │    Other: 10%              │  │       ██           Other           │ │
│  └────────────────────────────┘  └────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Stage Distribution Over Time                    [Timeline Chart] │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Recent Conversations                                              │   │
│  │ • Auth feature  [Dev] [Debug] [Test]     2h 15m    Jan 9         │   │
│  │ • API refactor  [Refactor] [Test]        1h 30m    Jan 8         │   │
│  │ • Bug fixes     [Debug]                  45m       Jan 8         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Tests

### Component Tests

```typescript
describe('StageDashboard', () => {
  it('should render all sections');
  it('should show loading skeleton');
  it('should show analysis needed banner');
  it('should handle empty data');
});

describe('StageSummaryCards', () => {
  it('should format time correctly');
  it('should show stage colors');
});

describe('StageDistributionChart', () => {
  it('should render donut chart');
  it('should show tooltip on hover');
  it('should handle empty data');
});
```

### E2E Tests

```typescript
describe('Stage Dashboard', () => {
  it('should display all summary cards');
  it('should display charts');
  it('should display recent conversations');
  it('should navigate to timeline');
});
```

## Dependencies

- Story 31-5: Project Stage API
- Story 31-7: Conversation Badges
- Story 31-8: Timeline (embedded)
- Recharts library

## Definition of Done

- [x] Dashboard page created
- [x] Summary cards implemented
- [x] Pie/donut chart working
- [x] Bar chart working
- [x] Recent activity list
- [x] Timeline integration
- [x] Responsive design
- [x] Component tests passing
- [x] E2E test passing
