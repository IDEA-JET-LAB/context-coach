'use client';

/**
 * ContextWindowGauge - Story 30-6: Analysis Panel UI
 *
 * A progress bar component that visualizes context window usage
 * with color coding based on utilization percentage.
 */

import { cn } from '@/lib/utils';

interface ContextWindowGaugeProps {
  /** Peak percentage of context window used (0-100) */
  peakPercentage: number;
  /** Turn number where peak occurred */
  peakTurn: number;
  /** Average percentage across conversation */
  avgPercentage: number;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * Returns the appropriate color class based on context usage percentage.
 * - Green (<70%): Healthy usage
 * - Yellow (70-90%): Caution, approaching limits
 * - Red (>90%): Critical, near context limit
 */
function getColorClasses(percentage: number): {
  bg: string;
  text: string;
} {
  if (percentage >= 90) {
    return {
      bg: 'bg-destructive',
      text: 'text-destructive',
    };
  }
  if (percentage >= 70) {
    return {
      bg: 'bg-score-growth',
      text: 'text-score-growth',
    };
  }
  return {
    bg: 'bg-primary',
    text: 'text-primary',
  };
}

/**
 * ContextWindowGauge
 *
 * Displays context window usage with:
 * - Visual progress bar with color-coded status
 * - Peak usage percentage and turn
 * - Average usage across conversation
 */
export function ContextWindowGauge({
  peakPercentage,
  peakTurn,
  avgPercentage,
  className,
}: ContextWindowGaugeProps) {
  const colors = getColorClasses(peakPercentage);
  const clampedPercentage = Math.min(100, Math.max(0, peakPercentage));

  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all duration-300 rounded-full',
            colors.bg
          )}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          Peak: <span className={cn('font-medium', colors.text)}>{peakPercentage}%</span>
          {peakTurn > 0 && <span className="ml-1">(turn {peakTurn})</span>}
        </span>
        <span>
          Avg: <span className="font-medium">{avgPercentage}%</span>
        </span>
      </div>
    </div>
  );
}

export default ContextWindowGauge;
