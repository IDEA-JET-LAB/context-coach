/**
 * StagePromptChart - Story 31-9
 *
 * Horizontal bar chart showing prompt count per project stage.
 * Uses Recharts BarChart with horizontal layout.
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STAGE_CONFIG } from "@/components/conversations/types";
import type { StageBreakdownItem } from "@/lib/types/stage-analytics";
import type { ProjectStage } from "@/lib/types/conversations";

// Stage colors matching the design system
const STAGE_CHART_COLORS: Record<ProjectStage, string> = {
  architecture: "#0ea5e9",    // info/sky
  specification: "#a855f7",   // secondary/purple
  development: "#22c55e",     // score-high/green
  debugging: "#f59e0b",       // score-medium/amber
  enhancement: "#8b5cf6",     // primary/violet
  planning: "#06b6d4",        // cyan
  implementation: "#10b981",  // emerald
  testing: "#d946ef",         // fuchsia
  documentation: "#6b7280",   // muted/gray
  deployment: "#22c55e",      // score-high/green
  review: "#ec4899",          // pink
  refactoring: "#f97316",     // orange
  exploration: "#14b8a6",     // teal
  unknown: "#9ca3af",         // gray
};

export interface StagePromptChartProps {
  data?: StageBreakdownItem[];
  isLoading?: boolean;
  className?: string;
}

interface ChartDataItem {
  name: string;
  stage: ProjectStage;
  prompts: number;
  fill: string;
  [key: string]: unknown; // Required by recharts Bar component
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataItem }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md">
      <p className="font-medium text-foreground">{data.name}</p>
      <p className="text-sm text-muted-foreground">
        {data.prompts.toLocaleString()} prompts
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Renders a horizontal bar chart showing prompt counts per stage.
 *
 * @example
 * <StagePromptChart data={stageBreakdown} isLoading={isLoading} />
 */
export function StagePromptChart({
  data,
  isLoading = false,
  className,
}: StagePromptChartProps) {
  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <Card className={cn(className)} data-testid="stage-prompt-chart-empty">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Prompts by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No prompt data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for chart - sort by prompt count descending
  const chartData: ChartDataItem[] = [...data]
    .sort((a, b) => b.promptCount - a.promptCount)
    .map((item) => {
      const stageConfig = STAGE_CONFIG[item.stage] || STAGE_CONFIG.unknown;
      return {
        name: stageConfig.label,
        stage: item.stage,
        prompts: item.promptCount,
        fill: STAGE_CHART_COLORS[item.stage] || STAGE_CHART_COLORS.unknown,
      };
    });

  // Calculate dynamic height based on number of stages
  const chartHeight = Math.max(250, chartData.length * 40 + 50);

  return (
    <Card className={cn(className)} data-testid="stage-prompt-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Prompts by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: `${chartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={75}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
              <Bar dataKey="prompts" radius={[0, 4, 4, 0]} maxBarSize={30}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
