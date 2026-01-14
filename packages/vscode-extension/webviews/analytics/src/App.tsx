import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dashboard } from "./components/Dashboard";
import { ErrorState } from "./components/ErrorState";
import { Loading } from "./components/Loading";
import { TabNavigation, type TabId } from "./components/TabNavigation";
import { SessionsPanel, type Session } from "./components/SessionsPanel";
import { ImportPanel, type ImportStatus, type ImportHistory, type ExistingProject, type ProjectMappings, type ProjectCustomNames, type ProjectTeamIds, type TeamWithProjects } from "./components/ImportPanel";
import { LastPromptPanel, type LastPromptData } from "./components/LastPromptPanel";
import { CommandsPanel } from "./components/CommandsPanel";
import { ConversationsPanel } from "./components/ConversationsPanel";
import { StatusPanel, type ProjectStatusData, type StatusSectionState } from "./components/StatusPanel";
import { NotInstalledPanel } from "./components/NotInstalledPanel";
import { DocumentsPanel, type DocumentItem, type ProjectDocument } from "./components/DocumentsPanel";
import { BmadSettingsPanel, type BmadVersionInfo } from "./components/BmadSettingsPanel";
import { TeamPanel, type TeamStatsData, type TeamTimeRange, type TeamInfo } from "./components/TeamPanel";
import { FeedbackPanel, type FeedbackCategory } from "./components/FeedbackPanel";
import type { DimensionScore, PromptDimensions } from "../../shared/types";

// ============================================
// VS Code Webview API Types
// ============================================

interface VSCodeAPI {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare global {
  function acquireVsCodeApi(): VSCodeAPI;
}

// ============================================
// Message Types
// ============================================

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface AnalyticsData {
  summary: {
    overallScore: number;
    promptCount: number;
    timeRange: string;
    scoreChange?: number;
    countChange?: number;
  };
  dimensions: {
    clarity: DimensionScore;
    context: DimensionScore;
    specificity: DimensionScore;
    actionability: DimensionScore;
    efficiency: DimensionScore;
  };
  lastUpdated: string;
}

// ============================================
// Conversation Types (Phase 3)
// ============================================

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

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  promptType?: string;
  score?: number;
  toolsUsed?: string[];
}

// ============================================
// Workspace Status Types
// ============================================

export interface WorkspaceStatus {
  contextorInstalled: boolean;
  bmadInstalled: boolean;
  projectId: string | null;
  projectName: string | null;
  teamId: string | null;
}

type ExtensionMessage =
  | { type: "auth"; authenticated: boolean; user?: UserProfile }
  | { type: "analytics"; data: AnalyticsData }
  | { type: "error"; message: string }
  | { type: "loading"; isLoading: boolean }
  | { type: "refreshing"; isRefreshing: boolean }
  // Server status
  | { type: "server-status"; isServerOnline: boolean; retryCountdown?: number }
  // Extension version
  | { type: "extension-version"; version: string }
  // Signup messages
  | { type: "signup-result"; success: boolean; message: string; requiresEmailConfirmation?: boolean }
  | { type: "signup-loading"; isLoading: boolean }
  // Session messages
  | { type: "sessions"; sessions: Session[] }
  | { type: "sessions-loading"; isLoading: boolean }
  | { type: "session-recovered"; sessionId: string; success: boolean }
  | { type: "session-dismissed"; sessionId: string }
  // Import messages
  | { type: "import-status"; status: ImportStatus }
  | { type: "import-history"; history: ImportHistory | null }
  // Last prompt messages
  | { type: "last-prompt"; prompt: LastPromptData | null }
  | { type: "last-prompt-loading"; isLoading: boolean }
  // Status messages
  | { type: "project-status"; status: ProjectStatusData | null }
  | { type: "project-status-loading"; isLoading: boolean }
  | { type: "project-status-error"; error: string }
  // Conversation messages (Phase 3)
  | { type: "conversations"; conversations: ConversationSummary[] }
  | { type: "conversations-loading"; isLoading: boolean }
  | { type: "conversation-messages"; messages: ConversationMessage[] }
  | { type: "conversation-messages-loading"; isLoading: boolean }
  // Workspace status
  | { type: "workspace-status"; status: WorkspaceStatus }
  // Documents messages
  | { type: "documents"; documents: DocumentItem[] }
  | { type: "documents-loading"; isLoading: boolean }
  // BMAD version messages
  | { type: "bmad-version-info"; versionInfo: BmadVersionInfo }
  | { type: "bmad-version-loading"; isLoading: boolean }
  // Teams messages
  | { type: "teams"; teams: TeamInfo[] }
  | { type: "teams-loading"; isLoading: boolean }
  | { type: "team-stats"; data: TeamStatsData }
  | { type: "team-stats-loading"; isLoading: boolean }
  // Feedback messages
  | { type: "feedback-submitted"; success: boolean; message?: string }
  | { type: "feedback-loading"; isLoading: boolean }
  // Team projects for import matching (all teams grouped)
  | { type: "import-all-team-projects"; teams: TeamWithProjects[] }
  | { type: "import-all-team-projects-loading"; isLoading: boolean }
  // Environment info
  | { type: "environment-info"; apiEndpoint: string };

