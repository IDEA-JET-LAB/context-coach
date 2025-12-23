import React from 'react';

export type SuggestionType = 'improvement' | 'warning' | 'achievement';

export interface SuggestionCardProps {
  type: SuggestionType;
  message: string;
  details?: string;
  onApply?: () => void;
  onDismiss?: () => void;
  isDismissed?: boolean;
  animateIn?: boolean;
  className?: string;
}

const typeConfig: Record<
  SuggestionType,
  { icon: string; color: string; bg: string; label: string }
> = {
  improvement: {
    icon: 'M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2 M19 11h2m-1 -1v2',
    color: 'var(--ctx-score-growth)',
    bg: 'var(--ctx-score-growth-bg)',
    label: 'Tip',
  },
  warning: {
    icon: 'M12 9v4 M12 17.01l.01 -.011 M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z',
    color: 'var(--ctx-score-medium)',
    bg: 'var(--ctx-score-medium-bg)',
    label: 'Notice',
  },
  achievement: {
    icon: 'M9 12l2 2l4 -4 M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z',
    color: 'var(--ctx-score-high)',
    bg: 'var(--ctx-score-high-bg)',
    label: 'Achievement',
  },
};

// Simple icon components using SVG paths
const LightbulbIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7" />
    <path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" />
    <path d="M9.7 17l4.6 0" />
  </svg>
);

const AlertIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <path d="M12 17.01l.01 -.011" />
    <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z" />
  </svg>
);

const CheckIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12l2 2l4 -4" />
    <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z" />
  </svg>
);

const iconMap = {
  improvement: LightbulbIcon,
  warning: AlertIcon,
  achievement: CheckIcon,
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  type,
  message,
  details,
  onApply,
  onDismiss,
  isDismissed = false,
  animateIn = false,
  className = '',
}) => {
  const config = typeConfig[type];
  const Icon = iconMap[type];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    backgroundColor: config.bg,
    borderRadius: 'var(--ctx-radius)',
    border: `1px solid ${config.color}20`,
    opacity: isDismissed ? 0.5 : 1,
    animation: animateIn ? 'slideInRight 200ms ease-out' : 'none',
    transition: 'opacity 200ms ease',
  };

  const iconContainerStyle: React.CSSProperties = {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'flex-start',
    paddingTop: '2px',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: config.color,
    marginBottom: '4px',
  };

  const messageStyle: React.CSSProperties = {
    fontSize: '12px',
    lineHeight: '1.4',
    color: 'var(--ctx-foreground)',
    marginBottom: details ? '4px' : '8px',
  };

  const detailsStyle: React.CSSProperties = {
    fontSize: '11px',
    lineHeight: '1.4',
    color: 'var(--ctx-foreground-muted)',
    marginBottom: '8px',
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: '3px 10px',
    fontSize: '11px',
    fontWeight: 500,
    borderRadius: '3px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 100ms ease',
  };

  const applyButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: config.color,
    color: '#fff',
  };

  const dismissButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'transparent',
    color: 'var(--ctx-foreground-muted)',
  };

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .ctx-suggestion-apply:hover {
          filter: brightness(1.1);
        }
        .ctx-suggestion-dismiss:hover {
          background-color: var(--ctx-surface-hover) !important;
          color: var(--ctx-foreground) !important;
        }
      `}</style>
      <div className={className} style={containerStyle} role="article" aria-label={`${config.label}: ${message}`}>
        <div style={iconContainerStyle}>
          <Icon color={config.color} />
        </div>
        <div style={contentStyle}>
          <div style={labelStyle}>{config.label}</div>
          <p style={messageStyle}>{message}</p>
          {details && <p style={detailsStyle}>{details}</p>}
          {(onApply || onDismiss) && !isDismissed && (
            <div style={actionsStyle}>
              {onApply && type !== 'achievement' && (
                <button
                  className="ctx-suggestion-apply"
                  style={applyButtonStyle}
                  onClick={onApply}
                  aria-label="Apply suggestion"
                >
                  Apply
                </button>
              )}
              {onDismiss && (
                <button
                  className="ctx-suggestion-dismiss"
                  style={dismissButtonStyle}
                  onClick={onDismiss}
                  aria-label="Dismiss suggestion"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SuggestionCard;
