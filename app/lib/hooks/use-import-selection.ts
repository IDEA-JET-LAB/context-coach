'use client';

/**
 * Import Selection Hook - Story 17-2
 *
 * Manages project selection state for historical import.
 * Persists selection in sessionStorage for page refresh resilience.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DiscoveredProject } from '@/lib/import/types';

const STORAGE_KEY = 'contextor-import-selection';

interface ImportSelectionStats {
  projectCount: number;
  sessionCount: number;
  promptCount: number;
}

export function useImportSelection(projects: DiscoveredProject[]) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>(() => {
    // Initialize from session storage if available
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Validate that parsed value is an array of strings
          if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
            return parsed;
          }
        } catch {
          // Fall through to default
        }
      }
    }
    // Default: all projects selected
    return projects.map((p) => p.normalizedPath);
  });

  // Sync with projects if they change (e.g., filter updates)
  useEffect(() => {
    const projectPaths = new Set(projects.map((p) => p.normalizedPath));
    const validSelected = selectedPaths.filter((path) => projectPaths.has(path));

    // If all existing selections are still valid, don't update
    if (validSelected.length !== selectedPaths.length) {
      setSelectedPaths(validSelected);
    }
  }, [projects]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedPaths));
    }
  }, [selectedPaths]);

  /**
   * Calculate stats based on current selection.
   */
  const stats = useMemo<ImportSelectionStats>(() => {
    const selectedSet = new Set(selectedPaths);
    return projects
      .filter((p) => selectedSet.has(p.normalizedPath))
      .reduce(
        (acc, p) => ({
          projectCount: acc.projectCount + 1,
          sessionCount: acc.sessionCount + p.sessionCount,
          promptCount: acc.promptCount + p.totalPrompts,
        }),
        { projectCount: 0, sessionCount: 0, promptCount: 0 }
      );
  }, [projects, selectedPaths]);

  /**
   * Toggle a single project's selection.
   */
  const toggleProject = useCallback((normalizedPath: string) => {
    setSelectedPaths((prev) => {
      if (prev.includes(normalizedPath)) {
        return prev.filter((p) => p !== normalizedPath);
      }
      return [...prev, normalizedPath];
    });
  }, []);

  /**
   * Select all projects.
   */
  const selectAll = useCallback(() => {
    setSelectedPaths(projects.map((p) => p.normalizedPath));
  }, [projects]);

  /**
   * Deselect all projects.
   */
  const deselectAll = useCallback(() => {
    setSelectedPaths([]);
  }, []);

  /**
   * Check if a project is selected.
   */
  const isSelected = useCallback(
    (normalizedPath: string) => selectedPaths.includes(normalizedPath),
    [selectedPaths]
  );

  /**
   * Check if all projects are selected.
   */
  const allSelected = useMemo(
    () => projects.length > 0 && selectedPaths.length === projects.length,
    [projects.length, selectedPaths.length]
  );

  /**
   * Clear session storage (call on import completion or skip).
   */
  const clearStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    selectedPaths,
    setSelectedPaths,
    stats,
    toggleProject,
    selectAll,
    deselectAll,
    isSelected,
    allSelected,
    clearStorage,
  };
}
