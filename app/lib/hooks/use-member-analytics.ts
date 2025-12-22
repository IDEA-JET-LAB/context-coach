'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface DimensionScore {
  name: string;
  score: number;
  maxScore: number;
}

// Simplified prompt type for member analytics display
export interface MemberPrompt {
  id: string;
  text: string;
  created_at: string;
  team_id: string;
  project_id: string;
  user_id: string;
  char_count: number;
  word_count: number;
  analysis_status: 'pending' | 'processing' | 'complete' | 'failed';
  analysis: {
    overall_score: number;
    dimension_scores: Record<string, { score: number; reasoning?: string }> | null;
  } | null;
}

export interface MemberAnalyticsData {
  member: {
    id: string;
    name: string;
    avatar?: string;
  };
  promptCount: number;
  avgScore: number;
  dimensions: DimensionScore[];
  coachingOpportunities: string[];
  recentPrompts: MemberPrompt[];
}

interface DimensionScoreValue {
  score: number;
  reasoning?: string;
}

interface PromptData {
  id: string;
  text: string;
  created_at: string;
  team_id: string;
  project_id: string;
  user_id: string;
  char_count: number;
  word_count: number;
  analysis_status: 'pending' | 'processing' | 'complete' | 'failed';
  prompt_analyses: Array<{
    overall_score: number | null;
    dimension_scores: Record<string, DimensionScoreValue | number> | null;
  }> | null;
}

interface ProfileData {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

export function useMemberAnalytics(memberId: string | null, teamId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['member-analytics', memberId, teamId],
    queryFn: async (): Promise<MemberAnalyticsData | null> => {
      if (!memberId) return null;

      // Fetch member info from profiles
      const { data: member, error: memberError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .eq('id', memberId)
        .single();

      if (memberError) throw memberError;

      // Fetch member's prompts with analyses for this team
      // Exclude pure commands from analytics (Story 5.7)
      const { data: prompts, error: promptsError } = await supabase
        .from('prompts')
        .select(`
          id,
          text,
          created_at,
          team_id,
          project_id,
          user_id,
          char_count,
          word_count,
          analysis_status,
          prompt_analyses(overall_score, dimension_scores)
        `)
        .eq('user_id', memberId)
        .eq('team_id', teamId)
        .eq('analysis_status', 'complete')
        .neq('prompt_type', 'command')
        .order('created_at', { ascending: false })
        .limit(50);

      if (promptsError) throw promptsError;

      const typedPrompts = (prompts as unknown as PromptData[]) || [];
      const typedMember = member as ProfileData;

      // Calculate averages
      const scores = typedPrompts
        .map(p => p.prompt_analyses?.[0]?.overall_score)
        .filter((s): s is number => s !== undefined && s !== null);

      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

      // Calculate dimension averages
      const dimensionTotals: Record<string, { sum: number; count: number }> = {};

      typedPrompts.forEach(p => {
        const dimScores = p.prompt_analyses?.[0]?.dimension_scores;
        if (dimScores && typeof dimScores === 'object') {
          Object.entries(dimScores).forEach(([name, value]) => {
            // Handle both { score: number } format and raw number format
            const score = typeof value === 'object' && value !== null && 'score' in value
              ? value.score
              : typeof value === 'number'
                ? value
                : null;

            if (typeof score === 'number') {
              if (!dimensionTotals[name]) {
                dimensionTotals[name] = { sum: 0, count: 0 };
              }
              dimensionTotals[name].sum += score;
              dimensionTotals[name].count += 1;
            }
          });
        }
      });

      const dimensions: DimensionScore[] = Object.entries(dimensionTotals)
        .map(([name, { sum, count }]) => ({
          name,
          score: sum / count,
          maxScore: 10,
        }))
        .sort((a, b) => a.score - b.score);

      // Generate coaching opportunities
      const coachingOpportunities: string[] = [];
      dimensions.forEach(dim => {
        if (dim.score < 5) {
          coachingOpportunities.push(
            `${dim.name} needs improvement (avg: ${dim.score.toFixed(1)})`
          );
        }
      });

      if (avgScore < 5) {
        coachingOpportunities.unshift('Overall prompt quality could be improved');
      }

      // Format recent prompts for display
      const recentPrompts: MemberPrompt[] = typedPrompts
        .slice(0, 10)
        .filter(p => p.prompt_analyses?.[0]?.overall_score !== null)
        .map(p => ({
          id: p.id,
          text: p.text,
          created_at: p.created_at,
          team_id: p.team_id,
          project_id: p.project_id,
          user_id: p.user_id,
          char_count: p.char_count,
          word_count: p.word_count,
          analysis_status: p.analysis_status,
          analysis: p.prompt_analyses?.[0] && p.prompt_analyses[0].overall_score !== null ? {
            overall_score: p.prompt_analyses[0].overall_score,
            dimension_scores: p.prompt_analyses[0].dimension_scores as Record<string, DimensionScoreValue> | null,
          } : null,
        }));

      return {
        member: {
          id: typedMember.id,
          name: typedMember.name || 'Unknown',
          avatar: typedMember.avatar_url ?? undefined,
        },
        promptCount: typedPrompts.length,
        avgScore,
        dimensions,
        coachingOpportunities,
        recentPrompts,
      };
    },
    enabled: Boolean(memberId) && Boolean(teamId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
