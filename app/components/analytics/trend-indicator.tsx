'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'stable';
export type TrendVariant = 'default' | 'pill' | 'inline';

export interface TrendIndicatorProps {
  /** Trend direction */
  direction: TrendDirection;
  /** Change value (e.g., "+12%", "-5%") */
  value?: string;
  /** Label text (e.g., "Improving", "vs last week") */
  label?: string;
  /** Visual variant */
  variant?: TrendVariant;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

const sizeConfig = {
  sm: { icon: 'h-3 w-3', text: 'text-xs', gap: 'gap-0.5' },
  md: { icon: 'h-4 w-4', text: 'text-sm', gap: 'gap-1' },
  lg: { icon: 'h-5 w-5', text: 'text-base', gap: 'gap-1.5' },
};

export function TrendIndicator({
  direction,
  value,
  label,
  variant = 'default',
  size = 'md',
  className,
}: TrendIndicatorProps) {
  const config = sizeConfig[size];

  const color =
    direction === 'up'
      ? 'text-score-high'
      : direction === 'down'
        ? 'text-score-growth'
        : 'text-muted-foreground';

  const bgColor =
    direction === 'up'
      ? 'bg-score-high/10'
      : direction === 'down'
        ? 'bg-score-growth/10'
        : 'bg-muted';

  const Icon =
    variant === 'inline'
      ? direction === 'up'
        ? ArrowUp
        : direction === 'down'
          ? ArrowDown
          : Minus
      : direction === 'up'
        ? TrendingUp
        : direction === 'down'
          ? TrendingDown
          : Minus;

  const defaultLabel =
    direction === 'up' ? 'Improving' : direction === 'down' ? 'Declining' : 'Stable';

  if (variant === 'pill') {
    return (
      <div
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5',
          config.gap,
          bgColor,
          color,
          className
        )}
        data-testid="trend-indicator-pill"
        data-direction={direction}
      >
        <Icon className={config.icon} />
        <span className={config.text}>{value || label || defaultLabel}</span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        className={cn('inline-flex items-center', config.gap, color, className)}
        data-testid="trend-indicator-inline"
        data-direction={direction}
      >
        <Icon className={config.icon} />
        {value && <span className={config.text}>{value}</span>}
      </span>
    );
  }

  return (
    <div
      className={cn('flex items-center', config.gap, color, className)}
      data-testid="trend-indicator"
      data-direction={direction}
    >
      <Icon className={config.icon} />
      <span className={config.text}>
        {value && <span className="font-medium">{value}</span>}
        {value && (label || defaultLabel) && ' '}
        {label || defaultLabel}
      </span>
    </div>
  );
}
