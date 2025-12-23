import React from 'react';
import { SuggestionType, SparklesIcon, CoachingIcon } from '../components';

/**
 * Notification States for VS Code Extension
 *
 * This file documents the notification patterns used in Contextor VS Code extension.
 * VS Code supports several notification types that we leverage:
 *
 * 1. Status Bar Item - Quick glance indicator (always visible)
 * 2. Information/Warning Messages - VS Code native notifications
 * 3. Inline Notifications - Within the webview sidebar
 *
 * Usage Guidelines:
 * - Status Bar: Show overall session health score, update every prompt
 * - Info Messages: New coaching suggestions (max 1 per 5 minutes to avoid spam)
 * - Inline: Real-time updates within the sidebar panel
 */

// ============================================
// Status Bar Item Component
// ============================================
// Note: This is rendered by the extension, not the webview.
// This component is for documentation/preview purposes.

export interface StatusBarItemProps {
  score: number;
  isActive: boolean;
  hasNewSuggestions: boolean;
  onClick?: () => void;
}

export const StatusBarItemPreview: React.FC<StatusBarItemProps> = ({
  score,
  isActive,
  hasNewSuggestions,
}) => {
  const getScoreColor = (value: number): string => {
    if (value >= 7) return 'var(--ctx-score-high)';
    if (value >= 4) return 'var(--ctx-score-medium)';
    return 'var(--ctx-score-growth)';
  };

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '2px 8px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: '3px',
    fontSize: '12px',
    fontFamily: 'var(--ctx-font-family)',
    color: 'var(--ctx-foreground)',
  };

  const scoreStyle: React.CSSProperties = {
    fontFamily: 'var(--ctx-font-mono)',
    fontWeight: 600,
    color: getScoreColor(score),
  };

  const dotStyle: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: isActive ? 'var(--ctx-status-connected)' : 'var(--ctx-foreground-muted)',
  };

  const badgeStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--ctx-badge-bg)',
    display: hasNewSuggestions ? 'block' : 'none',
  };

  return (
    <div style={containerStyle}>
      <span style={dotStyle} />
      <SparklesIcon size={12} color="var(--ctx-foreground-muted)" />
      <span style={scoreStyle}>{score.toFixed(1)}</span>
      <span style={badgeStyle} />
    </div>
  );
};

// ============================================
// Inline Notification Component
// ============================================

export interface InlineNotificationProps {
  type: 'info' | 'success' | 'warning';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}

const typeConfig = {
  info: {
    color: 'var(--ctx-score-growth)',
    bg: 'var(--ctx-score-growth-bg)',
  },
  success: {
    color: 'var(--ctx-score-high)',
    bg: 'var(--ctx-score-high-bg)',
  },
  warning: {
    color: 'var(--ctx-score-medium)',
    bg: 'var(--ctx-score-medium-bg)',
  },
};

