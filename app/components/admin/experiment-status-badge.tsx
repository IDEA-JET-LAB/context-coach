'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExperimentStatus } from '@/lib/types/experiments';
import { STATUS_COLORS } from '@/lib/types/experiments';
import {
  FileEdit,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  BarChart3,
  CircleDot,
} from 'lucide-react';

interface ExperimentStatusBadgeProps {
  status: ExperimentStatus;
  size?: 'sm' | 'default';
}

const STATUS_ICONS: Record<ExperimentStatus, React.ComponentType<{ className?: string }>> = {
  draft: FileEdit,
  active: CheckCircle2,
  running: PlayCircle,
  paused: PauseCircle,
  analyzing: BarChart3,
  completed: CircleDot,
};

const STATUS_LABELS: Record<ExperimentStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  running: 'Running',
  paused: 'Paused',
  analyzing: 'Analyzing',
  completed: 'Completed',
};

export function ExperimentStatusBadge({ status, size = 'default' }: ExperimentStatusBadgeProps) {
  const Icon = STATUS_ICONS[status];
  const colors = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <Badge
      variant="secondary"
      className={cn(
        colors.bg,
        colors.text,
        'font-medium',
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-0.5'
      )}
    >
      <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
      {label}
    </Badge>
  );
}
