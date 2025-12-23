'use client';

import { cn } from '@/lib/utils';
import { Lightbulb, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';

export interface PersonalizedTipsProps {
  tips: string[];
  loading?: boolean;
  className?: string;
  dismissable?: boolean;
  onDismiss?: (tipIndex: number) => void;
}

const TIP_ICONS = ['1', '2', '3', '4', '5'];

export function PersonalizedTips({
  tips,
  loading = false,
  className,
  dismissable = false,
  onDismiss,
}: PersonalizedTipsProps) {
  const [dismissedTips, setDismissedTips] = useState<Set<number>>(new Set());

  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="personalized-tips-loading"
      >
        <div className="h-4 w-40 animate-pulse rounded bg-muted mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const visibleTips = tips.filter((_, index) => !dismissedTips.has(index));

  if (visibleTips.length === 0) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="personalized-tips-empty"
      >
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Personalized Tips</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Lightbulb className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Great job! No improvement tips at the moment.
          </p>
        </div>
      </div>
    );
  }

  const handleDismiss = (index: number) => {
    setDismissedTips((prev) => new Set(prev).add(index));
    onDismiss?.(index);
  };

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="personalized-tips"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Personalized Tips</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {visibleTips.length} suggestion{visibleTips.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tips List */}
      <div className="space-y-3">
        {tips.map((tip, originalIndex) => {
          if (dismissedTips.has(originalIndex)) return null;

          const visibleIndex = tips
            .slice(0, originalIndex + 1)
            .filter((_, i) => !dismissedTips.has(i)).length;

          return (
            <div
              key={originalIndex}
              className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10 group"
              data-testid={`tip-${originalIndex}`}
            >
              {/* Number Badge */}
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {TIP_ICONS[visibleIndex - 1] || visibleIndex}
                </span>
              </div>

              {/* Tip Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-relaxed">{tip}</p>
              </div>

              {/* Dismiss Button */}
              {dismissable && (
                <button
                  onClick={() => handleDismiss(originalIndex)}
                  className="flex-shrink-0 p-1 rounded hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Dismiss tip"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Action hint */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Tips are personalized based on your prompting patterns
        </p>
      </div>

      {/* Accessible description */}
      <span className="sr-only">
        Personalized improvement tips. {visibleTips.length} suggestions available.
        {visibleTips.map((tip, i) => `Tip ${i + 1}: ${tip}`).join('. ')}
      </span>
    </div>
  );
}
