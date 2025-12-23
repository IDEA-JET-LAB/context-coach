'use client';

import { useQuery } from '@tanstack/react-query';
import { TeamIntelligenceResponse, AnalyticsTimeRange } from '@/lib/types/team-intelligence';

interface TeamIntelligenceAPIResponse {
  data: TeamIntelligenceResponse & {
    meta: {
      teamId: string;
      teamName: string;
      timeRange: AnalyticsTimeRange;
      isAdmin: boolean;
      generatedAt: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Hook to fetch team intelligence analytics
 *
 * @param teamId - The team ID to fetch analytics for
 * @param timeRange - Time range for analytics (7d, 30d, 90d)
 */
export function useTeamIntelligence(
  teamId: string | undefined,
  timeRange: AnalyticsTimeRange = '30d'
) {
  return useQuery({
    queryKey: ['team-intelligence', teamId, timeRange],
    queryFn: async (): Promise<TeamIntelligenceAPIResponse['data']> => {
      const response = await fetch(
        `/api/analytics/team/${teamId}/intelligence?timeRange=${timeRange}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch team intelligence');
      }

      const data: TeamIntelligenceAPIResponse = await response.json();
      return data.data;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes (matches API cache)
    gcTime: 60 * 60 * 1000, // 1 hour
    enabled: Boolean(teamId),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
