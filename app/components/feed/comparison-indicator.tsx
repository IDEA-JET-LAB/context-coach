'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface ComparisonIndicatorProps {
  userScore: number;
  teamAverage: number;
  showValue?: boolean;
}

export type ComparisonDirection = 'above' | 'below' | 'at';

export function getComparisonDirection(
  userScore: number,
  teamAverage: number
): ComparisonDirection {
  const difference = userScore - teamAverage;
  if (difference > 0.5) return 'above';
  if (difference < -0.5) return 'below';
  return 'at';
}

export function ComparisonIndicator({
  userScore,
  teamAverage,
  showValue = true,
}: ComparisonIndicatorProps) {
  const difference = userScore - teamAverage;
  const direction = getComparisonDirection(userScore, teamAverage);

  const Icon = direction === 'above' ? ArrowUp : direction === 'below' ? ArrowDown : Minus;
  const color =
    direction === 'above'
      ? 'text-teal-500'
      : direction === 'below'
        ? 'text-red-400'
        : 'text-muted-foreground';

  const label =
    direction === 'above'
      ? 'Above team average'
      : direction === 'below'
        ? 'Below team average'
        : 'At team average';

  const formattedDifference = difference > 0 ? `+${difference.toFixed(1)}` : difference.toFixed(1);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn('flex items-center gap-1 cursor-help', color)}
          role="status"
          aria-label={`${label}: ${formattedDifference} from team average of ${teamAverage.toFixed(1)}`}
          data-testid="comparison-indicator"
          data-direction={direction}
          data-difference={difference.toFixed(1)}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {showValue && (
            <span className="text-xs font-medium" data-testid="comparison-value">
              {formattedDifference}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
        <p className="text-xs text-muted-foreground">
          Team avg: {teamAverage.toFixed(1)}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
