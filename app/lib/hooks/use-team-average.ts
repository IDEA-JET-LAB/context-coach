'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export type TimeWindow = '7d' | '30d' | 'all';

export interface TeamAverageResult {
  average: number | null;
  count: number;
}

function getDateFilter(window: TimeWindow): Date | null {
  const now = new Date();
  switch (window) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return null;
  }
}

async function fetchTeamAverage(
  teamId: string,
  window: TimeWindow
): Promise<TeamAverageResult> {
  const supabase = createClient();

  // Exclude pure commands from team average (Story 5.7)
  let query = supabase
    .from('prompts')
    .select(`
      id,
      analysis:prompt_analyses(overall_score)
    `)
    .eq('team_id', teamId)
    .eq('analysis_status', 'complete')
    .neq('prompt_type', 'command');

  const dateFilter = getDateFilter(window);
  if (dateFilter) {
    query = query.gte('created_at', dateFilter.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  const scores = data
    ?.map((p) => {
      const analysis = p.analysis;
      if (Array.isArray(analysis) && analysis.length > 0) {
        return analysis[0]?.overall_score;
      }
      return undefined;
    })
    .filter((s): s is number => s !== undefined && s !== null);

  if (!scores || scores.length === 0) {
    return { average: null, count: 0 };
  }

  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { average: Math.round(average * 10) / 10, count: scores.length };
}

export function useTeamAverage(teamId: string | undefined, window: TimeWindow = '30d') {
  return useQuery({
    queryKey: ['team-average', teamId, window],
    queryFn: () => {
      if (!teamId) {
        return { average: null, count: 0 };
      }
      return fetchTeamAverage(teamId, window);
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: Boolean(teamId),
  });
}
