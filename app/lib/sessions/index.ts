/**
 * Sessions Module
 * Story 16-2: Session Detection Logic
 * Story 16-3: Session Metadata Capture
 *
 * Provides session detection, creation, and management functionality
 * for Claude Code sessions, including metadata extraction and lifecycle management.
 */

// Session detection and management
export {
  // Types
  type SessionContext,
  type FindOrCreateSessionResult,
  // Validation
  isValidSessionId,
  // Extraction
  extractSessionId,
  extractSessionIdFromMetadata,
  // Session operations
  findOrCreateSession,
  incrementSessionPromptCount,
  linkPromptToSession,
  getSessionBySessionId,
} from "./session-detection";

// Story 25-1: Session upsert for response capture
export {
  type UpsertSessionResult,
  type ResponseSessionCreate,
  upsertSessionForResponse,
} from "./upsert-session";

// Session context resolution
export {
  type ResolveContextInput,
  SessionContextError,
  resolveSessionContext,
  buildSessionContextFromKeyResult,
} from "./session-context";

// Story 16-3: Session Metadata Types
export type {
  SessionMetadata,
  SessionTimingInfo,
  SessionEndReason,
  SessionEndInfo,
  TranscriptContext,
  TranscriptMessage,
  SessionEndDetectionResult,
  CloseStaleSessionsOptions,
  CloseStaleSessionsResult,
} from './types';

// Story 16-3: Metadata extraction
export {
  sanitizePath,
  generateSlug,
  extractSessionMetadata,
  extractStartedAt,
  extractLastMessageTimestamp,
  extractContextFromMessages,
  calculateSessionDuration,
} from './metadata-extraction';

// Story 16-3: Session lifecycle
export {
  detectSessionEnd,
  inferEndReason,
  closeSession,
  closeStaleSession,
  isSessionActive,
  getSessionPromptCount,
} from './session-lifecycle';

// Story 16-3: Session updates
export {
  updateSessionMetadata,
  updateSessionMetadataIfNull,
  updateSessionTiming,
  incrementSessionTokens,
  getOrCreateSession,
  // Story 21-1: Context Exhaustion
  markContextExhausted,
  updateContextUsageEstimate,
  getSessionDurationMinutes,
} from './session-update';

// Story 16-4: Conversation Threading - Thread Linking
export {
  type ParentResolutionResult,
  type UuidMapping,
  resolveParentPrompt,
  batchResolveParents,
  clearUuidCache,
  cacheUuidMapping,
  getUuidCacheSize,
} from './thread-linking';

// Story 16-4: Conversation Threading - Tree Building
export {
  type ThreadedPrompt,
  type ConversationTree,
  type PromptRow,
  buildConversationTree,
  flattenTree,
  findPromptInTree,
  getPromptPath,
  countByDepth,
} from './conversation-tree';

// Story 16-4: Conversation Threading - Thread Queries
export {
  type LinearPrompt,
  type LinearThread,
  SessionNotFoundError,
  AccessDeniedError,
  getSessionThread,
  getSessionLinearThread,
  verifySessionAccess,
  getSessionTeamId,
} from './thread-query';

// Story 16-5: Multi-Terminal Awareness - Active Sessions
export {
  type ActiveSession,
  type GetUserSessionsOptions,
  type GetUserSessionsResult,
  getActiveSessions,
  getUserSessions,
  getTeamActiveSessions,
  countActiveSessions,
} from './active-sessions';

// Story 16-5: Multi-Terminal Awareness - Session Overlap
export {
  type SessionTimeRange,
  type OverlapInfo,
  type ConcurrentSessionGroup,
  detectOverlappingSessions,
  groupConcurrentSessions,
  findConcurrentSessionIds,
  getMaxConcurrentSessions,
  hasConcurrentSessions,
} from './session-overlap';

// Story 16-5: Multi-Terminal Awareness - Types
export {
  type MultiTerminalSessionSummary,
  type SessionDisplayNameInput,
  generateSessionDisplayName,
  calculateDurationMinutes,
} from './types';

// Story 16-6: Session Duration Calculation
export {
  // Types
  type SessionTimings,
  type DurationResult,
  // Constants
  MAX_SESSION_HOURS,
  MAX_SESSION_MINUTES,
  // Core duration functions
  calculateSessionDuration as calculateDuration,
  formatDuration,
  formatDurationLong,
  calculateInterPromptDuration,
  // Stale session handling
  isSessionStale,
  filterStaleSessions,
  getTotalDuration,
  extractTimings,
} from './duration';

// Story 16-6: Duration Aggregates
export {
  type DateRange,
  type DurationStats,
  getSessionDurationStats,
  getTeamSessionDurationStats,
  calculateDurationStats,
  calculateMedian,
  calculateTrimmedMean,
  calculatePercentile,
  getDurationDistribution,
} from './duration-aggregates';

// Story 16-6: Duration Summaries
export {
  type PeriodSummary,
  getDailySummary,
  getTeamDailySummary,
  getWeeklySummary,
  getTeamWeeklySummary,
  getMonthlySummary,
  getTeamMonthlySummary,
  calculateDailySummaries,
  calculateWeeklySummaries,
  calculateMonthlySummaries,
} from './duration-summaries';

// Story 16-6: Efficiency Metrics
export {
  type EfficiencyMetrics,
  calculatePromptsPerHour,
  calculateAverageTimeBetweenPrompts,
  calculateAverageGapFromPrompts,
  calculateSessionDensity,
  calculateDensityFromPrompts,
  findSessionPeakHour,
  findPeakHourFromPrompts,
  calculateHourlyDistribution,
  getSessionEfficiencyMetrics,
  getUserEfficiencyMetrics,
} from './efficiency';

// Story 21-6: Tool Usage Profiling
export {
  type SessionToolUsageRecord,
  type RecordToolUsageOptions,
  type GetUserToolDistributionOptions,
  type TeamToolAveragesResult,
  // Recording functions
  recordToolUsage,
  recordBatchToolUsage,
  extractAndRecordToolUsage,
  // Querying functions
  getSessionToolUsage,
  getUserToolDistribution,
  getTeamToolAverages,
  // Profile generation
  getUserToolProfile,
  getUserProfileClassification,
} from './tool-usage';
