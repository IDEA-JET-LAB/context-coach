'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface MemberStats {
  userId: string;
  name: string;
  avatar?: string;
  promptCount: number;
  avgScore: number;
  trend: 'up' | 'down' | 'stable';
}

export interface DistributionData {
  range: string;
  count: number;
  color: string;
}

export interface TeamAnalyticsData {
  members: MemberStats[];
  distribution: DistributionData[];
  teamAverage: number;
  totalPrompts: number;
  teamTrend: 'up' | 'down' | 'stable';
}

interface DimensionScoreValue {
  score: number;
  reasoning?: string;
}

interface PromptData {
  id: string;
  user_id: string;
  created_at: string;
  user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
  analysis: {
    overall_score: number | null;
    dimension_scores: Record<string, DimensionScoreValue | number> | null;
  } | null;
}

export function useTeamAnalytics(teamId: string, timeRange: string = '30d') {
  const supabase = createClient();

  return useQuery({
    queryKey: ['team-analytics', teamId, timeRange],
    queryFn: async (): Promise<TeamAnalyticsData> => {
      // Fetch all team prompts with analyses and user info
      // RLS automatically filters by team_id
      // Exclude pure commands from analytics (Story 5.7)
      const { data, error } = await supabase
        .from('prompts')
        .select(`
          id,
          user_id,
          created_at,
          user:users(id, name, avatar_url),
          analysis:prompt_analyses(overall_score, dimension_scores)
        `)
        .eq('team_id', teamId)
        .eq('analysis_status', 'complete')
        .neq('prompt_type', 'command')  // Exclude pure commands from analytics
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process data for team analytics
      return processTeamData((data as unknown as PromptData[]) || []);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: Boolean(teamId),
  });
}

function processTeamData(data: PromptData[]): TeamAnalyticsData {
  // Aggregate by member
  const memberMap = new Map<string, {
    userId: string;
    name: string;
    avatar?: string;
    scores: number[];
    prompts: PromptData[];
  }>();

  data.forEach(prompt => {
    const userId = prompt.user_id;
    const existing = memberMap.get(userId) || {
      userId,
      name: prompt.user?.name || 'Unknown',
      avatar: prompt.user?.avatar_url ?? undefined,
      scores: [],
      prompts: [],
    };

    const score = prompt.analysis?.overall_score;
    if (score !== undefined && score !== null) {
      existing.scores.push(score);
    }
    existing.prompts.push(prompt);
    memberMap.set(userId, existing);
  });

  // Calculate member stats
  const members: MemberStats[] = Array.from(memberMap.values()).map(m => ({
    userId: m.userId,
    name: m.name,
    avatar: m.avatar,
    promptCount: m.prompts.length,
    avgScore: m.scores.length > 0
      ? m.scores.reduce((a, b) => a + b, 0) / m.scores.length
      : 0,
    trend: calculateTrend(m.scores),
  }));

  // Calculate distribution
  const allScores = data
    .map(p => p.analysis?.overall_score)
    .filter((s): s is number => s !== undefined && s !== null);

  const distribution: DistributionData[] = [
    { range: '1-3', count: allScores.filter(s => s < 4).length, color: '#f87171' },
    { range: '4-6', count: allScores.filter(s => s >= 4 && s < 7).length, color: '#f59e0b' },
    { range: '7-10', count: allScores.filter(s => s >= 7).length, color: '#14b8a6' },
  ];

  // Team-wide stats
  const teamAvg = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;

  return {
    members,
    distribution,
    teamAverage: teamAvg,
    totalPrompts: data.length,
    teamTrend: calculateTrend(allScores),
  };
}

function calculateTrend(scores: number[]): 'up' | 'down' | 'stable' {
  if (scores.length < 4) return 'stable';

  const mid = Math.floor(scores.length / 2);
  const firstHalf = scores.slice(0, mid);
  const secondHalf = scores.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (firstAvg === 0) return 'stable';
  const change = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
}
