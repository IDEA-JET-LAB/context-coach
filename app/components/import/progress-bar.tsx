'use client';

import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2, AlertCircle, FileText } from 'lucide-react';

export type ImportPhase = 'discovering' | 'parsing' | 'deduplicating' | 'importing' | 'complete' | 'error';

export interface ImportProgressBarProps {
  /** Current import phase */
  phase: ImportPhase;
  /** Progress percentage (0-100) */
  progress: number;
  /** Number of items processed */
  processed?: number;
  /** Total number of items */
  total?: number;
  /** Current file being processed */
  currentFile?: string;
  /** Error message if phase is 'error' */
  error?: string;
  /** Additional class names */
  className?: string;
}

const phaseConfig: Record<ImportPhase, { label: string; icon: typeof Loader2 }> = {
  discovering: { label: 'Discovering transcript files...', icon: Loader2 },
  parsing: { label: 'Parsing transcripts...', icon: Loader2 },
  deduplicating: { label: 'Checking for duplicates...', icon: Loader2 },
  importing: { label: 'Importing sessions...', icon: Loader2 },
  complete: { label: 'Import complete!', icon: CheckCircle },
  error: { label: 'Import failed', icon: AlertCircle },
};

export function ImportProgressBar({
  phase,
  progress,
  processed,
  total,
  currentFile,
  error,
  className,
}: ImportProgressBarProps) {
  const config = phaseConfig[phase];
  const Icon = config.icon;
  const isAnimating = phase !== 'complete' && phase !== 'error';

  return (
    <div className={cn('space-y-3', className)} data-testid="import-progress">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              'h-4 w-4',
              phase === 'complete' && 'text-score-high',
              phase === 'error' && 'text-destructive',
              isAnimating && 'text-primary animate-spin'
            )}
          />
          <span className="text-sm font-medium text-foreground">{config.label}</span>
        </div>
        {processed !== undefined && total !== undefined && (
          <span className="text-sm text-muted-foreground">
            {processed} / {total}
          </span>
        )}
      </div>

      <Progress value={progress} className="h-2" />

      {currentFile && phase !== 'complete' && phase !== 'error' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="truncate">{currentFile}</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
