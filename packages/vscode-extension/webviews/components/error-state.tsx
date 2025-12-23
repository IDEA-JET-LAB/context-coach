/**
 * ErrorState Component
 * Story 19-4: Real-time Analytics Display
 *
 * Displays error messages with retry functionality.
 */

import React from 'react';
import { AlertCircleIcon, RefreshIcon, CloudOffIcon } from './icons';

export interface ErrorStateProps {
  /** Error message to display */
  message: string;
  /** Whether this is an offline error */
  isOffline?: boolean;
  /** Callback for retry button */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Additional CSS class */
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  isOffline = false,
  onRetry,
  isRetrying = false,
  className = '',
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '32px 16px',
    color: 'var(--ctx-foreground-muted)',
  };

  const iconContainerStyle: React.CSSProperties = {
    marginBottom: '16px',
    color: isOffline ? 'var(--ctx-foreground-muted)' : 'var(--ctx-status-disconnected)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--ctx-foreground)',
    marginBottom: '8px',
  };

  const messageStyle: React.CSSProperties = {
    fontSize: '11px',
    lineHeight: '1.5',
    maxWidth: '200px',
    marginBottom: '16px',
  };

  const retryButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--ctx-button-fg)',
    backgroundColor: 'var(--ctx-button-bg)',
    border: 'none',
    borderRadius: 'var(--ctx-radius)',
    cursor: isRetrying ? 'not-allowed' : 'pointer',
    opacity: isRetrying ? 0.7 : 1,
    transition: 'all 100ms ease',
  };

  const spinnerStyle: React.CSSProperties = {
    animation: 'spin 1s linear infinite',
  };

  const Icon = isOffline ? CloudOffIcon : AlertCircleIcon;

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        className={className}
        style={containerStyle}
        role="alert"
        aria-live="polite"
      >
        <div style={iconContainerStyle}>
          <Icon size={48} />
        </div>
        <h3 style={titleStyle}>
          {isOffline ? 'You are offline' : 'Something went wrong'}
        </h3>
        <p style={messageStyle}>{message}</p>
        {onRetry && (
          <button
            style={retryButtonStyle}
            onClick={onRetry}
            disabled={isRetrying}
            aria-label={isRetrying ? 'Retrying...' : 'Try again'}
            onMouseEnter={(e) => {
              if (!isRetrying) {
                e.currentTarget.style.backgroundColor = 'var(--ctx-button-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--ctx-button-bg)';
            }}
          >
            <RefreshIcon size={12} style={isRetrying ? spinnerStyle : undefined} />
            <span>{isRetrying ? 'Retrying...' : 'Try Again'}</span>
          </button>
        )}
      </div>
    </>
  );
};

export default ErrorState;
