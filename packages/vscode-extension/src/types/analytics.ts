/**
 * Analytics Types for VS Code Extension
 * Story 19-4: Real-time Analytics Display
 *
 * Types for analytics data displayed in the sidebar panel.
 */

/**
 * Time range options for analytics queries
 */
export type TimeRange = '1d' | '7d' | '30d' | 'all';

/**
 * Dimension score with trend information
 */
export interface DimensionScore {
  /** Score from 0-100 (percentage) */
  score: number;
  /** Trend compared to previous period */
  trend: 'up' | 'down' | 'stable';
  /** Change in score from previous period */
  change?: number;
}

/**
 * The 5 prompt quality dimensions
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
 * Recent prompt for display in the sidebar
 */
export interface RecentPrompt {
  /** Prompt UUID */
  id: string;
  /** Truncated prompt text */
  text: string;
  /** Overall score (0-100) */
  score: number;
  /** Creation timestamp (ISO 8601) */
  timestamp: string;
  /** Individual dimension scores */
  dimensions: Record<string, number>;
  /** Whether this prompt is newly added (for animations) */
  isNew?: boolean;
}

/**
 * Full prompt detail for modal view
 */
export interface PromptDetail {
  /** Prompt UUID */
  id: string;
  /** Full prompt text */
  text: string;
  /** Overall score (0-100) */
  score: number;
  /** Creation timestamp (ISO 8601) */
  timestamp: string;
  /** Individual dimension scores */
  dimensions: Record<string, number>;
  /** Improvement suggestions */
  suggestions: PromptSuggestion[];
}

/**
 * Suggestion for prompt improvement
 */
export interface PromptSuggestion {
  /** Which dimension this suggestion targets */
  dimension: string;
  /** Type of feedback */
  type: 'reinforcement' | 'improvement';
  /** Actionable message */
  message: string;
  /** Optional example of improved prompt */
  example?: string;
}

/**
 * Sync state for offline mode
 */
export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

/**
 * Cached analytics data for offline mode
 */
export interface CachedAnalytics {
  /** The analytics data */
  data: AnalyticsData;
  /** Recent prompts list */
  recentPrompts: RecentPrompt[];
  /** When the cache was created (ISO 8601) */
  cachedAt: string;
  /** Time range the cache is for */
  timeRange: TimeRange;
}

/**
 * API error response
 */
export interface ApiError {
  code: string;
  message: string;
  status?: number;
}
