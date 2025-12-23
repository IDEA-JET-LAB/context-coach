'use client';

/**
 * Import State Machine Hook - Story 17-2
 *
 * Manages the state machine for the historical import workflow.
 * States: discovery -> selection -> importing -> complete | skipped
 */

import { useState, useCallback } from 'react';
import type { ImportState, DiscoveredProject } from '@/lib/import/types';

export function useImportState() {
  const [state, setState] = useState<ImportState>({ phase: 'discovery' });

  /**
   * Set discovery as complete with discovered projects.
   */
  const setDiscoveryComplete = useCallback((projects: DiscoveredProject[]) => {
    setState({ phase: 'discovery', projects });
  }, []);

  /**
   * Transition to selection phase with selected project paths.
   */
  const startSelection = useCallback((selected: string[]) => {
    setState({ phase: 'selection', selected });
  }, []);

  /**
   * Transition to importing phase with total count.
   */
  const startImporting = useCallback((total: number) => {
    setState({ phase: 'importing', progress: 0, total });
  }, []);

  /**
   * Update import progress.
   */
  const updateProgress = useCallback((progress: number) => {
    setState((prev) => {
      if (prev.phase !== 'importing') return prev;
      return { ...prev, progress };
    });
  }, []);

  /**
   * Complete the import with counts.
   */
  const completeImport = useCallback((imported: number, skipped: number, failed: number) => {
    setState({ phase: 'complete', imported, skipped, failed });
  }, []);

  /**
   * Skip the import process.
   */
  const skip = useCallback(() => {
    setState({ phase: 'skipped' });
  }, []);

  /**
   * Reset to discovery phase.
   */
  const reset = useCallback(() => {
    setState({ phase: 'discovery' });
  }, []);

  return {
    state,
    setDiscoveryComplete,
    startSelection,
    startImporting,
    updateProgress,
    completeImport,
    skip,
    reset,
  };
}
