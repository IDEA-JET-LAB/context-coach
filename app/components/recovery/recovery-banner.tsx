'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, RefreshCw, Clock, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface RecoveryBannerProps {
  /** Session name/identifier */
  sessionName: string;
  /** When the session was interrupted */
  interruptedAt: Date;
  /** Number of prompts in the session */
  promptCount: number;
  /** Handler for resume action */
  onResume: () => void;
  /** Handler for dismiss action */
  onDismiss: () => void;
  /** Whether resume is in progress */
  resuming?: boolean;
  /** Additional class names */
  className?: string;
}

export function RecoveryBanner({
  sessionName,
  interruptedAt,
  promptCount,
  onResume,
  onDismiss,
  resuming = false,
  className,
}: RecoveryBannerProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-info/20 bg-info/10 p-4',
        className
      )}
      data-testid="recovery-banner"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-info/20">
            <RefreshCw className="h-5 w-5 text-info" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Resume Previous Session?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You have an interrupted session that can be resumed.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <FileText className="h-4 w-4" />
                {sessionName}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatDistanceToNow(interruptedAt, { addSuffix: true })}
              </span>
              <span className="text-muted-foreground">
                {promptCount} prompts captured
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={onResume}
                disabled={resuming}
                size="sm"
              >
                {resuming ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resuming...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resume Session
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                disabled={resuming}
              >
                Start Fresh
              </Button>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onDismiss}
          disabled={resuming}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
