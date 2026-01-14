'use client';

/**
 * OutcomeIndicator - Story 30-6: Analysis Panel UI
 *
 * Displays the session outcome status with an icon, label,
 * and indicator badges for detected signals.
 */

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  PlayCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OutcomeResult, OutcomeStatus } from '@/lib/analysis/conversation-stats';

interface OutcomeIndicatorProps {
  /** Outcome result from stats calculation */
  outcome: OutcomeResult;
  /** Whether to show indicator badges (default: true) */
  showIndicators?: boolean;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * Configuration for each outcome status
 */
const outcomeConfig: Record<
  OutcomeStatus,
  {
    icon: typeof CheckCircle;
    label: string;
    colorClass: string;
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    colorClass: 'text-primary',
    badgeVariant: 'default',
  },
  abandoned: {
    icon: XCircle,
    label: 'Abandoned',
    colorClass: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
  ongoing: {
    icon: PlayCircle,
    label: 'Ongoing',
    colorClass: 'text-primary',
    badgeVariant: 'outline',
  },
  error: {
    icon: AlertTriangle,
    label: 'Error',
    colorClass: 'text-destructive',
    badgeVariant: 'destructive',
  },
  unknown: {
    icon: HelpCircle,
    label: 'Unknown',
    colorClass: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
};

/**
 * OutcomeIndicator
 *
 * Displays session outcome with:
 * - Status icon with appropriate color
 * - Status label
 * - Indicator badges showing signals that led to classification
 */
export function OutcomeIndicator({
  outcome,
  showIndicators = true,
  className,
}: OutcomeIndicatorProps) {
  const config = outcomeConfig[outcome.status];
  const Icon = config.icon;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Status row */}
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', config.colorClass)} />
        <span className="text-sm font-medium">{config.label}</span>
      </div>

      {/* Indicator badges */}
      {showIndicators && outcome.indicators.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {outcome.indicators.slice(0, 3).map((indicator, index) => (
            <Badge
              key={index}
              variant={config.badgeVariant}
              className="text-xs font-normal truncate max-w-[180px]"
              title={indicator}
            >
              {formatIndicator(indicator)}
            </Badge>
          ))}
          {outcome.indicators.length > 3 && (
            <Badge variant="outline" className="text-xs font-normal">
              +{outcome.indicators.length - 3} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Formats an indicator string for display
 * Removes common prefixes and truncates long strings
 */
function formatIndicator(indicator: string): string {
  // Remove common prefixes
  const cleanIndicator = indicator
    .replace(/^End reason: /i, '')
    .replace(/^Error indicator in stop_reason: /i, 'Error: ');

  // Truncate if too long
  if (cleanIndicator.length > 30) {
    return cleanIndicator.substring(0, 27) + '...';
  }

  return cleanIndicator;
}

export default OutcomeIndicator;
