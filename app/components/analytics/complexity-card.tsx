'use client';

import { cn } from '@/lib/utils';
import {
  Brain,
  FileText,
  Layers,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

export interface ComplexityBreakdown {
  /** Prompt length factor (0-10) */
  length: number;
  /** Structure/formatting factor (0-10) */
  structure: number;
  /** Specificity/clarity factor (0-10) */
  specificity: number;
  /** Context requirements factor (0-10) */
  context: number;
}

export interface ComplexityTrendPoint {
  date: string;
  score: number;
  promptCount?: number;
}

export interface ComplexityCardProps {
  /** Overall complexity score (0-10) */
  score: number;
  /** Score breakdown by factor */
  breakdown?: ComplexityBreakdown;
  /** Complexity trend over time */
  trend?: ComplexityTrendPoint[];
  /** Trend direction */
  trendDirection?: 'up' | 'down' | 'stable';
  /** Change from previous period */
  change?: number;
  /** Recommendation based on complexity */
  recommendation?: string;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
}

const BREAKDOWN_CONFIG = {
  length: {
    icon: FileText,
    label: 'Length',
    description: 'Word count and detail level',
    color: 'hsl(var(--chart-1))',
  },
  structure: {
    icon: Layers,
    label: 'Structure',
    description: 'Formatting, lists, sections',
    color: 'hsl(var(--chart-2))',
  },
  specificity: {
    icon: Target,
    label: 'Specificity',
    description: 'Clarity and precision',
    color: 'hsl(var(--chart-3))',
  },
  context: {
    icon: Brain,
    label: 'Context',
    description: 'Background info provided',
    color: 'hsl(var(--chart-4))',
  },
};

const CHART_COLORS = {
  line: 'hsl(var(--primary))',
  grid: 'hsl(var(--border))',
  axisText: 'hsl(var(--muted-foreground))',
};

// Helper to get score color
function getScoreColor(score: number): string {
  if (score >= 7) return 'text-score-high';
  if (score >= 4) return 'text-score-medium';
  return 'text-score-growth';
}

function getScoreBgColor(score: number): string {
  if (score >= 7) return 'bg-score-high';
  if (score >= 4) return 'bg-score-medium';
  return 'bg-score-growth';
}

export function ComplexityCard({
  score,
  breakdown,
  trend = [],
  trendDirection = 'stable',
  change,
  recommendation,
  loading = false,
  className,
  onClick,
}: ComplexityCardProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="complexity-card-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-16 w-16 animate-pulse rounded-full bg-muted mx-auto mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate trend icon and color
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
    let desc = `Prompt complexity score is ${score.toFixed(1)} out of 10.`;
    if (breakdown) {
      desc += ` Breakdown: Length ${breakdown.length.toFixed(1)}, Structure ${breakdown.structure.toFixed(1)}, Specificity ${breakdown.specificity.toFixed(1)}, Context ${breakdown.context.toFixed(1)}.`;
    }
    if (change) {
      desc += ` ${change > 0 ? 'Up' : 'Down'} ${Math.abs(change).toFixed(1)} from previous period.`;
    }
    if (recommendation) {
      desc += ` Recommendation: ${recommendation}`;
    }
    return desc;
  };

  // Prepare breakdown chart data
  const breakdownData = breakdown
    ? Object.entries(breakdown).map(([key, value]) => ({
        name: BREAKDOWN_CONFIG[key as keyof ComplexityBreakdown].label,
        value,
        fill: BREAKDOWN_CONFIG[key as keyof ComplexityBreakdown].color,
      }))
    : [];

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        onClick && 'cursor-pointer hover:border-primary/50 transition-colors',
        className
      )}
      onClick={onClick}
      data-testid="complexity-card"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Prompt Complexity
        </h3>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm', trendColor)}>
            <TrendIcon className="h-4 w-4" />
            <span>{change > 0 ? '+' : ''}{change.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Main Score Display */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative">
          {/* Circular progress background */}
          <svg className="w-24 h-24 transform -rotate-90" aria-hidden="true">
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke={
                score >= 7
                  ? 'hsl(var(--score-high))'
                  : score >= 4
                    ? 'hsl(var(--score-medium))'
                    : 'hsl(var(--score-growth))'
              }
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(score / 10) * 251.2} 251.2`}
              className="transition-all duration-500"
            />
          </svg>
          {/* Score text in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-2xl font-bold', getScoreColor(score))}>
              {score.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">/ 10</span>
          </div>
        </div>
      </div>

      {/* Breakdown Bars */}
      {breakdown && (
        <div className="space-y-3 mb-4">
          {Object.entries(breakdown).map(([key, value]) => {
            const config = BREAKDOWN_CONFIG[key as keyof ComplexityBreakdown];
            const Icon = config.icon;
            return (
              <div key={key} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="text-xs text-muted-foreground">
                      {config.label}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {value.toFixed(1)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(value / 10) * 100}%`,
                      backgroundColor: config.color,
                    }}
                  />
                </div>
                {/* Tooltip on hover */}
                <div className="hidden group-hover:block mt-1">
                  <p className="text-xs text-muted-foreground/70">
                    {config.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trend Chart */}
      {trend.length > 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Trend Over Time</p>
          <div className="h-[100px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trend}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke={CHART_COLORS.axisText}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axisText }}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  stroke={CHART_COLORS.axisText}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axisText }}
                  tickLine={false}
                  axisLine={false}
                  ticks={[0, 5, 10]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  formatter={(value) => [Number(value ?? 0).toFixed(1), 'Score']}
                  labelFormatter={(label) =>
                    format(new Date(label), 'MMM d, yyyy')
                  }
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={CHART_COLORS.line}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.line, r: 3 }}
                  activeDot={{ r: 5, fill: CHART_COLORS.line }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/20">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <p className="text-xs text-foreground">{recommendation}</p>
          </div>
        </div>
      )}

      {/* Drill-down indicator */}
      {onClick && (
        <div className="mt-4 flex items-center justify-center text-xs text-muted-foreground">
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
 * Compact complexity score badge for inline use
 */
export function ComplexityBadge({
  score,
  size = 'md',
  className,
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeConfig = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        sizeConfig[size],
        score >= 7
          ? 'bg-score-high/10 text-score-high'
          : score >= 4
            ? 'bg-score-medium/10 text-score-medium'
            : 'bg-score-growth/10 text-score-growth',
        className
      )}
      data-testid="complexity-badge"
    >
      <Brain className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      <span>{score.toFixed(1)}</span>
    </span>
  );
}
