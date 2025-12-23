/**
 * Contextor VS Code Extension Type Definitions
 */

// Re-export analytics types
export * from './analytics';

// Re-export coaching types (Story 19-5)
// Note: PromptSuggestion is also exported from analytics, so we use CoachingPromptSuggestion here
export {
  DimensionName,
  TipPriority,
  TipSource,
  CoachingTip,
  WeakDimension,
  CoachingResponse,
  CoachingPromptSuggestion,
  DismissTipRequest,
  COACHING_STORAGE_KEYS,
  CachedCoaching,
  DIMENSION_CONFIG,
  DEFAULT_GETTING_STARTED_TIPS,
} from './coaching';

/**
 * Extension configuration settings
 */
export interface ContextorConfig {
  /** API endpoint URL */
  apiEndpoint: string;
  /** Enable coaching notifications */
  enableNotifications: boolean;
}

/**
 * Authentication token stored in VS Code secrets
 */
export interface AuthToken {
  /** JWT access token */
  accessToken: string;
  /** Token expiration timestamp */
  expiresAt: number;
  /** Refresh token for token renewal */
  refreshToken?: string;
}

/**
 * Session metrics summary
 */
export interface SessionMetrics {
  /** Total sessions today */
  todayCount: number;
  /** Total prompts today */
  todayPrompts: number;
  /** Average session duration (minutes) */
  avgDuration: number;
  /** Current streak (days) */
  streak: number;
}

/**
 * Efficiency metrics
 */
export interface EfficiencyMetrics {
  /** Overall efficiency score (0-100) */
  overallScore: number;
  /** Prompts per hour */
  promptsPerHour: number;
  /** Average prompt length */
  avgPromptLength: number;
  /** Context utilization percentage */
  contextUtilization: number;
}

/**
 * Activity summary item
 */
export interface ActivitySummary {
  /** Activity timestamp */
  timestamp: string;
  /** Activity type */
  type: 'prompt' | 'session_start' | 'session_end';
  /** Brief description */
  description: string;
}

// Note: CoachingTip is now imported from './coaching' (Story 19-5)
// The old interface with 'category' field has been replaced by the new one with 'dimension' field

/**
 * Session state for recovery
 */
export interface SessionState {
  /** Session identifier */
  sessionId: string;
  /** Last active timestamp */
  lastActiveAt: string;
  /** Working directory */
  workingDirectory: string;
  /** Git branch at interruption */
  gitBranch?: string;
  /** Last prompt text */
  lastPrompt: string;
  /** Context summary for recovery */
  contextSummary: string;
}
