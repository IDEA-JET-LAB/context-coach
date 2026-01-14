/**
 * Hook for managing the globally selected project via URL
 *
 * Stores the selected project ID in the URL query param `project`
 * so it persists across page navigations.
 *
 * Also detects project ID from URL path when on /projects/[projectId]/* routes.
 */

'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export interface UseSelectedProjectReturn {
  /** Currently selected project ID, or null for "all projects" */
  projectId: string | null;
  /** Set the selected project (updates URL) */
  setProjectId: (projectId: string | null) => void;
  /** Whether a specific project is selected */
  hasProject: boolean;
}

// Regex to extract project ID from /projects/[projectId] paths
const PROJECT_PATH_REGEX = /^\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * Hook to manage globally selected project via URL query param
 *
 * @example
 * const { projectId, setProjectId, hasProject } = useSelectedProject();
 *
 * // Check if project selected
 * if (hasProject) {
 *   // Show project-specific features
 * }
 *
 * // Change selection
 * setProjectId('project-uuid'); // Select project
 * setProjectId(null);           // Clear selection (all projects)
 */
export function useSelectedProject(): UseSelectedProjectReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get project ID from query param or from URL path (for /projects/[projectId]/* routes)
  const projectId = useMemo((): string | null => {
    // Query param takes precedence
    const queryProjectId = searchParams.get('project');
    if (queryProjectId) {
      return queryProjectId;
    }

    // Check if we're on a /projects/[projectId] path
    const match = pathname.match(PROJECT_PATH_REGEX);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }, [searchParams, pathname]);

  const setProjectId = useCallback(
    (newProjectId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newProjectId) {
        params.set('project', newProjectId);
      } else {
        params.delete('project');
      }

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  return {
    projectId,
    setProjectId,
    hasProject: !!projectId,
  };
}
