'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { subDays, eachDayOfInterval, format } from 'date-fns';

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'all';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendDataPoint {
  date: string;
  avgScore: number;
  promptCount: number;
}

export interface DimensionAverage {
  dimension: string;
  avgScore: number;
}

export interface PersonalAnalyticsData {
  trendData: TrendDataPoint[];
  totalPrompts: number;
  analyzedPrompts: number;  // Count of prompts that have analysis scores
  avgScore: number | null;  // null when no analyzed prompts
  improvement: number | null;  // null when not enough data to calculate
  dimensions: DimensionAverage[];
  trend: TrendDirection;
}

export function usePersonalAnalytics(userId: string, timeRange: TimeRange = '7d') {
  const supabase = createClient();

  return useQuery<PersonalAnalyticsData>({
    queryKey: ['personal-analytics', userId, timeRange],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const endDate = new Date();
      const startDate = getStartDate(timeRange);

      // Fetch prompts with analyses (exclude pure commands from analytics)
      let query = supabase
        .from('prompts')
        .select(`
          id,
          created_at,
          analysis:prompt_analyses(
            overall_score,
            dimension_scores
          )
        `)
        .eq('user_id', userId)
        .eq('analysis_status', 'complete')
        .neq('prompt_type', 'command')  // Exclude pure commands from analytics
        .order('created_at', { ascending: true });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Cast data to our expected type (PostgREST returns object, not array, for single relations)
      return processAnalyticsData((data as unknown as PromptWithAnalysis[]) ?? [], startDate, endDate);
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

function getStartDate(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case 'today':
      // Start of today (midnight)
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return today;
    case '7d':
      return subDays(now, 7);
    case '30d':
      return subDays(now, 30);
    case '90d':
      return subDays(now, 90);
    case 'all':
      return null;
  }
}

interface DimensionScoreValue {
  score: number;
  reasoning?: string;
}

interface PromptWithAnalysis {
  id: string;
  created_at: string;
  analysis: {
    overall_score: number | null;
    dimension_scores: Record<string, DimensionScoreValue> | null;
  } | null;
}

function processAnalyticsData(
  data: PromptWithAnalysis[],
  startDate: Date | null,
  endDate: Date
): PersonalAnalyticsData {
  // Group by day for trend chart
  const dailyData = new Map<string, { scores: number[]; count: number }>();

  // Initialize all days in range (for continuous chart)
  if (startDate) {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    days.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      dailyData.set(key, { scores: [], count: 0 });
    });
  }

  // Aggregate scores by day
  data.forEach((prompt) => {
    const day = format(new Date(prompt.created_at), 'yyyy-MM-dd');
    const score = prompt.analysis?.overall_score;

    if (score !== undefined && score !== null) {
      const existing = dailyData.get(day) || { scores: [], count: 0 };
      existing.scores.push(score);
      existing.count++;
      dailyData.set(day, existing);
    }
  });

  // Convert to chart format (only days with data)
  const trendData = Array.from(dailyData.entries())
    .map(([date, { scores, count }]) => ({
      date,
      avgScore: scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0,
      promptCount: count,
    }))
    .filter((d) => d.promptCount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate summary stats
  const allScores = data
    .map((p) => p.analysis?.overall_score)
    .filter((s): s is number => s !== undefined && s !== null);

  const totalPrompts = data.length;
  const analyzedPrompts = allScores.length;

  // Return null for avgScore when no analyses exist (shows "N/A" in UI)
  const avgScore =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : null;

  // Calculate improvement (compare first half to second half)
  // Need at least 2 data points to calculate meaningful improvement
  let improvement: number | null = null;
  let trend: TrendDirection = 'stable';

  if (allScores.length >= 2) {
    const midpoint = Math.floor(allScores.length / 2);
    const firstHalf = allScores.slice(0, midpoint);
    const secondHalf = allScores.slice(midpoint);

    const firstAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        : 0;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
        : 0;

    // Safe division - handle edge case where firstAvg is 0
    improvement =
      firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    // Determine trend direction: >5% up, <-5% down, else stable
    trend = improvement > 5 ? 'up' : improvement < -5 ? 'down' : 'stable';
  }

  // Calculate dimension averages
  const dimensionScoresMap = new Map<string, number[]>();
  data.forEach((prompt) => {
    const dims = prompt.analysis?.dimension_scores;
    if (dims && typeof dims === 'object') {
      Object.entries(dims).forEach(([dimension, value]) => {
        // Handle both { score: number } format and raw number format
        const score = typeof value === 'object' && value !== null && 'score' in value
          ? value.score
          : typeof value === 'number'
            ? value
            : null;

        if (score !== null && typeof score === 'number') {
          const existing = dimensionScoresMap.get(dimension) || [];
          existing.push(score);
          dimensionScoresMap.set(dimension, existing);
        }
      });
    }
  });

  const dimensions = Array.from(dimensionScoresMap.entries()).map(
    ([dimension, scores]) => ({
      dimension,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    })
  );

  return {
    trendData,
    totalPrompts,
    analyzedPrompts,
    avgScore,
    improvement,
    dimensions,
    trend,
  };
}
