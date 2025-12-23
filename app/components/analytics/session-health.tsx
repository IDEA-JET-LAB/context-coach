'use client';

import { cn } from '@/lib/utils';
import {
  Heart,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Clock,
  Zap,
  Brain,
  MessageSquare,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

export type HealthStatus = 'excellent' | 'healthy' | 'warning' | 'critical';

export interface HealthFactor {
  id: string;
  name: string;
  score: number; // 0-100
  weight: number; // 0-1, contribution to overall score
  status: HealthStatus;
  description?: string;
}

export interface HealthTrendPoint {
  timestamp: string;
  score: number;
  sessionId?: string;
}

export interface SessionHealthProps {
  /** Overall health score (0-100) */
  score: number;
  /** Health status based on score */
  status?: HealthStatus;
  /** Breakdown of health factors */
  factors?: HealthFactor[];
  /** Health trend over sessions */
  trend?: HealthTrendPoint[];
  /** Trend direction */
  trendDirection?: 'up' | 'down' | 'stable';
  /** Change from previous session */
  change?: number;
  /** Current session duration in minutes */
  sessionDuration?: number;
  /** Number of prompts in session */
  promptCount?: number;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
}

const STATUS_CONFIG = {
  excellent: {
    icon: CheckCircle,
    label: 'Excellent',
    color: 'text-score-high',
    bgColor: 'bg-score-high',
    description: 'Session is highly productive',
  },
  healthy: {
    icon: Heart,
    label: 'Healthy',
    color: 'text-primary',
    bgColor: 'bg-primary',
    description: 'Session is going well',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    color: 'text-score-growth',
    bgColor: 'bg-score-growth',
    description: 'Some factors need attention',
  },
  critical: {
    icon: XCircle,
    label: 'Critical',
    color: 'text-destructive',
    bgColor: 'bg-destructive',
    description: 'Consider taking a break or resetting',
  },
};

const FACTOR_ICONS: Record<string, typeof Heart> = {
  context: Brain,
  responsiveness: Zap,
  duration: Clock,
  engagement: MessageSquare,
  default: Activity,
};

function getFactorIcon(factorId: string): typeof Heart {
  const normalizedId = factorId.toLowerCase();
  for (const [key, icon] of Object.entries(FACTOR_ICONS)) {
    if (normalizedId.includes(key)) return icon;
  }
  return FACTOR_ICONS.default ?? Activity;
}

function getHealthStatus(score: number): HealthStatus {
  if (score >= 85) return 'excellent';
  if (score >= 65) return 'healthy';
  if (score >= 40) return 'warning';
  return 'critical';
}

export function SessionHealth({
  score,
  status,
  factors = [],
  trend = [],
  trendDirection = 'stable',
  change,
  sessionDuration,
  promptCount,
  loading = false,
  className,
  onClick,
}: SessionHealthProps) {
  // Derive status from score if not provided
  const derivedStatus = status || getHealthStatus(score);
  const config = STATUS_CONFIG[derivedStatus];
  const StatusIcon = config.icon;

  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="session-health-loading"
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

  // Calculate gauge arc
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

  // Trend icon
  const TrendIcon =
    trendDirection === 'up'
      ? TrendingUp
      : trendDirection === 'down'
        ? TrendingDown
        : Minus;
  const trendColor =
    trendDirection === 'up'
      ? 'text-score-high'
      : trendDirection === 'down'
        ? 'text-score-growth'
        : 'text-muted-foreground';

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Session health score is ${score}%, status: ${config.label}.`;
    if (factors.length > 0) {
      desc += ` Factors: ${factors.map((f) => `${f.name} ${f.score}%`).join(', ')}.`;
    }
    if (sessionDuration) {
      desc += ` Session duration: ${sessionDuration} minutes.`;
    }
    if (promptCount) {
      desc += ` Prompts in session: ${promptCount}.`;
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
      data-testid="session-health"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Session Health
        </h3>
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
              derivedStatus === 'excellent'
                ? 'hsl(var(--score-high))'
                : derivedStatus === 'healthy'
                  ? 'hsl(var(--primary))'
                  : derivedStatus === 'warning'
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
            className={cn('fill-foreground text-2xl font-bold')}
          >
            {score}
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

      {/* Change indicator */}
      {change !== undefined && (
        <div className="flex items-center justify-center gap-1 mb-4">
          <TrendIcon className={cn('h-4 w-4', trendColor)} />
          <span className={cn('text-sm', trendColor)}>
            {change > 0 ? '+' : ''}
            {change}% from last session
          </span>
        </div>
      )}

      {/* Session Stats */}
      {(sessionDuration !== undefined || promptCount !== undefined) && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {sessionDuration !== undefined && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-medium text-foreground">
                  {sessionDuration < 60
                    ? `${sessionDuration}m`
                    : `${Math.floor(sessionDuration / 60)}h ${sessionDuration % 60}m`}
                </p>
              </div>
            </div>
          )}
          {promptCount !== undefined && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Prompts</p>
                <p className="text-sm font-medium text-foreground">
                  {promptCount}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Health Factors */}
      {factors.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Health Factors</p>
          {factors.map((factor) => {
            const FactorIcon = getFactorIcon(factor.id);
            const factorConfig = STATUS_CONFIG[factor.status];
            return (
              <div key={factor.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FactorIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {factor.name}
                    </span>
                  </div>
                  <span
                    className={cn('text-xs font-medium', factorConfig.color)}
                  >
                    {factor.score}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      factorConfig.bgColor
                    )}
                    style={{ width: `${factor.score}%` }}
                  />
                </div>
                {factor.description && (
                  <p className="text-[10px] text-muted-foreground/70">
                    {factor.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Trend Chart */}
      {trend.length > 1 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Health Over Sessions</p>
          <div className="h-[80px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trend}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="timestamp"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
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
                  formatter={(value) => [`${value ?? 0}%`, 'Health']}
                  labelFormatter={(label) =>
                    format(new Date(label), 'MMM d, h:mm a')
                  }
                />
                <ReferenceLine
                  y={65}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                  activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Description */}
      <p className="mt-4 text-xs text-muted-foreground text-center">
        {config.description}
      </p>

      {/* Drill-down indicator */}
      {onClick && (
        <div className="mt-2 flex items-center justify-center text-xs text-muted-foreground">
          <span>View details</span>
          <ChevronRight className="h-3 w-3 ml-1" />
        </div>
      )}

      {/* Screen reader description */}
      <span className="sr-only">{getAccessibleDescription()}</span>
    </div>
  );
}

/**
 * Compact health badge for inline display
 */
export function SessionHealthBadge({
  score,
  size = 'md',
  className,
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const status = getHealthStatus(score);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const sizeConfig = {
    sm: { badge: 'px-1.5 py-0.5 text-xs', icon: 'h-3 w-3' },
    md: { badge: 'px-2 py-1 text-sm', icon: 'h-4 w-4' },
    lg: { badge: 'px-3 py-1.5 text-base', icon: 'h-5 w-5' },
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        sizeConfig[size].badge,
        status === 'excellent'
          ? 'bg-score-high/10 text-score-high'
          : status === 'healthy'
            ? 'bg-primary/10 text-primary'
            : status === 'warning'
              ? 'bg-score-growth/10 text-score-growth'
              : 'bg-destructive/10 text-destructive',
        className
      )}
      data-testid="session-health-badge"
    >
      <StatusIcon className={sizeConfig[size].icon} />
      <span>{score}%</span>
    </span>
  );
}
