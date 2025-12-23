'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  RotateCcw,
  X,
  FileJson,
  Pause,
  Play,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';

export type FileImportStatus = 'pending' | 'importing' | 'complete' | 'error' | 'skipped';

export interface ImportFileProgress {
  /** File identifier */
  id: string;
  /** File name */
  name: string;
  /** Import status */
  status: FileImportStatus;
  /** Number of sessions in file */
  sessionCount: number;
  /** Sessions imported so far */
  sessionsImported: number;
  /** Number of prompts in file */
  promptCount: number;
  /** Prompts imported so far */
  promptsImported: number;
  /** Error message if status is error */
  errorMessage?: string;
  /** Time started */
  startedAt?: Date;
  /** Time completed */
  completedAt?: Date;
}

export interface ImportProgressState {
  /** Overall status */
  status: 'idle' | 'running' | 'paused' | 'complete' | 'cancelled' | 'error';
  /** Files being imported */
  files: ImportFileProgress[];
  /** When import started */
  startedAt?: Date;
  /** When import completed */
  completedAt?: Date;
  /** Total sessions to import */
  totalSessions: number;
  /** Sessions imported so far */
  sessionsImported: number;
  /** Total prompts to import */
  totalPrompts: number;
  /** Prompts imported so far */
  promptsImported: number;
}

export interface ImportProgressProps {
  /** Progress state */
  progress: ImportProgressState;
  /** Handler to pause import */
  onPause?: () => void;
  /** Handler to resume import */
  onResume?: () => void;
  /** Handler to cancel import */
  onCancel?: () => void;
  /** Handler to retry failed file */
  onRetry?: (fileId: string) => void;
  /** Handler to skip failed file */
  onSkip?: (fileId: string) => void;
  /** Additional class names */
  className?: string;
}

const fileStatusConfig: Record<
  FileImportStatus,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Pending',
  },
  importing: {
    icon: Loader2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Importing',
  },
  complete: {
    icon: CheckCircle,
    color: 'text-score-high',
    bgColor: 'bg-score-high/10',
    label: 'Complete',
  },
  error: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    label: 'Error',
  },
  skipped: {
    icon: AlertTriangle,
    color: 'text-score-medium',
    bgColor: 'bg-score-medium/10',
    label: 'Skipped',
  },
};

interface FileProgressRowProps {
  file: ImportFileProgress;
  onRetry?: () => void;
  onSkip?: () => void;
}

