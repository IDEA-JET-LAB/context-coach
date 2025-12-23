'use client';

import { cn } from '@/lib/utils';
import {
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Target,
  RefreshCw,
  ChevronRight,
  Lightbulb,
  LucideIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

export interface Bottleneck {
  id: string;
  name: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  impact: number; // Estimated efficiency impact (0-100)
  suggestion?: string;
}

export interface EfficiencyTip {
  id: string;
  title: string;
  description: string;
  potentialGain: number; // Percentage improvement
  category: 'speed' | 'quality' | 'context' | 'workflow';
}

export interface EfficiencyMetric {
  name: string;
  score: number; // 0-100
  benchmark?: number; // Team/industry average
}

export interface EfficiencyCardProps {
  /** Overall efficiency score (0-100) */
  score: number;
  /** Change from previous period */
  change?: number;
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable';
  /** Individual efficiency metrics */
  metrics?: EfficiencyMetric[];
  /** Identified bottlenecks */
  bottlenecks?: Bottleneck[];
  /** Efficiency tips */
  tips?: EfficiencyTip[];
  /** Average time per prompt (seconds) */
  avgPromptTime?: number;
  /** Iterations per task */
  avgIterations?: number;
  /** First-attempt success rate */
  successRate?: number;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
  /** Click handler for tip */
  onTipClick?: (tipId: string) => void;
}

const SEVERITY_CONFIG = {
  high: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    icon: AlertTriangle,
  },
  medium: {
    color: 'text-score-growth',
    bgColor: 'bg-score-growth/10',
    icon: AlertTriangle,
  },
  low: {
    color: 'text-info',
    bgColor: 'bg-info/10',
    icon: AlertTriangle,
  },
};

const CATEGORY_ICONS: Record<EfficiencyTip['category'], LucideIcon> = {
  speed: Zap,
  quality: Target,
  context: RefreshCw,
  workflow: Clock,
};

function getEfficiencyStatus(score: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (score >= 80)
    return { label: 'Excellent', color: 'text-score-high', bgColor: 'bg-score-high' };
  if (score >= 60)
    return { label: 'Good', color: 'text-primary', bgColor: 'bg-primary' };
  if (score >= 40)
    return { label: 'Fair', color: 'text-score-medium', bgColor: 'bg-score-medium' };
  return { label: 'Needs Work', color: 'text-score-growth', bgColor: 'bg-score-growth' };
}

