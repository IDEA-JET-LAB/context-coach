'use client';

import { cn } from '@/lib/utils';
import {
  Smile,
  Meh,
  Frown,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { format } from 'date-fns';

export type SentimentLevel = 'positive' | 'neutral' | 'frustrated' | 'confused';

export interface SentimentDataPoint {
  timestamp: string;
  sentiment: SentimentLevel;
  score: number; // -1 to 1 scale
  promptId?: string;
  label?: string;
}

export interface FrustrationSpike {
  timestamp: string;
  intensity: number; // 0-1 scale
  duration: number; // in minutes
  promptCount: number;
  trigger?: string;
}

export interface SentimentTimelineProps {
  /** Sentiment data points over time */
  data: SentimentDataPoint[];
  /** Overall sentiment trend */
  trend?: 'improving' | 'declining' | 'stable';
  /** Distribution percentages */
  distribution?: {
    positive: number;
    neutral: number;
    frustrated: number;
    confused: number;
  };
  /** Detected frustration spikes */
  frustrationSpikes?: FrustrationSpike[];
  /** Height of the chart */
  height?: number;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
  /** Click handler for specific data point */
  onPointClick?: (point: SentimentDataPoint) => void;
}

const SENTIMENT_CONFIG = {
  positive: {
    icon: Smile,
    label: 'Positive',
    color: 'text-score-high',
    bgColor: 'bg-score-high/10',
    chartColor: 'hsl(var(--score-high))',
  },
  neutral: {
    icon: Meh,
    label: 'Neutral',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    chartColor: 'hsl(var(--muted-foreground))',
  },
  frustrated: {
    icon: Frown,
    label: 'Frustrated',
    color: 'text-score-growth',
    bgColor: 'bg-score-growth/10',
    chartColor: 'hsl(var(--score-growth))',
  },
  confused: {
    icon: AlertCircle,
    label: 'Confused',
    color: 'text-info',
    bgColor: 'bg-info/10',
    chartColor: 'hsl(var(--info))',
  },
};

const CHART_COLORS = {
  positive: 'hsl(var(--score-high))',
  negative: 'hsl(var(--score-growth))',
  neutral: 'hsl(var(--muted-foreground))',
  spike: 'hsl(var(--destructive))',
  grid: 'hsl(var(--border))',
  axisText: 'hsl(var(--muted-foreground))',
};

export function SentimentTimeline({
  data,
  trend = 'stable',
  distribution,
  frustrationSpikes = [],
  height = 200,
  loading = false,
  className,
  onClick,
  onPointClick,
}: SentimentTimelineProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="sentiment-timeline-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-[200px] animate-pulse rounded bg-muted mb-4" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 w-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-4 flex items-center justify-center',
          className
        )}
        style={{ minHeight: height + 100 }}
        data-testid="sentiment-timeline-empty"
      >
        <p className="text-muted-foreground">No sentiment data available</p>
      </div>
    );
  }

  // Process data for timeline chart
  const chartData = data.map((point) => ({
    ...point,
    // Convert sentiment to numeric for charting (-1 to 1)
    value: point.score,
    // Add visual category
    fill:
      point.score > 0.3
        ? CHART_COLORS.positive
        : point.score < -0.3
          ? CHART_COLORS.negative
          : CHART_COLORS.neutral,
  }));

  // Calculate trend icon
  const TrendIcon =
    trend === 'improving'
      ? TrendingUp
      : trend === 'declining'
        ? TrendingDown
        : Minus;
  const trendColor =
    trend === 'improving'
      ? 'text-score-high'
      : trend === 'declining'
        ? 'text-score-growth'
        : 'text-muted-foreground';
  const trendLabel =
    trend === 'improving'
      ? 'Improving'
      : trend === 'declining'
        ? 'Declining'
        : 'Stable';

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Sentiment analysis timeline showing ${data.length} data points.`;
    desc += ` Overall trend is ${trendLabel.toLowerCase()}.`;
    if (distribution) {
      desc += ` Distribution: ${distribution.positive}% positive, ${distribution.neutral}% neutral, ${distribution.frustrated}% frustrated, ${distribution.confused}% confused.`;
    }
    if (frustrationSpikes.length > 0) {
      desc += ` ${frustrationSpikes.length} frustration spike(s) detected.`;
    }
    return desc;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: SentimentDataPoint }> }) => {
    if (!active || !payload?.length || !payload[0]) return null;
    const point = payload[0].payload;
    const config = SENTIMENT_CONFIG[point.sentiment];
    const Icon = config.icon;

    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn('h-4 w-4', config.color)} />
          <span className="text-sm font-medium text-foreground">
            {config.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(new Date(point.timestamp), 'MMM d, h:mm a')}
        </p>
        {point.label && (
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
            {point.label}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        onClick && 'cursor-pointer hover:border-primary/50 transition-colors',
        className
      )}
      onClick={onClick}
      data-testid="sentiment-timeline"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Sentiment Analysis
        </h3>
        <div className={cn('flex items-center gap-1 text-sm', trendColor)}>
          <TrendIcon className="h-4 w-4" />
          <span>{trendLabel}</span>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="h-[200px]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="sentimentGradientPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.positive} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.positive} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="sentimentGradientNeg" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%" stopColor={CHART_COLORS.negative} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.negative} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              stroke={CHART_COLORS.axisText}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisText }}
              tickFormatter={(value) => format(new Date(value), 'MMM d')}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[-1, 1]}
              stroke={CHART_COLORS.axisText}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisText }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                value === 1 ? '+' : value === -1 ? '-' : '0'
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#sentimentGradientPos)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Frustration Spikes Alert */}
      {frustrationSpikes.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-score-growth/10 border border-score-growth/20">
          <div className="flex items-center gap-2 text-score-growth">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">
              {frustrationSpikes.length} Frustration Spike
              {frustrationSpikes.length > 1 ? 's' : ''} Detected
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {frustrationSpikes.slice(0, 3).map((spike, index) => (
              <p key={index} className="text-xs text-muted-foreground">
                {format(new Date(spike.timestamp), 'MMM d, h:mm a')} -{' '}
                {spike.promptCount} prompts over {spike.duration} min
                {spike.trigger && ` (${spike.trigger})`}
              </p>
            ))}
            {frustrationSpikes.length > 3 && (
              <p className="text-xs text-muted-foreground">
                + {frustrationSpikes.length - 3} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Distribution Breakdown */}
      {distribution && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Distribution</p>
          <div className="flex gap-3 flex-wrap">
            {(Object.entries(distribution) as [SentimentLevel, number][]).map(
              ([sentiment, percentage]) => {
                const config = SENTIMENT_CONFIG[sentiment];
                const Icon = config.icon;
                return (
                  <div
                    key={sentiment}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
                      config.bgColor
                    )}
                  >
                    <Icon className={cn('h-3 w-3', config.color)} />
                    <span className={config.color}>{percentage}%</span>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* Screen reader description */}
      <span className="sr-only">{getAccessibleDescription()}</span>
    </div>
  );
}

/**
 * Compact sentiment indicator for inline use
 */
export function SentimentIndicator({
  sentiment,
  size = 'md',
  showLabel = true,
  className,
}: {
  sentiment: SentimentLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}) {
  const config = SENTIMENT_CONFIG[sentiment];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        config.color,
        textSize,
        className
      )}
      data-testid={`sentiment-indicator-${sentiment}`}
    >
      <Icon className={iconSize} aria-hidden="true" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
