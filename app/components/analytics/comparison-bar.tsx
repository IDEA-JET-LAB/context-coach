'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

export interface ComparisonBarProps {
  /** Label for the metric */
  label: string;
  /** User's value */
  userValue: number;
  /** Team/comparison value */
  compareValue: number;
  /** Maximum value for the scale */
  maxValue?: number;
  /** User label */
  userLabel?: string;
  /** Comparison label */
  compareLabel?: string;
  /** Whether to show numeric values */
  showValues?: boolean;
  /** Additional class names */
  className?: string;
}

export function ComparisonBar({
  label,
  userValue,
  compareValue,
  maxValue = 10,
  userLabel = 'You',
  compareLabel = 'Team Avg',
  showValues = true,
  className,
}: ComparisonBarProps) {
  const userPercent = Math.min((userValue / maxValue) * 100, 100);
  const comparePercent = Math.min((compareValue / maxValue) * 100, 100);
  const isAhead = userValue >= compareValue;

  return (
    <TooltipProvider>
      <div className={cn('space-y-2', className)} data-testid="comparison-bar">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {showValues && (
            <div className="flex items-center gap-3 text-xs">
              <span className={cn(isAhead ? 'text-score-high' : 'text-muted-foreground')}>
                {userLabel}: {userValue.toFixed(1)}
              </span>
              <span className="text-muted-foreground">
                {compareLabel}: {compareValue.toFixed(1)}
              </span>
            </div>
          )}
        </div>
        <div className="relative h-4 rounded-full bg-muted overflow-hidden">
          {/* Team average bar (background) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute inset-y-0 left-0 bg-secondary/50 transition-all duration-300"
                style={{ width: `${comparePercent}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{compareLabel}: {compareValue.toFixed(1)}</p>
            </TooltipContent>
          </Tooltip>

          {/* User bar (foreground) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
                  isAhead ? 'bg-score-high' : 'bg-primary'
                )}
                style={{ width: `${userPercent}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{userLabel}: {userValue.toFixed(1)}</p>
            </TooltipContent>
          </Tooltip>

          {/* Team average marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-secondary border-l border-background"
            style={{ left: `${comparePercent}%` }}
          />
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>{userLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-secondary/50" />
            <span>{compareLabel}</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
