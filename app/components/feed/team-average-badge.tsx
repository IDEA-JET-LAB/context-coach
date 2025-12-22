'use client';

import { cn } from '@/lib/utils';
import { getScoreColorClass } from './score-badge';

export interface TeamAverageBadgeProps {
  average: number;
  className?: string;
}

function getAverageTextColor(score: number): string {
  if (score >= 7) return 'text-teal-500';
  if (score >= 4) return 'text-amber-500';
  return 'text-red-400';
}

export function TeamAverageBadge({ average, className }: TeamAverageBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 text-sm text-muted-foreground',
        className
      )}
      data-testid="team-average-badge"
      data-average={average.toFixed(1)}
      data-color={getScoreColorClass(average)}
    >
      <span>Team avg:</span>
      <span className={cn('font-medium', getAverageTextColor(average))}>
        {average.toFixed(1)}
      </span>
    </div>
  );
}
