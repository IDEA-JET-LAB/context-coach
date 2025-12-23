'use client';

/**
 * Import Progress Tracker Component - Story 17-5
 *
 * Real-time progress tracking UI for historical import with:
 * - Animated progress bar with percentage
 * - Current project display
 * - Running stats (imported, skipped, failed)
 * - Estimated time remaining
 * - Cancel functionality
 *
 * Uses semantic design tokens exclusively.
 */

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Loader2,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  FolderOpen,
  MessageSquare,
  Ban,
} from 'lucide-react';
import { ImportErrors } from './import-errors';
import { formatEstimate } from '@/lib/hooks/use-import-progress';
import type { ImportProgressState } from '@/lib/import/types';

export interface ImportProgressTrackerProps {
  /** Progress state from useImportProgress hook */
  state: ImportProgressState;
  /** Handler for cancel button */
  onCancel: () => void;
  /** Additional class names */
  className?: string;
}

export function ImportProgressTracker({
  state,
  onCancel,
  className,
}: ImportProgressTrackerProps) {
  const percentage =
    state.total > 0 ? Math.round((state.progress / state.total) * 100) : 0;

  const isCancelled = state.status === 'cancelled';
  const isComplete = state.status === 'complete';
  const isRunning = state.status === 'running';

  return (
    <Card className={cn('max-w-lg mx-auto', className)} data-testid="import-progress-tracker">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-2 text-lg">
          {isRunning && !state.cancelling && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Importing Your History
            </>
          )}
          {state.cancelling && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-score-medium" />
              Cancelling...
            </>
          )}
          {isComplete && (
            <>
              <CheckCircle className="h-5 w-5 text-score-high" />
              Import Complete
            </>
          )}
          {isCancelled && (
            <>
              <Ban className="h-5 w-5 text-score-medium" />
              Import Cancelled
            </>
          )}
        </CardTitle>
        {state.currentProject && isRunning && (
          <CardDescription className="flex items-center justify-center gap-2 mt-2">
            <FolderOpen className="h-4 w-4" />
            <span className="truncate max-w-[300px]">{state.currentProject}</span>
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={percentage} className="h-3" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{percentage}% complete</span>
            {state.estimatedTimeRemaining !== null && isRunning && !state.cancelling && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatEstimate(state.estimatedTimeRemaining)} remaining
              </span>
            )}
          </div>
        </div>

        {/* Running Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div
            className="p-3 rounded-lg bg-score-high/10 border border-score-high/20"
            data-testid="stat-imported"
          >
            <p className="text-2xl font-bold text-score-high">
              {state.imported.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Imported</p>
          </div>
          <div
            className="p-3 rounded-lg bg-score-medium/10 border border-score-medium/20"
            data-testid="stat-skipped"
          >
            <p className="text-2xl font-bold text-score-medium">
              {state.skipped.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Duplicates</p>
          </div>
          <div
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20"
            data-testid="stat-failed"
          >
            <p className="text-2xl font-bold text-destructive">
              {state.failed.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* Project Progress */}
        {state.totalProjects > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span>
              Project {state.projectIndex + 1} of {state.totalProjects}
            </span>
          </div>
        )}

        {/* Prompt Progress */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>
            {state.progress.toLocaleString()} of {state.total.toLocaleString()} prompts
          </span>
        </div>

        {/* Inline Errors */}
        {state.errors.length > 0 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                {state.errors.length} error{state.errors.length !== 1 ? 's' : ''} encountered
              </span>
            </div>
          </div>
        )}

        {/* Cancel Button */}
        {isRunning && (
          <Button
            variant="outline"
            className="w-full"
            onClick={onCancel}
            disabled={state.cancelling}
            data-testid="cancel-import-button"
          >
            {state.cancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stopping after current batch...
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Cancel Import
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact progress indicator for use in headers/sidebars.
 */
export interface CompactProgressIndicatorProps {
  /** Progress state */
  state: ImportProgressState;
  /** Additional class names */
  className?: string;
}

export function CompactProgressIndicator({
  state,
  className,
}: CompactProgressIndicatorProps) {
  const percentage =
    state.total > 0 ? Math.round((state.progress / state.total) * 100) : 0;

  const isRunning = state.status === 'running' && !state.cancelling;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg bg-surface border border-border',
        className
      )}
      data-testid="compact-progress-indicator"
    >
      {isRunning ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
      ) : state.cancelling ? (
        <Loader2 className="h-4 w-4 animate-spin text-score-medium shrink-0" />
      ) : (
        <CheckCircle className="h-4 w-4 text-score-high shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-foreground truncate">
            {state.cancelling
              ? 'Cancelling...'
              : isRunning
                ? 'Importing history'
                : 'Import complete'}
          </span>
          <span className="text-xs text-muted-foreground">{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-1.5" />
      </div>
    </div>
  );
}
