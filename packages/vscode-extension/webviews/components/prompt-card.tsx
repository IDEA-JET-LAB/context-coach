import React from 'react';
import { ScoreBadge } from './score-badge';

export interface PromptCardProps {
  text: string;
  score: number;
  timestamp: Date | string;
  onClick?: () => void;
  isNew?: boolean;
  className?: string;
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export const PromptCard: React.FC<PromptCardProps> = ({
  text,
  score,
  timestamp,
  onClick,
  isNew = false,
  className = '',
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: 'var(--ctx-radius)',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 150ms ease',
    position: 'relative',
    overflow: 'hidden',
  };

  const hoverStyle: React.CSSProperties = {
    borderColor: 'var(--ctx-border)',
    backgroundColor: 'var(--ctx-surface-hover)',
  };

  const newIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '3px',
    height: '100%',
    backgroundColor: 'var(--ctx-score-high)',
    borderRadius: '0 2px 2px 0',
  };

  const textStyle: React.CSSProperties = {
    fontSize: '12px',
    lineHeight: '1.4',
    color: 'var(--ctx-foreground)',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    wordBreak: 'break-word',
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const timeStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--ctx-foreground-muted)',
  };

  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className={className}
      style={{
        ...containerStyle,
        ...(isHovered ? hoverStyle : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-label={onClick ? `View prompt: ${text.substring(0, 50)}...` : undefined}
    >
      {isNew && <div style={newIndicatorStyle} aria-hidden="true" />}
      <p style={textStyle}>{text}</p>
      <div style={footerStyle}>
        <span style={timeStyle}>{formatTimeAgo(timestamp)}</span>
        <ScoreBadge score={score} size="sm" />
      </div>
    </div>
  );
};

export default PromptCard;
