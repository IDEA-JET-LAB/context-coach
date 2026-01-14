/**
 * Stage Timeline Constants - Story 31-8
 *
 * Color definitions for stage timeline chart visualization.
 */

import type { ProjectStage } from "@/components/conversations/types";

/**
 * Stage colors for Recharts area fills and strokes.
 * Colors are designed to be visually distinct while maintaining
 * a cohesive palette for the stacked area chart.
 */
export const STAGE_COLORS: Record<ProjectStage, { fill: string; stroke: string }> = {
  development: { fill: "hsl(142 71% 45% / 0.6)", stroke: "hsl(142 71% 45%)" },
  debugging: { fill: "hsl(38 92% 50% / 0.6)", stroke: "hsl(38 92% 50%)" },
  testing: { fill: "hsl(217 91% 60% / 0.6)", stroke: "hsl(217 91% 60%)" },
  planning: { fill: "hsl(262 83% 58% / 0.6)", stroke: "hsl(262 83% 58%)" },
  refactoring: { fill: "hsl(38 92% 50% / 0.6)", stroke: "hsl(38 92% 50%)" },
  documentation: { fill: "hsl(220 9% 46% / 0.4)", stroke: "hsl(220 9% 46%)" },
  deployment: { fill: "hsl(142 71% 45% / 0.6)", stroke: "hsl(142 71% 45%)" },
  implementation: { fill: "hsl(142 71% 45% / 0.6)", stroke: "hsl(142 71% 45%)" },
  review: { fill: "hsl(262 83% 58% / 0.6)", stroke: "hsl(262 83% 58%)" },
  architecture: { fill: "hsl(217 91% 60% / 0.6)", stroke: "hsl(217 91% 60%)" },
  specification: { fill: "hsl(262 83% 58% / 0.6)", stroke: "hsl(262 83% 58%)" },
  enhancement: { fill: "hsl(142 71% 45% / 0.6)", stroke: "hsl(142 71% 45%)" },
  exploration: { fill: "hsl(217 91% 60% / 0.6)", stroke: "hsl(217 91% 60%)" },
  unknown: { fill: "hsl(220 9% 46% / 0.4)", stroke: "hsl(220 9% 46%)" },
};

/**
 * Chart dimensions.
 */
export const TIMELINE_CHART_HEIGHT = 300;

/**
 * Time range options for the controls.
 */
export const TIME_RANGE_OPTIONS = [
  { value: "7d" as const, label: "7 days" },
  { value: "30d" as const, label: "30 days" },
  { value: "all" as const, label: "All time" },
];

/**
 * Granularity options for the controls.
 */
export const GRANULARITY_OPTIONS = [
  { value: "day" as const, label: "Daily" },
  { value: "week" as const, label: "Weekly" },
];
