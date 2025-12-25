/**
 * Design Tokens for VS Code Extension
 *
 * Centralizes all color definitions to ensure consistency across components.
 * Uses CSS variable fallbacks for theming support.
 */

// =============================================================================
// DIMENSION COLORS
// Colors for the 5 scoring dimensions
// =============================================================================

export const DIMENSION_COLORS = {
  clarity: {
    base: "var(--ctx-dimension-clarity, #3b82f6)",
    bg: "var(--ctx-dimension-clarity-bg, rgba(59, 130, 246, 0.15))",
  },
  context: {
    base: "var(--ctx-dimension-context, #8b5cf6)",
    bg: "var(--ctx-dimension-context-bg, rgba(139, 92, 246, 0.15))",
  },
  specificity: {
    base: "var(--ctx-dimension-specificity, #10b981)",
    bg: "var(--ctx-dimension-specificity-bg, rgba(16, 185, 129, 0.15))",
  },
  actionability: {
    base: "var(--ctx-dimension-actionability, #f59e0b)",
    bg: "var(--ctx-dimension-actionability-bg, rgba(245, 158, 11, 0.15))",
  },
  efficiency: {
    base: "var(--ctx-dimension-efficiency, #ef4444)",
    bg: "var(--ctx-dimension-efficiency-bg, rgba(239, 68, 68, 0.15))",
  },
} as const;

/**
 * Get dimension color by name (case-insensitive)
 */
export function getDimensionColor(dimension: string): string {
  const key = dimension.toLowerCase() as keyof typeof DIMENSION_COLORS;
  return DIMENSION_COLORS[key]?.base || "var(--ctx-foreground-muted, #6b7280)";
}

/**
 * Get dimension background color by name (case-insensitive)
 */
export function getDimensionBgColor(dimension: string): string {
  const key = dimension.toLowerCase() as keyof typeof DIMENSION_COLORS;
  return DIMENSION_COLORS[key]?.bg || "rgba(107, 114, 128, 0.15)";
}

// =============================================================================
// STAGE COLORS
// Colors for conversation stages
// =============================================================================

export const STAGE_COLORS = {
  architecture: {
    bg: "var(--ctx-stage-architecture-bg, rgba(59, 130, 246, 0.15))",
    text: "var(--ctx-stage-architecture, #3B82F6)",
  },
  specification: {
    bg: "var(--ctx-stage-specification-bg, rgba(139, 92, 246, 0.15))",
    text: "var(--ctx-stage-specification, #8B5CF6)",
  },
  development: {
    bg: "var(--ctx-stage-development-bg, rgba(34, 197, 94, 0.15))",
    text: "var(--ctx-stage-development, #22C55E)",
  },
  debugging: {
    bg: "var(--ctx-stage-debugging-bg, rgba(245, 158, 11, 0.15))",
    text: "var(--ctx-stage-debugging, #F59E0B)",
  },
  enhancement: {
    bg: "var(--ctx-stage-enhancement-bg, rgba(20, 184, 166, 0.15))",
    text: "var(--ctx-stage-enhancement, #14B8A6)",
  },
} as const;

/**
 * Get stage color config by name
 */
export function getStageColor(stage: string): { bg: string; text: string } {
  const key = stage.toLowerCase() as keyof typeof STAGE_COLORS;
  return (
    STAGE_COLORS[key] || {
      bg: "var(--ctx-surface, rgba(51, 51, 51, 0.5))",
      text: "var(--ctx-foreground-muted, #999)",
    }
  );
}

// =============================================================================
// SCORE COLORS
// Colors for score levels (high/medium/low)
// =============================================================================

export const SCORE_COLORS = {
  high: "var(--ctx-score-high, #22c55e)",
  medium: "var(--ctx-score-medium, #f59e0b)",
  low: "var(--ctx-score-low, #ef4444)",
} as const;

/**
 * Get score color based on numeric value
 */
export function getScoreColor(score: number): string {
  if (score >= 70) return SCORE_COLORS.high;
  if (score >= 40) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}

/**
 * Get score level based on numeric value
 */
export function getScoreLevel(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// =============================================================================
// STATUS COLORS
// Colors for epic/story status indicators
// =============================================================================

export const STATUS_COLORS = {
  done: "var(--ctx-success, #22c55e)",
  "in-progress": "var(--ctx-primary, #3b82f6)",
  "ready-for-dev": "var(--ctx-warning, #f59e0b)",
  backlog: "var(--ctx-foreground-muted, #6b7280)",
  deferred: "var(--ctx-foreground-subtle, #4b5563)",
  future: "var(--ctx-foreground-subtle, #4b5563)",
  "design-only": "var(--ctx-status-design, #9333EA)",
  optional: "var(--ctx-foreground-subtle, #4b5563)",
} as const;

/**
 * Get status color by status name
 */
export function getStatusColor(status: string): string {
  const key = status as keyof typeof STATUS_COLORS;
  return STATUS_COLORS[key] || "var(--ctx-foreground-muted, #6b7280)";
}

// =============================================================================
// PRIORITY COLORS
// Colors for tip priority levels
// =============================================================================

export const PRIORITY_COLORS = {
  high: "var(--vscode-inputValidation-errorBorder, #f14c4c)",
  medium: "var(--vscode-inputValidation-warningBorder, #cca700)",
  low: "var(--vscode-inputValidation-infoBorder, #3794ff)",
} as const;

/**
 * Get priority color by level
 */
export function getPriorityColor(priority: "high" | "medium" | "low"): string {
  return PRIORITY_COLORS[priority];
}

// =============================================================================
// TREND COLORS
// Colors for trend indicators
// =============================================================================

export const TREND_COLORS = {
  improving: "var(--ctx-score-high, #22c55e)",
  declining: "var(--ctx-score-low, #ef4444)",
  stable: "var(--ctx-foreground-muted, #6b7280)",
} as const;

/**
 * Get trend color by trend type
 */
export function getTrendColor(trend: "improving" | "declining" | "stable"): string {
  return TREND_COLORS[trend];
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type DimensionName = keyof typeof DIMENSION_COLORS;
export type StageName = keyof typeof STAGE_COLORS;
export type ScoreLevel = keyof typeof SCORE_COLORS;
export type StatusName = keyof typeof STATUS_COLORS;
export type PriorityLevel = keyof typeof PRIORITY_COLORS;
export type TrendType = keyof typeof TREND_COLORS;