export function EfficiencyCard({
  score,
  change,
  trend = 'stable',
  metrics = [],
  bottlenecks = [],
  tips = [],
  avgPromptTime,
  avgIterations,
  successRate,
  loading = false,
  className,
  onClick,
  onTipClick,
}: EfficiencyCardProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="efficiency-card-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-20 w-20 animate-pulse rounded-full bg-muted mx-auto mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const status = getEfficiencyStatus(score);

  // Trend icon
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-score-high'
      : trend === 'down'
        ? 'text-score-growth'
        : 'text-muted-foreground';

  // Calculate gauge arc
  const gaugeRadius = 45;
  const gaugeWidth = 8;
  const startAngle = -135;
  const endAngle = 135;
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + (score / 100) * totalAngle;

  const polarToCartesian = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: 55 + radius * Math.cos(rad),
      y: 55 + radius * Math.sin(rad),
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

  // Prepare metrics chart data
  const metricsChartData = metrics.map((m) => ({
    name: m.name,
    score: m.score,
    benchmark: m.benchmark,
    fill:
      m.score >= (m.benchmark || 70)
        ? 'hsl(var(--score-high))'
        : m.score >= (m.benchmark || 70) * 0.7
          ? 'hsl(var(--score-medium))'
          : 'hsl(var(--score-growth))',
  }));

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Workflow efficiency score is ${score}%, rated ${status.label}.`;
    if (change) {
      desc += ` ${change > 0 ? 'Improved' : 'Declined'} by ${Math.abs(change)}%.`;
    }
    if (bottlenecks.length > 0) {
      desc += ` ${bottlenecks.length} bottleneck(s) identified.`;
    }
    if (tips.length > 0) {
      desc += ` ${tips.length} improvement tip(s) available.`;
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
      data-testid="efficiency-card"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Workflow Efficiency
        </h3>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm', trendColor)}>
            <TrendIcon className="h-4 w-4" />
            <span>
              {change > 0 ? '+' : ''}
              {change}%
            </span>
          </div>
        )}
      </div>

      {/* Main Gauge */}
      <div className="flex items-center justify-center mb-4" aria-hidden="true">
        <svg viewBox="0 0 110 80" className="w-28 h-20">
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
              score >= 80
                ? 'hsl(var(--score-high))'
                : score >= 60
                  ? 'hsl(var(--primary))'
                  : score >= 40
                    ? 'hsl(var(--score-medium))'
                    : 'hsl(var(--score-growth))'
            }
            strokeWidth={gaugeWidth}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
          {/* Score text */}
          <text
            x="55"
            y="50"
            textAnchor="middle"
            className="fill-foreground text-xl font-bold"
          >
            {score}%
          </text>
          <text
            x="55"
            y="65"
            textAnchor="middle"
            className={cn('text-xs', status.color)}
          >
            {status.label}
          </text>
        </svg>
      </div>

      {/* Quick Stats */}
      {(avgPromptTime !== undefined ||
        avgIterations !== undefined ||
        successRate !== undefined) && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {avgPromptTime !== undefined && (
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm font-medium text-foreground">
                {avgPromptTime < 60
                  ? `${avgPromptTime}s`
                  : `${(avgPromptTime / 60).toFixed(1)}m`}
              </p>
              <p className="text-[10px] text-muted-foreground">Avg Time</p>
            </div>
          )}
          {avgIterations !== undefined && (
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <RefreshCw className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm font-medium text-foreground">
                {avgIterations.toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">Iterations</p>
            </div>
          )}
          {successRate !== undefined && (
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <CheckCircle className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm font-medium text-foreground">
                {successRate}%
              </p>
              <p className="text-[10px] text-muted-foreground">Success</p>
            </div>
          )}
        </div>
      )}

      {/* Metrics Chart */}
      {metrics.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Efficiency Breakdown</p>
          <div className="h-[100px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metricsChartData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 60, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value, name, props) => {
                    const payload = (props as { payload?: EfficiencyMetric & { fill: string } }).payload;
                    const benchmark = payload?.benchmark;
                    return [
                      `${value ?? 0}%${benchmark ? ` (Benchmark: ${benchmark}%)` : ''}`,
                      'Score',
                    ];
                  }}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {metricsChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bottlenecks */}
      {bottlenecks.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Bottlenecks Identified</p>
          <div className="space-y-2">
            {bottlenecks.slice(0, 3).map((bottleneck) => {
              const config = SEVERITY_CONFIG[bottleneck.severity];
              const SeverityIcon = config.icon;
              return (
                <div
                  key={bottleneck.id}
                  className={cn(
                    'p-2 rounded-lg border',
                    config.bgColor,
                    `border-${bottleneck.severity === 'high' ? 'destructive' : bottleneck.severity === 'medium' ? 'score-growth' : 'info'}/20`
                  )}
                  data-testid={`bottleneck-${bottleneck.id}`}
                >
                  <div className="flex items-start gap-2">
                    <SeverityIcon
                      className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {bottleneck.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {bottleneck.description}
                      </p>
                      {bottleneck.suggestion && (
                        <p className="text-xs text-primary mt-1">
                          Tip: {bottleneck.suggestion}
                        </p>
                      )}
                    </div>
                    <span className={cn('text-xs font-medium', config.color)}>
                      -{bottleneck.impact}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Efficiency Tips */}
      {tips.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Quick Wins</p>
          </div>
          <div className="space-y-2">
            {tips.slice(0, 3).map((tip) => {
              const CategoryIcon = CATEGORY_ICONS[tip.category];
              return (
                <button
                  key={tip.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTipClick?.(tip.id);
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                  data-testid={`tip-${tip.id}`}
                >
                  <CategoryIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {tip.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {tip.description}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-score-high shrink-0">
                    +{tip.potentialGain}%
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Screen reader description */}
      <span className="sr-only">{getAccessibleDescription()}</span>
    </div>
  );
}

/**
 * Compact efficiency badge for inline display
 */
export function EfficiencyBadge({
  score,
  size = 'md',
  className,
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const status = getEfficiencyStatus(score);

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
        score >= 80
          ? 'bg-score-high/10 text-score-high'
          : score >= 60
            ? 'bg-primary/10 text-primary'
            : score >= 40
              ? 'bg-score-medium/10 text-score-medium'
              : 'bg-score-growth/10 text-score-growth',
        className
      )}
      data-testid="efficiency-badge"
    >
      <Gauge className={sizeConfig[size].icon} />
      <span>{score}%</span>
    </span>
  );
}
