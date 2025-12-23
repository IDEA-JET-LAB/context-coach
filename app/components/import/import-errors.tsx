'use client';

/**
 * Import Errors Component - Story 17-5
 *
 * Displays inline error notifications during import with expandable details.
 * Uses semantic design tokens for styling.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Wifi,
  FolderX,
  FileWarning,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ImportError } from '@/lib/import/types';

export interface ImportErrorsProps {
  /** List of errors to display */
  errors: ImportError[];
  /** Maximum errors to show before collapsing */
  maxVisible?: number;
  /** Additional class names */
  className?: string;
}

const errorTypeConfig: Record<
  ImportError['type'],
  { icon: typeof AlertCircle; label: string }
> = {
  project: {
    icon: FolderX,
    label: 'Project Error',
  },
  session: {
    icon: FileWarning,
    label: 'Session Error',
  },
  batch: {
    icon: AlertTriangle,
    label: 'Batch Error',
  },
  network: {
    icon: Wifi,
    label: 'Network Error',
  },
};

interface ErrorItemProps {
  error: ImportError;
}

function ErrorItem({ error }: ErrorItemProps) {
  const config = errorTypeConfig[error.type];
  const Icon = config.icon;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20"
      data-testid={`import-error-${error.timestamp}`}
    >
      <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
        <Icon className="h-3 w-3 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-destructive">{config.label}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(error.timestamp, { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-foreground mt-1 truncate" title={error.projectPath}>
          {error.projectPath}
        </p>
        {error.sessionPath && (
          <p className="text-xs text-muted-foreground truncate" title={error.sessionPath}>
            Session: {error.sessionPath}
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
    </div>
  );
}

export function ImportErrors({
  errors,
  maxVisible = 3,
  className,
}: ImportErrorsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (errors.length === 0) {
    return null;
  }

  const visibleErrors = isExpanded ? errors : errors.slice(0, maxVisible);
  const hiddenCount = errors.length - maxVisible;

  return (
    <div className={cn('space-y-3', className)} data-testid="import-errors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            {errors.length} error{errors.length !== 1 ? 's' : ''} occurred
          </span>
        </div>
        {errors.length > maxVisible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {hiddenCount} more
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error list */}
      <div className="space-y-2">
        {visibleErrors.map((error) => (
          <ErrorItem key={error.timestamp} error={error} />
        ))}
      </div>
    </div>
  );
}

/**
 * Compact inline error notification for real-time display.
 */
export interface InlineErrorNotificationProps {
  /** The error to display */
  error: ImportError;
  /** Handler to dismiss */
  onDismiss?: () => void;
  /** Additional class names */
  className?: string;
}

export function InlineErrorNotification({
  error,
  onDismiss,
  className,
}: InlineErrorNotificationProps) {
  const config = errorTypeConfig[error.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5 animate-in slide-in-from-top-2 duration-200',
        className
      )}
      role="alert"
      data-testid="inline-error-notification"
    >
      <Icon className="h-4 w-4 text-destructive shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{error.message}</p>
        <p className="text-xs text-muted-foreground truncate">{error.projectPath}</p>
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0 shrink-0"
        >
          <span className="sr-only">Dismiss</span>
          <ChevronUp className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
