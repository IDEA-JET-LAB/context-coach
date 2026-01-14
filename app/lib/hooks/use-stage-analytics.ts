/**
 * useStageAnalytics Hook - Story 31-9
 *
 * TanStack Query hook for fetching project stage analytics.
 * Provides loading states, error handling, and cache management.
 */

import { useQuery } from "@tanstack/react-query";
import type { ProjectStageAnalytics, TimeRangeFilter } from "@/lib/types/stage-analytics";

/**
 * Options for the useStageAnalytics hook
 */
export interface UseStageAnalyticsOptions {
  /** Time range filter: '7d', '30d', or 'all' (default: 'all') */
  range?: TimeRangeFilter;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Query key factory for stage analytics
 */
export const stageAnalyticsKeys = {
  all: ["stage-analytics"] as const,
  project: (projectId: string, range?: TimeRangeFilter) =>
    [...stageAnalyticsKeys.all, projectId, range || "all"] as const,
};

/**
 * Hook to fetch project stage analytics
 *
 * @param projectId - The project ID to fetch analytics for
 * @param options - Query options
 * @returns TanStack Query result with stage analytics data
 *
 * @example
 * const { data, isPending, error, refetch } = useStageAnalytics(projectId, {
 *   range: '30d',
 * });
 */
export function useStageAnalytics(
  projectId: string,
  options: UseStageAnalyticsOptions = {}
) {
  const { range = "all", enabled = true } = options;

  return useQuery<ProjectStageAnalytics>({
    queryKey: stageAnalyticsKeys.project(projectId, range),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (range && range !== "all") {
        searchParams.set("range", range);
      }

      const queryString = searchParams.toString();
      const url = queryString
        ? `/api/projects/${projectId}/stage-analytics?${queryString}`
        : `/api/projects/${projectId}/stage-analytics`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to fetch stage analytics: ${response.status}`
        );
      }

      const json = await response.json();
      return json.data;
    },
    enabled: enabled && !!projectId,
    staleTime: 60_000, // 1 minute
  });
}
