"use client";

/**
 * Stage Timeline Chart - Story 31-8
 *
 * Recharts stacked area chart showing stage distribution over time.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { STAGE_CONFIG, type ProjectStage } from "@/components/conversations/types";
import { STAGE_COLORS, TIMELINE_CHART_HEIGHT } from "./constants";
import type { StageTimelineDataPoint } from "@/lib/types/stage-analytics";

/**
 * Chart data format for Recharts.
 * Each entry is a date with stage values as properties.
 */
interface ChartDataPoint {
  date: string;
  [stage: string]: string | number; // stage keys have number values
}

/**
 * Payload item in tooltip.
 */
interface TooltipPayloadItem {
  dataKey?: string;
  value?: number;
  payload?: ChartDataPoint;
}

/**
 * Custom tooltip props for the chart.
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

interface StageTimelineChartProps {
  /** Data points from the API */
  dataPoints: StageTimelineDataPoint[];
  /** Unique stages found in the data */
  stages: ProjectStage[];
  /** Optional class name for styling */
  className?: string;
}

// Chart color constants for grid/axis
const CHART_COLORS = {
  grid: "#2a2a2a",
  axisText: "#a1a1aa",
} as const;

/**
 * Transforms API data points into Recharts-compatible format.
 */
function transformDataForChart(
  dataPoints: StageTimelineDataPoint[],
  stages: ProjectStage[]
): ChartDataPoint[] {
  return dataPoints.map((dp) => {
    const point: ChartDataPoint = { date: dp.date };

    // Initialize all stages to 0
    for (const stage of stages) {
      point[stage] = 0;
    }

    // Fill in actual values (using activeMinutes)
    for (const [stage, data] of Object.entries(dp.stages)) {
      if (stage in point) {
        point[stage] = data.activeMinutes;
      }
    }

    return point;
  });
}

/**
 * Custom tooltip component for the chart.
 */
function CustomTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  // Filter to only show stages with non-zero values
  const activeStages = payload.filter(
    (p: TooltipPayloadItem) => p.value && p.value > 0
  );

  return (
    <div
      className="rounded-lg border border-border bg-card p-3 shadow-lg"
      data-testid="chart-tooltip"
    >
      <p className="text-sm font-medium text-foreground mb-2">
        {format(parseISO(label as string), "MMMM d, yyyy")}
      </p>
      {activeStages.length > 0 ? (
        <div className="space-y-1">
          {activeStages.map((entry: TooltipPayloadItem) => {
            const stage = entry.dataKey as ProjectStage;
            const config = STAGE_CONFIG[stage];
            const colors = STAGE_COLORS[stage];

            return (
              <div key={stage} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: colors.stroke }}
                  />
                  <span className="text-muted-foreground">{config?.label || stage}:</span>
                </div>
                <span className="font-medium text-foreground">
                  {entry.value?.toFixed(1)} min
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No activity</p>
      )}
    </div>
  );
}

/**
 * Renders a stacked area chart showing stage distribution over time.
 */
export function StageTimelineChart({
  dataPoints,
  stages,
  className,
}: StageTimelineChartProps) {
  if (dataPoints.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height: TIMELINE_CHART_HEIGHT }}
        data-testid="chart-empty"
      >
        No data available for this time range
      </div>
    );
  }

  const chartData = transformDataForChart(dataPoints, stages);

  return (
    <div className={className} data-testid="stage-timeline-chart">
      <ResponsiveContainer width="100%" height={TIMELINE_CHART_HEIGHT}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="date"
            stroke={CHART_COLORS.axisText}
            tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
            tickFormatter={(value) => format(parseISO(value), "MMM d")}
          />
          <YAxis
            stroke={CHART_COLORS.axisText}
            tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
            tickFormatter={(value) => `${value}m`}
            label={{
              value: "Minutes",
              angle: -90,
              position: "insideLeft",
              fill: CHART_COLORS.axisText,
              fontSize: 12,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {stages.map((stage) => {
            const colors = STAGE_COLORS[stage];
            return (
              <Area
                key={stage}
                type="monotone"
                dataKey={stage}
                stackId="1"
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={1}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
