import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dashboard } from "./components/Dashboard";
import { ErrorState } from "./components/ErrorState";
import { Loading } from "./components/Loading";
import { TabNavigation, type TabId } from "./components/TabNavigation";
import { SessionsPanel, type Session } from "./components/SessionsPanel";
import { ImportPanel, type ImportStatus } from "./components/ImportPanel";
import { LastPromptPanel, type LastPromptData } from "./components/LastPromptPanel";

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

interface DimensionScore {
  score: number;
  trend: "up" | "down" | "stable";
  change?: number;
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

type ExtensionMessage =
  | { type: "auth"; authenticated: boolean; user?: UserProfile }
  | { type: "analytics"; data: AnalyticsData }
  | { type: "error"; message: string }
  | { type: "loading"; isLoading: boolean }
  | { type: "refreshing"; isRefreshing: boolean }
  // Session messages
  | { type: "sessions"; sessions: Session[] }
  | { type: "sessions-loading"; isLoading: boolean }
  | { type: "session-recovered"; sessionId: string; success: boolean }
  | { type: "session-dismissed"; sessionId: string }
  // Import messages
  | { type: "import-status"; status: ImportStatus }
  // Last prompt messages
  | { type: "last-prompt"; prompt: LastPromptData | null }
  | { type: "last-prompt-loading"; isLoading: boolean };

type WebviewMessage =
  | { type: "refresh" }
  | { type: "error"; error: string }
  | { type: "ready" }
  | { type: "login" }
  | { type: "logout" }
  // Session messages
  | { type: "scan-sessions" }
  | { type: "recover-session"; sessionId: string }
  | { type: "dismiss-session"; sessionId: string }
  // Import messages
  | { type: "start-import" }
  | { type: "cancel-import" }
  // Last prompt messages
  | { type: "fetch-last-prompt" };

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
  // Sessions
  sessions: Session[];
  sessionsLoading: boolean;
  // Import
  importStatus: ImportStatus | null;
  // Last Prompt
  lastPrompt: LastPromptData | null;
  lastPromptLoading: boolean;
}

const initialState: AppState = {
  isAuthenticated: false,
  isLoading: true,
  isRefreshing: false,
  error: null,
  analytics: null,
  user: null,
  activeTab: "analytics",
  sessions: [],
  sessionsLoading: false,
  importStatus: null,
  lastPrompt: null,
  lastPromptLoading: false,
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

      // Restore persisted state
      const persistedState = vscodeRef.current.getState() as AppState | undefined;
      if (persistedState) {
        setState((prev) => ({ ...prev, ...persistedState }));
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
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Tab change handler
  const handleTabChange = useCallback((tab: TabId) => {
    setState((prev) => {
      const newState = { ...prev, activeTab: tab };
      vscodeRef.current?.setState(newState);
      return newState;
    });

    // Auto-fetch last prompt when tab becomes active
    if (tab === "lastPrompt") {
      setState((prev) => ({ ...prev, lastPromptLoading: true }));
      vscodeRef.current?.postMessage({ type: "fetch-last-prompt" } satisfies WebviewMessage);
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

  // Last prompt handlers
  const handleFetchLastPrompt = useCallback(() => {
    setState((prev) => ({ ...prev, lastPromptLoading: true }));
    vscodeRef.current?.postMessage({ type: "fetch-last-prompt" } satisfies WebviewMessage);
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
        <h2>Welcome to Contextor</h2>
        <p>Track and improve your AI prompting skills.</p>
        <button className="sign-in-button" onClick={handleSignIn}>
          Sign In
        </button>
      </div>
    );
  }

  // Count interrupted sessions for badge
  const interruptedCount = state.sessions.filter((s) => s.isInterrupted).length;

  return (
    <div className="app-container">
      <TabNavigation
        activeTab={state.activeTab}
        onTabChange={handleTabChange}
        sessionCount={interruptedCount}
      />

      <div className="tab-content">
        {state.activeTab === "analytics" && (
          <Dashboard
            analytics={state.analytics}
            user={state.user}
            isRefreshing={state.isRefreshing}
            onRefresh={handleRefresh}
            onSignOut={handleSignOut}
          />
        )}

        {state.activeTab === "sessions" && (
          <SessionsPanel
            sessions={state.sessions}
            isLoading={state.sessionsLoading}
            onScan={handleScanSessions}
            onRecover={handleRecoverSession}
            onDismiss={handleDismissSession}
          />
        )}

        {state.activeTab === "import" && (
          <ImportPanel
            isLoading={false}
            importStatus={state.importStatus}
            onStartImport={handleStartImport}
            onCancelImport={handleCancelImport}
          />
        )}

        {state.activeTab === "lastPrompt" && (
          <LastPromptPanel
            prompt={state.lastPrompt}
            isLoading={state.lastPromptLoading}
            onRefresh={handleFetchLastPrompt}
          />
        )}
      </div>
    </div>
  );
};

export default App;
