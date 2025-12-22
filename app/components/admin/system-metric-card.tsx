'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HealthStatus } from '@/lib/utils/health-thresholds';

interface SystemMetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  status: HealthStatus;
  threshold?: string;
  description?: string;
  testId?: string;
}

const statusConfig: Record<HealthStatus, {
  icon: typeof CheckCircle;
  color: string;
  bgColor: string;
  borderColor: string;
  animate?: string;
}> = {
  healthy: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
  },
  critical: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    animate: 'animate-pulse',
  },
};

export function SystemMetricCard({
  title,
  value,
  unit,
  status,
  threshold,
  description,
  testId,
}: SystemMetricCardProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        'border-2 bg-[#0f0f0f]',
        config.borderColor,
        status === 'critical' && config.animate
      )}
      role="region"
      aria-label={`${title} metric`}
      data-testid={testId}
      data-status={status}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="focus:outline-none focus:ring-2 focus:ring-primary rounded"
              aria-label={`Status: ${status}${threshold ? `. ${threshold}` : ''}`}
            >
              <Icon
                className={cn('h-5 w-5', config.color)}
                aria-hidden="true"
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{threshold ?? `Status: ${status}`}</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent>
        <div
          className={cn('text-2xl font-bold', config.color)}
          aria-live="polite"
        >
          {value}
          {unit && <span className="ml-1 text-lg">{unit}</span>}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
