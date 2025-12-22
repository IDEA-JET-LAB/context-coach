'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { subDays, format, eachDayOfInterval } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamTrendChartProps {
  teamId: string;
}

type TimeRange = '7d' | '30d' | '90d';

interface TrendDataPoint {
  date: string;
  avgScore: number;
  count: number;
}

interface PromptData {
  created_at: string;
  prompt_analyses: Array<{
    overall_score: number | null;
  }> | null;
}

export function TeamTrendChart({ teamId }: TeamTrendChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const supabase = createClient();

  const { data, isPending, error } = useQuery({
    queryKey: ['team-trend', teamId, timeRange],
    queryFn: async (): Promise<TrendDataPoint[]> => {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = subDays(new Date(), days);

      const { data: prompts, error } = await supabase
        .from('prompts')
        .select(`
          created_at,
          prompt_analyses(overall_score)
        `)
        .eq('team_id', teamId)
        .eq('analysis_status', 'complete')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const typedPrompts = (prompts as unknown as PromptData[]) || [];

      // Initialize all days
      const allDays = eachDayOfInterval({ start: startDate, end: new Date() });
      const dailyData = new Map<string, { scores: number[]; count: number }>();

      allDays.forEach(day => {
        dailyData.set(format(day, 'yyyy-MM-dd'), { scores: [], count: 0 });
      });

      // Aggregate by day
      typedPrompts.forEach(prompt => {
        const day = format(new Date(prompt.created_at), 'yyyy-MM-dd');
        const score = prompt.prompt_analyses?.[0]?.overall_score;

        if (score !== null && score !== undefined) {
          const existing = dailyData.get(day) || { scores: [], count: 0 };
          existing.scores.push(score);
          existing.count++;
          dailyData.set(day, existing);
        }
      });

      // Convert to array format
      return Array.from(dailyData.entries())
        .map(([date, { scores, count }]) => ({
          date: format(new Date(date), 'MMM d'),
          avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
          count,
        }))
        .filter(d => d.count > 0);
    },
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(teamId),
  });

  if (error) {
    return (
      <div className="flex h-[200px] items-center justify-center text-red-400">
        Failed to load trend data
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="team-trend-chart">
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(range)}
            data-testid={`trend-range-${range}`}
          >
            {range}
          </Button>
        ))}
      </div>

      {isPending ? (
        <Skeleton className="h-[200px] w-full bg-[#1a1a1a]" />
      ) : !data || data.length === 0 ? (
        <div
          className="flex h-[200px] items-center justify-center text-muted-foreground"
          data-testid="trend-chart-empty"
        >
          No trend data for this period
        </div>
      ) : (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="date"
                stroke="#a1a1aa"
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
              />
              <YAxis
                domain={[0, 10]}
                stroke="#a1a1aa"
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#fafafa' }}
                formatter={(value, name) => [
                  name === 'avgScore' && typeof value === 'number' ? value.toFixed(1) : value,
                  name === 'avgScore' ? 'Avg Score' : 'Prompts'
                ]}
              />
              <Line
                type="monotone"
                dataKey="avgScore"
                stroke="#14b8a6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
