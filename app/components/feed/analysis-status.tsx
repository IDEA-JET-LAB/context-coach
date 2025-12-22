'use client';

import { Clock, Loader2, CheckCircle, AlertTriangle, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalysisStatus as AnalysisStatusType } from '@/lib/types/prompt';

interface AnalysisStatusProps {
  status: AnalysisStatusType;
  className?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Queued',
    className: 'text-muted-foreground',
  },
  processing: {
    icon: Loader2,
    label: 'Analyzing...',
    className: 'text-amber-500',
    animate: true,
  },
  complete: {
    icon: CheckCircle,
    label: 'Complete',
    className: 'text-teal-500',
  },
  failed: {
    icon: AlertTriangle,
    label: 'Failed',
    className: 'text-red-400',
  },
  skipped: {
    icon: MinusCircle,
    label: 'Skipped',
    className: 'text-muted-foreground',
  },
} as const;

export function AnalysisStatus({ status, className }: AnalysisStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn('flex items-center gap-1.5 text-xs', config.className, className)}
      data-testid={`analysis-status-${status}`}
    >
      <Icon className={cn('h-3.5 w-3.5', 'animate' in config && config.animate && 'animate-spin')} />
      <span>{config.label}</span>
    </div>
  );
}
