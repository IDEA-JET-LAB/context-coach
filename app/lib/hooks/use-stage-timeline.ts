/**
 * Hook for Stage Timeline Data - Story 31-8
 *
 * Fetches and caches timeline data for stage analytics visualization.
 */

import { useQuery } from "@tanstack/react-query";
import type {
  StageTimelineData,
  TimeRangeFilter,
  TimelineGranularity,
} from "@/lib/types/stage-analytics";

/**
 * Query key factory for stage timeline data.
 * Used for cache management and invalidation.
 */
export const stageTimelineKeys = {
  /** Base key for all stage timeline queries */
  all: ["stage-timeline"] as const,
  /** Key for a specific project's timeline */
  project: (projectId: string) => [...stageTimelineKeys.all, projectId] as const,
  /** Key for a specific project's timeline with filters */
  filtered: (projectId: string, range: TimeRangeFilter, granularity: TimelineGranularity) =>
    [...stageTimelineKeys.project(projectId), range, granularity] as const,
};

/**
 * Fetches stage timeline data for a project.
 *
 * @param projectId - Project ID to get timeline data for
 * @param range - Time range filter: "7d" | "30d" | "all"
 * @param granularity - Data granularity: "day" | "week"
 * @returns Query result with timeline data
 *
 * @example
 * const { data, isPending, isError } = useStageTimelineData(projectId, "30d", "day");
 * if (data?.dataPoints) {
 *   // Render chart with data.dataPoints
 * }
 */
export function useStageTimelineData(
  projectId: string,
  range: TimeRangeFilter,
  granularity: TimelineGranularity
) {
  return useQuery<StageTimelineData>({
    queryKey: stageTimelineKeys.filtered(projectId, range, granularity),
    queryFn: async () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      const params = new URLSearchParams({
        range,
        granularity,
      });

      const response = await fetch(
        `/api/projects/${projectId}/stage-analytics/timeline?${params.toString()}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || "Failed to fetch timeline data");
      }

      const json = await response.json();
      return json.data as StageTimelineData;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
