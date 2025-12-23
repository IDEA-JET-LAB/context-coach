// Admin Configuration Components
// Story D-7: Admin Configuration & A/B Testing UI Design

// Code Editor
export { CodeEditor, CodeEditorSkeleton } from './code-editor';
export type { CodeEditorProps, CodeEditorRef } from './code-editor';

// Prompt Template Editor
export {
  PromptTemplateEditor,
  PromptTemplateList,
} from './prompt-template-editor';
export type { PromptTemplate } from './prompt-template-editor';

// Rule Editor
export { RuleEditor, RuleEditorSkeleton } from './rule-editor';
export type { RuleEditorProps } from './rule-editor';

// Weight Configuration
export {
  WeightConfiguration,
  WeightConfigurationCompact,
  WeightConfigurationSkeleton,
} from './weight-configuration';
export type { WeightConfigurationProps, DimensionWeight } from './weight-configuration';

// Team Overrides
export { TeamOverrides, TeamOverridesSkeleton } from './team-overrides';
export type { Team, TeamOverride, TeamOverridesProps } from './team-overrides';

// Version History
export {
  VersionHistory,
  VersionHistoryCompact,
  VersionHistorySkeleton,
} from './version-history';
export type { ConfigVersion, VersionHistoryProps } from './version-history';

// Experiment Creator
export { ExperimentCreator, ExperimentCreatorSkeleton } from './experiment-creator';
export type { ConfigOption, TeamOption, ExperimentCreatorProps } from './experiment-creator';

// Traffic Split
export { TrafficSplit, TrafficSplitSkeleton } from './traffic-split';
export type {
  ExperimentVariant,
  UserAssignment,
  TrafficSplitProps,
} from './traffic-split';

// Experiment Results
export { ExperimentResults, ExperimentResultsSkeleton } from './experiment-results';
export type {
  VariantResult,
  ExperimentResult,
  ExperimentResultsProps,
} from './experiment-results';

// Audit Trail
export { AuditTrail, AuditTrailCompact, AuditTrailSkeleton } from './audit-trail';
export type { AuditEntry, AuditTrailProps, AuditFilters } from './audit-trail';

// Contextual Help
export {
  TourProvider,
  useTour,
  HelpTooltip,
  HelpPopover,
  DocumentationSidebar,
  QuickStartButton,
  ExampleTemplates,
  HelpButton,
} from './contextual-help';

// Existing components re-exported for convenience
export { ConfigList } from './config-list';
export { ConfigDetailView } from './config-detail-view';
export { ConfigVersionCard } from './config-version-card';
export { DimensionEditor } from './dimension-editor';
export { AnalysisConfigForm } from './analysis-config-form';
export { StatCard, StatCardSkeleton } from './stat-card';
export { DeadLetterQueue } from './dead-letter-queue';
