'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { escapeSqlLikePattern } from '@/lib/utils/sql-sanitize';
import type { PromptWithAnalysis } from '@/lib/types/prompt';
import type { FeedFilters } from '@/lib/types/filters';

export function usePrompts(teamId: string | undefined, filters: FeedFilters = {}) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['prompts', teamId, filters],
    queryFn: async (): Promise<PromptWithAnalysis[]> => {
      if (!teamId) return [];

      let query = supabase
        .from('prompts')
        .select(
          `
          *,
          analysis:prompt_analyses(
            overall_score,
            dimension_scores
          )
        `
        )
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      // Apply search filter (text content)
      // Escape SQL pattern characters to prevent pattern injection attacks
      if (filters.search) {
        const escapedSearch = escapeSqlLikePattern(filters.search);
        query = query.ilike('text', `%${escapedSearch}%`);
      }

      // Apply user filter (team leads only)
      if (filters.users?.length) {
        query = query.in('user_id', filters.users);
      }

      // Apply project filter
      if (filters.project) {
        query = query.eq('project_id', filters.project);
      }

      // Apply date range filter
      if (filters.dateRange) {
        query = query
          .gte('created_at', filters.dateRange.from.toISOString())
          .lte('created_at', filters.dateRange.to.toISOString());
      }

      // Apply score range filter - filter after fetching since it requires joining
      const { data, error } = await query.limit(100);

      if (error) throw error;

      // Transform the data to match PromptWithAnalysis type
      let results = (data ?? []).map((prompt) => ({
        ...prompt,
        analysis: Array.isArray(prompt.analysis)
          ? prompt.analysis[0] ?? null
          : prompt.analysis,
      })) as PromptWithAnalysis[];

      // Apply score range filter client-side (Supabase doesn't support filtering on joined tables easily)
      if (filters.scoreRange) {
        results = results.filter((prompt) => {
          if (!prompt.analysis?.overall_score) return false;
          const score = prompt.analysis.overall_score;
          return score >= filters.scoreRange!.min && score <= filters.scoreRange!.max;
        });
      }

      return results.slice(0, 50);
    },
    enabled: !!teamId,
    staleTime: 30 * 1000, // 30 seconds
  });
}
