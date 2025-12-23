'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface LineChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface LineChartSeries {
  dataKey: string;
  name: string;
  color?: string;
  strokeWidth?: number;
}

export interface LineChartProps {
  data: LineChartDataPoint[];
  series: LineChartSeries[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisKey?: string;
  yAxisDomain?: [number, number];
  dateFormat?: (value: string) => string;
  className?: string;
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--info))',
  'hsl(var(--score-medium))',
];

export function LineChartComponent({
  data,
  series,
  height = 300,
  showGrid = true,
  showLegend = true,
  xAxisKey = 'date',
  yAxisDomain,
  dateFormat,
  className,
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-muted-foreground',
          className
        )}
        style={{ height }}
        data-testid="line-chart-empty"
      >
        No data available
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} data-testid="line-chart">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.5}
            />
          )}
          <XAxis
            dataKey={xAxisKey}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={dateFormat}
          />
          <YAxis
            domain={yAxisDomain}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }}
            />
          )}
          {series.map((s, index) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              strokeWidth={s.strokeWidth || 2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { LineChartComponent as LineChart };
