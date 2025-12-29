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

// Sentiment Classifier (Story 21-3)
export {
  // Types
  type Sentiment,
  type SentimentResult,
  // Constants
  SENTIMENT_TYPES,
  // Main analyzer
  analyzeSentiment,
  // Utility
  toSentimentScoresJson,
} from './sentiment-classifier';

// Session Sentiment Tracker (Story 21-3)
export {
  // Types
  type FrustrationTrend,
  type PromptWithSentiment,
  type SessionSentimentMetrics,
  // Functions
  calculateFrustrationTrend,
  detectRisingFrustration,
  calculatePolitenessRatio,
  calculateSessionSentimentMetrics,
} from './session-sentiment-tracker';

// Context Management (Story 21-1)
export {
  // Types
  type DetectionMethod,
  type ContextExhaustionResult,
  type SessionExhaustionUpdate,
  // Constants
  EXHAUSTION_PATTERNS,
  // Detection functions
  matchesExhaustionKeywords,
  exceedsDurationThreshold,
  detectContextExhaustion,
  // Session update
  createExhaustionUpdate,
} from './context-management';

// Exhaustion Feedback (Story 21-1)
export {
  // Types
  type ExhaustionSeverity,
  type ExhaustionFeedback,
  // Constants
  EXHAUSTION_THRESHOLDS,
  // Functions
  determineExhaustionSeverity,
  generateExhaustionFeedback,
  generateSessionWarning,
} from './exhaustion-feedback';

// Tool Usage Tracker (Story 21-6)
export {
  // Types
  type ToolName,
  type ToolUserProfile,
  type MasteryLevel,
  type ToolDistribution,
  type ProfileClassificationResult,
  type ToolUsageProfile,
  type TeamToolAverage,
  type TeamAverages,
  type TeamComparison,
  type ToolMasteryProfile,
  type ToolFeedback,
  // Constants
  TOOL_NAMES,
  ALL_TOOL_NAMES,
  TOOL_USER_PROFILES,
  // Tool extraction
  extractToolUsage,
  calculateToolDistribution,
  // Profile classification
  classifyUserProfile,
  // Insights generation
  identifyTopTools,
  identifyUnderutilizedTools,
  generateToolInsights,
  // Team comparison
  compareToTeamAverages,
  // Mastery calculation
  calculateMasteryLevel,
  // Feedback generation
  generateToolFeedback,
} from './tool-usage-tracker';

// Timing Analyzer (Story 21-5)
export {
  // Types
  type TimingMetrics,
  // Constants
  RAPID_FIRE_THRESHOLD_SECONDS,
  LONG_PAUSE_THRESHOLD_SECONDS,
  FOLLOW_UP_PATTERNS,
  // Functions
  isFollowUpPrompt,
  analyzeTimingWithContext,
} from './timing-analyzer';

// Interval Statistics (Story 21-5)
export {
  // Types
  type IntervalStats,
  // Functions
  calculateMean,
  calculateMedian,
  calculateIntervalStatsFromArray,
} from './interval-stats';

// Productivity Patterns (Story 21-5)
export {
  // Types
  type TimeOfDayBucket,
  type TimeOfDayDistribution,
  // Constants
  TIME_BUCKETS,
  // Functions
  getTimeOfDayBucket,
  findPeakHour,
  calculateTimeOfDayDistribution,
} from './productivity-patterns';

// Session Health (Story 21-7)
export {
  // Types
  type HealthLevel,
  type SessionHealthInput,
  type HealthFactors,
  type HealthWarning,
  type SessionHealthMetrics,
  type HealthTrendPoint,
  // Constants
  FACTOR_MAX_POINTS,
  TOTAL_MAX_POINTS,
  HEALTH_THRESHOLDS,
  WARNING_THRESHOLDS,
  // Score calculators
  calculateDurationScore,
  calculateContextScore,
  calculateFrustrationScore,
  calculateFrustrationRate,
  calculateRetryScore,
  calculateRetryRate,
  calculateToolErrorScore,
  calculateToolErrorRate,
  // Health level
  determineHealthLevel,
  // Warnings
  determineSeverity,
  generateWarnings,
  extractSuggestions,
  // Main calculator
  calculateSessionHealth,
  // Factory functions
  createDefaultHealthInput,
  createHealthTrendPoint,
  factorsToJson,
} from './session-health';

// Technical Depth Profiler (Story 21-8)
export {
  // Types
  type TechnicalPersona,
  type TechnicalBreakdown,
  type TechnicalDepthProfile,
  type WorkStyleDistribution,
  // Constants
  PERSONA_DESCRIPTIONS,
  PERSONA_CONFIDENCE,
  CLASSIFICATION_THRESHOLDS,
  INSUFFICIENT_DATA_DESCRIPTION,
  // Ratio calculators
  calculateTotal,
  calculateArchitectureRatio,
  calculateDebuggingRatio,
  calculateTestingRatio,
  calculateImplementationRatio,
  calculateBusinessUxRatio,
  calculateBreakdown,
  // Classification functions
  isArchitect,
  isFirefighter,
  isCraftsman,
  classifyPersona,
  // Main calculator
  calculateTechnicalProfile,
  // Factory function
  createEmptyProfile,
} from './technical-depth';

// Heuristic Classification Patterns (Story 27-2)
export {
  // Main classifier
  classifyByHeuristics,
  // Pattern sets (for testing/debugging)
  CONFIRMATION_EXACT_MATCHES,
  CONFIRMATION_PATTERNS,
  SELECTION_PATTERNS,
  SELECTION_MAX_LENGTH,
  CORRECTION_INDICATORS,
  CLARIFICATION_PATTERNS,
  // Helper functions
  normalizePrompt,
  isConfirmation,
  isSelection,
  isCorrection,
  isClarification,
} from './classificationPatterns';

// Option Extractor (Story 27-2)
export {
  // Types
  type ExtractedOption,
  // Main functions
  extractOptionsFromResponse,
  extractOptionsWithMetadata,
  hasOptions,
  // Individual extractors (for testing)
  extractNumberedOptions,
  extractLetteredOptions,
  extractLabeledOptions,
  extractBulletOptions,
  // Constants
  MAX_OPTION_TEXT_LENGTH,
  MAX_OPTIONS,
} from './optionExtractor';

// Prompt Classifier (Story 27-1)
export {
  // Main classifier
  classifyPrompt,
  // Helpers
  getScoringWeight,
  shouldSkipScoring,
  // Constants
  SCORING_WEIGHTS,
  HEURISTIC_CONFIDENCE_THRESHOLD,
} from './promptClassifier';

// LLM Classifier (Story 27-1)
export {
  // Main classifier
  classifyByLLM,
  // Helpers (for testing)
  buildClassificationPrompt,
  parseClassificationResponse,
} from './llmClassifier';
