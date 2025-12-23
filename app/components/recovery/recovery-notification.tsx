'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  RotateCcw,
  X,
  Clock,
  MessageSquare,
  Sparkles,
  ChevronRight,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { InterruptedSession } from './recovery-banner';

/**
 * VS Code Extension Notification Component
 *
 * This component is designed to be used within the VS Code extension sidebar
 * to notify users about interrupted sessions that can be recovered.
 * The styling mimics VS Code's notification style.
 */

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface RecoveryNotificationProps {
  /** The interrupted session */
  session: InterruptedSession;
  /** Handler to start recovery */
  onRecover: () => void;
  /** Handler to dismiss notification */
  onDismiss: () => void;
  /** Handler to open in web app */
  onOpenInWeb?: () => void;
  /** Notification severity */
  severity?: NotificationSeverity;
  /** Whether recovery is in progress */
  recovering?: boolean;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

const severityConfig: Record<
  NotificationSeverity,
  { icon: React.ElementType; borderColor: string; iconColor: string }
> = {
  info: {
    icon: Sparkles,
    borderColor: 'border-l-info',
    iconColor: 'text-info',
  },
  warning: {
    icon: AlertCircle,
    borderColor: 'border-l-score-medium',
    iconColor: 'text-score-medium',
  },
  error: {
    icon: AlertCircle,
    borderColor: 'border-l-destructive',
    iconColor: 'text-destructive',
  },
};

export function RecoveryNotification({
  session,
  onRecover,
  onDismiss,
  onOpenInWeb,
  severity = 'info',
  recovering = false,
  compact = false,
  className,
}: RecoveryNotificationProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded bg-surface border border-border',
          config.borderColor,
          'border-l-2',
          className
        )}
        data-testid="recovery-notification-compact"
      >
        <Icon className={cn('h-4 w-4 shrink-0', config.iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground truncate">
            Session available to resume
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRecover}
          disabled={recovering}
          className="h-6 px-2 text-xs"
        >
          {recovering ? 'Resuming...' : 'Resume'}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          className="h-6 w-6"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg bg-surface border border-border overflow-hidden',
        config.borderColor,
        'border-l-4',
        className
      )}
      data-testid="recovery-notification"
      role="alert"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <div
          className={cn(
            'h-8 w-8 rounded flex items-center justify-center shrink-0',
            severity === 'info' && 'bg-info/10',
            severity === 'warning' && 'bg-score-medium/10',
            severity === 'error' && 'bg-destructive/10'
          )}
        >
          <Icon className={cn('h-4 w-4', config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground">
            Resume Previous Session
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDistanceToNow(session.interruptedAt, { addSuffix: true })}
          </p>
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

      {/* Content */}
      <div className="px-3 pb-3">
        {session.lastPromptPreview && (
          <div className="p-2 bg-muted rounded-md mb-3">
            <p className="text-xs text-foreground line-clamp-2">
              "{session.lastPromptPreview}"
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {session.promptCount} prompts
          </span>
          {session.durationMinutes !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {session.durationMinutes} min
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onRecover}
            disabled={recovering}
            className="flex-1"
            data-testid="notification-resume-button"
          >
            {recovering ? (
              <>
                <RotateCcw className="h-3 w-3 mr-1.5 animate-spin" />
                Resuming...
              </>
            ) : (
              <>
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Resume
              </>
            )}
          </Button>
          {onOpenInWeb && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenInWeb}
              className="shrink-0"
              data-testid="notification-open-web-button"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Sidebar indicator for pending recovery
 */
export interface RecoverySidebarIndicatorProps {
  /** Number of sessions available to recover */
  sessionCount: number;
  /** Handler to open recovery panel */
  onClick: () => void;
  /** Whether the indicator is active/focused */
  active?: boolean;
  /** Additional class names */
  className?: string;
}

export function RecoverySidebarIndicator({
  sessionCount,
  onClick,
  active = false,
  className,
}: RecoverySidebarIndicatorProps) {
  if (sessionCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full p-2 rounded transition-colors',
        'hover:bg-surface-hover',
        active && 'bg-surface',
        className
      )}
      data-testid="recovery-sidebar-indicator"
    >
      <div className="relative">
        <Sparkles className="h-5 w-5 text-info" />
        {sessionCount > 1 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-info text-[10px] font-bold text-white flex items-center justify-center">
            {sessionCount > 9 ? '9+' : sessionCount}
          </span>
        )}
      </div>
      <span className="text-sm text-foreground flex-1 text-left">
        {sessionCount === 1 ? 'Resume session' : `${sessionCount} sessions to resume`}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

/**
 * Quick resume action for command palette
 */
export interface QuickResumeActionProps {
  /** The interrupted session */
  session: InterruptedSession;
  /** Handler to start recovery */
  onRecover: () => void;
  /** Whether the action is selected */
  selected?: boolean;
  /** Additional class names */
  className?: string;
}

export function QuickResumeAction({
  session,
  onRecover,
  selected = false,
  className,
}: QuickResumeActionProps) {
  return (
    <button
      onClick={onRecover}
      className={cn(
        'flex items-center gap-3 w-full p-2 rounded transition-colors text-left',
        selected ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-hover',
        className
      )}
      data-testid="quick-resume-action"
    >
      <Sparkles
        className={cn(
          'h-4 w-4 shrink-0',
          selected ? 'text-primary-foreground' : 'text-info'
        )}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate',
            selected ? 'text-primary-foreground' : 'text-foreground'
          )}
        >
          Resume: {session.sessionName}
        </p>
        <p
          className={cn(
            'text-xs truncate',
            selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
          )}
        >
          {session.promptCount} prompts -{' '}
          {formatDistanceToNow(session.interruptedAt, { addSuffix: true })}
        </p>
      </div>
      <RotateCcw
        className={cn(
          'h-4 w-4 shrink-0',
          selected ? 'text-primary-foreground' : 'text-muted-foreground'
        )}
      />
    </button>
  );
}

/**
 * Empty state when no sessions to recover
 */
export interface NoRecoverySessionsProps {
  /** Additional class names */
  className?: string;
}

export function NoRecoverySessions({ className }: NoRecoverySessionsProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center',
        className
      )}
      data-testid="no-recovery-sessions"
    >
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Sparkles className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">No interrupted sessions</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        When a session is interrupted, you can resume it from here
      </p>
    </div>
  );
}
