'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  X,
  RefreshCw,
  Clock,
  FileText,
  MessageSquare,
  FolderGit2,
  ChevronRight,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface InterruptedSession {
  /** Session identifier */
  id: string;
  /** Session name/identifier */
  sessionName: string;
  /** Last prompt text (truncated) */
  lastPromptPreview?: string;
  /** When the session was interrupted */
  interruptedAt: Date;
  /** Project name */
  projectName?: string;
  /** Number of prompts in session */
  promptCount: number;
  /** Session duration in minutes before interruption */
  durationMinutes?: number;
}

export interface RecoveryBannerProps {
  /** Session name/identifier (legacy support) */
  sessionName?: string;
  /** The interrupted session to recover */
  session?: InterruptedSession;
  /** When the session was interrupted (legacy support) */
  interruptedAt?: Date;
  /** Number of prompts in the session (legacy support) */
  promptCount?: number;
  /** Handler for resume action */
  onResume: () => void;
  /** Handler for dismiss action */
  onDismiss: () => void;
  /** Handler to view recovery details */
  onViewDetails?: () => void;
  /** Whether resume is in progress */
  resuming?: boolean;
  /** Additional class names */
  className?: string;
}

export function RecoveryBanner({
  sessionName: legacySessionName,
  session,
  interruptedAt: legacyInterruptedAt,
  promptCount: legacyPromptCount,
  onResume,
  onDismiss,
  onViewDetails,
  resuming = false,
  className,
}: RecoveryBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  // Support both old and new prop formats
  const sessionName = session?.sessionName ?? legacySessionName ?? 'Previous Session';
  const interruptedAt = session?.interruptedAt ?? legacyInterruptedAt ?? new Date();
  const promptCount = session?.promptCount ?? legacyPromptCount ?? 0;
  const lastPromptPreview = session?.lastPromptPreview;
  const projectName = session?.projectName;
  const durationMinutes = session?.durationMinutes;

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border transition-all duration-300',
        'bg-gradient-to-r from-info/5 via-primary/5 to-info/5',
        'border-info/20',
        isVisible && !isDismissing
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2',
        className
      )}
      data-testid="recovery-banner"
      role="alert"
    >
      {/* Subtle animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-info/5 to-transparent animate-pulse opacity-50" />

      <div className="relative flex items-start justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-6 w-6 text-info" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">
                Continue where you left off?
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">
                {formatDistanceToNow(interruptedAt, { addSuffix: true })}
              </span>
            </div>

            {lastPromptPreview && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                "{lastPromptPreview}"
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <FileText className="h-4 w-4" />
                {sessionName}
              </span>
              {projectName && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <FolderGit2 className="h-3 w-3" />
                  {projectName}
                </span>
              )}
              <span className="flex items-center gap-1 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                {promptCount} prompts
              </span>
              {durationMinutes !== undefined && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {durationMinutes} min
                </span>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={onResume}
                disabled={resuming}
                size="sm"
                className="bg-info text-white hover:bg-info/90"
                data-testid="recovery-resume-button"
              >
                {resuming ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    Resuming...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Resume Session
                  </>
                )}
              </Button>
              {onViewDetails && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewDetails}
                  disabled={resuming}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="recovery-view-details"
                >
                  Details
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                disabled={resuming}
              >
                Start Fresh
              </Button>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDismiss}
          disabled={resuming}
          aria-label="Dismiss"
          data-testid="recovery-dismiss-button"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Minimal recovery prompt for inline display
 */
export interface RecoveryPromptProps {
  /** Session to recover */
  session: InterruptedSession;
  /** Handler to start recovery */
  onRecover: () => void;
  /** Handler to dismiss */
  onDismiss: () => void;
  /** Additional class names */
  className?: string;
}

export function RecoveryPrompt({
  session,
  onRecover,
  onDismiss,
  className,
}: RecoveryPromptProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg bg-surface border border-border',
        className
      )}
      data-testid="recovery-prompt"
    >
      <Sparkles className="h-5 w-5 text-info shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">
          <span className="font-medium">Interrupted session detected</span>
          <span className="text-muted-foreground"> - </span>
          <span className="text-muted-foreground truncate">
            {formatDistanceToNow(session.interruptedAt, { addSuffix: true })}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
        <Button size="sm" onClick={onRecover}>
          Resume
        </Button>
      </div>
    </div>
  );
}

/**
 * Toast-style recovery notification
 */
export interface RecoveryToastProps {
  /** Session to recover */
  session: InterruptedSession;
  /** Handler to start recovery */
  onRecover: () => void;
  /** Handler to dismiss */
  onDismiss: () => void;
  /** Whether the toast is visible */
  visible?: boolean;
  /** Additional class names */
  className?: string;
}

export function RecoveryToast({
  session,
  onRecover,
  onDismiss,
  visible = true,
  className,
}: RecoveryToastProps) {
  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]',
        'rounded-lg border bg-card shadow-lg',
        'transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
        className
      )}
      data-testid="recovery-toast"
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-info" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground">
              Resume your session?
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              You have an interrupted session from{' '}
              {formatDistanceToNow(session.interruptedAt, { addSuffix: true })}
            </p>
            {session.lastPromptPreview && (
              <p className="text-sm text-foreground mt-2 line-clamp-2">
                "{session.lastPromptPreview}"
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            className="shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Not now
          </Button>
          <Button size="sm" onClick={onRecover}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Resume
          </Button>
        </div>
      </div>
    </div>
  );
}
