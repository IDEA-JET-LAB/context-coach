// Analytics components for data visualization and insights

// Existing components
export { InsightCard, type InsightCardProps, type InsightType } from './insight-card';
export { DimensionRadar, type DimensionRadarProps, type DimensionScore as RadarDimensionScore } from './dimension-radar';
export { MetricCard, type MetricCardProps } from './metric-card';
export { TrendIndicator, type TrendIndicatorProps } from './trend-indicator';
export { ComparisonBar, type ComparisonBarProps } from './comparison-bar';
export { SessionTimeline, type SessionTimelineProps, type SessionEvent, type SessionStatus } from './session-timeline';

// New D-6 Advanced Analytics Components

// Context Window Management
export {
  ContextGauge,
  type ContextGaugeProps,
  type ContextUsagePoint,
} from './context-gauge';

// Work Style Categorization
export {
  WorkStyleBadge,
  WorkStyleBadgeInline,
  type WorkStyleBadgeProps,
  type WorkStyle,
  type WorkStyleData,
} from './work-style-badge';

// Sentiment Analysis
export {
  SentimentTimeline,
  SentimentIndicator,
  type SentimentTimelineProps,
  type SentimentLevel,
  type SentimentDataPoint,
  type FrustrationSpike,
} from './sentiment-timeline';

// Prompt Complexity
export {
  ComplexityCard,
  ComplexityBadge,
  type ComplexityCardProps,
  type ComplexityBreakdown,
  type ComplexityTrendPoint,
} from './complexity-card';

// Interaction Timing
export {
  TimingHeatmap,
  PeakTimeBadge,
  type TimingHeatmapProps,
  type HourlyActivity,
  type DailyActivity,
  type SessionDurationData,
} from './timing-heatmap';

// Tool Usage
export {
  ToolUsageChart,
  ToolBadge,
  type ToolUsageChartProps,
  type ToolUsageData,
} from './tool-usage-chart';

// Session Health
export {
  SessionHealth,
  SessionHealthBadge,
  type SessionHealthProps,
  type HealthStatus,
  type HealthFactor,
  type HealthTrendPoint,
} from './session-health';

// Technical Depth
export {
  DepthRadar,
  DepthIndicator,
  type DepthRadarProps,
  type TechnicalDepthCategory,
} from './depth-radar';

// Learning Progress
export {
  LearningProgress,
  MilestoneBadge,
  type LearningProgressProps,
  type SkillProgress,
  type Milestone,
  type ImprovementSuggestion,
} from './learning-progress';

// Workflow Efficiency
export {
  EfficiencyCard,
  EfficiencyBadge,
  type EfficiencyCardProps,
  type Bottleneck,
  type EfficiencyTip,
  type EfficiencyMetric,
} from './efficiency-card';

// Enhanced Insights with Drill-down
export {
  EnhancedInsightCard,
  InsightsList,
  type EnhancedInsightCardProps,
  type EnhancedInsightType,
  type InsightCategory,
  type InsightData,
  type InsightAction,
  type InsightsListProps,
} from './enhanced-insight-card';

// Team Intelligence
export {
  TeamIntelligence,
  TeamStatsBadge,
  type TeamIntelligenceProps,
  type TeamMemberStats,
  type TeamTrendPoint,
  type CoachingOpportunity,
} from './team-intelligence';

// Filter and Export Controls
export {
  AnalyticsFilters,
  FilterBadge,
  type AnalyticsFiltersProps,
  type TimeRange,
  type ExportFormat,
  type DateRange,
  type FilterOption,
} from './analytics-filters';