type WebviewMessage =
  | { type: "refresh" }
  | { type: "error"; error: string }
  | { type: "ready" }
  | { type: "login" }
  | { type: "logout" }
  | { type: "signup"; email: string; password: string }
  | { type: "signup-google" }
  // Session messages
  | { type: "scan-sessions" }
  | { type: "recover-session"; sessionId: string }
  | { type: "dismiss-session"; sessionId: string }
  // Import messages
  | { type: "start-import" }
  | { type: "cancel-import" }
  | { type: "confirm-import-projects"; selectedPaths: string[]; teamId?: string }
  | { type: "confirm-project-mappings"; mappings: ProjectMappings; customNames: ProjectCustomNames; teamIds: ProjectTeamIds }
  | { type: "fetch-import-teams" }
  | { type: "fetch-all-team-projects" }
  // Last prompt messages
  | { type: "fetch-last-prompt" }
  // Status messages
  | { type: "fetch-project-status" }
  | { type: "open-status-file" }
  | { type: "run-validation"; epicId: string; storyId?: string }
  // Terminal command messages
  | { type: "run-terminal-command"; command: string }
  // Conversation messages (Phase 3)
  | { type: "fetch-conversations" }
  | { type: "select-conversation"; sessionId: string }
  | { type: "close-conversation" }
  | { type: "open-conversation-in-browser"; sessionId: string }
  // Workspace installation actions
  | { type: "install-bmad" }
  | { type: "refresh-workspace-status" }
  | { type: "register-project" }
  // Documents actions
  | { type: "fetch-documents" }
  | { type: "open-document"; path: string }
  // Start conversation action
  | { type: "start-conversation" }
  // BMAD version actions
  | { type: "fetch-bmad-version" }
  | { type: "upgrade-bmad" }
  // Team stats actions
  | { type: "fetch-teams" }
  | { type: "fetch-team-stats"; teamId?: string; timeRange?: TeamTimeRange }
  // Feedback actions
  | { type: "submit-feedback"; category: string; message: string }
  // Global actions
  | { type: "open-web" }
  // Environment toggle
  | { type: "set-environment"; isDevelopment: boolean };

// ============================================
// App State
// ============================================

interface AppState {
  // Auth & Analytics
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  analytics: AnalyticsData | null;
  user: UserProfile | null;
  // Navigation
  activeTab: TabId;
  lastContextorTab: TabId;
  lastBmadTab: TabId;
  // Sessions
  sessions: Session[];
  sessionsLoading: boolean;
  // Import
  importStatus: ImportStatus | null;
  lastImport: ImportHistory | null;
  importTeams: Array<{ id: string; name: string }>;
  importTeamsLoading: boolean;
  allTeamProjects: TeamWithProjects[];
  allTeamProjectsLoading: boolean;
  importSelectedPaths: string[];
  importSelectedTeamId: string | undefined;
  // Last Prompt
  lastPrompt: LastPromptData | null;
  lastPromptLoading: boolean;
  // Project Status
  projectStatus: ProjectStatusData | null;
  projectStatusLoading: boolean;
  projectStatusError: string | null;
  statusSectionState: StatusSectionState;
  // Conversations (Phase 3)
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  selectedConversation: ConversationSummary | null;
  conversationMessages: ConversationMessage[];
  conversationMessagesLoading: boolean;
  // Workspace status
  workspaceStatus: WorkspaceStatus | null;
  // Documents
  documents: DocumentItem[];
  documentsLoading: boolean;
  // BMAD version
  bmadVersionInfo: BmadVersionInfo | null;
  bmadVersionLoading: boolean;
  // Team stats
  teams: TeamInfo[];
  teamsLoading: boolean;
  selectedTeamId: string | null;
  teamStats: TeamStatsData | null;
  teamStatsLoading: boolean;
  // Server status
  isServerOnline: boolean;
  retryCountdown: number;
  // Extension version
  extensionVersion: string;
  // Signup state
  isSignupMode: boolean;
  signupLoading: boolean;
  signupMessage: string | null;
  signupSuccess: boolean | null;
  signupEmail: string;
  signupPassword: string;
  signupConfirmPassword: string;
  // Feedback state
  feedbackOpen: boolean;
  feedbackLoading: boolean;
  feedbackResult: { success: boolean; message: string } | null;
  // Environment
  apiEndpoint: string;
}

const initialState: AppState = {
  isAuthenticated: false,
  isLoading: true,
  isRefreshing: false,
  error: null,
  analytics: null,
  user: null,
  activeTab: "analytics",
  lastContextorTab: "analytics",
  lastBmadTab: "commands",
  sessions: [],
  sessionsLoading: false,
  importStatus: null,
  lastImport: null,
  importTeams: [],
  importTeamsLoading: false,
  allTeamProjects: [],
  allTeamProjectsLoading: false,
  importSelectedPaths: [],
  importSelectedTeamId: undefined,
  lastPrompt: null,
  lastPromptLoading: false,
  // Project Status
  projectStatus: null,
  projectStatusLoading: false,
  projectStatusError: null,
  statusSectionState: {
    inProgress: true,
    backlog: true,
    completed: false, // Collapsed by default
    deferred: false,  // Collapsed by default
  },
  // Conversations (Phase 3)
  conversations: [],
  conversationsLoading: false,
  selectedConversation: null,
  conversationMessages: [],
  conversationMessagesLoading: false,
  // Workspace status
  workspaceStatus: null,
  // Documents
  documents: [],
  documentsLoading: false,
  // BMAD version
  bmadVersionInfo: null,
  bmadVersionLoading: false,
  // Team stats
  teams: [],
  teamsLoading: false,
  selectedTeamId: null,
  teamStats: null,
  teamStatsLoading: false,
  // Server status
  isServerOnline: true,
  retryCountdown: 0,
  // Extension version
  extensionVersion: "",
  // Signup state
  isSignupMode: false,
  signupLoading: false,
  signupMessage: null,
  signupSuccess: null,
  signupEmail: "",
  signupPassword: "",
  signupConfirmPassword: "",
  // Feedback state
  feedbackOpen: false,
  feedbackLoading: false,
  feedbackResult: null,
  // Environment
  apiEndpoint: "https://contextor.co/api",
};

