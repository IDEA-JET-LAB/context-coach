/**
 * Project Import Orchestrator - Story 17-3: Batch Import Processing
 *
 * Coordinates the import of multiple projects, continuing when individual
 * projects fail and aggregating results across all projects.
 *
 * Key functions:
 * - importProjects: Main entry point for multi-project import
 */

import { importProject, BatchUploadConfig } from './batch';
import type {
  DiscoveredProject,
  ImportResult,
  OrchestratorProgress,
  OrchestratorResult,
} from './types';

/**
 * Import multiple projects concurrently (with error isolation).
 *
 * Processes each project sequentially to avoid overwhelming the server.
 * Continues to the next project when one fails.
 *
 * @param projects - Array of discovered projects to import
 * @param config - Batch upload configuration
 * @param onProgress - Progress callback for UI updates
 * @returns Aggregated result across all projects
 *
 * @example
 * ```ts
 * const result = await importProjects(discoveredProjects, config, (progress) => {
 *   console.log(`Importing ${progress.currentProject}`);
 *   console.log(`Progress: ${progress.projectIndex + 1}/${progress.totalProjects}`);
 * });
 *
 * console.log(`Total imported: ${result.totalImported}`);
 * console.log(`Total skipped: ${result.totalSkipped}`);
 * console.log(`Total failed: ${result.totalFailed}`);
 * ```
 */
export async function importProjects(
  projects: DiscoveredProject[],
  config: Omit<BatchUploadConfig, 'projectPath'>,
  onProgress: (progress: OrchestratorProgress) => void
): Promise<OrchestratorResult> {
  const projectResults = new Map<string, ImportResult>();
  let totalImported = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i]!;

    try {
      // Report start of project
      onProgress({
        currentProject: project.path,
        projectIndex: i,
        totalProjects: projects.length,
        sessionProgress: 0,
        totalSessions: project.sessionCount,
      });

      // Import the project
      const result = await importProject(
        project.normalizedPath,
        { ...config, projectPath: project.path },
        (sessionProgress, totalSessions) => {
          onProgress({
            currentProject: project.path,
            projectIndex: i,
            totalProjects: projects.length,
            sessionProgress,
            totalSessions,
          });
        }
      );

      // Record results
      projectResults.set(project.normalizedPath, result);
      totalImported += result.success;
      totalFailed += result.failed;
      totalSkipped += result.skipped;

      console.log(
        `[import/orchestrator] Completed project ${project.path}: ` +
          `imported=${result.success}, skipped=${result.skipped}, failed=${result.failed}`
      );
    } catch (error) {
      const err = error as Error;
      console.error(
        `[import/orchestrator] Failed to import project ${project.path}:`,
        err.message
      );

      // Mark entire project as failed
      projectResults.set(project.normalizedPath, {
        success: 0,
        failed: project.totalPrompts,
        skipped: 0,
        failedSessions: [],
      });
      totalFailed += project.totalPrompts;
    }

    // Report completion of project
    onProgress({
      currentProject: project.path,
      projectIndex: i + 1,
      totalProjects: projects.length,
      sessionProgress: project.sessionCount,
      totalSessions: project.sessionCount,
    });
  }

  return {
    totalImported,
    totalFailed,
    totalSkipped,
    projectResults,
  };
}

/**
 * Create an import ID for tracking.
 *
 * Format: import-{timestamp}-{random}
 *
 * @returns Unique import ID
 */
export function createImportId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `import-${timestamp}-${random}`;
}

/**
 * Calculate estimated time remaining based on current progress.
 *
 * @param startTime - When the import started (timestamp)
 * @param processed - Number of items processed
 * @param total - Total number of items
 * @returns Estimated seconds remaining, or null if not enough data
 */
export function estimateTimeRemaining(
  startTime: number,
  processed: number,
  total: number
): number | null {
  if (processed === 0) return null;

  const elapsed = Date.now() - startTime;
  const rate = processed / elapsed; // items per ms
  const remaining = total - processed;

  if (rate === 0) return null;

  return Math.ceil(remaining / rate / 1000); // Convert to seconds
}
