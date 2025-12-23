'use client';

import { cn } from '@/lib/utils';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Sparkles, LucideIcon } from 'lucide-react';

export type InsightType = 'suggestion' | 'achievement' | 'warning' | 'insight';

export interface InsightCardProps {
  /** Insight type determines icon and styling */
  type: InsightType;
  /** Main insight message */
  message: string;
  /** Optional detailed explanation */
  details?: string;
  /** Optional action label */
  action?: string;
  /** Optional action handler */
  onAction?: () => void;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Whether the insight is dismissible */
  dismissible?: boolean;
  /** Additional class names */
  className?: string;
}

const typeConfig: Record<InsightType, { icon: LucideIcon; color: string; bgColor: string }> = {
  suggestion: {
    icon: Lightbulb,
    color: 'text-info',
    bgColor: 'bg-info/10 border-info/20',
  },
  achievement: {
    icon: CheckCircle,
    color: 'text-score-high',
    bgColor: 'bg-score-high/10 border-score-high/20',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-score-growth',
    bgColor: 'bg-score-growth/10 border-score-growth/20',
  },
  insight: {
    icon: Sparkles,
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/20',
  },
};

export function InsightCard({
  type,
  message,
  details,
  action,
  onAction,
  onDismiss,
  dismissible = true,
  className,
}: InsightCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4',
        config.bgColor,
        className
      )}
      data-testid="insight-card"
      data-type={type}
    >
      <div className="flex gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', config.color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{message}</p>
          {details && (
            <p className="mt-1 text-sm text-muted-foreground">{details}</p>
          )}
          {action && onAction && (
            <button
              onClick={onAction}
              className={cn(
                'mt-2 text-sm font-medium hover:underline',
                config.color
              )}
            >
              {action} →
            </button>
          )}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