// ============================================
// Main App Component
// ============================================

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(initialState);
  const vscodeRef = useRef<VSCodeAPI | null>(null);

  // Initialize VS Code API
  useEffect(() => {
    try {
      vscodeRef.current = acquireVsCodeApi();

      // Restore persisted state (but clear teamStats to force fresh fetch)
      // CRITICAL: Always reset isLoading to true to show loading spinner
      // until extension confirms auth state. This prevents showing stale
      // sign-in screen when user is actually authenticated via SecretStorage.
      const persistedState = vscodeRef.current.getState() as AppState | undefined;
      if (persistedState) {
        setState((prev) => ({
          ...prev,
          ...persistedState,
          isLoading: true, // Always show loading until auth is confirmed
          teamStats: null,
          teamStatsLoading: false
        }));
      }

      // Notify extension that webview is ready
      vscodeRef.current.postMessage({ type: "ready" } satisfies WebviewMessage);
    } catch {
      // Running outside VS Code (for development)
      console.log("Running in development mode (no VS Code API)");
      // Show mock data in dev mode
      setState({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        analytics: {
          summary: {
            overallScore: 78,
            promptCount: 25,
            timeRange: "7d",
            scoreChange: 5,
          },
          dimensions: {
            clarity: { score: 82, trend: "up", change: 3 },
            context: { score: 75, trend: "stable" },
            specificity: { score: 70, trend: "down", change: -2 },
            actionability: { score: 85, trend: "up", change: 5 },
            efficiency: { score: 78, trend: "stable" },
          },
          lastUpdated: new Date().toISOString(),
        },
        user: {
          id: "dev-user",
          email: "dev@example.com",
          name: "Developer",
        },
        activeTab: "analytics",
        sessions: [
          {
            sessionId: "dev-session-1",
            projectName: "context-coach",
            lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            lastPrompt: "Help me implement the session recovery feature",
            messageCount: 25,
            isInterrupted: true,
          },
          {
            sessionId: "dev-session-2",
            projectName: "my-website",
            lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            lastPrompt: "Fix the CSS layout issue on mobile",
            messageCount: 12,
            isInterrupted: false,
          },
        ],
        sessionsLoading: false,
        importStatus: null,
        lastPrompt: {
          id: "dev-prompt-1",
          text: "Help me implement a Last Prompt tab that shows the most recent prompt with its analysis for immediate feedback",
          overall_score: 82,
          clarity_score: 85,
          context_score: 78,
          specificity_score: 80,
          actionability_score: 88,
          efficiency_score: 79,
          created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
        lastPromptLoading: false,
        // Mock conversations for dev mode
        conversations: [
          {
            id: "conv-1",
            sessionId: "dev-session-1",
            slug: "Session Recovery Feature",
            projectName: "context-coach",
            startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            endedAt: null,
            messageCount: 25,
            primaryStage: "development",
            hasDebuggingLoop: false,
            conversationScore: 78,
            gitBranch: "feature/session-recovery",
          },
          {
            id: "conv-2",
            sessionId: "dev-session-2",
            slug: "CSS Layout Fix",
            projectName: "my-website",
            startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            endedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            messageCount: 12,
            primaryStage: "debugging",
            hasDebuggingLoop: true,
            conversationScore: 62,
            gitBranch: "fix/mobile-layout",
          },
          {
            id: "conv-3",
            sessionId: "dev-session-3",
            slug: "API Architecture Review",
            projectName: "backend-api",
            startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
            messageCount: 35,
            primaryStage: "architecture",
            hasDebuggingLoop: false,
            conversationScore: 85,
            gitBranch: "main",
          },
        ],
        conversationsLoading: false,
        selectedConversation: null,
        conversationMessages: [],
        conversationMessagesLoading: false,
      });
    }
  }, []);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "auth":
          setState((prev) => {
            const newState = {
              ...prev,
              isAuthenticated: message.authenticated,
              user: message.user || prev.user,
              isLoading: false,
            };
            vscodeRef.current?.setState(newState);
            return newState;
          });
          break;

        case "analytics":
          setState((prev) => {
            const newState = {
              ...prev,
              analytics: message.data,
              isLoading: false,
              error: null,
            };
            vscodeRef.current?.setState(newState);
            return newState;
          });
          break;

        case "error":
          setState((prev) => {
            const newState = {
              ...prev,
              error: message.message,
              isLoading: false,
            };
            vscodeRef.current?.setState(newState);
            return newState;
          });
          break;

        case "loading":
          setState((prev) => ({
            ...prev,
            isLoading: message.isLoading,
          }));
          break;

        case "refreshing":
          setState((prev) => ({
            ...prev,
            isRefreshing: message.isRefreshing,
          }));
          break;

        // Session messages
        case "sessions":
          setState((prev) => ({
            ...prev,
            sessions: message.sessions,
            sessionsLoading: false,
          }));
          break;

        case "sessions-loading":
          setState((prev) => ({
            ...prev,
            sessionsLoading: message.isLoading,
          }));
          break;

        case "session-recovered":
          if (message.success) {
            setState((prev) => ({
              ...prev,
              sessions: prev.sessions.filter((s) => s.sessionId !== message.sessionId),
            }));
          }
          break;

        case "session-dismissed":
          setState((prev) => ({
            ...prev,
            sessions: prev.sessions.filter((s) => s.sessionId !== message.sessionId),
          }));
          break;

        // Import messages
        case "import-status":
          setState((prev) => ({
            ...prev,
            importStatus: message.status,
          }));
          break;

        case "import-history":
          setState((prev) => ({
            ...prev,
            lastImport: message.history,
          }));
          break;

        case "import-teams":
          setState((prev) => ({
            ...prev,
            importTeams: message.teams || [],
          }));
          break;

        case "import-teams-loading":
          setState((prev) => ({
            ...prev,
            importTeamsLoading: message.isLoading,
          }));
          break;

        case "import-all-team-projects":
          setState((prev) => ({
            ...prev,
            allTeamProjects: message.teams || [],
            allTeamProjectsLoading: false,
          }));
          break;

        case "import-all-team-projects-loading":
          setState((prev) => ({
            ...prev,
            allTeamProjectsLoading: message.isLoading,
          }));
          break;

        // Last prompt messages
        case "last-prompt":
          setState((prev) => ({
            ...prev,
            lastPrompt: message.prompt,
            lastPromptLoading: false,
          }));
          break;

        case "last-prompt-loading":
          setState((prev) => ({
            ...prev,
            lastPromptLoading: message.isLoading,
          }));
          break;

        // Project status messages
        case "project-status":
          setState((prev) => ({
            ...prev,
            projectStatus: message.status,
            projectStatusLoading: false,
            projectStatusError: null,
          }));
          break;

        case "project-status-loading":
          setState((prev) => ({
            ...prev,
            projectStatusLoading: message.isLoading,
          }));
          break;

        case "project-status-error":
          setState((prev) => ({
            ...prev,
            projectStatusError: message.error,
            projectStatusLoading: false,
          }));
          break;

        // Conversation messages (Phase 3)
        case "conversations":
          setState((prev) => ({
            ...prev,
            conversations: message.conversations,
            conversationsLoading: false,
          }));
          break;

        case "conversations-loading":
          setState((prev) => ({
            ...prev,
            conversationsLoading: message.isLoading,
          }));
          break;

        case "conversation-messages":
          setState((prev) => ({
            ...prev,
            conversationMessages: message.messages,
            conversationMessagesLoading: false,
          }));
          break;

        case "conversation-messages-loading":
          setState((prev) => ({
            ...prev,
            conversationMessagesLoading: message.isLoading,
          }));
          break;

        // Workspace status
        case "workspace-status":
          setState((prev) => {
            // If workspace has a team and it exists in our teams list, select it
            const workspaceTeamId = message.status.teamId;
            let selectedTeamId = prev.selectedTeamId;

            if (workspaceTeamId && prev.teams.some(t => t.id === workspaceTeamId)) {
              selectedTeamId = workspaceTeamId;
            }

            return {
              ...prev,
              workspaceStatus: message.status,
              selectedTeamId,
            };
          });
          break;

        // Documents
        case "documents":
          setState((prev) => ({
            ...prev,
            documents: message.documents,
            documentsLoading: false,
          }));
          break;

        case "documents-loading":
          setState((prev) => ({
            ...prev,
            documentsLoading: message.isLoading,
          }));
          break;

        // BMAD version messages
        case "bmad-version-info":
          setState((prev) => ({
            ...prev,
            bmadVersionInfo: message.versionInfo,
            bmadVersionLoading: false,
          }));
          break;

        case "bmad-version-loading":
          setState((prev) => ({
            ...prev,
            bmadVersionLoading: message.isLoading,
          }));
          break;

        // Teams list messages
        case "teams":
          setState((prev) => {
            // Always prefer workspace's team if available in the list
            const workspaceTeamId = prev.workspaceStatus?.teamId;
            let selectedTeamId: string | null = null;

            // Priority: workspace team > previously selected > first team
            if (workspaceTeamId && message.teams.some(t => t.id === workspaceTeamId)) {
              selectedTeamId = workspaceTeamId;
            } else if (prev.selectedTeamId && message.teams.some(t => t.id === prev.selectedTeamId)) {
              selectedTeamId = prev.selectedTeamId;
            } else if (message.teams.length > 0) {
              selectedTeamId = message.teams[0].id;
            }

            // Always clear teamStats to force refetch with fresh data
            return {
              ...prev,
              teams: message.teams,
              teamsLoading: false,
              selectedTeamId,
              teamStats: null,
              teamStatsLoading: false,
            };
          });
          break;

        case "teams-loading":
          setState((prev) => ({
            ...prev,
            teamsLoading: message.isLoading,
          }));
          break;

        // Team stats messages
        case "team-stats":
          setState((prev) => ({
            ...prev,
            teamStats: message.data,
            teamStatsLoading: false,
          }));
          break;

        case "team-stats-loading":
          setState((prev) => ({
            ...prev,
            teamStatsLoading: message.isLoading,
          }));
          break;

        // Server status message
        case "server-status":
          setState((prev) => ({
            ...prev,
            isServerOnline: message.isServerOnline,
            retryCountdown: message.retryCountdown ?? 0,
          }));
          break;

        // Extension version message
        case "extension-version":
          setState((prev) => ({
            ...prev,
            extensionVersion: message.version,
          }));
          break;

        // Signup messages
        case "signup-result":
          setState((prev) => ({
            ...prev,
            signupMessage: message.message,
            signupSuccess: message.success,
            signupLoading: false,
            // If email confirmation required, show message but stay on form
            // If success without confirmation, auth state will update and hide form
          }));
          break;

        case "signup-loading":
          setState((prev) => ({
            ...prev,
            signupLoading: message.isLoading,
          }));
          break;

        // Feedback messages
        case "feedback-submitted":
          setState((prev) => ({
            ...prev,
            feedbackResult: {
              success: message.success,
              message: message.message || (message.success ? "Thank you!" : "Failed to submit"),
            },
            feedbackLoading: false,
          }));
          break;

        case "feedback-loading":
          setState((prev) => ({
            ...prev,
            feedbackLoading: message.isLoading,
          }));
          break;

        // Environment info
        case "environment-info":
          setState((prev) => ({
            ...prev,
            apiEndpoint: message.apiEndpoint,
          }));
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Auto-fetch team stats when selectedTeamId changes or teams are loaded
  // Only fetch if authenticated to prevent infinite loop when not signed in
  useEffect(() => {
    if (state.isAuthenticated && state.selectedTeamId && state.teams.length > 0 && !state.teamStats && !state.teamStatsLoading) {
      vscodeRef.current?.postMessage({
        type: "fetch-team-stats",
        teamId: state.selectedTeamId,
        timeRange: "today",
      } satisfies WebviewMessage);
      setState((prev) => ({ ...prev, teamStatsLoading: true }));
    }
  }, [state.isAuthenticated, state.selectedTeamId, state.teams.length, state.teamStats, state.teamStatsLoading]);

  // Tab change handler - tracks last tab per section for memory
  const handleTabChange = useCallback((tab: TabId) => {
    // Determine which section this tab belongs to
    const isBmadTab = tab === "commands" || tab === "status" || tab === "documents" || tab === "bmadSettings";

    setState((prev) => {
      const newState = {
        ...prev,
        activeTab: tab,
        // Update the memory for the appropriate section
        ...(isBmadTab
          ? { lastBmadTab: tab }
          : { lastContextorTab: tab }
        ),
      };
      vscodeRef.current?.setState(newState);
      return newState;
    });

    // Auto-fetch data when tabs become active
    if (tab === "analytics") {
      vscodeRef.current?.postMessage({ type: "refresh" } satisfies WebviewMessage);
    } else if (tab === "lastPrompt") {
      setState((prev) => ({ ...prev, lastPromptLoading: true }));
      vscodeRef.current?.postMessage({ type: "fetch-last-prompt" } satisfies WebviewMessage);
    } else if (tab === "conversations") {
      setState((prev) => ({ ...prev, conversationsLoading: true }));
      vscodeRef.current?.postMessage({ type: "fetch-conversations" } satisfies WebviewMessage);
    } else if (tab === "status") {
      setState((prev) => ({ ...prev, projectStatusLoading: true }));
      vscodeRef.current?.postMessage({ type: "fetch-project-status" } satisfies WebviewMessage);
    } else if (tab === "documents") {
      setState((prev) => ({ ...prev, documentsLoading: true }));
      vscodeRef.current?.postMessage({ type: "fetch-documents" } satisfies WebviewMessage);
    } else if (tab === "bmadSettings") {
      setState((prev) => ({ ...prev, bmadVersionLoading: true }));
      vscodeRef.current?.postMessage({ type: "fetch-bmad-version" } satisfies WebviewMessage);
    } else if (tab === "team") {
      setState((prev) => ({ ...prev, teamsLoading: true }));
      vscodeRef.current?.postMessage({ type: "fetch-teams" } satisfies WebviewMessage);
    }
  }, []);

  // No aggressive polling - user can manually refresh or we'll add Supabase Realtime later
  // The tab auto-fetches when it becomes active (see handleTabChange)

  // Analytics handlers
  const handleRefresh = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "refresh" } satisfies WebviewMessage);
  }, []);

  const handleRetry = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, isLoading: true }));
    handleRefresh();
  }, [handleRefresh]);

  const handleSignIn = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "login" } satisfies WebviewMessage);
  }, []);

  const handleSignOut = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "logout" } satisfies WebviewMessage);
  }, []);

  // Signup handlers
  const handleToggleSignupMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isSignupMode: !prev.isSignupMode,
      signupMessage: null,
      signupSuccess: null,
      signupEmail: "",
      signupPassword: "",
      signupConfirmPassword: "",
    }));
  }, []);

  const handleSignupEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, signupEmail: e.target.value, signupMessage: null }));
  }, []);

  const handleSignupPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, signupPassword: e.target.value, signupMessage: null }));
  }, []);

  const handleSignupConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, signupConfirmPassword: e.target.value, signupMessage: null }));
  }, []);

  const handleSignup = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (state.signupPassword !== state.signupConfirmPassword) {
      setState((prev) => ({
        ...prev,
        signupMessage: "Passwords do not match",
        signupSuccess: false,
      }));
      return;
    }

    // Validate password length
    if (state.signupPassword.length < 12) {
      setState((prev) => ({
        ...prev,
        signupMessage: "Password must be at least 12 characters",
        signupSuccess: false,
      }));
      return;
    }

    vscodeRef.current?.postMessage({
      type: "signup",
      email: state.signupEmail,
      password: state.signupPassword,
    } satisfies WebviewMessage);
  }, [state.signupEmail, state.signupPassword, state.signupConfirmPassword]);

  const handleSignupWithGoogle = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "signup-google" } satisfies WebviewMessage);
  }, []);

  // Session handlers
  const handleScanSessions = useCallback(() => {
    setState((prev) => ({ ...prev, sessionsLoading: true }));
    vscodeRef.current?.postMessage({ type: "scan-sessions" } satisfies WebviewMessage);
  }, []);

  const handleRecoverSession = useCallback((sessionId: string) => {
    vscodeRef.current?.postMessage({ type: "recover-session", sessionId } satisfies WebviewMessage);
  }, []);

  const handleDismissSession = useCallback((sessionId: string) => {
    vscodeRef.current?.postMessage({ type: "dismiss-session", sessionId } satisfies WebviewMessage);
  }, []);

  // Import handlers
  const handleStartImport = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "start-import" } satisfies WebviewMessage);
  }, []);

  const handleCancelImport = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "cancel-import" } satisfies WebviewMessage);
  }, []);

  const handleConfirmProjects = useCallback((selectedPaths: string[], teamId?: string) => {
    // Store selected paths and team, then tell extension to transition to project-matching state
    setState((prev) => ({
      ...prev,
      importSelectedPaths: selectedPaths,
      importSelectedTeamId: teamId,
    }));
    vscodeRef.current?.postMessage({ type: "confirm-import-projects", selectedPaths, teamId } satisfies WebviewMessage);
  }, []);

  const handleConfirmProjectMappings = useCallback((mappings: ProjectMappings, customNames: ProjectCustomNames, teamIds: ProjectTeamIds) => {
    vscodeRef.current?.postMessage({ type: "confirm-project-mappings", mappings, customNames, teamIds } satisfies WebviewMessage);
  }, []);

  const handleFetchImportTeams = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "fetch-import-teams" } satisfies WebviewMessage);
  }, []);

  const handleFetchAllTeamProjects = useCallback(() => {
    setState((prev) => ({ ...prev, allTeamProjectsLoading: true }));
    vscodeRef.current?.postMessage({ type: "fetch-all-team-projects" } satisfies WebviewMessage);
  }, []);

  const handleResetImport = useCallback(() => {
    setState((prev) => ({
      ...prev,
      importStatus: null,
      importTeams: [],
      importTeamsLoading: false,
      allTeamProjects: [],
      allTeamProjectsLoading: false,
      importSelectedPaths: [],
      importSelectedTeamId: undefined,
    }));
  }, []);

  // Last prompt handlers
  const handleFetchLastPrompt = useCallback(() => {
    setState((prev) => ({ ...prev, lastPromptLoading: true }));
    vscodeRef.current?.postMessage({ type: "fetch-last-prompt" } satisfies WebviewMessage);
  }, []);

  // Start a new Claude Code conversation
  const handleStartConversation = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "start-conversation" } satisfies WebviewMessage);
  }, []);

  // Terminal command handlers
  const handleRunCommand = useCallback((command: string) => {
    vscodeRef.current?.postMessage({ type: "run-terminal-command", command } satisfies WebviewMessage);
  }, []);

  // Project status handlers
  const handleFetchProjectStatus = useCallback(() => {
    setState((prev) => ({ ...prev, projectStatusLoading: true, projectStatusError: null }));
    vscodeRef.current?.postMessage({ type: "fetch-project-status" } satisfies WebviewMessage);
  }, []);

  const handleOpenStatusFile = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "open-status-file" } satisfies WebviewMessage);
  }, []);

  const handleRunValidation = useCallback((epicId: string, storyId?: string) => {
    vscodeRef.current?.postMessage({ type: "run-validation", epicId, storyId } satisfies WebviewMessage);
  }, []);

  // Section toggle handler for Status panel
  const handleStatusSectionToggle = useCallback((section: keyof StatusSectionState) => {
    setState((prev) => {
      const newState = {
        ...prev,
        statusSectionState: {
          ...prev.statusSectionState,
          [section]: !prev.statusSectionState[section],
        },
      };
      vscodeRef.current?.setState(newState);
      return newState;
    });
  }, []);

  // Conversation handlers (Phase 3)
  const handleFetchConversations = useCallback(() => {
    setState((prev) => ({ ...prev, conversationsLoading: true }));
    vscodeRef.current?.postMessage({ type: "fetch-conversations" } satisfies WebviewMessage);
  }, []);

  const handleSelectConversation = useCallback((conversation: ConversationSummary) => {
    setState((prev) => ({
      ...prev,
      selectedConversation: conversation,
      conversationMessagesLoading: true,
    }));
    vscodeRef.current?.postMessage({
      type: "select-conversation",
      sessionId: conversation.sessionId,
    } satisfies WebviewMessage);
  }, []);

  const handleBackToConversations = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedConversation: null,
      conversationMessages: [],
    }));
    vscodeRef.current?.postMessage({ type: "close-conversation" } satisfies WebviewMessage);
  }, []);

  const handleOpenConversationInBrowser = useCallback(() => {
    if (state.selectedConversation) {
      vscodeRef.current?.postMessage({
        type: "open-conversation-in-browser",
        sessionId: state.selectedConversation.sessionId,
      } satisfies WebviewMessage);
    }
  }, [state.selectedConversation]);

  // Workspace installation handlers
  const handleInstallBmad = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "install-bmad" } satisfies WebviewMessage);
  }, []);

  const handleRefreshWorkspaceStatus = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "refresh-workspace-status" } satisfies WebviewMessage);
  }, []);

  const handleRegisterProject = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "register-project" } satisfies WebviewMessage);
  }, []);

  // Documents handlers
  const handleFetchDocuments = useCallback(() => {
    setState((prev) => ({ ...prev, documentsLoading: true }));
    vscodeRef.current?.postMessage({ type: "fetch-documents" } satisfies WebviewMessage);
  }, []);

  const handleOpenDocument = useCallback((path: string) => {
    vscodeRef.current?.postMessage({ type: "open-document", path } satisfies WebviewMessage);
  }, []);

  // Create a new BMAD project document
  const handleCreateDocument = useCallback((doc: ProjectDocument) => {
    vscodeRef.current?.postMessage({
      type: "create-document",
      doc: {
        id: doc.id,
        name: doc.name,
        filename: doc.filename,
        workflow: doc.workflow,
        agent: doc.agent,
      },
    } satisfies WebviewMessage);
  }, []);

  // BMAD version handlers
  const handleCheckBmadVersion = useCallback(() => {
    setState((prev) => ({ ...prev, bmadVersionLoading: true }));
    vscodeRef.current?.postMessage({ type: "fetch-bmad-version" } satisfies WebviewMessage);
  }, []);

  const handleUpgradeBmad = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "upgrade-bmad" } satisfies WebviewMessage);
  }, []);

  // Team stats handlers
  const handleFetchTeams = useCallback(() => {
    setState((prev) => ({ ...prev, teamsLoading: true }));
    vscodeRef.current?.postMessage({ type: "fetch-teams" } satisfies WebviewMessage);
  }, []);

  const handleFetchTeamStats = useCallback((teamId?: string, timeRange?: TeamTimeRange) => {
    setState((prev) => ({ ...prev, teamStatsLoading: true }));
    vscodeRef.current?.postMessage({ type: "fetch-team-stats", teamId, timeRange } satisfies WebviewMessage);
  }, []);

  // Refresh current team stats (doesn't reset team selection)
  const handleRefreshTeamStats = useCallback(() => {
    if (state.selectedTeamId) {
      setState((prev) => ({ ...prev, teamStats: null, teamStatsLoading: true }));
      vscodeRef.current?.postMessage({ type: "fetch-team-stats", teamId: state.selectedTeamId } satisfies WebviewMessage);
    }
  }, [state.selectedTeamId]);

  const handleTeamChange = useCallback((teamId: string) => {
    setState((prev) => ({ ...prev, selectedTeamId: teamId, teamStats: null, teamStatsLoading: true }));
    vscodeRef.current?.postMessage({ type: "fetch-team-stats", teamId } satisfies WebviewMessage);
  }, []);

  const handleTeamTimeRangeChange = useCallback((teamId: string, timeRange: TeamTimeRange) => {
    handleFetchTeamStats(teamId, timeRange);
  }, [handleFetchTeamStats]);

  const handleOpenWeb = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "open-web" } satisfies WebviewMessage);
  }, []);

  // Environment toggle handler
  const handleToggleEnvironment = useCallback(() => {
    const isDevelopment = !state.apiEndpoint.includes("localhost") && !state.apiEndpoint.includes("127.0.0.1");
    vscodeRef.current?.postMessage({ type: "set-environment", isDevelopment } satisfies WebviewMessage);
  }, [state.apiEndpoint]);

  // Feedback handlers
  const handleOpenFeedback = useCallback(() => {
    setState((prev) => ({
      ...prev,
      feedbackOpen: true,
      feedbackResult: null,
    }));
  }, []);

  const handleCloseFeedback = useCallback(() => {
    setState((prev) => ({
      ...prev,
      feedbackOpen: false,
      feedbackResult: null,
    }));
  }, []);

  const handleSubmitFeedback = useCallback((category: FeedbackCategory, message: string) => {
    vscodeRef.current?.postMessage({
      type: "submit-feedback",
      category,
      message,
    } satisfies WebviewMessage);
  }, []);

  // Render based on state
  if (state.isLoading) {
    return <Loading />;
  }

  if (state.error) {
    return <ErrorState message={state.error} onRetry={handleRetry} onSignOut={handleSignOut} />;
  }

  if (!state.isAuthenticated) {
    return (
      <div className="welcome-container">
        <div className="welcome-header">
          <h2>Welcome to Contextor</h2>
          {/* Environment toggle for switching between dev/prod when server is down */}
          <button
            className={`header-env-toggle ${state.apiEndpoint.includes("localhost") || state.apiEndpoint.includes("127.0.0.1") ? "dev" : "prod"}`}
            onClick={handleToggleEnvironment}
            title={`Server: ${state.apiEndpoint}\nClick to switch environment`}
          >
            {state.apiEndpoint.includes("localhost") || state.apiEndpoint.includes("127.0.0.1") ? "DEV" : "PROD"}
          </button>
        </div>
        <p>Track and improve your AI prompting skills.</p>

        {/* Server status warning */}
        {!state.isServerOnline && (
          <div className="server-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="server-warning-text">
              <span className="server-warning-title">Server unavailable</span>
              <span className="server-warning-detail">
                Retrying in {state.retryCountdown}s...
              </span>
            </div>
          </div>
        )}

        {/* Signup result message */}
        {state.signupMessage && (
          <div className={`auth-message ${state.signupSuccess ? "success" : "error"}`}>
            {state.signupMessage}
          </div>
        )}

        {/* Sign In Mode */}
        {!state.isSignupMode && (
          <>
            <button
              className="sign-in-button"
              onClick={handleSignIn}
              disabled={!state.isServerOnline}
            >
              Sign In
            </button>

            <div className="auth-toggle">
              <span>Don't have an account?</span>
              <button
                className="auth-toggle-link"
                onClick={handleToggleSignupMode}
                disabled={!state.isServerOnline}
              >
                Sign Up
              </button>
            </div>
          </>
        )}

        {/* Sign Up Mode */}
        {state.isSignupMode && (
          <form className="signup-form" onSubmit={handleSignup}>
            <div className="form-field">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                value={state.signupEmail}
                onChange={handleSignupEmailChange}
                placeholder="you@example.com"
                required
                disabled={state.signupLoading || !state.isServerOnline}
              />
            </div>

            <div className="form-field">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                value={state.signupPassword}
                onChange={handleSignupPasswordChange}
                placeholder="Min 12 characters"
                required
                minLength={12}
                disabled={state.signupLoading || !state.isServerOnline}
              />
            </div>

            <div className="form-field">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                value={state.signupConfirmPassword}
                onChange={handleSignupConfirmPasswordChange}
                placeholder="Confirm password"
                required
                disabled={state.signupLoading || !state.isServerOnline}
              />
            </div>

            <button
              type="submit"
              className="sign-in-button"
              disabled={state.signupLoading || !state.isServerOnline}
            >
              {state.signupLoading ? "Creating Account..." : "Create Account"}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="google-signup-button"
              onClick={handleSignupWithGoogle}
              disabled={!state.isServerOnline}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="auth-toggle">
              <span>Already have an account?</span>
              <button
                type="button"
                className="auth-toggle-link"
                onClick={handleToggleSignupMode}
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {!state.isServerOnline && (
          <p className="server-offline-hint">
            The Contextor server is currently unavailable. Please try again later.
          </p>
        )}
      </div>
    );
  }

  // Count interrupted sessions for badge
  const interruptedCount = state.sessions.filter((s) => s.isInterrupted).length;

  // Determine if import is in progress
  const isImporting = state.importStatus?.state === "scanning" || state.importStatus?.state === "importing";

  // Check installation status for tabs
  const contextorInstalled = state.workspaceStatus?.contextorInstalled ?? true; // Default to true (show content while loading)
  const bmadInstalled = state.workspaceStatus?.bmadInstalled ?? true; // Default to true (show content while loading)

  // Determine which tabs show the not-installed panel
  const isContextorTab = ["analytics", "sessions", "import", "lastPrompt", "conversations"].includes(state.activeTab);
  const isBmadTab = ["commands", "status", "documents", "bmadSettings"].includes(state.activeTab);
  const showContextorNotInstalled = isContextorTab && !contextorInstalled && state.workspaceStatus !== null;
  const showBmadNotInstalled = isBmadTab && !bmadInstalled && state.workspaceStatus !== null;

  return (
    <div className="app-container">
      <TabNavigation
        activeTab={state.activeTab}
        onTabChange={handleTabChange}
        sessionCount={interruptedCount}
        isImporting={isImporting}
        lastContextorTab={state.lastContextorTab}
        lastBmadTab={state.lastBmadTab}
        apiEndpoint={state.apiEndpoint}
        onToggleEnvironment={handleToggleEnvironment}
      />

      <div className="tab-content">
        {/* Contextor Not Installed state */}
        {showContextorNotInstalled && (
          <NotInstalledPanel
            type="contextor"
            onInstall={handleRegisterProject}
            onRefresh={handleRefreshWorkspaceStatus}
          />
        )}

        {/* BMAD Not Installed state */}
        {showBmadNotInstalled && (
          <NotInstalledPanel
            type="bmad"
            onInstall={handleInstallBmad}
            onRefresh={handleRefreshWorkspaceStatus}
          />
        )}

        {/* Normal tab content - only show if not in "not installed" state */}
        {state.activeTab === "analytics" && !showContextorNotInstalled && (
          <Dashboard
            analytics={state.analytics}
            user={state.user}
            isRefreshing={state.isRefreshing}
            onRefresh={handleRefresh}
          />
        )}

        {state.activeTab === "team" && !showContextorNotInstalled && (
          <TeamPanel
            teams={state.teams}
            teamsLoading={state.teamsLoading}
            selectedTeamId={state.selectedTeamId}
            data={state.teamStats}
            isLoading={state.teamStatsLoading}
            onTeamChange={handleTeamChange}
            onTimeRangeChange={handleTeamTimeRangeChange}
            onRefresh={handleRefreshTeamStats}
          />
        )}

        {state.activeTab === "sessions" && !showContextorNotInstalled && (
          <SessionsPanel
            sessions={state.sessions}
            isLoading={state.sessionsLoading}
            onScan={handleScanSessions}
            onRecover={handleRecoverSession}
            onDismiss={handleDismissSession}
          />
        )}

        {state.activeTab === "import" && !showContextorNotInstalled && (
          <ImportPanel
            isLoading={false}
            importStatus={state.importStatus}
            lastImport={state.lastImport}
            teams={state.importTeams}
            teamsLoading={state.importTeamsLoading}
            allTeamProjects={state.allTeamProjects}
            allTeamProjectsLoading={state.allTeamProjectsLoading}
            onStartImport={handleStartImport}
            onCancelImport={handleCancelImport}
            onConfirmProjects={handleConfirmProjects}
            onConfirmProjectMappings={handleConfirmProjectMappings}
            onFetchTeams={handleFetchImportTeams}
            onFetchAllTeamProjects={handleFetchAllTeamProjects}
            onResetImport={handleResetImport}
          />
        )}

        {state.activeTab === "lastPrompt" && !showContextorNotInstalled && (
          <LastPromptPanel
            prompt={state.lastPrompt}
            isLoading={state.lastPromptLoading}
            onRefresh={handleFetchLastPrompt}
            onStartConversation={handleStartConversation}
          />
        )}

        {state.activeTab === "conversations" && !showContextorNotInstalled && (
          <ConversationsPanel
            conversations={state.conversations}
            selectedConversation={state.selectedConversation}
            messages={state.conversationMessages}
            isLoading={state.conversationsLoading || state.conversationMessagesLoading}
            onSelectConversation={handleSelectConversation}
            onBack={handleBackToConversations}
            onRefresh={handleFetchConversations}
            onOpenInBrowser={handleOpenConversationInBrowser}
          />
        )}

        {state.activeTab === "commands" && !showBmadNotInstalled && (
          <CommandsPanel onRunCommand={handleRunCommand} />
        )}

        {state.activeTab === "status" && !showBmadNotInstalled && (
          <StatusPanel
            status={state.projectStatus}
            isLoading={state.projectStatusLoading}
            error={state.projectStatusError}
            onRefresh={handleFetchProjectStatus}
            onOpenFile={handleOpenStatusFile}
            sectionState={state.statusSectionState}
            onSectionToggle={handleStatusSectionToggle}
            onRunValidation={handleRunValidation}
          />
        )}

        {state.activeTab === "documents" && !showBmadNotInstalled && (
          <DocumentsPanel
            documents={state.documents}
            isLoading={state.documentsLoading}
            onOpenDocument={handleOpenDocument}
            onRefresh={handleFetchDocuments}
            onCreateDocument={handleCreateDocument}
          />
        )}

        {state.activeTab === "bmadSettings" && !showBmadNotInstalled && (
          <BmadSettingsPanel
            versionInfo={state.bmadVersionInfo}
            isLoading={state.bmadVersionLoading}
            onCheckVersion={handleCheckBmadVersion}
            onUpgrade={handleUpgradeBmad}
          />
        )}
      </div>

      {/* Footer with project and version */}
      <div className="app-footer">
        {state.workspaceStatus?.projectName && (
          <>
            <span className="footer-label">Project:</span>
            <span className="footer-project-name">{state.workspaceStatus.projectName}</span>
          </>
        )}
        <div className="footer-right">
          <button
            className="footer-feedback-btn"
            onClick={handleOpenFeedback}
            title="Send Feedback"
          >
            Feedback
          </button>
          {state.extensionVersion && (
            <span className="footer-version">v{state.extensionVersion}</span>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackPanel
        isOpen={state.feedbackOpen}
        isLoading={state.feedbackLoading}
        onClose={handleCloseFeedback}
        onSubmit={handleSubmitFeedback}
        submitResult={state.feedbackResult}
      />
    </div>
  );
};

export default App;
