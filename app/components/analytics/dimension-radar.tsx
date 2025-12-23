'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface DimensionScore {
  dimension: string;
  score: number;
  fullMark?: number;
}

export interface DimensionRadarProps {
  /** User's dimension scores */
  data: DimensionScore[];
  /** Comparison data (e.g., team average) */
  compareData?: DimensionScore[];
  /** Height of the chart */
  height?: number;
  /** Whether to show the legend */
  showLegend?: boolean;
  /** Label for user data */
  userLabel?: string;
  /** Label for comparison data */
  compareLabel?: string;
  /** Additional class names */
  className?: string;
}

export function DimensionRadar({
  data,
  compareData,
  height = 300,
  showLegend = true,
  userLabel = 'Your Scores',
  compareLabel = 'Team Average',
  className,
}: DimensionRadarProps) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-muted-foreground',
          className
        )}
        style={{ height }}
        data-testid="dimension-radar-empty"
      >
        No dimension data available
      </div>
    );
  }

  // Merge data for recharts
  const mergedData = data.map((item, index) => ({
    dimension: item.dimension,
    user: item.score,
    compare: compareData?.[index]?.score,
    fullMark: item.fullMark || 10,
  }));

  return (
    <div className={cn('w-full', className)} data-testid="dimension-radar">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={mergedData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 10]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickCount={6}
          />
          {compareData && (
            <Radar
              name={compareLabel}
              dataKey="compare"
              stroke="hsl(var(--secondary))"
              fill="hsl(var(--secondary))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          )}
          <Radar
            name={userLabel}
            dataKey="user"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
            formatter={(value) => [typeof value === 'number' ? value.toFixed(1) : String(value), '']}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
