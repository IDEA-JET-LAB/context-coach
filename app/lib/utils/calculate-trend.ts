export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendResult {
  direction: TrendDirection;
  percentage: number;
}

export function calculateTrend(
  currentValue: number,
  previousValue: number,
  threshold: number = 0.1
): TrendResult {
  if (previousValue === 0) {
    return { direction: 'stable', percentage: 0 };
  }

  const change = ((currentValue - previousValue) / previousValue) * 100;

  if (change > threshold) {
    return { direction: 'up', percentage: Math.round(change * 10) / 10 };
  } else if (change < -threshold) {
    return { direction: 'down', percentage: Math.round(Math.abs(change) * 10) / 10 };
  }

  return { direction: 'stable', percentage: 0 };
}

export function formatTrendValue(percentage: number, direction: TrendDirection): string {
  if (direction === 'stable') return '';
  const sign = direction === 'up' ? '+' : '-';
  return `${sign}${percentage.toFixed(1)}%`;
}
