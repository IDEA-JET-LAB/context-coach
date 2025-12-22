'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Prompt } from '@/lib/types/prompt';
import type { PromptAnalysis } from '@/lib/types/analysis';

/**
 * Full prompt with complete analysis data (for detail view)
 */
export interface PromptWithFullAnalysis extends Prompt {
  analysis: PromptAnalysis | null;
  project?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    email: string;
    display_name?: string;
  };
}

export function usePrompt(promptId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['prompt', promptId],
    queryFn: async (): Promise<PromptWithFullAnalysis | null> => {
      if (!promptId) return null;

      const { data, error } = await supabase
        .from('prompts')
        .select(
          `
          *,
          analysis:prompt_analyses(*),
          project:projects(id, name)
        `
        )
        .eq('id', promptId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw error;
      }

      // Transform the data to match PromptWithFullAnalysis type
      return {
        ...data,
        analysis: Array.isArray(data.analysis)
          ? data.analysis[0] ?? null
          : data.analysis,
        project: data.project,
      } as PromptWithFullAnalysis;
    },
    enabled: !!promptId,
    staleTime: 60 * 1000, // 1 minute
  });
}
