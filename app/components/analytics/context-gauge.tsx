'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';

export interface ContextUsagePoint {
  timestamp: string;
  usage: number;
  label?: string;
}

export interface ContextGaugeProps {
  /** Current context usage percentage (0-100) */
  usage: number;
  /** Warning threshold percentage */
  warningThreshold?: number;
  /** Critical threshold percentage */
  criticalThreshold?: number;
  /** Historical usage data for timeline */
  history?: ContextUsagePoint[];
  /** Maximum token capacity */
  maxTokens?: number;
  /** Current token count */
  currentTokens?: number;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
}

const CHART_COLORS = {
  area: 'hsl(var(--primary))',
  areaFill: 'hsl(var(--primary))',
  warning: 'hsl(var(--score-growth))',
  critical: 'hsl(var(--destructive))',
  grid: 'hsl(var(--border))',
  axisText: 'hsl(var(--muted-foreground))',
};

export function ContextGauge({
  usage,
  warningThreshold = 70,
  criticalThreshold = 90,
  history = [],
  maxTokens,
  currentTokens,
  loading = false,
  className,
  onClick,
}: ContextGaugeProps) {
  const getStatus = () => {
    if (usage >= criticalThreshold) return 'critical';
    if (usage >= warningThreshold) return 'warning';
    return 'healthy';
  };

  const status = getStatus();

  const statusConfig = {
    healthy: {
      color: 'text-score-high',
      bgColor: 'bg-score-high',
      label: 'Healthy',
      description: 'Context usage is within optimal range',
    },
    warning: {
      color: 'text-score-growth',
      bgColor: 'bg-score-growth',
      label: 'Growing',
      description: 'Context is filling up - consider a summary',
    },
    critical: {
      color: 'text-destructive',
      bgColor: 'bg-destructive',
      label: 'Critical',
      description: 'Context nearly exhausted - action needed',
    },
  };

  const config = statusConfig[status];

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-4',
          className
        )}
        data-testid="context-gauge-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-24 animate-pulse rounded bg-muted mb-4" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  // Calculate the gauge arc path
  const gaugeRadius = 80;
  const gaugeWidth = 12;
  const startAngle = -135;
  const endAngle = 135;
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + (usage / 100) * totalAngle;

  const polarToCartesian = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: 100 + radius * Math.cos(rad),
      y: 100 + radius * Math.sin(rad),
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

  // Warning and critical threshold positions
  const warningAngle = startAngle + (warningThreshold / 100) * totalAngle;
  const criticalAngle = startAngle + (criticalThreshold / 100) * totalAngle;
  const warningPos = polarToCartesian(warningAngle, gaugeRadius);
  const criticalPos = polarToCartesian(criticalAngle, gaugeRadius);

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Context window is ${usage}% full.`;
    if (status === 'critical') {
      desc += ' This is critical - consider starting a new session or summarizing context.';
    } else if (status === 'warning') {
      desc += ' The context is growing - consider summarizing soon.';
    }
    if (currentTokens && maxTokens) {
      desc += ` Using ${currentTokens.toLocaleString()} of ${maxTokens.toLocaleString()} tokens.`;
    }
    return desc;
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        onClick && 'cursor-pointer hover:border-primary/50 transition-colors',
        className
      )}
      onClick={onClick}
      data-testid="context-gauge"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Context Usage</h3>
        <div className={cn('flex items-center gap-1 text-sm', config.color)}>
          {status === 'warning' && <TrendingUp className="h-4 w-4" />}
          {status === 'critical' && <AlertTriangle className="h-4 w-4" />}
          <span>{config.label}</span>
        </div>
      </div>

      {/* Gauge Visualization */}
      <div className="relative flex justify-center" aria-hidden="true">
        <svg viewBox="0 0 200 130" className="w-full max-w-[200px]">
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
              status === 'critical'
                ? 'hsl(var(--destructive))'
                : status === 'warning'
                  ? 'hsl(var(--score-growth))'
                  : 'hsl(var(--primary))'
            }
            strokeWidth={gaugeWidth}
            strokeLinecap="round"
            className="transition-all duration-500"
          />

          {/* Threshold markers */}
          <circle
            cx={warningPos.x}
            cy={warningPos.y}
            r="3"
            fill="hsl(var(--score-growth))"
          />
          <circle
            cx={criticalPos.x}
            cy={criticalPos.y}
            r="3"
            fill="hsl(var(--destructive))"
          />

          {/* Center text */}
          <text
            x="100"
            y="95"
            textAnchor="middle"
            className="fill-foreground text-3xl font-bold"
          >
            {usage}%
          </text>
          <text
            x="100"
            y="115"
            textAnchor="middle"
            className="fill-muted-foreground text-xs"
          >
            {currentTokens && maxTokens
              ? `${(currentTokens / 1000).toFixed(1)}k / ${(maxTokens / 1000).toFixed(0)}k tokens`
              : 'of context used'}
          </text>
        </svg>
      </div>

      {/* Description */}
      <p className="mt-2 text-xs text-muted-foreground text-center">
        {config.description}
      </p>

      {/* History Timeline */}
      {history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Context exhaustion timeline</span>
          </div>
          <div className="h-[80px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="contextGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.areaFill} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.areaFill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  stroke={CHART_COLORS.axisText}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axisText }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  hide
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  formatter={(value) => [`${value ?? 0}%`, 'Usage']}
                />
                <ReferenceLine
                  y={warningThreshold}
                  stroke={CHART_COLORS.warning}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  y={criticalThreshold}
                  stroke={CHART_COLORS.critical}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
                <Area
                  type="monotone"
                  dataKey="usage"
                  stroke={CHART_COLORS.area}
                  fill="url(#contextGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Screen reader description */}
      <span className="sr-only">
        {getAccessibleDescription()}
        {history.length > 0 && ` Historical data shows ${history.length} data points tracking context usage over time.`}
      </span>
    </div>
  );
}
