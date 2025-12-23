// Shared components for VS Code extension webviews
export { StatusIndicator, type ConnectionStatus, type StatusIndicatorProps } from './status-indicator';
export { ScoreBadge, type ScoreBadgeProps } from './score-badge';
export { Sparkline, type SparklineProps } from './sparkline';
export { PromptCard, type PromptCardProps } from './prompt-card';
export { SuggestionCard, type SuggestionType, type SuggestionCardProps } from './suggestion-card';
export { Gauge, type GaugeProps } from './gauge';
export * from './icons';

// Story 19-4: Real-time Analytics Display components
export { DimensionScoreCard, type DimensionScoreCardProps } from './dimension-score-card';
export { TimeRangeSelector, type TimeRange, type TimeRangeSelectorProps } from './time-range-selector';
export { SyncStatus, type SyncState, type SyncStatusProps } from './sync-status';
export { PromptDetail, type PromptDetailProps, type PromptSuggestion } from './prompt-detail';
export { ErrorState, type ErrorStateProps } from './error-state';

// Story 19-5: Quick Coaching Tips components
export { TipCard, type TipCardProps, type TipPriority, type DimensionName } from './tip-card';
export { WeakDimensionAlert, type WeakDimensionAlertProps, type Trend } from './weak-dimension-alert';
export { EmptyCoaching, type EmptyCoachingProps } from './empty-coaching';
export { CoachingSection, type CoachingSectionProps, type CoachingTip, type WeakDimension } from './coaching-section';
