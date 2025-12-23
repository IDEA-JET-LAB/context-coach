'use client';

/**
 * Import Complete Component - Story 17-5
 *
 * Displays final summary after import completion with:
 * - Total stats (imported, skipped, failed)
 * - Duration
 * - Expandable error details
 * - Action buttons
 *
 * Uses semantic design tokens exclusively.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
  Ban,
  Clock,
  FolderOpen,
} from 'lucide-react';
import { formatDuration } from '@/lib/hooks/use-import-progress';
import type { ImportSummary, ImportError } from '@/lib/import/types';

export interface ImportCompleteProps {
  /** Summary of the completed import */
  summary: ImportSummary;
  /** Handler to view prompts */
  onViewPrompts: () => void;
  /** Handler to close the modal/view */
  onClose: () => void;
  /** Additional class names */
  className?: string;
}

export function ImportComplete({
  summary,
  onViewPrompts,
  onClose,
  className,
}: ImportCompleteProps) {
  const [showErrors, setShowErrors] = useState(false);

  const hasErrors = summary.failed > 0 || summary.errors.length > 0;
  const wasSuccessful = !hasErrors && !summary.cancelled;
  const wasCancelled = summary.cancelled;

  // Determine which icon/color to use
  const StatusIcon = wasCancelled
    ? Ban
    : hasErrors
      ? AlertTriangle
      : CheckCircle;

  const statusColor = wasCancelled
    ? 'text-score-medium'
    : hasErrors
      ? 'text-score-medium'
      : 'text-score-high';

  const statusBgColor = wasCancelled
    ? 'bg-score-medium/10'
    : hasErrors
      ? 'bg-score-medium/10'
      : 'bg-score-high/10';

  const title = wasCancelled
    ? 'Import Cancelled'
    : hasErrors
      ? 'Import Completed with Errors'
      : 'Import Complete!';

  return (
    <Card
      className={cn('max-w-lg mx-auto', className)}
      data-testid="import-complete"
    >
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-4">
          <div
            className={cn(
              'h-16 w-16 rounded-full flex items-center justify-center',
              statusBgColor
            )}
          >
            <StatusIcon className={cn('h-8 w-8', statusColor)} />
          </div>
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="flex items-center justify-center gap-2 mt-2">
          <Clock className="h-4 w-4" />
          Completed in {formatDuration(summary.durationSeconds)}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div
            className="p-4 rounded-lg bg-score-high/10 border border-score-high/20"
            data-testid="summary-imported"
          >
            <p className="text-3xl font-bold text-score-high">
              {summary.imported.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Imported</p>
          </div>
          <div
            className="p-4 rounded-lg bg-score-medium/10 border border-score-medium/20"
            data-testid="summary-skipped"
          >
            <p className="text-3xl font-bold text-score-medium">
              {summary.skipped.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Duplicates</p>
          </div>
          <div
            className="p-4 rounded-lg bg-destructive/10 border border-destructive/20"
            data-testid="summary-failed"
          >
            <p className="text-3xl font-bold text-destructive">
              {summary.failed.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Failed</p>
          </div>
        </div>

        {/* Projects processed */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span>
            {summary.projectsProcessed} project{summary.projectsProcessed !== 1 ? 's' : ''}{' '}
            processed
          </span>
        </div>

        {/* Error Details (Expandable) */}
        {summary.errors.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="flex w-full items-center justify-between p-3 text-sm text-muted-foreground hover:bg-surface transition-colors"
              data-testid="toggle-errors-button"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {summary.errors.length} error{summary.errors.length !== 1 ? 's' : ''} occurred
              </span>
              {showErrors ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showErrors && (
              <div
                className="max-h-48 overflow-y-auto border-t border-border p-3 space-y-3"
                data-testid="error-details"
              >
                {summary.errors.map((error, index) => (
                  <ErrorDetail key={error.timestamp || index} error={error} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cancelled Message */}
        {wasCancelled && (
          <div className="rounded-lg bg-score-medium/10 border border-score-medium/20 p-4">
            <p className="text-sm text-foreground">
              Import was stopped. {summary.imported > 0 && (
                <>Your {summary.imported.toLocaleString()} imported prompts are preserved.</>
              )}
            </p>
          </div>
        )}

        {/* Success Message */}
        {wasSuccessful && summary.imported > 0 && (
          <div className="rounded-lg bg-score-high/10 border border-score-high/20 p-4">
            <p className="text-sm text-foreground">
              All prompts imported successfully. Your prompt history is now available in your feed.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {summary.imported > 0 && (
            <Button
              className="w-full"
              onClick={onViewPrompts}
              data-testid="view-prompts-button"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Your Prompts
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={onClose}
            data-testid="close-button"
          >
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Single error detail row.
 */
interface ErrorDetailProps {
  error: ImportError;
}

function ErrorDetail({ error }: ErrorDetailProps) {
  return (
    <div className="text-xs space-y-1">
      <p className="font-medium text-destructive truncate" title={error.projectPath}>
        {error.projectPath}
      </p>
      {error.sessionPath && (
        <p className="text-muted-foreground truncate" title={error.sessionPath}>
          Session: {error.sessionPath}
        </p>
      )}
      <p className="text-muted-foreground">{error.message}</p>
    </div>
  );
}

/**
 * Compact summary for embedding in other views.
 */
export interface CompactImportSummaryProps {
  /** Summary of the completed import */
  summary: ImportSummary;
  /** Additional class names */
  className?: string;
}

export function CompactImportSummary({
  summary,
  className,
}: CompactImportSummaryProps) {
  const hasErrors = summary.failed > 0;
  const wasCancelled = summary.cancelled;

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg bg-surface border border-border',
        className
      )}
      data-testid="compact-import-summary"
    >
      <div
        className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
          wasCancelled
            ? 'bg-score-medium/10'
            : hasErrors
              ? 'bg-score-medium/10'
              : 'bg-score-high/10'
        )}
      >
        {wasCancelled ? (
          <Ban className="h-5 w-5 text-score-medium" />
        ) : hasErrors ? (
          <AlertTriangle className="h-5 w-5 text-score-medium" />
        ) : (
          <CheckCircle className="h-5 w-5 text-score-high" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {wasCancelled
            ? 'Import cancelled'
            : hasErrors
              ? 'Import completed with errors'
              : 'Import complete'}
        </p>
        <p className="text-xs text-muted-foreground">
          {summary.imported.toLocaleString()} imported
          {summary.skipped > 0 && `, ${summary.skipped.toLocaleString()} skipped`}
          {summary.failed > 0 && `, ${summary.failed.toLocaleString()} failed`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">
          {formatDuration(summary.durationSeconds)}
        </p>
      </div>
    </div>
  );
}
