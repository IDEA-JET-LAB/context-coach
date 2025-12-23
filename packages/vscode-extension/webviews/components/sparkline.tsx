import React from 'react';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showTrendColor?: boolean;
  strokeWidth?: number;
  showDots?: boolean;
  showArea?: boolean;
  className?: string;
}

function getTrendColor(data: number[]): string {
  if (data.length < 2) return 'var(--ctx-foreground-muted)';
  const first = data[0];
  const last = data[data.length - 1];
  if (last > first) return 'var(--ctx-score-high)';
  if (last < first) return 'var(--ctx-score-growth)';
  return 'var(--ctx-foreground-muted)';
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 100,
  height = 24,
  color,
  showTrendColor = true,
  strokeWidth = 1.5,
  showDots = false,
  showArea = false,
  className = '',
}) => {
  if (data.length === 0) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ctx-foreground-muted)',
          fontSize: '10px',
        }}
      >
        —
      </div>
    );
  }

  const lineColor = color || (showTrendColor ? getTrendColor(data) : 'var(--ctx-foreground-muted)');

  // Calculate points with padding
  const paddingX = 4;
  const paddingY = 4;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => {
    const x = paddingX + (index / (data.length - 1 || 1)) * chartWidth;
    const y = paddingY + chartHeight - ((value - minValue) / range) * chartHeight;
    return { x, y, value };
  });

  const pathD = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  // Area path (for gradient fill)
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(2)} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`;

  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block' }}
      role="img"
      aria-label={`Trend chart showing ${data.length} data points`}
    >
      {showArea && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={areaD}
            fill={`url(#${gradientId})`}
          />
        </>
      )}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={index === points.length - 1 ? 3 : 2}
          fill={index === points.length - 1 ? lineColor : 'var(--ctx-background)'}
          stroke={lineColor}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
};

export default Sparkline;
