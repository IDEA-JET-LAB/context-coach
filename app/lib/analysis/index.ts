/**
 * Analysis module exports
 *
 * Story 21-9: Learning Progression Tracking
 */

export {
  // Types
  type WeeklyMetrics,
  type MetricImprovements,
  type AchievementThresholds,
  type LearningProgression,
  // Functions
  calculatePercentageChange,
  calculateImprovements,
  generateAchievements,
  generateSuggestions,
  calculateProgression,
  createEmptyWeeklyMetrics,
  getWeekStart,
  getPreviousWeekStart,
  isValidWeekStart,
  // Constants
  DEFAULT_THRESHOLDS,
  FIRST_WEEK_MESSAGE,
} from './learning-progression';

export {
  // Types
  type EfficiencyBenchmark,
  type WorkflowEfficiencyMetrics,
  type UserEfficiencyInput,
  // Constants
  TEAM_BENCHMARKS,
  // Individual metric calculators
  calculatePromptsPerTask,
  calculateContextResetsPerSession,
  calculateDebuggingLoopAverage,
  calculateTimeToResolution,
  // Scoring functions
  calculateEfficiencyScore,
  determineBenchmarkLevel,
  // Main calculator
  calculateWorkflowEfficiency,
} from './workflow-efficiency';

// Complexity Analyzer (Story 21-4)
export {
  // Types
  type ComplexityLevel,
  type ComplexityMetrics,
  // Detection functions
  countSentences,
  countCodeBlocks,
  hasInlineCode,
  hasCodePatterns,
  detectCode,
  countFileExtensions,
  countPathReferences,
  countFileReferences,
  detectFileRefs,
  // Scoring functions
  calculateComplexityScore,
  determineComplexityLevel,
  // Main analyzers
  analyzeComplexity,
  quickComplexityCheck,
} from './complexity-analyzer';

// Work Style Classifier (Story 21-2)
export {
  // Types
  type WorkStyleCategory,
  type WorkStyleResult,
  // Constants
  WORK_STYLE_CATEGORIES,
  // Main classifier
  classifyWorkStyle,
} from './work-style-classifier';
