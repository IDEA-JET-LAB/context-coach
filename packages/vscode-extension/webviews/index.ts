/**
 * Contextor VS Code Extension Webviews
 *
 * This package contains React components for the VS Code extension sidebar.
 * Components are designed to work within VS Code's webview environment with
 * automatic theme support via CSS variables.
 *
 * @packageDocumentation
 */

// Main sidebar components
export { SidebarLayout, type SidebarLayoutProps, type TabId } from './sidebar/layout';
export { AnalyticsPanel, type AnalyticsPanelProps, type AnalyticsData, type Prompt } from './sidebar/analytics-panel';
export { CoachingPanel, type CoachingPanelProps, type Suggestion } from './sidebar/coaching-panel';
export { SettingsPanel, type SettingsPanelProps, type User } from './sidebar/settings-panel';

// Notification components
export {
  InlineNotification,
  StatusBarItemPreview,
  NewSuggestionBanner,
  type InlineNotificationProps,
  type StatusBarItemProps,
  type NewSuggestionBannerProps,
} from './sidebar/notifications';

// Coaching overlay components (for future Epic 20)
export {
  HoverCard,
  InlineDecorationPreview,
  QuickFixMenu,
  ProgressIndicator,
  type HoverCardProps,
  type InlineDecorationProps,
  type QuickFixProps,
  type ProgressIndicatorProps,
} from './sidebar/coaching-overlay';

// Shared components
export {
  StatusIndicator,
  ScoreBadge,
  Sparkline,
  PromptCard,
  SuggestionCard,
  Gauge,
  type ConnectionStatus,
  type StatusIndicatorProps,
  type ScoreBadgeProps,
  type SparklineProps,
  type PromptCardProps,
  type SuggestionCardProps,
  type SuggestionType,
  type GaugeProps,
} from './components';

// Icons
export {
  ContextorLogo,
  AnalyticsIcon,
  CoachingIcon,
  SettingsIcon,
  HelpIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  LogoutIcon,
  RefreshIcon,
  CodeIcon,
  SparklesIcon,
  UserIcon,
  CloudIcon,
  CloudOffIcon,
  HistoryIcon,
} from './components';

// Demo component for development
export { SidebarDemo } from './sidebar/demo';

// Message types for extension communication
export type { WebviewMessage, ExtensionMessage, AppState } from './sidebar/index';
