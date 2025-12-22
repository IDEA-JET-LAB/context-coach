'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DistributionData } from '@/lib/hooks/use-team-analytics';

const COLORS: Record<string, string> = {
  '1-3': '#f87171',  // Coral - needs improvement
  '4-6': '#f59e0b',  // Amber - moderate
  '7-10': '#14b8a6', // Teal - good
};

interface TeamDistributionChartProps {
  data: DistributionData[];
}

export function TeamDistributionChart({ data }: TeamDistributionChartProps) {
  if (data.every(d => d.count === 0)) {
    return (
      <div
        className="flex h-[250px] items-center justify-center text-muted-foreground"
        data-testid="distribution-chart-empty"
      >
        No score data available
      </div>
    );
  }

  return (
    <div className="h-[250px] w-full" data-testid="team-distribution-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="range"
            stroke="#a1a1aa"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
          />
          <YAxis
            stroke="#a1a1aa"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#fafafa' }}
            formatter={(value) => [`${value} prompts`, 'Count']}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.range] || '#a1a1aa'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
