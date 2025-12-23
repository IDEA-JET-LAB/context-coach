/**
 * DimensionScoreCard Component
 * Story 19-4: Real-time Analytics Display
 *
 * Displays a single dimension score with color coding and trend indicator.
 */

import React from 'react';
import { TrendUpIcon, TrendDownIcon } from './icons';

export interface DimensionScoreCardProps {
  /** Dimension name (e.g., "Clarity", "Context") */
  name: string;
  /** Score value (0-100) */
  score: number;
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable';
  /** Change amount from previous period */
  change?: number;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS class */
  className?: string;
}

/**
 * Gets the color for a score value.
 * Red (<60), Yellow (60-79), Green (>=80)
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--ctx-score-high)';
  if (score >= 60) return 'var(--ctx-score-medium)';
  return 'var(--ctx-score-growth)';
}

/**
 * Gets the background color for a score value.
 */
function getScoreBgColor(score: number): string {
  if (score >= 80) return 'var(--ctx-score-high-bg)';
  if (score >= 60) return 'var(--ctx-score-medium-bg)';
  return 'var(--ctx-score-growth-bg)';
}

/**
 * Capitalizes the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const DimensionScoreCard: React.FC<DimensionScoreCardProps> = ({
  name,
  score,
  trend = 'stable',
  change,
  size = 'sm',
  className = '',
}) => {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const scoreColor = getScoreColor(normalizedScore);
  const scoreBgColor = getScoreBgColor(normalizedScore);

  const isSm = size === 'sm';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isSm ? '8px 10px' : '10px 12px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: 'var(--ctx-radius)',
    transition: 'border-color 150ms ease',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: isSm ? '11px' : '12px',
    fontWeight: 500,
    color: 'var(--ctx-foreground)',
    textTransform: 'capitalize',
  };

  const rightSideStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const trendContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    fontSize: '10px',
    color: trend === 'up'
      ? 'var(--ctx-score-high)'
      : trend === 'down'
        ? 'var(--ctx-status-disconnected)'
        : 'var(--ctx-foreground-muted)',
  };

  const scoreStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: isSm ? '36px' : '42px',
    padding: isSm ? '2px 6px' : '3px 8px',
    fontSize: isSm ? '11px' : '12px',
    fontWeight: 600,
    fontFamily: 'var(--ctx-font-mono)',
    color: scoreColor,
    backgroundColor: scoreBgColor,
    borderRadius: 'var(--ctx-radius-sm)',
  };

  const progressBarContainerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '2px',
    backgroundColor: 'var(--ctx-border-subtle)',
    borderRadius: '0 0 var(--ctx-radius) var(--ctx-radius)',
    overflow: 'hidden',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '100%',
    width: `${normalizedScore}%`,
    backgroundColor: scoreColor,
    transition: 'width 0.3s ease',
  };

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
  };

  return (
    <div className={className} style={wrapperStyle}>
      <div
        style={containerStyle}
        role="listitem"
        aria-label={`${capitalize(name)} score: ${normalizedScore} out of 100`}
      >
        <span style={nameStyle}>{capitalize(name)}</span>
        <div style={rightSideStyle}>
          {trend !== 'stable' && (
            <div style={trendContainerStyle} aria-hidden="true">
              {trend === 'up' ? (
                <TrendUpIcon size={10} />
              ) : (
                <TrendDownIcon size={10} />
              )}
              {change !== undefined && Math.abs(change) >= 1 && (
                <span>{Math.abs(Math.round(change))}</span>
              )}
            </div>
          )}
          <span style={scoreStyle}>{normalizedScore}</span>
        </div>
      </div>
      <div style={progressBarContainerStyle} aria-hidden="true">
        <div style={progressBarStyle} />
      </div>
    </div>
  );
};

export default DimensionScoreCard;
