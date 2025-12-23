import React from 'react';
import { createRoot } from 'react-dom/client';
import { SidebarLayout, SidebarLayoutProps } from './layout';
import './styles.css';

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
// Message Types for Extension Communication
// ============================================

export type WebviewMessage =
  | { type: 'refresh-analytics' }
  | { type: 'prompt-click'; promptId: string }
  | { type: 'apply-suggestion'; suggestionId: string }
  | { type: 'dismiss-suggestion'; suggestionId: string }
  | { type: 'toggle-coaching-minimize' }
  | { type: 'login' }
  | { type: 'logout' }
  | { type: 'sensitivity-change'; value: number }
  | { type: 'notifications-change'; enabled: boolean }
  | { type: 'realtime-coaching-change'; enabled: boolean }
  | { type: 'open-docs' }
  | { type: 'open-support' }
  | { type: 'open-settings' }
  | { type: 'ready' };

export type ExtensionMessage =
  | { type: 'update-state'; state: Partial<AppState> }
  | { type: 'analytics-loading'; isLoading: boolean }
  | { type: 'coaching-loading'; isLoading: boolean }
  | { type: 'connection-status-change'; status: 'connected' | 'syncing' | 'disconnected' }
  | { type: 'new-suggestion'; suggestion: unknown }
  | { type: 'show-notification'; notification: { type: string; message: string } };

// ============================================
// Application State
// ============================================

export interface AppState {
  connectionStatus: 'connected' | 'syncing' | 'disconnected';
  analyticsData: SidebarLayoutProps['analyticsData'];
  isAnalyticsLoading: boolean;
  suggestions: SidebarLayoutProps['suggestions'];
  dismissedSuggestions: SidebarLayoutProps['dismissedSuggestions'];
  isCoachingLoading: boolean;
  isCoachingMinimized: boolean;
  user: SidebarLayoutProps['user'];
  isAuthenticated: boolean;
  coachingSensitivity: number;
  notificationsEnabled: boolean;
  realtimeCoachingEnabled: boolean;
  version: string;
  activeTab: 'analytics' | 'coaching' | 'settings';
}

const defaultState: AppState = {
  connectionStatus: 'disconnected',
  analyticsData: null,
  isAnalyticsLoading: false,
  suggestions: [],
  dismissedSuggestions: [],
  isCoachingLoading: false,
  isCoachingMinimized: false,
  user: null,
  isAuthenticated: false,
  coachingSensitivity: 3,
  notificationsEnabled: true,
  realtimeCoachingEnabled: true,
  version: '1.0.0',
  activeTab: 'analytics',
};

// ============================================
// Main App Component
// ============================================

const App: React.FC = () => {
  const [state, setState] = React.useState<AppState>(defaultState);
  const vscodeRef = React.useRef<VSCodeAPI | null>(null);

  // Initialize VS Code API
  React.useEffect(() => {
    try {
      vscodeRef.current = acquireVsCodeApi();

      // Restore persisted state
      const persistedState = vscodeRef.current.getState() as AppState | undefined;
      if (persistedState) {
        setState((prev) => ({ ...prev, ...persistedState }));
      }

      // Notify extension that webview is ready
      vscodeRef.current.postMessage({ type: 'ready' });
    } catch (error) {
      // Running outside VS Code (for development)
      console.log('Running in development mode (no VS Code API)');
    }
  }, []);

  // Listen for messages from extension
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'update-state':
          setState((prev) => {
            const newState = { ...prev, ...message.state };
            vscodeRef.current?.setState(newState);
            return newState;
          });
          break;
        case 'analytics-loading':
          setState((prev) => ({ ...prev, isAnalyticsLoading: message.isLoading }));
          break;
        case 'coaching-loading':
          setState((prev) => ({ ...prev, isCoachingLoading: message.isLoading }));
          break;
        case 'connection-status-change':
          setState((prev) => ({ ...prev, connectionStatus: message.status }));
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Message posting helper
  const postMessage = React.useCallback((message: WebviewMessage) => {
    vscodeRef.current?.postMessage(message);
  }, []);

  // Event handlers
  const handlers: Partial<SidebarLayoutProps> = {
    onRefreshAnalytics: () => postMessage({ type: 'refresh-analytics' }),
    onPromptClick: (promptId) => postMessage({ type: 'prompt-click', promptId }),
    onApplySuggestion: (suggestionId) => postMessage({ type: 'apply-suggestion', suggestionId }),
    onDismissSuggestion: (suggestionId) => postMessage({ type: 'dismiss-suggestion', suggestionId }),
    onToggleCoachingMinimize: () => postMessage({ type: 'toggle-coaching-minimize' }),
    onLogin: () => postMessage({ type: 'login' }),
    onLogout: () => postMessage({ type: 'logout' }),
    onSensitivityChange: (value) => postMessage({ type: 'sensitivity-change', value }),
    onNotificationsChange: (enabled) => postMessage({ type: 'notifications-change', enabled }),
    onRealtimeCoachingChange: (enabled) => postMessage({ type: 'realtime-coaching-change', enabled }),
    onOpenDocs: () => postMessage({ type: 'open-docs' }),
    onOpenSupport: () => postMessage({ type: 'open-support' }),
    onOpenSettings: () => postMessage({ type: 'open-settings' }),
  };

  return (
    <SidebarLayout
      connectionStatus={state.connectionStatus}
      analyticsData={state.analyticsData}
      isAnalyticsLoading={state.isAnalyticsLoading}
      suggestions={state.suggestions}
      dismissedSuggestions={state.dismissedSuggestions}
      isCoachingLoading={state.isCoachingLoading}
      isCoachingMinimized={state.isCoachingMinimized}
      user={state.user}
      isAuthenticated={state.isAuthenticated}
      coachingSensitivity={state.coachingSensitivity}
      notificationsEnabled={state.notificationsEnabled}
      realtimeCoachingEnabled={state.realtimeCoachingEnabled}
      version={state.version}
      initialTab={state.activeTab}
      {...handlers}
    />
  );
};

// ============================================
// Mount Application
// ============================================

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Export for testing and extension use
export { App, SidebarLayout };
export type { SidebarLayoutProps };
