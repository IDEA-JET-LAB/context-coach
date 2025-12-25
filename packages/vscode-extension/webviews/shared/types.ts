/**
 * Shared Types for VS Code Extension Webviews
 *
 * IMPORTANT: These types mirror the canonical definitions in src/types/.
 * Due to webview build isolation, webviews cannot directly import from src/types/.
 * Keep these in sync with:
 *   - src/types/coaching.ts (DimensionName, TipPriority)
 *   - src/types/analytics.ts (DimensionScore, TimeRange, PromptDimensions, etc.)
 */

// ============================================
// From src/types/coaching.ts
// ============================================

/**
 * The 5 prompt quality dimensions
 */
export type DimensionName =
  | "clarity"
  | "context"
  | "specificity"
  | "actionability"
  | "efficiency";

/**
 * Priority level for coaching tips
 */
export type TipPriority = "high" | "medium" | "low";

// ============================================
// From src/types/analytics.ts
// ============================================

/**
 * Time range options for analytics queries
 */
export type TimeRange = "1d" | "7d" | "30d";

/**
 * Dimension score with trend information
 */
export interface DimensionScore {
  /** Score from 0-100 (percentage) */
  score: number;
  /** Trend compared to previous period */
  trend: "up" | "down" | "stable";
  /** Change in score from previous period */
  change?: number;
}

/**
 * The 5 prompt quality dimensions with their scores
 */
export interface PromptDimensions {
  clarity: DimensionScore;
  context: DimensionScore;
  specificity: DimensionScore;
  actionability: DimensionScore;
  efficiency: DimensionScore;
}

/**
 * Analytics summary data
 */
export interface AnalyticsSummary {
  /** Overall average score (0-100) */
  overallScore: number;
  /** Total prompt count for the period */
  promptCount: number;
  /** Selected time range */
  timeRange: TimeRange;
  /** Change in overall score from previous period */
  scoreChange?: number;
  /** Change in prompt count from previous period */
  countChange?: number;
}

/**
 * Full analytics data structure
 */
export interface AnalyticsData {
  /** Summary statistics */
  summary: AnalyticsSummary;
  /** Scores for each dimension */
  dimensions: PromptDimensions;
  /** Last updated timestamp (ISO 8601) */
  lastUpdated: string;
}

/**
 * Sync state for offline mode
 */
export type SyncState = "idle" | "syncing" | "synced" | "error" | "offline";

/**
 * Trend type for weak dimension alerts
 */
export type Trend = "improving" | "declining" | "stable";
