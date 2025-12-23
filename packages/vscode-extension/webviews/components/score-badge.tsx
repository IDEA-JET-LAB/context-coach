import React from 'react';

export interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

type ScoreLevel = 'high' | 'medium' | 'growth';

function getScoreLevel(score: number): ScoreLevel {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'growth';
}

const levelConfig: Record<ScoreLevel, { color: string; bg: string; label: string }> = {
  high: {
    color: 'var(--ctx-score-high)',
    bg: 'var(--ctx-score-high-bg)',
    label: 'Great',
  },
  medium: {
    color: 'var(--ctx-score-medium)',
    bg: 'var(--ctx-score-medium-bg)',
    label: 'Good',
  },
  growth: {
    color: 'var(--ctx-score-growth)',
    bg: 'var(--ctx-score-growth-bg)',
    label: 'Growing',
  },
};

const sizeConfig = {
  sm: {
    padding: '1px 6px',
    fontSize: '10px',
    minWidth: '28px',
  },
  md: {
    padding: '2px 8px',
    fontSize: '11px',
    minWidth: '32px',
  },
  lg: {
    padding: '4px 10px',
    fontSize: '13px',
    minWidth: '40px',
  },
};

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const normalizedScore = Math.max(0, Math.min(10, score));
  const level = getScoreLevel(normalizedScore);
  const config = levelConfig[level];
  const sizes = sizeConfig[size];

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: sizes.padding,
    minWidth: sizes.minWidth,
    fontFamily: 'var(--ctx-font-mono)',
    fontSize: sizes.fontSize,
    fontWeight: 600,
    color: config.color,
    backgroundColor: config.bg,
    borderRadius: 'var(--ctx-radius-sm)',
    lineHeight: 1.2,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--ctx-font-family)',
    fontWeight: 500,
    fontSize: sizes.fontSize,
    opacity: 0.9,
  };

  return (
    <span
      className={className}
      style={badgeStyle}
      role="status"
      aria-label={`Score: ${normalizedScore.toFixed(1)} out of 10, ${config.label}`}
    >
      {normalizedScore.toFixed(1)}
      {showLabel && <span style={labelStyle}>{config.label}</span>}
    </span>
  );
};

export default ScoreBadge;
