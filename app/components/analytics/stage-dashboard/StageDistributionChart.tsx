/**
 * StageDistributionChart - Story 31-9
 *
 * Donut chart showing time distribution across project stages.
 * Uses Recharts PieChart with inner/outer radius for donut effect.
 */

"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STAGE_CONFIG, formatDuration } from "@/components/conversations/types";
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

export interface StageDistributionChartProps {
  data?: StageBreakdownItem[];
  isLoading?: boolean;
  className?: string;
}

interface ChartDataItem {
  name: string;
  value: number;
  minutes: number;
  percentage: number;
  fill: string;
  [key: string]: unknown; // Required by recharts Pie component
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
        {formatDuration(data.minutes)} ({data.percentage}%)
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex h-[250px] items-center justify-center">
          <Skeleton className="h-40 w-40 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Renders a donut chart showing time distribution across stages.
 *
 * @example
 * <StageDistributionChart data={stageBreakdown} isLoading={isLoading} />
 */
export function StageDistributionChart({
  data,
  isLoading = false,
  className,
}: StageDistributionChartProps) {
  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <Card className={cn(className)} data-testid="stage-distribution-chart-empty">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No stage data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for chart
  const chartData: ChartDataItem[] = data.map((item) => {
    const stageConfig = STAGE_CONFIG[item.stage] || STAGE_CONFIG.unknown;
    return {
      name: stageConfig.label,
      value: item.activeMinutes,
      minutes: item.activeMinutes,
      percentage: item.percentage,
      fill: STAGE_CHART_COLORS[item.stage] || STAGE_CHART_COLORS.unknown,
    };
  });

  return (
    <Card className={cn(className)} data-testid="stage-distribution-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Time Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                paddingAngle={2}
                label={({ payload }) => {
                  const item = payload as ChartDataItem;
                  return `${item.percentage}%`;
                }}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
