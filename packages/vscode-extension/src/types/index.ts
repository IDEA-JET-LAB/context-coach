/**
 * Contextor VS Code Extension Type Definitions
 */

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
 * Analytics data from Contextor API
 */
export interface AnalyticsData {
  /** Session metrics */
  sessions: SessionMetrics;
  /** Prompt efficiency scores */
  efficiency: EfficiencyMetrics;
  /** Recent activity summary */
  recentActivity: ActivitySummary[];
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

/**
 * Coaching tip from the backend
 */
export interface CoachingTip {
  /** Tip identifier */
  id: string;
  /** Tip category */
  category: 'clarity' | 'context' | 'efficiency' | 'best-practice';
  /** Tip title */
  title: string;
  /** Detailed tip message */
  message: string;
  /** Optional action URL */
  actionUrl?: string;
}

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
