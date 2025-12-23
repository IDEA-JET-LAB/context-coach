'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Play,
  FolderOpen,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { ImportRecord, ImportRecordStatus } from '@/lib/import/types';

interface ImportHistoryItemProps {
  importRecord: ImportRecord;
  onRollback?: () => void;
  onResume?: () => void;
  isRollingBack?: boolean;
}

const statusConfig: Record<
  ImportRecordStatus,
  { icon: typeof CheckCircle2; color: string; bgColor: string; label: string }
> = {
  complete: {
    icon: CheckCircle2,
    color: 'text-score-high',
    bgColor: 'bg-score-high/10',
    label: 'Complete',
  },
  processing: {
    icon: Loader2,
    color: 'text-score-medium',
    bgColor: 'bg-score-medium/10',
    label: 'Processing',
  },
  pending: {
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Pending',
  },
  failed: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    label: 'Failed',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-score-medium',
    bgColor: 'bg-score-medium/10',
    label: 'Cancelled',
  },
  rolled_back: {
    icon: RotateCcw,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Rolled Back',
  },
  rolling_back: {
    icon: Loader2,
    color: 'text-score-medium',
    bgColor: 'bg-score-medium/10',
    label: 'Rolling Back...',
  },
  partially_rolled_back: {
    icon: AlertCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    label: 'Partially Rolled Back',
  },
};

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function ImportHistoryItem({
  importRecord,
  onRollback,
  onResume,
  isRollingBack = false,
}: ImportHistoryItemProps) {
  const [expanded, setExpanded] = useState(false);

  const status = statusConfig[importRecord.status];
  const StatusIcon = status.icon;
  const isAnimatedIcon = importRecord.status === 'processing' || importRecord.status === 'rolling_back';

  const canRollback = importRecord.status === 'complete';
  const canResume = importRecord.status === 'cancelled' || importRecord.status === 'failed';
  const isInactive = importRecord.status === 'rolled_back';

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all',
        isInactive && 'opacity-60'
      )}
      data-testid={`import-history-item-${importRecord.id}`}
    >
      {/* Header - Clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
            status.bgColor
          )}
        >
          <StatusIcon
            className={cn(
              'h-5 w-5',
              status.color,
              isAnimatedIcon && 'animate-spin'
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">
              {importRecord.promptsImported.toLocaleString()} prompts imported
            </p>
            {importRecord.promptsSkipped > 0 && (
              <span className="text-sm text-muted-foreground">
                ({importRecord.promptsSkipped.toLocaleString()} skipped)
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(importRecord.createdAt), { addSuffix: true })}
            {importRecord.metadata?.projects?.length > 0 && (
              <>
                {' '}&middot;{' '}
                {importRecord.metadata.projects.length} project{importRecord.metadata.projects.length !== 1 ? 's' : ''}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full',
              status.bgColor,
              status.color
            )}
          >
            {status.label}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          {/* Import Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Started</p>
              <p className="text-foreground">
                {importRecord.startedAt
                  ? format(new Date(importRecord.startedAt), 'PPp')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="text-foreground">
                {importRecord.metadata?.totalDurationMs
                  ? formatDuration(importRecord.metadata.totalDurationMs)
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Imported</p>
              <p className="text-foreground">{importRecord.promptsImported.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Failed</p>
              <p className={cn(
                "text-foreground",
                importRecord.promptsFailed > 0 && "text-destructive"
              )}>
                {importRecord.promptsFailed.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Error message if any */}
          {importRecord.errorMessage && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{importRecord.errorMessage}</p>
            </div>
          )}

          {/* Partial rollback info */}
          {importRecord.status === 'partially_rolled_back' && importRecord.metadata?.remainingCount && (
            <div className="p-3 rounded-md bg-score-medium/10 border border-score-medium/20">
              <p className="text-sm text-score-medium">
                Rollback was interrupted. {importRecord.metadata.deletedPromptIds?.length || 0} prompts were deleted,
                {' '}{importRecord.metadata.remainingCount} prompts remain.
              </p>
              {importRecord.metadata.rollbackError && (
                <p className="text-xs text-muted-foreground mt-1">
                  Error: {importRecord.metadata.rollbackError}
                </p>
              )}
            </div>
          )}

          {/* Project Breakdown */}
          {importRecord.metadata?.projects && importRecord.metadata.projects.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Projects</p>
              <div className="space-y-2">
                {importRecord.metadata.projects.map((project, index) => (
                  <div
                    key={index}
                    className="text-sm p-3 rounded-md bg-background border border-border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate text-foreground">{project.path}</span>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground shrink-0">
                      <span>{project.promptsImported} imported</span>
                      {project.promptsSkipped > 0 && (
                        <span>{project.promptsSkipped} skipped</span>
                      )}
                      {project.promptsFailed > 0 && (
                        <span className="text-destructive">{project.promptsFailed} failed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-border flex items-center gap-2">
            {canRollback && onRollback && (
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRollback();
                }}
                disabled={isRollingBack}
              >
                {isRollingBack ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rolling back...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Rollback Import
                  </>
                )}
              </Button>
            )}
            {canResume && onResume && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onResume();
                }}
              >
                <Play className="h-4 w-4" />
                Resume Import
              </Button>
            )}
            {!canRollback && !canResume && importRecord.status !== 'rolled_back' && (
              <p className="text-xs text-muted-foreground">
                {importRecord.status === 'processing' && 'Import in progress...'}
                {importRecord.status === 'rolling_back' && 'Rollback in progress...'}
                {importRecord.status === 'partially_rolled_back' && 'Contact support for assistance with partial rollback.'}
                {importRecord.status === 'pending' && 'Waiting to start...'}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
