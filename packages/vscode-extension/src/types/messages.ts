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
  | { type: "import-history"; history: ImportHistoryData | null }
  | { type: "import-teams"; teams: ImportTeamInfo[] }
  | { type: "import-teams-loading"; isLoading: boolean }

  // Last prompt messages
  | { type: "last-prompt"; prompt: LastPromptData | null }
  | { type: "last-prompt-loading"; isLoading: boolean }
  // Conversation messages (Phase 3)
  | { type: "conversations"; conversations: ConversationSummary[] }
  | { type: "conversations-loading"; isLoading: boolean }
  | { type: "conversation-messages"; messages: ConversationMessage[] }
  | { type: "conversation-messages-loading"; isLoading: boolean }

  // Project status messages (BMAD)
  | { type: "project-status"; status: ProjectStatusData | null }
  | { type: "project-status-loading"; isLoading: boolean }
  | { type: "project-status-error"; error: string }

  // Workspace installation status
  | { type: "workspace-status"; status: WorkspaceStatus }

  // Documents messages
  | { type: "documents"; documents: DocumentItem[] }
  | { type: "documents-loading"; isLoading: boolean }

  // BMAD version messages
  | { type: "bmad-version-info"; versionInfo: BmadVersionInfo }
  | { type: "bmad-version-loading"; isLoading: boolean }

  // CLI version messages
  | { type: "cli-version-info"; versionInfo: CliVersionInfo }
  | { type: "cli-version-loading"; isLoading: boolean }

  // Team stats messages
  | { type: "teams"; teams: TeamInfo[] }
  | { type: "teams-loading"; isLoading: boolean }
  | { type: "team-stats"; data: TeamStatsData }
  | { type: "team-stats-loading"; isLoading: boolean }

  // Server status messages
  | { type: "server-status"; isServerOnline: boolean; retryCountdown?: number }

  // Extension version
  | { type: "extension-version"; version: string }

  // Signup result messages
  | { type: "signup-result"; success: boolean; message: string; requiresEmailConfirmation?: boolean }
  | { type: "signup-loading"; isLoading: boolean };

/**
 * Conversation summary for webview display (Phase 3)
 */
export interface ConversationSummary {
  id: string;
  sessionId: string;
  slug: string;
  projectName: string | null;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  primaryStage: string | null;
  hasDebuggingLoop: boolean;
  conversationScore: number | null;
  gitBranch: string | null;
}

/**
 * Conversation message for webview display (Phase 3)
 */
export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  promptType?: string;
  score?: number;
  toolsUsed?: string[];
}

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
  state: "idle" | "scanning" | "selecting" | "importing" | "complete" | "error" | "cancelled";
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
  /** Discovered projects for selection (when state is 'selecting') */
  discoveredProjects?: DiscoveredProjectInfo[];
}

/**
 * Discovered Claude Code project info for webview display
 */
export interface DiscoveredProjectInfo {
  /** Human-readable path (e.g., /Users/edgars/my-project) */
  path: string;
  /** Normalized path used in storage (e.g., -Users-edgars-my-project) */
  normalizedPath: string;
  /** Number of session files (JSONL) */
  sessionCount: number;
  /** Estimated number of prompts based on file size */
  estimatedPrompts: number;
  /** Oldest session file timestamp */
  oldestSession: string;
  /** Newest session file timestamp */
  newestSession: string;
  /** Display-friendly project name extracted from path */
  displayName: string;
}

/**
 * Import history data for webview display
 */
export interface ImportHistoryData {
  timestamp: string;
  importedCount: number;
  skippedCount: number;
  totalSessions: number;
}

/**
 * Team info for import team selection
 */
export interface ImportTeamInfo {
  id: string;
  name: string;
}

/**
 * Workspace installation status
 */
export interface WorkspaceStatus {
  contextorInstalled: boolean;
  bmadInstalled: boolean;
  projectId: string | null;
  projectName: string | null;
}

/**
 * Project status data for BMAD sprint tracking
 */
export interface ProjectStatusData {
  project: string;
  generated: string;
  epics: Array<{
    id: string;
    name: string;
    status: string;
    description?: string;
    stories: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  }>;
}

/**
 * Document tree item for BMAD documents panel
 */
export interface DocumentItem {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  children?: DocumentItem[];
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
  | { type: "signup"; email: string; password: string }
  | { type: "signup-google" }

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
  | { type: "confirm-import-projects"; selectedPaths: string[]; teamId?: string }
  | { type: "fetch-import-teams" }

  // Last prompt actions
  | { type: "fetch-last-prompt" }

  // Terminal command actions
  | { type: "run-terminal-command"; command: string }

  // Start new Claude Code conversation
  | { type: "start-conversation" }

  // Conversation actions (Phase 3)
  | { type: "fetch-conversations" }
  | { type: "select-conversation"; sessionId: string }
  | { type: "close-conversation" }
  | { type: "open-conversation-in-browser"; sessionId: string }

  // Project status actions (BMAD)
  | { type: "fetch-project-status" }
  | { type: "open-status-file" }
  | { type: "run-validation"; epicId: string; storyId?: string }

  // Workspace installation actions
  | { type: "install-bmad" }
  | { type: "refresh-workspace-status" }
  | { type: "register-project" }

  // Documents actions
  | { type: "fetch-documents" }
  | { type: "open-document"; path: string }
  | { type: "create-document"; doc: ProjectDocumentInfo }

  // BMAD version actions
  | { type: "fetch-bmad-version" }
  | { type: "upgrade-bmad" }

  // CLI version actions
  | { type: "fetch-cli-version" }
  | { type: "upgrade-cli" }

  // Team stats actions
  | { type: "fetch-teams" }
  | { type: "fetch-team-stats"; teamId?: string; timeRange?: TeamTimeRange };

/**
 * Project document info for creation workflow
 */
export interface ProjectDocumentInfo {
  id: string;
  name: string;
  filename: string;
  workflow: string | null;
  agent: string | null;
}

/**
 * BMAD version information for settings panel
 */
export interface BmadVersionInfo {
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: string | null;
}

/**
 * CLI version information for update notifications
 */
export interface CliVersionInfo {
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: string | null;
  /** Whether CLI is installed globally */
  isInstalled: boolean;
}

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

/**
 * Team time range for filtering
 */
export type TeamTimeRange = "today" | "week" | "month";

/**
 * Team info for dropdown display
 */
export interface TeamInfo {
  id: string;
  name: string;
  memberCount: number;
}

/**
 * Team member stats for webview display
 */
export interface TeamMemberStats {
  userId: string;
  name: string;
  avatarUrl: string | null;
  promptCount: number;
  avgScore: number;
  scoreChange: number | null;
  avgCharCount: number;
  rank: number;
}

/**
 * Team stats data for webview display
 */
export interface TeamStatsData {
  members: TeamMemberStats[];
  teamName: string;
  timeRange: TeamTimeRange;
  currentUserId: string;
}
