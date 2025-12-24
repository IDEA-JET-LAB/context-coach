'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Prompt } from '@/lib/types/prompt';
import type { PromptAnalysis } from '@/lib/types/analysis';

/**
 * Tool execution data (from tool_executions table)
 */
export interface ToolExecution {
  id: string;
  tool_name: string;
  tool_id?: string;
  input_summary: string;
  input_full?: Record<string, unknown>;
  output_summary?: string;
  result_matched: boolean;
  success?: boolean;
  execution_order: number;
  created_at: string;
}

/**
 * Response data with decrypted text (from prompt_responses table)
 */
export interface PromptResponse {
  id: string;
  prompt_id: string;
  response_text?: string;
  tool_count: number;
  tools_used: string[];
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  has_thinking: boolean;
  created_at: string;
  tool_executions?: ToolExecution[];
}

/**
 * Full prompt with complete analysis data (for detail view)
 */
export interface PromptWithFullAnalysis extends Prompt {
  analysis: PromptAnalysis | null;
  response?: PromptResponse | null;
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

      // Fetch prompt with analysis and project
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

      // Fetch response with decrypted text
      let response: PromptResponse | null = null;
      try {
        const { data: responseData, error: responseError } = await supabase
          .rpc('get_decrypted_response_by_prompt', { p_prompt_id: promptId });

        if (!responseError && responseData && responseData.length > 0) {
          const r = responseData[0];
          response = {
            id: r.id,
            prompt_id: r.prompt_id,
            response_text: r.response_text || undefined,
            tool_count: r.tool_count || 0,
            tools_used: r.tools_used || [],
            model: r.model || undefined,
            tokens_in: r.tokens_in || undefined,
            tokens_out: r.tokens_out || undefined,
            has_thinking: r.has_thinking || false,
            created_at: r.created_at,
          };

          // Fetch tool executions if there are tools used
          if (response.tool_count > 0) {
            const { data: toolData } = await supabase
              .from('tool_executions')
              .select('*')
              .eq('response_id', response.id)
              .order('execution_order', { ascending: true });

            if (toolData && toolData.length > 0) {
              response.tool_executions = toolData.map((t) => ({
                id: t.id,
                tool_name: t.tool_name,
                tool_id: t.tool_id || undefined,
                input_summary: t.input_summary,
                input_full: t.input_full || undefined,
                output_summary: t.output_summary || undefined,
                result_matched: t.result_matched || false,
                success: t.success ?? undefined,
                execution_order: t.execution_order,
                created_at: t.created_at,
              }));
            }
          }
        }
      } catch (err) {
        // Response fetch is optional - don't fail if it errors
        console.warn('Failed to fetch response data:', err);
      }

      // Transform the data to match PromptWithFullAnalysis type
      return {
        ...data,
        analysis: Array.isArray(data.analysis)
          ? data.analysis[0] ?? null
          : data.analysis,
        project: data.project,
        response,
      } as PromptWithFullAnalysis;
    },
    enabled: !!promptId,
    staleTime: 60 * 1000, // 1 minute
  });
}
