'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HealthStatus } from '@/lib/db/queries/system-health';

interface HealthIndicatorProps {
  title: string;
  value: number;
  unit: string;
  status: HealthStatus;
  tooltip: string;
  isPending?: boolean;
  testId?: string;
}

/**
 * HealthIndicator - Displays a system health metric with status coloring.
 * Used in the admin dashboard to show system health at a glance.
 *
 * Story 7.2: Admin Dashboard Overview
 */
export function HealthIndicator({
  title,
  value,
  unit,
  status,
  tooltip,
  isPending,
  testId,
}: HealthIndicatorProps) {
  if (isPending) {
    return (
      <Card
        data-testid={testId}
        className="border-[#2a2a2a] bg-[#0f0f0f]"
        role="status"
        aria-label={`Loading ${title}`}
      >
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-6 w-16" />
        </CardContent>
      </Card>
    );
  }

  const StatusIcon =
    status === 'green'
      ? CheckCircle
      : status === 'yellow'
        ? AlertTriangle
        : XCircle;

  const statusColor =
    status === 'green'
      ? 'text-green-500'
      : status === 'yellow'
        ? 'text-amber-500'
        : 'text-red-500';

  return (
    <Card
      data-testid={testId}
      className="border-[#2a2a2a] bg-[#0f0f0f]"
      role="status"
      aria-label={`${title}: ${value}${unit}`}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="More information"
            >
              <Info
                data-testid="health-info-icon"
                className="h-4 w-4 cursor-help"
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            <p className="max-w-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <StatusIcon
          data-testid="health-status-icon"
          className={cn('h-5 w-5', statusColor)}
          aria-hidden="true"
        />
        <span className="text-xl font-bold text-foreground">
          {value}
          {unit}
        </span>
      </CardContent>
    </Card>
  );
}

/**
 * HealthIndicatorSkeleton - Loading skeleton for health indicators.
 */
export function HealthIndicatorSkeleton() {
  return (
    <Card className="border-[#2a2a2a] bg-[#0f0f0f]">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-6 w-16" />
      </CardContent>
    </Card>
  );
}
