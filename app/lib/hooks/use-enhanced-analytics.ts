/**
 * React Query hook for enhanced personal analytics (Story 21-11)
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type { InsightsResponse, InsightsTimeRange } from '@/lib/types/insights';

const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
};

async function fetchInsights(
  timeRange: InsightsTimeRange,
  teamId?: string
): Promise<InsightsResponse> {
  const params = new URLSearchParams({ timeRange });
  if (teamId) {
    params.set('teamId', teamId);
  }

  const response = await fetch(`/api/analytics/insights?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch insights');
  }

  return response.json();
}

/**
 * Hook to fetch enhanced personal analytics with React Query caching
 */
export function useEnhancedPersonalAnalytics(
  timeRange: InsightsTimeRange = '7d',
  teamId?: string
) {
  return useQuery<InsightsResponse, Error>({
    queryKey: ['analytics', 'insights', timeRange, teamId],
    queryFn: () => fetchInsights(timeRange, teamId),
    staleTime: CACHE_CONFIG.staleTime,
    gcTime: CACHE_CONFIG.gcTime,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook to prefetch insights data (useful for time range changes)
 */
export function usePrefetchInsights() {
  // This would use queryClient.prefetchQuery if needed
  return null;
}

export type { InsightsResponse, InsightsTimeRange };
