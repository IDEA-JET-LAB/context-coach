/**
 * SyncStatus Component
 * Story 19-4: Real-time Analytics Display
 *
 * Displays sync state indicator with last sync time and manual refresh button.
 */

import React from 'react';
import { SyncIcon, CheckCircleIcon, AlertCircleIcon, CloudOffIcon, RefreshIcon } from './icons';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncStatusProps {
  /** Current sync state */
  state: SyncState;
  /** Last successful sync timestamp (ISO 8601) */
  lastSyncTime?: string;
  /** Callback to trigger manual sync */
  onSync?: () => void;
  /** Whether sync button is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Formats a timestamp to a human-readable time ago string.
 */
function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days}d ago`;
}

/**
 * Gets the status configuration for a sync state.
 */
function getStatusConfig(state: SyncState) {
  switch (state) {
    case 'syncing':
      return {
        icon: SyncIcon,
        color: 'var(--ctx-status-syncing)',
        label: 'Syncing...',
        animate: true,
      };
    case 'synced':
      return {
        icon: CheckCircleIcon,
        color: 'var(--ctx-status-connected)',
        label: 'Synced',
        animate: false,
      };
    case 'error':
      return {
        icon: AlertCircleIcon,
        color: 'var(--ctx-status-disconnected)',
        label: 'Sync failed',
        animate: false,
      };
    case 'offline':
      return {
        icon: CloudOffIcon,
        color: 'var(--ctx-foreground-muted)',
        label: 'Offline',
        animate: false,
      };
    default:
      return {
        icon: SyncIcon,
        color: 'var(--ctx-foreground-muted)',
        label: 'Idle',
        animate: false,
      };
  }
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  state,
  lastSyncTime,
  onSync,
  disabled = false,
  className = '',
}) => {
  const config = getStatusConfig(state);
  const Icon = config.icon;
  const canSync = onSync && !disabled && state !== 'syncing';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: 'var(--ctx-radius)',
    fontSize: '10px',
  };

  const leftSideStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const iconContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: config.color,
    animation: config.animate ? 'spin 1s linear infinite' : undefined,
  };

  const labelStyle: React.CSSProperties = {
    color: config.color,
    fontWeight: 500,
  };

  const timeStyle: React.CSSProperties = {
    color: 'var(--ctx-foreground-muted)',
    marginLeft: '4px',
  };

  const refreshButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--ctx-radius-sm)',
    color: 'var(--ctx-foreground-muted)',
    cursor: canSync ? 'pointer' : 'not-allowed',
    opacity: canSync ? 1 : 0.5,
    transition: 'all 100ms ease',
  };

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
        role="status"
        aria-label={`Sync status: ${config.label}${lastSyncTime ? `, last synced ${formatTimeAgo(lastSyncTime)}` : ''}`}
      >
        <div style={leftSideStyle}>
          <div style={iconContainerStyle}>
            <Icon size={12} />
          </div>
          <span style={labelStyle}>{config.label}</span>
          {lastSyncTime && state !== 'syncing' && (
            <span style={timeStyle}>{formatTimeAgo(lastSyncTime)}</span>
          )}
        </div>
        {onSync && (
          <button
            style={refreshButtonStyle}
            onClick={onSync}
            disabled={!canSync}
            aria-label="Refresh data"
            title="Refresh data"
            onMouseEnter={(e) => {
              if (canSync) {
                e.currentTarget.style.color = 'var(--ctx-foreground)';
                e.currentTarget.style.backgroundColor = 'var(--ctx-surface-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ctx-foreground-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <RefreshIcon size={12} />
          </button>
        )}
      </div>
    </>
  );
};

export default SyncStatus;
