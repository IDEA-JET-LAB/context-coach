'use client';

import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';

export interface ScoreBadgeProps {
  score?: number;
  status?: 'pending' | 'processing' | 'complete' | 'failed' | 'skipped';
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
};

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function getScoreColor(score: number): string {
  if (score >= 7) return 'bg-teal-500 text-white';
  if (score >= 4) return 'bg-amber-500 text-white';
  return 'bg-red-400 text-white';
}

export function getScoreColorClass(score: number): 'teal' | 'amber' | 'coral' {
  if (score >= 7) return 'teal';
  if (score >= 4) return 'amber';
  return 'coral';
}

export function ScoreBadge({ score, status = 'complete', size = 'md' }: ScoreBadgeProps) {
  const sizeClass = sizeClasses[size];
  const iconClass = iconSizeClasses[size];

  if (status === 'pending' || status === 'processing') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted',
          sizeClass
        )}
        data-testid="score-badge-loading"
        aria-label="Score is being calculated"
      >
        <Loader2
          className={cn('animate-spin text-muted-foreground', iconClass)}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-red-500/20',
          sizeClass
        )}
        data-testid="score-badge-failed"
        aria-label="Score calculation failed"
      >
        <AlertCircle className={cn('text-red-400', iconClass)} aria-hidden="true" />
      </div>
    );
  }

  if (status === 'skipped') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted',
          sizeClass
        )}
        data-testid="score-badge-skipped"
        aria-label="Analysis skipped"
      >
        <span className="text-muted-foreground text-xs">—</span>
      </div>
    );
  }

  if (score === undefined || score === null) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-bold transition-colors',
        sizeClass,
        getScoreColor(score)
      )}
      data-testid="score-badge"
      data-score={score}
      data-color={getScoreColorClass(score)}
      aria-label={`Score: ${score.toFixed(1)} out of 10`}
    >
      {score.toFixed(1)}
    </div>
  );
}
