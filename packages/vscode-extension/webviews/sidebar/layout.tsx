import React, { useState, useCallback } from 'react';
import {
  StatusIndicator,
  ConnectionStatus,
  ContextorLogo,
  AnalyticsIcon,
  CoachingIcon,
  SettingsIcon,
  HelpIcon,
  ExternalLinkIcon,
  CoachingTip,
  WeakDimension,
} from '../components';
import { AnalyticsPanel, AnalyticsData } from './analytics-panel';
import { CoachingPanel, Suggestion } from './coaching-panel';
import { SettingsPanel, User } from './settings-panel';

export type TabId = 'analytics' | 'coaching' | 'settings';

export interface SidebarLayoutProps {
  // Connection state
  connectionStatus?: ConnectionStatus;

  // Analytics data
  analyticsData?: AnalyticsData | null;
  isAnalyticsLoading?: boolean;

  // Legacy coaching data (Suggestion format)
  suggestions?: Suggestion[];
  dismissedSuggestions?: Suggestion[];
  isCoachingLoading?: boolean;
  isCoachingMinimized?: boolean;
  suggestionBadgeCount?: number;

  // New coaching data (Story 19-5)
  coachingTips?: CoachingTip[];
  weakDimensions?: WeakDimension[];
  dismissedTips?: CoachingTip[];

  // Settings data
  user?: User | null;
  isAuthenticated?: boolean;
  coachingSensitivity?: number;
  notificationsEnabled?: boolean;
  realtimeCoachingEnabled?: boolean;
  version?: string;

  // Event handlers
  onRefreshAnalytics?: () => void;
  onRefreshCoaching?: () => void;
  onPromptClick?: (promptId: string) => void;
  onApplySuggestion?: (suggestionId: string) => void;
  onDismissSuggestion?: (suggestionId: string) => void;
  onToggleCoachingMinimize?: () => void;
  onLogin?: () => void;
  onLogout?: () => void;
  onSensitivityChange?: (value: number) => void;
  onNotificationsChange?: (enabled: boolean) => void;
  onRealtimeCoachingChange?: (enabled: boolean) => void;
  onOpenDocs?: () => void;
  onOpenSupport?: () => void;
  onOpenSettings?: () => void;

  // Initial tab
  initialTab?: TabId;
}