function FileProgressRow({ file, onRetry, onSkip }: FileProgressRowProps) {
  const config = fileStatusConfig[file.status];
  const Icon = config.icon;
  const fileProgress =
    file.promptCount > 0 ? (file.promptsImported / file.promptCount) * 100 : 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-border transition-colors',
        file.status === 'error' && 'bg-destructive/5 border-destructive/20'
      )}
      data-testid={`file-progress-${file.id}`}
      data-status={file.status}
    >
      <div
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
          config.bgColor
        )}
      >
        <Icon
          className={cn('h-4 w-4', config.color, file.status === 'importing' && 'animate-spin')}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileJson className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {file.name}
            </span>
          </div>
          <span className={cn('text-xs font-medium shrink-0', config.color)}>
            {config.label}
          </span>
        </div>

        {file.status === 'importing' && (
          <div className="mt-2">
            <Progress value={fileProgress} className="h-1.5" />
            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
              <span>
                {file.sessionsImported} / {file.sessionCount} sessions
              </span>
              <span>
                {file.promptsImported} / {file.promptCount} prompts
              </span>
            </div>
          </div>
        )}

        {file.status === 'complete' && (
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span>{file.sessionsImported} sessions</span>
            <span>{file.promptsImported} prompts</span>
            {file.completedAt && (
              <span>Completed at {format(file.completedAt, 'h:mm:ss a')}</span>
            )}
          </div>
        )}

        {file.status === 'error' && (
          <div className="mt-2">
            <p className="text-xs text-destructive">{file.errorMessage}</p>
            <div className="flex items-center gap-2 mt-2">
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
              {onSkip && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSkip}
                  className="h-7 text-xs"
                >
                  Skip
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ImportProgress({
  progress,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onSkip,
  className,
}: ImportProgressProps) {
  const overallProgress =
    progress.totalPrompts > 0
      ? (progress.promptsImported / progress.totalPrompts) * 100
      : 0;

  const completedFiles = progress.files.filter((f) => f.status === 'complete').length;
  const errorFiles = progress.files.filter((f) => f.status === 'error').length;
  const skippedFiles = progress.files.filter((f) => f.status === 'skipped').length;

  const isRunning = progress.status === 'running';
  const isPaused = progress.status === 'paused';
  const isComplete = progress.status === 'complete';
  const hasErrors = errorFiles > 0;

  return (
    <div className={cn('space-y-6', className)} data-testid="import-progress">
      {/* Overall Progress */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {isComplete
                ? hasErrors
                  ? 'Import Complete (with errors)'
                  : 'Import Complete'
                : isPaused
                  ? 'Import Paused'
                  : 'Importing...'}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isComplete
                ? `Imported ${progress.sessionsImported} sessions and ${progress.promptsImported} prompts`
                : `${progress.sessionsImported} of ${progress.totalSessions} sessions`}
            </p>
          </div>
          {!isComplete && (
            <div className="flex items-center gap-2">
              {isRunning && onPause && (
                <Button variant="outline" size="sm" onClick={onPause}>
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
              )}
              {isPaused && onResume && (
                <Button variant="outline" size="sm" onClick={onResume}>
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </Button>
              )}
              {onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Progress value={overallProgress} className="h-3" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {Math.round(overallProgress)}% complete
            </span>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-score-high">
                <CheckCircle className="h-3 w-3" />
                {completedFiles} files
              </span>
              {errorFiles > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  {errorFiles} errors
                </span>
              )}
              {skippedFiles > 0 && (
                <span className="flex items-center gap-1 text-score-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {skippedFiles} skipped
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-surface rounded-lg border border-border text-center">
          <p className="text-2xl font-bold text-foreground">{progress.files.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Files</p>
        </div>
        <div className="p-4 bg-surface rounded-lg border border-border text-center">
          <p className="text-2xl font-bold text-foreground">{progress.sessionsImported}</p>
          <p className="text-xs text-muted-foreground mt-1">Sessions</p>
        </div>
        <div className="p-4 bg-surface rounded-lg border border-border text-center">
          <div className="flex items-center justify-center gap-1">
            <MessageSquare className="h-5 w-5 text-primary" />
            <p className="text-2xl font-bold text-foreground">{progress.promptsImported}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Prompts</p>
        </div>
        <div className="p-4 bg-surface rounded-lg border border-border text-center">
          <p className="text-2xl font-bold text-score-high">{completedFiles}</p>
          <p className="text-xs text-muted-foreground mt-1">Complete</p>
        </div>
      </div>

      {/* File List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Files</h4>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {progress.files.map((file) => (
            <FileProgressRow
              key={file.id}
              file={file}
              onRetry={onRetry ? () => onRetry(file.id) : undefined}
              onSkip={onSkip ? () => onSkip(file.id) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Completion Message */}
      {isComplete && (
        <div
          className={cn(
            'p-4 rounded-lg border',
            hasErrors
              ? 'bg-score-medium/10 border-score-medium/20'
              : 'bg-score-high/10 border-score-high/20'
          )}
        >
          <div className="flex items-start gap-3">
            {hasErrors ? (
              <AlertTriangle className="h-5 w-5 text-score-medium shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="h-5 w-5 text-score-high shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {hasErrors
                  ? 'Import completed with some errors'
                  : 'All files imported successfully'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasErrors
                  ? `${errorFiles} file(s) could not be imported. You can retry them from the import history.`
                  : 'Your conversation history is now available in your feed.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Completion Summary Component
 */
export interface ImportCompleteSummaryProps {
  /** Number of sessions imported */
  sessionsImported: number;
  /** Number of prompts imported */
  promptsImported: number;
  /** Number of errors */
  errorCount: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** Handler to view imported sessions */
  onViewSessions?: () => void;
  /** Handler to close */
  onClose?: () => void;
  /** Additional class names */
  className?: string;
}

export function ImportCompleteSummary({
  sessionsImported,
  promptsImported,
  errorCount,
  durationSeconds,
  onViewSessions,
  onClose,
  className,
}: ImportCompleteSummaryProps) {
  const hasErrors = errorCount > 0;

  return (
    <div className={cn('flex flex-col items-center text-center py-8', className)}>
      <div
        className={cn(
          'h-20 w-20 rounded-full flex items-center justify-center mb-6',
          hasErrors ? 'bg-score-medium/10' : 'bg-score-high/10'
        )}
      >
        {hasErrors ? (
          <AlertTriangle className="h-10 w-10 text-score-medium" />
        ) : (
          <CheckCircle className="h-10 w-10 text-score-high" />
        )}
      </div>

      <h3 className="text-xl font-semibold text-foreground mb-2">
        {hasErrors ? 'Import Complete (with errors)' : 'Import Successful'}
      </h3>

      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {hasErrors
          ? `Imported ${sessionsImported} sessions and ${promptsImported} prompts. ${errorCount} file(s) had errors.`
          : `Successfully imported ${sessionsImported} sessions containing ${promptsImported} prompts.`}
      </p>

      <div className="flex items-center justify-center gap-8 mb-8">
        <div>
          <p className="text-3xl font-bold text-foreground">{sessionsImported}</p>
          <p className="text-xs text-muted-foreground">Sessions</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-3xl font-bold text-foreground">{promptsImported}</p>
          <p className="text-xs text-muted-foreground">Prompts</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-3xl font-bold text-muted-foreground">{durationSeconds}s</p>
          <p className="text-xs text-muted-foreground">Duration</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onViewSessions && (
          <Button onClick={onViewSessions}>View Imported Sessions</Button>
        )}
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
