'use client';

/**
 * useConversationStats Hook - Story 30-6: Analysis Panel UI
 *
 * TanStack Query hook for fetching conversation statistics from the API.
 * Provides loading states, error handling, and cache management.
 */

import { useQuery } from '@tanstack/react-query';
import type { ConversationStats } from '@/lib/analysis/conversation-stats';

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for conversation stats
 * Enables targeted invalidation and type-safe keys
 */
export const conversationStatsKeys = {
  all: ['conversation-stats'] as const,
  detail: (sessionId: string) =>
    [...conversationStatsKeys.all, sessionId] as const,
};

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useConversationStats hook
 */
export interface UseConversationStatsOptions {
  enabled?: boolean;
}

/**
 * API response shape for conversation stats
 */
export interface ConversationStatsResponse {
  data: ConversationStats;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to fetch conversation statistics
 *
 * @param sessionId - The session database UUID
 * @param options - Query options
 * @returns TanStack Query result with conversation stats data
 *
 * @example
 * const { data, isPending, error, refetch } = useConversationStats(sessionId);
 *
 * if (isPending) return <Skeleton />;
 * if (error) return <Error onRetry={refetch} />;
 *
 * return <StatsDisplay stats={data} />;
 */
export function useConversationStats(
  sessionId: string,
  options: UseConversationStatsOptions = {}
) {
  const { enabled = true } = options;

  return useQuery<ConversationStats>({
    queryKey: conversationStatsKeys.detail(sessionId),
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${sessionId}/stats`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to fetch stats: ${response.status}`
        );
      }

      const json: ConversationStatsResponse = await response.json();
      return json.data;
    },
    enabled: enabled && !!sessionId,
    staleTime: 60_000, // 1 minute - stats don't change frequently
  });
}
