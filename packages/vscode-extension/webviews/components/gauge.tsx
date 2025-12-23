import React from 'react';

export interface GaugeProps {
  value: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  animated?: boolean;
  className?: string;
}

type ScoreLevel = 'high' | 'medium' | 'growth';

function getScoreLevel(value: number): ScoreLevel {
  if (value >= 7) return 'high';
  if (value >= 4) return 'medium';
  return 'growth';
}

const levelColors: Record<ScoreLevel, string> = {
  high: 'var(--ctx-score-high)',
  medium: 'var(--ctx-score-medium)',
  growth: 'var(--ctx-score-growth)',
};

const sizeConfig = {
  sm: { width: 60, strokeWidth: 5, fontSize: 14, labelSize: 9 },
  md: { width: 80, strokeWidth: 6, fontSize: 18, labelSize: 10 },
  lg: { width: 100, strokeWidth: 7, fontSize: 22, labelSize: 11 },
};

export const Gauge: React.FC<GaugeProps> = ({
  value,
  label,
  size = 'md',
  showValue = true,
  animated = true,
  className = '',
}) => {
  const config = sizeConfig[size];
  const normalizedValue = Math.max(0, Math.min(10, value));
  const percentage = normalizedValue / 10;
  const level = getScoreLevel(normalizedValue);
  const scoreColor = levelColors[level];

  // SVG calculations for semi-circle gauge
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage);
  const cx = config.width / 2;
  const cy = config.width / 2;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const gaugeContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: config.width,
    height: config.width / 2 + 10,
  };

  const valueStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    bottom: 0,
    transform: 'translateX(-50%)',
    fontFamily: 'var(--ctx-font-mono)',
    fontSize: config.fontSize,
    fontWeight: 700,
    color: 'var(--ctx-foreground)',
  };

  const labelStyle: React.CSSProperties = {
    marginTop: '4px',
    fontSize: config.labelSize,
    color: 'var(--ctx-foreground-muted)',
    textAlign: 'center',
  };

  const animationId = `gauge-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <>
      {animated && (
        <style>{`
          @keyframes ${animationId} {
            from { stroke-dashoffset: ${circumference}; }
            to { stroke-dashoffset: ${strokeDashoffset}; }
          }
          .${animationId} {
            animation: ${animationId} 0.6s ease-out forwards;
          }
        `}</style>
      )}
      <div className={className} style={containerStyle} role="meter" aria-valuenow={normalizedValue} aria-valuemin={0} aria-valuemax={10} aria-label={label || 'Score gauge'}>
        <div style={gaugeContainerStyle}>
          <svg
            width={config.width}
            height={config.width / 2 + 10}
            viewBox={`0 0 ${config.width} ${config.width / 2 + 10}`}
            style={{ overflow: 'visible' }}
          >
            {/* Background track */}
            <path
              d={`M ${config.strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${cy}`}
              fill="none"
              stroke="var(--ctx-border-subtle)"
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
            />
            {/* Value arc */}
            <path
              className={animated ? animationId : undefined}
              d={`M ${config.strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${cy}`}
              fill="none"
              stroke={scoreColor}
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={animated ? circumference : strokeDashoffset}
              style={!animated ? { transition: 'stroke-dashoffset 0.5s ease-out' } : undefined}
            />
          </svg>
          {showValue && (
            <div style={valueStyle}>
              {normalizedValue.toFixed(1)}
            </div>
          )}
        </div>
        {label && <span style={labelStyle}>{label}</span>}
      </div>
    </>
  );
};

export default Gauge;
