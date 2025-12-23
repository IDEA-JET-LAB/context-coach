import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dashboard } from "./components/Dashboard";
import { ErrorState } from "./components/ErrorState";
import { Loading } from "./components/Loading";

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

type ExtensionMessage =
  | { type: "auth"; authenticated: boolean }
  | { type: "analytics"; data: AnalyticsData; user: UserProfile }
  | { type: "error"; message: string }
  | { type: "loading"; isLoading: boolean };

type WebviewMessage = { type: "refresh" } | { type: "error"; error: string } | { type: "ready" };

// ============================================
// App State
// ============================================

interface AppState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  analytics: AnalyticsData | null;
  user: UserProfile | null;
}

const initialState: AppState = {
  isAuthenticated: false,
  isLoading: true,
  error: null,
  analytics: null,
  user: null,
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
          sessions: {
            todayCount: 3,
            todayPrompts: 25,
            avgDuration: 45,
            streak: 5,
          },
          efficiency: {
            overallScore: 78,
            promptsPerHour: 15,
            avgPromptLength: 120,
            contextUtilization: 65,
          },
          recentActivity: [
            {
              timestamp: new Date().toISOString(),
              type: "prompt",
              description: "Debugging authentication flow",
            },
            {
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              type: "session_start",
              description: "Started new session",
            },
          ],
        },
        user: {
          id: "dev-user",
          email: "dev@example.com",
          name: "Developer",
        },
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
              user: message.user,
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
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    vscodeRef.current?.postMessage({ type: "refresh" } satisfies WebviewMessage);
  }, []);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, isLoading: true }));
    handleRefresh();
  }, [handleRefresh]);

  // Render based on state
  if (state.isLoading) {
    return <Loading />;
  }

  if (state.error) {
    return <ErrorState message={state.error} onRetry={handleRetry} />;
  }

  if (!state.isAuthenticated) {
    // The welcome view from package.json will be shown by VS Code
    // when not authenticated, so this is a fallback
    return (
      <div className="welcome-container">
        <h2>Welcome to Contextor</h2>
        <p>Sign in to view your analytics</p>
      </div>
    );
  }

  return (
    <Dashboard
      analytics={state.analytics}
      user={state.user}
      onRefresh={handleRefresh}
    />
  );
};

export default App;
