'use client';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { FileText, Clock, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

export type ImportStatus = 'pending' | 'importing' | 'imported' | 'error' | 'duplicate';

export interface SessionPreviewData {
  id: string;
  filename: string;
  startTime: Date;
  endTime?: Date;
  promptCount: number;
  status: ImportStatus;
  error?: string;
}

export interface SessionPreviewCardProps {
  /** Session data */
  session: SessionPreviewData;
  /** Whether the session is selected for import */
  selected?: boolean;
  /** Selection change handler */
  onSelectionChange?: (selected: boolean) => void;
  /** Whether selection is enabled */
  selectable?: boolean;
  /** Additional class names */
  className?: string;
}

const statusConfig: Record<ImportStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: 'Ready', color: 'bg-muted text-muted-foreground', icon: FileText },
  importing: { label: 'Importing...', color: 'bg-info/10 text-info', icon: Clock },
  imported: { label: 'Imported', color: 'bg-score-high/10 text-score-high', icon: CheckCircle },
  error: { label: 'Error', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
  duplicate: { label: 'Duplicate', color: 'bg-score-medium/10 text-score-medium', icon: AlertCircle },
};

export function SessionPreviewCard({
  session,
  selected = false,
  onSelectionChange,
  selectable = true,
  className,
}: SessionPreviewCardProps) {
  const status = statusConfig[session.status];
  const StatusIcon = status.icon;
  const duration = session.endTime
    ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000)
    : null;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 transition-colors',
        selected && 'border-primary bg-primary/5',
        selectable && 'cursor-pointer hover:border-primary/50',
        className
      )}
      onClick={() => selectable && onSelectionChange?.(!selected)}
      data-testid="session-preview-card"
      data-status={session.status}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
            disabled={session.status === 'imported' || session.status === 'duplicate'}
            className="mt-1"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-foreground truncate">{session.filename}</h4>
            <Badge className={cn('shrink-0', status.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {format(session.startTime, 'MMM d, yyyy HH:mm')}
            </span>
            {duration !== null && (
              <span>{duration} min</span>
            )}
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {session.promptCount} prompts
            </span>
          </div>
          {session.error && (
            <p className="mt-2 text-sm text-destructive">{session.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
