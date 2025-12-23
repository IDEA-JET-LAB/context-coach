'use client';

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

export interface SparklineDataPoint {
  value: number;
}

export interface SparklineProps {
  data: SparklineDataPoint[];
  /** Width of the sparkline */
  width?: number;
  /** Height of the sparkline */
  height?: number;
  /** Color of the line */
  color?: string;
  /** Whether to show area fill */
  showFill?: boolean;
  /** Additional class names */
  className?: string;
}

function getTrendColor(data: SparklineDataPoint[]): string {
  if (data.length < 2) return 'hsl(var(--muted-foreground))';
  const firstPoint = data[0];
  const lastPoint = data[data.length - 1];
  if (!firstPoint || !lastPoint) return 'hsl(var(--muted-foreground))';
  const first = firstPoint.value;
  const last = lastPoint.value;
  if (last > first) return 'hsl(var(--score-high))';
  if (last < first) return 'hsl(var(--score-growth))';
  return 'hsl(var(--muted-foreground))';
}

export function Sparkline({
  data,
  width = 100,
  height = 32,
  color,
  showFill = false,
  className,
}: SparklineProps) {
  if (data.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        style={{ width, height }}
        data-testid="sparkline-empty"
      >
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }

  const lineColor = color || getTrendColor(data);

  return (
    <div
      className={cn('inline-block', className)}
      style={{ width, height }}
      data-testid="sparkline"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
