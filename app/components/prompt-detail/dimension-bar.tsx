'use client';

import { cn } from '@/lib/utils';

interface DimensionBarProps {
  score: number;
  maxScore?: number;
}

function getBarColor(score: number): string {
  if (score >= 7) return 'bg-teal-500';
  if (score >= 4) return 'bg-amber-500';
  return 'bg-red-400';
}

export function DimensionBar({ score, maxScore = 10 }: DimensionBarProps) {
  const percentage = (score / maxScore) * 100;

  return (
    <div
      className="h-2 w-full rounded-full bg-muted overflow-hidden"
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={maxScore}
      aria-label={`Score: ${score.toFixed(1)} out of ${maxScore}`}
      data-testid="dimension-bar"
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', getBarColor(score))}
        style={{ width: `${percentage}%` }}
        data-testid="dimension-bar-fill"
      />
    </div>
  );
}
