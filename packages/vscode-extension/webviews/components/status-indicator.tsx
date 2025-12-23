import React from 'react';

export type ConnectionStatus = 'connected' | 'syncing' | 'disconnected';

export interface StatusIndicatorProps {
  status: ConnectionStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const statusConfig: Record<
  ConnectionStatus,
  { color: string; label: string; pulseColor: string }
> = {
  connected: {
    color: 'var(--ctx-status-connected)',
    label: 'Connected',
    pulseColor: 'rgba(34, 197, 94, 0.4)',
  },
  syncing: {
    color: 'var(--ctx-status-syncing)',
    label: 'Syncing...',
    pulseColor: 'rgba(234, 179, 8, 0.4)',
  },
  disconnected: {
    color: 'var(--ctx-status-disconnected)',
    label: 'Disconnected',
    pulseColor: 'rgba(239, 68, 68, 0.4)',
  },
};

const sizeConfig = {
  sm: { dot: 6, fontSize: '10px' },
  md: { dot: 8, fontSize: '11px' },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  showLabel = false,
  size = 'sm',
  className = '',
}) => {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  };

  const dotContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: sizes.dot,
    height: sizes.dot,
  };

  const dotStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: config.color,
  };

  const pulseStyle: React.CSSProperties = {
    position: 'absolute',
    inset: -2,
    borderRadius: '50%',
    backgroundColor: config.pulseColor,
    animation: status === 'syncing' ? 'statusPulse 1.5s ease-in-out infinite' : 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: sizes.fontSize,
    color: 'var(--ctx-foreground-muted)',
    fontWeight: 500,
  };

  return (
    <>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
      <div
        className={className}
        style={containerStyle}
        role="status"
        aria-label={config.label}
      >
        <div style={dotContainerStyle}>
          {status === 'syncing' && <div style={pulseStyle} />}
          <div style={dotStyle} />
        </div>
        {showLabel && <span style={labelStyle}>{config.label}</span>}
      </div>
    </>
  );
};

export default StatusIndicator;
