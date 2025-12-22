'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TrendDataPoint, TrendDirection } from '@/lib/hooks/use-personal-analytics';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: TrendDataPoint;
  }>;
  label?: string;
}

// Chart color constants
const CHART_COLORS = {
  line: '#14b8a6',       // teal-500
  grid: '#2a2a2a',
  axisText: '#a1a1aa',
  tooltipBg: '#1a1a1a',
  dot: '#14b8a6',
} as const;

interface ScoreTrendChartProps {
  data: TrendDataPoint[];
  trend: TrendDirection;
}

export function ScoreTrendChart({ data, trend }: ScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex h-[300px] items-center justify-center text-muted-foreground"
        data-testid="chart-empty"
      >
        No data available for this time range
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="score-trend-chart">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrendIndicator direction={trend} />
      </div>
      <div className="h-[300px] w-full" data-testid="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="date"
              stroke={CHART_COLORS.axisText}
              tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
              tickFormatter={(value) => format(new Date(value), 'MMM d')}
            />
            <YAxis
              domain={[0, 10]}
              stroke={CHART_COLORS.axisText}
              tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={5} stroke="#52525b" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="avgScore"
              stroke={CHART_COLORS.line}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.dot, r: 4 }}
              activeDot={{ r: 6, fill: CHART_COLORS.dot }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendIndicator({ direction }: { direction: TrendDirection }) {
  switch (direction) {
    case 'up':
      return (
        <span className="flex items-center gap-1 text-teal-500" data-testid="trend-up">
          <TrendingUp className="h-4 w-4" />
          Improving
        </span>
      );
    case 'down':
      return (
        <span className="flex items-center gap-1 text-red-500" data-testid="trend-down">
          <TrendingDown className="h-4 w-4" />
          Declining
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-zinc-400" data-testid="trend-stable">
          <Minus className="h-4 w-4" />
          Stable
        </span>
      );
  }
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null;

  const data = payload[0].payload;

  return (
    <div
      className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-3 shadow-lg"
      data-testid="chart-tooltip"
    >
      <p className="text-sm font-medium text-[#fafafa]">
        {format(new Date(label as string), 'MMMM d, yyyy')}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Average Score: <span className="font-bold text-teal-500">{data.avgScore.toFixed(1)}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        Prompts: {data.promptCount}
      </p>
    </div>
  );
}
