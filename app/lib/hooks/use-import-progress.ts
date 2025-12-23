'use client';

/**
 * Import Progress Hook - Story 17-5
 *
 * Manages the progress state for historical import with:
 * - Session storage persistence for page refresh resilience
 * - Time estimation based on rolling average of batch timings
 * - Cancellation token pattern
 * - Error tracking
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  ImportProgressState,
  ImportError,
  CancellationToken,
  BatchTimingInfo,
  ImportSummary,
} from '@/lib/import/types';

const STORAGE_KEY = 'contextor-import-progress';
const MIN_BATCHES_FOR_ESTIMATE = 3;
const MAX_BATCHES_FOR_ROLLING_AVG = 10;

/**
 * Initial state for import progress.
 */
const initialState: ImportProgressState = {
  currentProject: '',
  projectIndex: 0,
  totalProjects: 0,
  progress: 0,
  total: 0,
  imported: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  estimatedTimeRemaining: null,
  startedAt: Date.now(),
  cancelling: false,
  status: 'idle',
};

/**
 * Calculate estimated time remaining based on batch timings.
 */
function calculateEstimatedTime(
  batches: BatchTimingInfo[],
  remaining: number
): number | null {
  if (batches.length < MIN_BATCHES_FOR_ESTIMATE || remaining <= 0) {
    return null;
  }

  // Use recent batches for rolling average
  const recent = batches.slice(-MAX_BATCHES_FOR_ROLLING_AVG);
  const totalCount = recent.reduce((sum, b) => sum + b.count, 0);
  const totalDuration = recent.reduce((sum, b) => sum + b.durationMs, 0);

  if (totalDuration === 0 || totalCount === 0) {
    return null;
  }

  const ratePerMs = totalCount / totalDuration; // items per millisecond
  const estimatedMs = remaining / ratePerMs;
  return Math.ceil(estimatedMs / 1000); // Convert to seconds
}

/**
 * Format seconds into human-readable estimate.
 */
export function formatEstimate(seconds: number | null): string {
  if (seconds === null) return 'Calculating...';
  if (seconds < 60) return 'Less than a minute';
  if (seconds < 120) return 'About a minute';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `About ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `About ${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `About ${hours}h ${remainingMinutes}m`;
}

/**
 * Format duration in seconds to human-readable string.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hour${hours !== 1 ? 's' : ''}`;
}

export interface UseImportProgressReturn {
  /** Current progress state */
  state: ImportProgressState;
  /** Batch timing history for estimation */
  batchTimings: BatchTimingInfo[];
  /** Update progress with partial state */
  updateProgress: (updates: Partial<ImportProgressState>) => void;
  /** Add an error to the error list */
  addError: (error: Omit<ImportError, 'timestamp'>) => void;
  /** Record a batch completion for time estimation */
  recordBatch: (count: number, durationMs: number) => void;
  /** Start a new import */
  startImport: (totalProjects: number, totalPrompts: number) => void;
  /** Request cancellation */
  requestCancel: () => void;
  /** Complete the import */
  completeImport: (cancelled?: boolean) => void;
  /** Clear all progress data */
  clearProgress: () => void;
  /** Cancellation token for checking cancel state */
  cancellationToken: CancellationToken;
  /** Get summary of completed import */
  getSummary: () => ImportSummary;
  /** Whether there's an active import that can be resumed */
  hasActiveImport: boolean;
}