const tabs: { id: TabId; label: string; icon: React.FC<{ size?: number; color?: string }> }[] = [
  { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
  { id: 'coaching', label: 'Coaching', icon: CoachingIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({
  connectionStatus = 'disconnected',
  analyticsData,
  isAnalyticsLoading = false,
  suggestions = [],
  dismissedSuggestions = [],
  isCoachingLoading = false,
  isCoachingMinimized = false,
  suggestionBadgeCount,
  // New coaching data (Story 19-5)
  coachingTips = [],
  weakDimensions = [],
  dismissedTips = [],
  user,
  isAuthenticated = false,
  coachingSensitivity = 3,
  notificationsEnabled = true,
  realtimeCoachingEnabled = true,
  version = '1.0.0',
  onRefreshAnalytics,
  onRefreshCoaching,
  onPromptClick,
  onApplySuggestion,
  onDismissSuggestion,
  onToggleCoachingMinimize,
  onLogin,
  onLogout,
  onSensitivityChange,
  onNotificationsChange,
  onRealtimeCoachingChange,
  onOpenDocs,
  onOpenSupport,
  onOpenSettings,
  initialTab = 'analytics',
}) => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
  }, []);

  // Calculate badge count including coaching tips (Story 19-5)
  const badgeCount = suggestionBadgeCount ?? (
    coachingTips.length > 0 || weakDimensions.length > 0
      ? coachingTips.length + weakDimensions.length
      : suggestions.length
  );

  // Styles
  const sidebarStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minWidth: '250px',
    maxWidth: '500px',
    backgroundColor: 'var(--ctx-background)',
    color: 'var(--ctx-foreground)',
    fontFamily: 'var(--ctx-font-family)',
    fontSize: '13px',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--ctx-border-subtle)',
    flexShrink: 0,
  };

  const headerTitleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    fontSize: '13px',
    letterSpacing: '-0.01em',
  };

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid var(--ctx-border-subtle)',
    flexShrink: 0,
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 500,
    color: isActive ? 'var(--ctx-foreground)' : 'var(--ctx-foreground-muted)',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: `2px solid ${isActive ? 'var(--ctx-focus)' : 'transparent'}`,
    cursor: 'pointer',
    transition: 'all 100ms ease',
    position: 'relative',
  });

  const tabBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '12px',
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
    fontSize: '9px',
    fontWeight: 600,
    backgroundColor: 'var(--ctx-badge-bg)',
    color: 'var(--ctx-badge-fg)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '16px',
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderTop: '1px solid var(--ctx-border-subtle)',
    flexShrink: 0,
  };

  const footerLinkStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    color: 'var(--ctx-foreground-muted)',
    textDecoration: 'none',
    padding: '4px',
    borderRadius: '3px',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    transition: 'color 100ms ease',
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':
        return (
          <AnalyticsPanel
            data={analyticsData}
            isLoading={isAnalyticsLoading}
            onRefresh={onRefreshAnalytics}
            onPromptClick={onPromptClick}
          />
        );
      case 'coaching':
        return (
          <CoachingPanel
            suggestions={suggestions}
            dismissedSuggestions={dismissedSuggestions}
            coachingTips={coachingTips}
            weakDimensions={weakDimensions}
            dismissedTips={dismissedTips}
            isLoading={isCoachingLoading}
            isMinimized={isCoachingMinimized}
            onApply={onApplySuggestion}
            onDismiss={onDismissSuggestion}
            onToggleMinimize={onToggleCoachingMinimize}
            onRefresh={onRefreshCoaching}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            user={user}
            isAuthenticated={isAuthenticated}
            connectionStatus={connectionStatus}
            coachingSensitivity={coachingSensitivity}
            notificationsEnabled={notificationsEnabled}
            realtimeCoachingEnabled={realtimeCoachingEnabled}
            version={version}
            onLogin={onLogin}
            onLogout={onLogout}
            onSensitivityChange={onSensitivityChange}
            onNotificationsChange={onNotificationsChange}
            onRealtimeCoachingChange={onRealtimeCoachingChange}
            onOpenDocs={onOpenDocs}
            onOpenSupport={onOpenSupport}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={sidebarStyle} className="ctx-sidebar">
      {/* Header */}
      <header style={headerStyle}>
        <div style={headerTitleStyle}>
          <ContextorLogo size={18} />
          <span>Contextor</span>
        </div>
        <StatusIndicator status={connectionStatus} size="sm" />
      </header>

      {/* Tab Navigation */}
      <nav style={tabsStyle} role="tablist" aria-label="Sidebar navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === 'coaching' && badgeCount > 0 && !isActive;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              style={tabStyle(isActive)}
              onClick={() => handleTabChange(tab.id)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--ctx-foreground)';
                  e.currentTarget.style.backgroundColor = 'var(--ctx-surface-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--ctx-foreground-muted)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {showBadge && <span style={tabBadgeStyle}>{badgeCount > 9 ? '9+' : badgeCount}</span>}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={activeTab}
        style={contentStyle}
        className="ctx-content"
      >
        {renderContent()}
      </main>

      {/* Footer */}
      <footer style={footerStyle}>
        <button
          style={footerLinkStyle}
          onClick={onOpenSettings}
          aria-label="Open settings"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ctx-link)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ctx-foreground-muted)';
          }}
        >
          <SettingsIcon size={12} />
          <span>Settings</span>
        </button>
        <button
          style={footerLinkStyle}
          onClick={onOpenDocs}
          aria-label="Open documentation"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ctx-link)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ctx-foreground-muted)';
          }}
        >
          <HelpIcon size={12} />
          <span>Docs</span>
          <ExternalLinkIcon size={10} />
        </button>
      </footer>
    </div>
  );
};

export default SidebarLayout;
