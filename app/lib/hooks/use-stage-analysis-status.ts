/**
 * Hook for Stage Analysis Status - Story 31-6
 *
 * Fetches and caches the stage analysis status for a project.
 */

import { useQuery } from "@tanstack/react-query";

/**
 * Stage analysis status for a project.
 */
export interface StageAnalysisStatus {
  /** Total sessions in the project */
  totalSessions: number;
  /** Number of sessions with completed analysis */
  completedSessions: number;
  /** Number of sessions pending analysis */
  pendingSessions: number;
  /** Sessions currently processing */
  processingSessions: number;
  /** Sessions with analysis errors */
  errorSessions: number;
  /** Whether all sessions have been analyzed */
  isComplete: boolean;
  /** When the most recent analysis completed */
  lastAnalyzedAt: string | null;
}

/**
 * Fetches stage analysis status for a project.
 *
 * @param projectId - Project ID to get status for
 * @returns Query result with status data
 *
 * @example
 * const { data: status, isPending } = useStageAnalysisStatus(projectId);
 * if (status?.pendingSessions > 0) {
 *   // Show "Analyze" button
 * }
 */
export function useStageAnalysisStatus(projectId: string | null) {
  return useQuery<StageAnalysisStatus>({
    queryKey: ["stage-analysis-status", projectId],
    queryFn: async () => {
      if (!projectId) {
        throw new Error("Project ID required");
      }

      const response = await fetch(`/api/projects/${projectId}/analyze-stages`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || "Failed to fetch status");
      }

      const json = await response.json();
      return json.data as StageAnalysisStatus;
    },
    enabled: !!projectId,
    staleTime: 60_000, // 1 minute
    refetchOnWindowFocus: false,
  });
}
