'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'stable';

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: TrendDirection;
  trendValue?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  trend,
  trendValue,
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4',
          className
        )}
        data-testid="stat-card-loading"
      >
        <div className="h-4 w-20 animate-pulse rounded bg-[#2a2a2a] mb-2" />
        <div className="h-8 w-16 animate-pulse rounded bg-[#2a2a2a]" />
      </div>
    );
  }

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-teal-500'
      : trend === 'down'
        ? 'text-red-400'
        : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4',
        className
      )}
      data-testid="stat-card"
      data-label={label}
    >
      <p className="text-sm text-muted-foreground" data-testid="stat-card-label">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className="text-2xl font-bold text-[#fafafa]"
          data-testid="stat-card-value"
        >
          {value}
        </span>
        {trend && (
          <div
            className={cn('flex items-center gap-1', trendColor)}
            data-testid="stat-card-trend"
            data-trend={trend}
          >
            <TrendIcon className="h-4 w-4" aria-hidden="true" />
            {trendValue && (
              <span className="text-xs" data-testid="stat-card-trend-value">
                {trendValue}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