export const InlineNotification: React.FC<InlineNotificationProps> = ({
  type,
  message,
  action,
  onDismiss,
  autoHide = false,
  autoHideDelay = 5000,
}) => {
  const [isVisible, setIsVisible] = React.useState(true);
  const config = typeConfig[type];

  React.useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, onDismiss]);

  if (!isVisible) return null;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: config.bg,
    borderRadius: '4px',
    border: `1px solid ${config.color}30`,
    animation: 'slideDown 200ms ease-out',
  };

  const messageStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '11px',
    color: 'var(--ctx-foreground)',
    lineHeight: '1.4',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 500,
    backgroundColor: config.color,
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const dismissStyle: React.CSSProperties = {
    padding: '2px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--ctx-foreground-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={containerStyle} role="alert">
        <CoachingIcon size={14} color={config.color} />
        <span style={messageStyle}>{message}</span>
        {action && (
          <button style={buttonStyle} onClick={action.onClick}>
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button
            style={dismissStyle}
            onClick={() => {
              setIsVisible(false);
              onDismiss();
            }}
            aria-label="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
};

// ============================================
// Toast Notification Pattern
// ============================================
// Note: This documents how to trigger VS Code's built-in notifications

export interface ToastConfig {
  type: 'information' | 'warning' | 'error';
  message: string;
  detail?: string;
  actions?: { title: string; isCloseAffordance?: boolean }[];
}

/**
 * VS Code Toast Notification Patterns
 *
 * Usage (in extension code, not webview):
 *
 * ```typescript
 * // Information message
 * vscode.window.showInformationMessage(
 *   'New coaching suggestion available',
 *   'View',
 *   'Dismiss'
 * ).then(selection => {
 *   if (selection === 'View') {
 *     // Open sidebar to coaching tab
 *   }
 * });
 *
 * // Warning message
 * vscode.window.showWarningMessage(
 *   'Your prompt could be improved',
 *   { detail: 'Consider adding more context about your goal.' },
 *   'Show Tips'
 * );
 *
 * // With progress
 * vscode.window.withProgress({
 *   location: vscode.ProgressLocation.Notification,
 *   title: 'Analyzing prompt...',
 *   cancellable: false
 * }, async (progress) => {
 *   progress.report({ increment: 0 });
 *   await analyzePrompt();
 *   progress.report({ increment: 100 });
 * });
 * ```
 *
 * When to use each type:
 * - Information: New suggestions, achievements, tips
 * - Warning: Prompt quality concerns, missed opportunities
 * - Error: Connection issues, sync failures
 *
 * Rate limiting:
 * - Max 1 notification per 5 minutes per type
 * - Batch multiple suggestions into single notification
 * - Respect user's notification preferences
 */

export const ToastPatternDocumentation: React.FC = () => {
  const codeStyle: React.CSSProperties = {
    fontFamily: 'var(--ctx-font-mono)',
    fontSize: '11px',
    backgroundColor: 'var(--ctx-surface)',
    padding: '12px',
    borderRadius: '4px',
    overflow: 'auto',
    whiteSpace: 'pre',
  };

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--ctx-foreground)' }}>
        Toast Notification Patterns
      </h3>
      <p style={{ fontSize: '11px', color: 'var(--ctx-foreground-muted)', marginBottom: '12px' }}>
        Use VS Code's native notification API for important alerts:
      </p>
      <pre style={codeStyle}>
{`// In extension code (not webview)
vscode.window.showInformationMessage(
  'New coaching suggestion available',
  'View', 'Dismiss'
);`}
      </pre>
    </div>
  );
};

// ============================================
// New Suggestion Banner
// ============================================

export interface NewSuggestionBannerProps {
  count: number;
  latestType: SuggestionType;
  latestMessage: string;
  onView: () => void;
  onDismiss: () => void;
}

export const NewSuggestionBanner: React.FC<NewSuggestionBannerProps> = ({
  count,
  latestType,
  latestMessage,
  onView,
  onDismiss,
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: 'var(--ctx-score-growth-bg)',
    borderRadius: '4px',
    border: '1px solid var(--ctx-score-growth)30',
    marginBottom: '12px',
    animation: 'slideDown 200ms ease-out',
  };

  const iconStyle: React.CSSProperties = {
    flexShrink: 0,
    marginTop: '2px',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--ctx-foreground)',
    marginBottom: '2px',
  };

  const messageStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--ctx-foreground-muted)',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    marginTop: '8px',
  };

  const viewButtonStyle: React.CSSProperties = {
    padding: '3px 10px',
    fontSize: '10px',
    fontWeight: 500,
    backgroundColor: 'var(--ctx-score-growth)',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
  };

  const dismissButtonStyle: React.CSSProperties = {
    padding: '3px 10px',
    fontSize: '10px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: 'var(--ctx-foreground-muted)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
  };

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={containerStyle} role="alert">
        <div style={iconStyle}>
          <CoachingIcon size={16} color="var(--ctx-score-growth)" />
        </div>
        <div style={contentStyle}>
          <div style={titleStyle}>
            {count === 1 ? 'New suggestion' : `${count} new suggestions`}
          </div>
          <p style={messageStyle}>{latestMessage}</p>
          <div style={actionsStyle}>
            <button style={viewButtonStyle} onClick={onView}>
              View
            </button>
            <button style={dismissButtonStyle} onClick={onDismiss}>
              Later
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default InlineNotification;
