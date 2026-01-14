"use client";

/**
 * useConversationAnalysis Hooks - Story 30-7: Interactive Chat Interface
 *
 * TanStack Query hooks for fetching conversation content and past analyses.
 * Provides loading states, error handling, and cache management.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationAnalysis } from "@/lib/types/conversation-analysis";
import type { ExtractedContent, ExtractionOptions } from "@/lib/analysis/content-extractor";

// ============================================================================
// Types
// ============================================================================

/**
 * API response shape for past analyses
 */
export interface PastAnalysesResponse {
  data: ConversationAnalysis[];
}

/**
 * Content for token estimation (raw content arrays)
 */
export interface ConversationContentResponse {
  data: {
    prompts: string[];
    responses: string[];
    thinking: string[];
    tools: Array<{ name: string; inputSummary: string }>;
  };
}

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for conversation analysis
 */
export const analysisKeys = {
  all: ["conversation-analysis"] as const,
  pastAnalyses: () => [...analysisKeys.all, "past"] as const,
  pastAnalysesForSession: (sessionId: string) =>
    [...analysisKeys.pastAnalyses(), sessionId] as const,
  content: () => [...analysisKeys.all, "content"] as const,
  contentForSession: (sessionId: string) =>
    [...analysisKeys.content(), sessionId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch past analyses for a session
 *
 * @param sessionId - The session ID (UUID)
 * @param options - Query options
 * @returns TanStack Query result with past analyses
 *
 * @example
 * const { data, isPending, error } = usePastAnalyses(sessionId);
 * if (data) {
 *   console.log(`Found ${data.data.length} past analyses`);
 * }
 */
export function usePastAnalyses(
  sessionId: string,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery<PastAnalysesResponse>({
    queryKey: analysisKeys.pastAnalysesForSession(sessionId),
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${sessionId}/analyze`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ||
            `Failed to fetch past analyses: ${response.status}`
        );
      }

      return response.json();
    },
    enabled: enabled && !!sessionId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch raw conversation content for token estimation
 *
 * Uses the /api/conversations/[sessionId]/stats endpoint to get content
 * that can be used for token estimation before making an analysis request.
 *
 * @param sessionId - The session ID (UUID)
 * @param options - Query options
 * @returns TanStack Query result with conversation content
 *
 * @example
 * const { data, isPending } = useConversationContent(sessionId);
 * if (data) {
 *   const estimate = estimateConversationTokens(data.data);
 *   console.log(`Estimated ${estimate.total} tokens`);
 * }
 */
export function useConversationContent(
  sessionId: string,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery<ConversationContentResponse>({
    queryKey: analysisKeys.contentForSession(sessionId),
    queryFn: async () => {
      // Fetch conversation with all content to estimate tokens
      const response = await fetch(
        `/api/conversations/${sessionId}?include_responses=true&include_tools=true`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ||
            `Failed to fetch conversation content: ${response.status}`
        );
      }

      const data = await response.json();
      const messages = data.data?.messages || [];

      // Extract raw content arrays for token estimation
      const prompts: string[] = [];
      const responses: string[] = [];
      const thinking: string[] = [];
      const tools: Array<{ name: string; inputSummary: string }> = [];

      for (const message of messages) {
        if (message.role === "user") {
          prompts.push(message.content || "");
        } else if (message.role === "assistant") {
          responses.push(message.content || "");

          if (message.thinkingSummary) {
            thinking.push(message.thinkingSummary);
          }

          if (message.toolsUsed && Array.isArray(message.toolsUsed)) {
            for (const toolName of message.toolsUsed) {
              tools.push({ name: toolName, inputSummary: "" });
            }
          }
        }
      }

      return {
        data: {
          prompts,
          responses,
          thinking,
          tools,
        },
      };
    },
    enabled: enabled && !!sessionId,
    staleTime: 5 * 60 * 1000, // 5 minutes (content doesn't change often)
  });
}

/**
 * Hook to invalidate past analyses cache
 *
 * Call this after a new analysis is completed to refresh the list.
 *
 * @returns Function to invalidate the cache for a session
 *
 * @example
 * const invalidateAnalyses = useInvalidatePastAnalyses();
 * // After analysis completes:
 * invalidateAnalyses(sessionId);
 */
export function useInvalidatePastAnalyses() {
  const queryClient = useQueryClient();

  return (sessionId: string) => {
    queryClient.invalidateQueries({
      queryKey: analysisKeys.pastAnalysesForSession(sessionId),
    });
  };
}