export function useImportProgress(): UseImportProgressReturn {
  // Initialize state from session storage if available
  const [state, setState] = useState<ImportProgressState>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Validate it's a proper progress state
          if (parsed && typeof parsed.status === 'string') {
            return parsed;
          }
        } catch {
          // Fall through to default
        }
      }
    }
    return initialState;
  });

  // Batch timing history for estimation (not persisted)
  const [batchTimings, setBatchTimings] = useState<BatchTimingInfo[]>([]);

  // Cancellation token ref (mutable to allow checking during async operations)
  const cancellationTokenRef = useRef<CancellationToken>({
    cancelled: false,
    cancel: () => {
      cancellationTokenRef.current.cancelled = true;
    },
  });

  // Persist state to session storage on changes
  useEffect(() => {
    if (typeof window !== 'undefined' && state.status !== 'idle') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  // Update progress with partial state
  const updateProgress = useCallback((updates: Partial<ImportProgressState>) => {
    setState((prev) => {
      const newState = { ...prev, ...updates };

      // Recalculate estimated time if progress changed
      if ('progress' in updates && newState.total > 0) {
        const remaining = newState.total - newState.progress;
        // Time estimation is handled separately via recordBatch
      }

      return newState;
    });
  }, []);

  // Record a batch completion for time estimation
  const recordBatch = useCallback((count: number, durationMs: number) => {
    setBatchTimings((prev) => {
      const updated = [...prev, { count, durationMs }];
      // Keep only recent batches
      if (updated.length > MAX_BATCHES_FOR_ROLLING_AVG * 2) {
        return updated.slice(-MAX_BATCHES_FOR_ROLLING_AVG * 2);
      }
      return updated;
    });

    // Update estimated time in state
    setState((prev) => {
      const remaining = prev.total - prev.progress;
      const allBatches = [...batchTimings, { count, durationMs }];
      const estimated = calculateEstimatedTime(allBatches, remaining);
      return { ...prev, estimatedTimeRemaining: estimated };
    });
  }, [batchTimings]);

  // Add an error
  const addError = useCallback((error: Omit<ImportError, 'timestamp'>) => {
    setState((prev) => ({
      ...prev,
      errors: [...prev.errors, { ...error, timestamp: Date.now() }],
    }));
  }, []);

  // Start a new import
  const startImport = useCallback((totalProjects: number, totalPrompts: number) => {
    // Reset cancellation token
    cancellationTokenRef.current = {
      cancelled: false,
      cancel: () => {
        cancellationTokenRef.current.cancelled = true;
      },
    };

    // Clear batch timings
    setBatchTimings([]);

    // Set initial state
    setState({
      ...initialState,
      totalProjects,
      total: totalPrompts,
      startedAt: Date.now(),
      status: 'running',
    });
  }, []);

  // Request cancellation
  const requestCancel = useCallback(() => {
    cancellationTokenRef.current.cancel();
    setState((prev) => ({ ...prev, cancelling: true }));
  }, []);

  // Complete the import
  const completeImport = useCallback((cancelled = false) => {
    setState((prev) => ({
      ...prev,
      status: cancelled ? 'cancelled' : 'complete',
      cancelling: false,
      estimatedTimeRemaining: null,
    }));
  }, []);

  // Clear progress data
  const clearProgress = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setBatchTimings([]);
    cancellationTokenRef.current = {
      cancelled: false,
      cancel: () => {
        cancellationTokenRef.current.cancelled = true;
      },
    };
    setState(initialState);
  }, []);

  // Get summary of completed import
  const getSummary = useCallback((): ImportSummary => {
    const durationSeconds = Math.round((Date.now() - state.startedAt) / 1000);
    return {
      imported: state.imported,
      skipped: state.skipped,
      failed: state.failed,
      projectsProcessed: state.projectIndex + 1,
      durationSeconds,
      errors: state.errors,
      cancelled: state.status === 'cancelled',
    };
  }, [state]);

  // Check if there's an active import that can be resumed
  const hasActiveImport = useMemo(() => {
    return state.status === 'running' || state.status === 'paused';
  }, [state.status]);

  return {
    state,
    batchTimings,
    updateProgress,
    addError,
    recordBatch,
    startImport,
    requestCancel,
    completeImport,
    clearProgress,
    cancellationToken: cancellationTokenRef.current,
    getSummary,
    hasActiveImport,
  };
}
