/**
 * Message types for extension-webview communication
 * Story 19-4: Real-time Analytics Display
 * Story 19-5: Quick Coaching Tips
 */

import { UserProfile } from "../services/auth";
import {
  TimeRange,
  SyncState,
  AnalyticsData,
  RecentPrompt,
  PromptDetail,
} from "./analytics";
import {
  CoachingTip,
  WeakDimension,
} from "./coaching";

/**
 * Analytics panel state sent to webview
 */
export interface AnalyticsPanelState {
  // Analytics data
  analytics: AnalyticsData | null;
  recentPrompts: RecentPrompt[];
  promptDetail: PromptDetail | null;

  // Loading/error states
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  // Sync/offline states
  isOffline: boolean;
  syncState: SyncState;
  lastSyncTime: string | null;

  // Settings
  timeRange: TimeRange;

  // User info
  user: UserProfile | null;
  isAuthenticated: boolean;

  // Coaching data (Story 19-5)
  coachingTips: CoachingTip[];
  weakDimensions: WeakDimension[];
  dismissedTipIds: string[];
  isCoachingLoading: boolean;
}

/**
 * Messages sent from the extension to the webview
 */
export type ExtensionToWebviewMessage =
  // Authentication
  | { type: "auth"; authenticated: boolean; user?: UserProfile }

  // Full state update
  | { type: "state"; state: Partial<AnalyticsPanelState> }

  // Analytics data
  | { type: "analytics"; data: AnalyticsData; recentPrompts: RecentPrompt[] }

  // Prompt detail
  | { type: "prompt-detail"; detail: PromptDetail | null }

  // Loading states
  | { type: "loading"; isLoading: boolean }
  | { type: "refreshing"; isRefreshing: boolean }

  // Error handling
  | { type: "error"; message: string }

  // Sync status
  | { type: "sync-state"; state: SyncState; lastSyncTime?: string }
  | { type: "offline"; isOffline: boolean }

  // Legacy support (from existing code)
  | { type: "analytics-legacy"; data: LegacyAnalyticsData; user: UserProfile }

  // Coaching messages (Story 19-5)
  | { type: "coaching"; tips: CoachingTip[]; weakDimensions: WeakDimension[] }
  | { type: "coaching-loading"; isLoading: boolean }
  | { type: "tip-dismissed"; tipId: string }

  // Session messages
  | { type: "sessions"; sessions: SessionInfo[] }
  | { type: "sessions-loading"; isLoading: boolean }
  | { type: "session-recovered"; sessionId: string; success: boolean }
  | { type: "session-dismissed"; sessionId: string }

  // Import messages
  | { type: "import-status"; status: ImportStatus }

  // Last prompt messages
  | { type: "last-prompt"; prompt: LastPromptData | null }
  | { type: "last-prompt-loading"; isLoading: boolean };

/**
 * Session info for webview display
 */
export interface SessionInfo {
  sessionId: string;
  projectName: string;
  lastActivity: string;
  lastPrompt: string;
  messageCount: number;
  isInterrupted?: boolean;
}

/**
 * Last prompt data for webview display
 */
export interface LastPromptData {
  id: string;
  text: string;
  overall_score: number;
  clarity_score: number;
  context_score: number;
  specificity_score: number;
  actionability_score: number;
  efficiency_score: number;
  created_at: string;
}

/**
 * Import status for webview display
 */
export interface ImportStatus {
  state: "idle" | "scanning" | "importing" | "complete" | "error" | "cancelled";
  totalSessions: number;
  importedCount: number;
  skippedCount: number;
  errorMessage?: string;
  /** Detailed status message for user feedback */
  statusMessage?: string;
  /** Current project being processed */
  currentProject?: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Messages sent from the webview to the extension
 */
export type WebviewToExtensionMessage =
  // Initialization
  | { type: "ready" }

  // Authentication
  | { type: "login" }
  | { type: "logout" }

  // Analytics actions
  | { type: "refresh" }
  | { type: "time-range-change"; timeRange: TimeRange }

  // Prompt actions
  | { type: "prompt-click"; promptId: string }
  | { type: "prompt-detail-close" }

  // Error reporting
  | { type: "error"; error: string }

  // Retry action
  | { type: "retry" }

  // Coaching actions (Story 19-5)
  | { type: "refresh-coaching" }
  | { type: "dismiss-tip"; tipId: string; reason?: "applied" | "not_relevant" | "already_know" }

  // Session actions
  | { type: "scan-sessions" }
  | { type: "recover-session"; sessionId: string }
  | { type: "dismiss-session"; sessionId: string }

  // Import actions
  | { type: "start-import" }
  | { type: "cancel-import" }

  // Last prompt actions
  | { type: "fetch-last-prompt" };

/**
 * Legacy AnalyticsData type for backward compatibility
 * TODO: Remove once webview is fully migrated
 */
export interface LegacyAnalyticsData {
  sessions: {
    todayCount: number;
    todayPrompts: number;
    avgDuration: number;
    streak: number;
  };
  efficiency: {
    overallScore: number;
    promptsPerHour: number;
    avgPromptLength: number;
    contextUtilization: number;
  };
  recentActivity: Array<{
    timestamp: string;
    type: "prompt" | "session_start" | "session_end";
    description: string;
  }>;
}
