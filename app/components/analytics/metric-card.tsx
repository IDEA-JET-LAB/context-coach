'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

export interface MetricCardProps {
  /** Metric title/label */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Change value (e.g., "+12%") */
  change?: string;
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable';
  /** Optional icon */
  icon?: LucideIcon;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  trend,
  icon: Icon,
  loading = false,
  className,
}: MetricCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-4',
          className
        )}
        data-testid="metric-card-loading"
      >
        <div className="h-4 w-24 animate-pulse rounded bg-muted mb-2" />
        <div className="h-8 w-16 animate-pulse rounded bg-muted mb-1" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-score-high'
      : trend === 'down'
        ? 'text-score-growth'
        : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        className
      )}
      data-testid="metric-card"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {trend && change && (
          <div className={cn('flex items-center gap-0.5 text-sm', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>{change}</span>
          </div>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
