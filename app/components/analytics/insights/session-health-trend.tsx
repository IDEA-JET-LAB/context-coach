'use client';

import { cn } from '@/lib/utils';
import {
  Heart,
  AlertTriangle,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import type { InsightsSessionHealth } from '@/lib/types/insights';

export interface SessionHealthTrendProps {
  sessionHealth: InsightsSessionHealth;
  loading?: boolean;
  className?: string;
}

const HEALTH_STATUS_CONFIG = {
  excellent: {
    icon: CheckCircle,
    label: 'Excellent',
    color: 'text-score-high',
    bgColor: 'bg-score-high',
  },
  healthy: {
    icon: Heart,
    label: 'Healthy',
    color: 'text-primary',
    bgColor: 'bg-primary',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    color: 'text-score-growth',
    bgColor: 'bg-score-growth',
  },
  critical: {
    icon: XCircle,
    label: 'Critical',
    color: 'text-destructive',
    bgColor: 'bg-destructive',
  },
};

function getHealthStatus(score: number): 'excellent' | 'healthy' | 'warning' | 'critical' {
  if (score >= 85) return 'excellent';
  if (score >= 65) return 'healthy';
  if (score >= 40) return 'warning';
  return 'critical';
}

export function SessionHealthTrend({
  sessionHealth,
  loading = false,
  className,
}: SessionHealthTrendProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="session-health-trend-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-24 w-24 animate-pulse rounded-full bg-muted mx-auto mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const status = getHealthStatus(sessionHealth.avgHealthScore);
  const config = HEALTH_STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  // Calculate gauge arc
  const score = sessionHealth.avgHealthScore;
  const gaugeRadius = 50;
  const gaugeWidth = 8;
  const startAngle = -135;
  const endAngle = 135;
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + (score / 100) * totalAngle;

  const polarToCartesian = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: 60 + radius * Math.cos(rad),
      y: 60 + radius * Math.sin(rad),
    };
  };

  const describeArc = (startAng: number, endAng: number, radius: number) => {
    const start = polarToCartesian(startAng, radius);
    const end = polarToCartesian(endAng, radius);
    const largeArcFlag = Math.abs(endAng - startAng) > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  const backgroundArc = describeArc(startAngle, endAngle, gaugeRadius);
  const progressArc = describeArc(startAngle, currentAngle, gaugeRadius);

  const total = sessionHealth.healthDistribution.healthy +
    sessionHealth.healthDistribution.warning +
    sessionHealth.healthDistribution.critical;

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="session-health-trend"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Session Health</h3>
        <div className={cn('flex items-center gap-1', config.color)}>
          <StatusIcon className="h-4 w-4" />
          <span className="text-sm">{config.label}</span>
        </div>
      </div>

      {/* Main Gauge */}
      <div className="flex items-center justify-center mb-4" aria-hidden="true">
        <svg viewBox="0 0 120 90" className="w-32 h-24">
          {/* Background arc */}
          <path
            d={backgroundArc}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={gaugeWidth}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={progressArc}
            fill="none"
            stroke={
              status === 'excellent'
                ? 'hsl(var(--score-high))'
                : status === 'healthy'
                  ? 'hsl(var(--primary))'
                  : status === 'warning'
                    ? 'hsl(var(--score-growth))'
                    : 'hsl(var(--destructive))'
            }
            strokeWidth={gaugeWidth}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
          {/* Score text */}
          <text
            x="60"
            y="55"
            textAnchor="middle"
            className="fill-foreground text-2xl font-bold"
          >
            {Math.round(score)}
          </text>
          <text
            x="60"
            y="72"
            textAnchor="middle"
            className="fill-muted-foreground text-xs"
          >
            / 100
          </text>
        </svg>
      </div>

      {/* Health Distribution */}
      <div className="space-y-2 mb-4">
        <p className="text-xs text-muted-foreground">Session Distribution</p>
        <div className="flex gap-2">
          <div className="flex-1 text-center p-2 rounded-lg bg-score-high/10">
            <p className="text-lg font-bold text-score-high">
              {sessionHealth.healthDistribution.healthy}
            </p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </div>
          <div className="flex-1 text-center p-2 rounded-lg bg-score-growth/10">
            <p className="text-lg font-bold text-score-growth">
              {sessionHealth.healthDistribution.warning}
            </p>
            <p className="text-xs text-muted-foreground">Warning</p>
          </div>
          <div className="flex-1 text-center p-2 rounded-lg bg-destructive/10">
            <p className="text-lg font-bold text-destructive">
              {sessionHealth.healthDistribution.critical}
            </p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="pt-4 border-t border-border space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Avg Duration</span>
          <span className="text-sm font-medium text-foreground">
            {sessionHealth.avgSessionDuration.toFixed(1)} min
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Context Exhaustion Rate</span>
          <span className="text-sm font-medium text-foreground">
            {(sessionHealth.contextExhaustionRate * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Accessible description */}
      <span className="sr-only">
        Session health score is {Math.round(score)} out of 100, status: {config.label}.
        {sessionHealth.healthDistribution.healthy} healthy sessions,
        {sessionHealth.healthDistribution.warning} warning sessions,
        {sessionHealth.healthDistribution.critical} critical sessions.
      </span>
    </div>
  );
}
