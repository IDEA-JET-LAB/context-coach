/**
 * Demo/Preview Component
 *
 * This file provides sample data and a preview of the sidebar
 * for development and testing outside of VS Code.
 *
 * To use: Import and render <SidebarDemo /> in a standalone React app.
 */

import React, { useState } from 'react';
import { SidebarLayout } from './layout';
import { AnalyticsData, Prompt } from './analytics-panel';
import { Suggestion } from './coaching-panel';
import { User } from './settings-panel';
import { ConnectionStatus } from '../components';

// Sample data
const samplePrompts: Prompt[] = [
  {
    id: '1',
    text: 'Fix the authentication flow so users can reset their password using email verification links',
    score: 8.5,
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    isNew: true,
  },
  {
    id: '2',
    text: 'Add validation to the login form',
    score: 6.2,
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: '3',
    text: 'Refactor the user service to use dependency injection and improve testability across the application',
    score: 7.8,
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
  },
  {
    id: '4',
    text: 'Create new component',
    score: 3.5,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '5',
    text: 'Implement dark mode toggle with system preference detection and persistent user settings',
    score: 9.1,
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
];

const sampleAnalyticsData: AnalyticsData = {
  sessionScore: 7.2,
  promptCount: 12,
  averageScore: 6.8,
  trendData: [5.5, 6.2, 5.8, 7.0, 6.5, 7.8, 7.2],
  recentPrompts: samplePrompts,
  lastPromptTime: new Date(Date.now() - 2 * 60 * 1000),
};

const sampleSuggestions: Suggestion[] = [
  {
    id: 's1',
    type: 'improvement',
    message: 'Consider adding more context about the expected behavior',
    details: 'Your prompt mentions "fix" but does not describe what the correct behavior should be.',
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: 's2',
    type: 'achievement',
    message: 'Great job! Your prompts have improved 15% this week',
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
  },
];

const sampleDismissedSuggestions: Suggestion[] = [
  {
    id: 'd1',
    type: 'warning',
    message: 'Vague prompt detected: "Create new component"',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'd2',
    type: 'improvement',
    message: 'Try specifying the tech stack in your prompt',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
];

const sampleUser: User = {
  email: 'developer@example.com',
  name: 'Alex Developer',
};

// Demo states
type DemoState = 'loading' | 'empty' | 'authenticated' | 'unauthenticated';

export const SidebarDemo: React.FC = () => {
  const [demoState, setDemoState] = useState<DemoState>('authenticated');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [sensitivity, setSensitivity] = useState(3);
  const [notifications, setNotifications] = useState(true);
  const [realtimeCoaching, setRealtimeCoaching] = useState(true);
  const [isCoachingMinimized, setIsCoachingMinimized] = useState(false);
  const [suggestions, setSuggestions] = useState(sampleSuggestions);
  const [dismissed, setDismissed] = useState(sampleDismissedSuggestions);

  const handleApplySuggestion = (id: string) => {
    console.log('Apply suggestion:', id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDismissSuggestion = (id: string) => {
    const suggestion = suggestions.find((s) => s.id === id);
    if (suggestion) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setDismissed((prev) => [suggestion, ...prev]);
    }
  };

  // Render controls for demo
  const controlsStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: '#1e1e1e',
    borderBottom: '1px solid #333',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '12px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: '#0e639c',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
  };

  const selectStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: '#3c3c3c',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '3px',
  };

  const labelStyle: React.CSSProperties = {
    color: '#999',
    marginRight: '4px',
  };

  const getStateProps = () => {
    switch (demoState) {
      case 'loading':
        return {
          analyticsData: null,
          isAnalyticsLoading: true,
          isCoachingLoading: true,
          suggestions: [],
          dismissedSuggestions: [],
          user: null,
          isAuthenticated: false,
        };
      case 'empty':
        return {
          analyticsData: null,
          isAnalyticsLoading: false,
          isCoachingLoading: false,
          suggestions: [],
          dismissedSuggestions: [],
          user: sampleUser,
          isAuthenticated: true,
        };
      case 'unauthenticated':
        return {
          analyticsData: sampleAnalyticsData,
          isAnalyticsLoading: false,
          isCoachingLoading: false,
          suggestions,
          dismissedSuggestions: dismissed,
          user: null,
          isAuthenticated: false,
        };
      case 'authenticated':
      default:
        return {
          analyticsData: sampleAnalyticsData,
          isAnalyticsLoading: false,
          isCoachingLoading: false,
          suggestions,
          dismissedSuggestions: dismissed,
          user: sampleUser,
          isAuthenticated: true,
        };
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Demo Controls */}
      <div style={controlsStyle}>
        <span style={labelStyle}>State:</span>
        <select
          style={selectStyle}
          value={demoState}
          onChange={(e) => setDemoState(e.target.value as DemoState)}
        >
          <option value="authenticated">Authenticated</option>
          <option value="unauthenticated">Unauthenticated</option>
          <option value="loading">Loading</option>
          <option value="empty">Empty</option>
        </select>

        <span style={{ ...labelStyle, marginLeft: '12px' }}>Connection:</span>
        <select
          style={selectStyle}
          value={connectionStatus}
          onChange={(e) => setConnectionStatus(e.target.value as ConnectionStatus)}
        >
          <option value="connected">Connected</option>
          <option value="syncing">Syncing</option>
          <option value="disconnected">Disconnected</option>
        </select>

        <button
          style={{ ...buttonStyle, marginLeft: '12px' }}
          onClick={() => setSuggestions([
            {
              id: `s${Date.now()}`,
              type: 'improvement',
              message: 'New suggestion added at ' + new Date().toLocaleTimeString(),
              createdAt: new Date(),
            },
            ...suggestions,
          ])}
        >
          + Add Suggestion
        </button>

        <button
          style={buttonStyle}
          onClick={() => setIsCoachingMinimized(!isCoachingMinimized)}
        >
          {isCoachingMinimized ? 'Expand' : 'Minimize'} Coaching
        </button>
      </div>

      {/* Sidebar Preview */}
      <div style={{ flex: 1, width: '320px', overflow: 'hidden' }}>
        <SidebarLayout
          connectionStatus={connectionStatus}
          {...getStateProps()}
          isCoachingMinimized={isCoachingMinimized}
          coachingSensitivity={sensitivity}
          notificationsEnabled={notifications}
          realtimeCoachingEnabled={realtimeCoaching}
          version="1.0.0-demo"
          onRefreshAnalytics={() => console.log('Refresh analytics')}
          onPromptClick={(id) => console.log('Prompt clicked:', id)}
          onApplySuggestion={handleApplySuggestion}
          onDismissSuggestion={handleDismissSuggestion}
          onToggleCoachingMinimize={() => setIsCoachingMinimized(!isCoachingMinimized)}
          onLogin={() => {
            console.log('Login');
            setDemoState('authenticated');
          }}
          onLogout={() => {
            console.log('Logout');
            setDemoState('unauthenticated');
          }}
          onSensitivityChange={(v) => {
            console.log('Sensitivity:', v);
            setSensitivity(v);
          }}
          onNotificationsChange={(v) => {
            console.log('Notifications:', v);
            setNotifications(v);
          }}
          onRealtimeCoachingChange={(v) => {
            console.log('Realtime coaching:', v);
            setRealtimeCoaching(v);
          }}
          onOpenDocs={() => console.log('Open docs')}
          onOpenSupport={() => console.log('Open support')}
          onOpenSettings={() => console.log('Open settings')}
        />
      </div>
    </div>
  );
};

export default SidebarDemo;
