'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * NOTE: Admin components use hardcoded dark colors (#0f0f0f, #1a1a1a, #2a2a2a)
 * instead of CSS variables for a consistent darker admin theme.
 * This is intentional to differentiate admin UI from user-facing pages.
 */

export interface TrendInfo {
  percentChange: number;
  direction: 'up' | 'down' | 'neutral';
}

interface StatCardProps {
  title: string;
  value: number;
  trend?: TrendInfo;
  format?: 'number' | 'percentage';
  isPending?: boolean;
  testId?: string;
}

/**
 * StatCard - Displays a single statistic with optional trend indicator.
 * Used in the admin dashboard to show platform metrics.
 *
 * Story 7.2: Admin Dashboard Overview
 */
export function StatCard({
  title,
  value,
  trend,
  format = 'number',
  isPending,
  testId,
}: StatCardProps) {
  if (isPending) {
    return (
      <Card
        data-testid={testId}
        className="border-[#2a2a2a] bg-[#0f0f0f]"
        role="status"
        aria-label={`Loading ${title}`}
      >
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  const formattedValue =
    format === 'percentage' ? `${value}%` : value.toLocaleString();

  const TrendIcon =
    trend?.direction === 'up'
      ? ArrowUp
      : trend?.direction === 'down'
        ? ArrowDown
        : Minus;

  const trendColor =
    trend?.direction === 'up'
      ? 'text-green-500'
      : trend?.direction === 'down'
        ? 'text-red-500'
        : 'text-muted-foreground';

  return (
    <Card
      data-testid={testId}
      className="border-[#2a2a2a] bg-[#0f0f0f]"
      role="status"
      aria-label={`${title}: ${formattedValue}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div data-testid="stat-value" className="text-2xl font-bold text-foreground">
          {formattedValue}
        </div>
        {trend && (
          <div
            data-testid="stat-trend"
            className={cn('flex items-center text-sm mt-1', trendColor)}
            aria-label={`${Math.abs(trend.percentChange)}% ${trend.direction} from last period`}
          >
            <TrendIcon className="h-4 w-4 mr-1" aria-hidden="true" />
            <span>{Math.abs(trend.percentChange)}% vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * StatCardSkeleton - Loading skeleton for stat cards.
 */
export function StatCardSkeleton() {
  return (
    <Card className="border-[#2a2a2a] bg-[#0f0f0f]">
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  );
}
