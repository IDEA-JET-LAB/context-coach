'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Calendar,
  Clock,
  MessageSquare,
  Undo2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileJson,
  Loader2,
  History,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export type ImportBatchStatus = 'complete' | 'partial' | 'rolled_back';

export interface ImportBatchFile {
  id: string;
  name: string;
  sessionsImported: number;
  promptsImported: number;
  status: 'success' | 'error' | 'skipped';
  errorMessage?: string;
}

export interface ImportBatch {
  /** Unique batch identifier */
  id: string;
  /** When the import was performed */
  importedAt: Date;
  /** Total sessions imported in this batch */
  sessionCount: number;
  /** Total prompts imported in this batch */
  promptCount: number;
  /** Files included in this batch */
  files: ImportBatchFile[];
  /** Batch status */
  status: ImportBatchStatus;
  /** Duration of import in seconds */
  durationSeconds: number;
  /** Whether this batch can be rolled back */
  canRollback: boolean;
  /** Reason if rollback is not available */
  rollbackUnavailableReason?: string;
}

export interface ImportHistoryProps {
  /** Import batches */
  batches: ImportBatch[];
  /** Handler to rollback a batch */
  onRollback?: (batchId: string) => Promise<void>;
  /** Handler to delete a batch record (not rollback) */
  onDelete?: (batchId: string) => Promise<void>;
  /** Whether history is loading */
  loading?: boolean;
  /** Additional class names */
  className?: string;
}

const batchStatusConfig: Record<
  ImportBatchStatus,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  complete: {
    icon: CheckCircle,
    color: 'text-score-high',
    bgColor: 'bg-score-high/10',
    label: 'Complete',
  },
  partial: {
    icon: AlertTriangle,
    color: 'text-score-medium',
    bgColor: 'bg-score-medium/10',
    label: 'Partial',
  },
  rolled_back: {
    icon: Undo2,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Rolled Back',
  },
};

interface BatchCardProps {
  batch: ImportBatch;
  expanded: boolean;
  onToggleExpand: () => void;
  onRollback?: () => void;
  onDelete?: () => void;
  rolling?: boolean;
}

function BatchCard({
  batch,
  expanded,
  onToggleExpand,
  onRollback,
  onDelete,
  rolling,
}: BatchCardProps) {
  const config = batchStatusConfig[batch.status];
  const StatusIcon = config.icon;

  const successFiles = batch.files.filter((f) => f.status === 'success').length;
  const errorFiles = batch.files.filter((f) => f.status === 'error').length;

  return (
    <div
      className={cn(
        'border border-border rounded-lg overflow-hidden transition-all',
        batch.status === 'rolled_back' && 'opacity-60'
      )}
      data-testid={`batch-card-${batch.id}`}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
            config.bgColor
          )}
        >
          <StatusIcon className={cn('h-5 w-5', config.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium text-foreground">
                Import on {format(batch.importedAt, 'MMM d, yyyy')}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(batch.importedAt, { addSuffix: true })}
              </p>
            </div>
            <span
              className={cn(
                'text-xs font-medium px-2 py-1 rounded-full shrink-0',
                config.bgColor,
                config.color
              )}
            >
              {config.label}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileJson className="h-4 w-4" />
              {batch.files.length} files
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {batch.sessionCount} sessions
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {batch.promptCount} prompts
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {batch.durationSeconds}s
            </span>
          </div>

          {batch.status !== 'rolled_back' && (
            <div className="flex items-center gap-2 mt-3">
              {batch.canRollback && onRollback && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRollback}
                  disabled={rolling}
                  className="h-8 text-xs"
                >
                  {rolling ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Rolling back...
                    </>
                  ) : (
                    <>
                      <Undo2 className="h-3 w-3 mr-1" />
                      Rollback
                    </>
                  )}
                </Button>
              )}
              {!batch.canRollback && batch.rollbackUnavailableReason && (
                <span className="text-xs text-muted-foreground">
                  {batch.rollbackUnavailableReason}
                </span>
              )}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleExpand}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Expanded File List */}
      {expanded && (
        <div className="border-t border-border bg-surface/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">
              Files ({successFiles} success, {errorFiles} errors)
            </p>
            {onDelete && batch.status === 'rolled_back' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-7 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remove from history
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {batch.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-2 bg-background rounded-md border border-border"
              >
                <FileJson className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground truncate block">
                    {file.name}
                  </span>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>{file.sessionsImported} sessions</span>
                    <span>{file.promptsImported} prompts</span>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-xs font-medium shrink-0',
                    file.status === 'success' && 'text-score-high',
                    file.status === 'error' && 'text-destructive',
                    file.status === 'skipped' && 'text-score-medium'
                  )}
                >
                  {file.status === 'success' && (
                    <CheckCircle className="h-4 w-4 inline-block" />
                  )}
                  {file.status === 'error' && (
                    <XCircle className="h-4 w-4 inline-block" />
                  )}
                  {file.status === 'skipped' && (
                    <AlertTriangle className="h-4 w-4 inline-block" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ImportHistory({
  batches,
  onRollback,
  onDelete,
  loading = false,
  className,
}: ImportHistoryProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleRollback = async (batchId: string) => {
    if (!onRollback) return;
    setRollingBackId(batchId);
    try {
      await onRollback(batchId);
    } finally {
      setRollingBackId(null);
      setConfirmRollback(null);
    }
  };

  const totalSessions = batches
    .filter((b) => b.status !== 'rolled_back')
    .reduce((sum, b) => sum + b.sessionCount, 0);

  const totalPrompts = batches
    .filter((b) => b.status !== 'rolled_back')
    .reduce((sum, b) => sum + b.promptCount, 0);

  if (loading) {
    return (
      <div
        className={cn('flex flex-col items-center justify-center py-12', className)}
        data-testid="import-history-loading"
      >
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Loading import history...</p>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div
        className={cn('flex flex-col items-center justify-center py-12 text-center', className)}
        data-testid="import-history-empty"
      >
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <History className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No import history</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Import history will appear here after you import transcripts
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} data-testid="import-history">
      {/* Summary */}
      <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{batches.length}</p>
            <p className="text-xs text-muted-foreground">Imports</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{totalSessions}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{totalPrompts}</p>
            <p className="text-xs text-muted-foreground">Prompts</p>
          </div>
        </div>
      </div>

      {/* Batch List */}
      <div className="space-y-3">
        {batches.map((batch) => (
          <BatchCard
            key={batch.id}
            batch={batch}
            expanded={expandedIds.includes(batch.id)}
            onToggleExpand={() => toggleExpand(batch.id)}
            onRollback={
              onRollback && batch.canRollback
                ? () => setConfirmRollback(batch.id)
                : undefined
            }
            onDelete={onDelete ? () => onDelete(batch.id) : undefined}
            rolling={rollingBackId === batch.id}
          />
        ))}
      </div>

      {/* Rollback Confirmation */}
      <AlertDialog
        open={!!confirmRollback}
        onOpenChange={(open) => !open && setConfirmRollback(null)}
      >
        <AlertDialogContent data-testid="rollback-confirmation">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Undo2 className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle>Rollback Import?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              This will remove all sessions and prompts from this import batch. This action
              cannot be undone and may affect your analytics data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!rollingBackId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRollback && handleRollback(confirmRollback)}
              disabled={!!rollingBackId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rollingBackId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rolling back...
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Rollback
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
