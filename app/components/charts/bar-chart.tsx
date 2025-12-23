'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface BarChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  layout?: 'horizontal' | 'vertical';
  barColor?: string;
  useDataColors?: boolean;
  className?: string;
}

export function BarChartComponent({
  data,
  height = 300,
  showGrid = true,
  showLegend = false,
  layout = 'vertical',
  barColor = 'hsl(var(--primary))',
  useDataColors = false,
  className,
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-muted-foreground',
          className
        )}
        style={{ height }}
        data-testid="bar-chart-empty"
      >
        No data available
      </div>
    );
  }

  const isHorizontal = layout === 'horizontal';

  return (
    <div className={cn('w-full', className)} data-testid="bar-chart">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.5}
            />
          )}
          {isHorizontal ? (
            <>
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                width={100}
              />
            </>
          ) : (
            <>
              <XAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
          />
          {showLegend && (
            <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }} />
          )}
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={useDataColors && entry.color ? entry.color : barColor}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { BarChartComponent as BarChart };
