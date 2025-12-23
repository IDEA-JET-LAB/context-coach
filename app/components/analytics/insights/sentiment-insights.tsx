'use client';

import { cn } from '@/lib/utils';
import {
  Smile,
  Frown,
  Meh,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { InsightsSentiment } from '@/lib/types/insights';

export interface SentimentInsightsProps {
  sentiment: InsightsSentiment;
  loading?: boolean;
  className?: string;
}

const TREND_CONFIG = {
  improving: {
    icon: TrendingUp,
    label: 'Improving',
    color: 'text-score-high',
  },
  stable: {
    icon: Minus,
    label: 'Stable',
    color: 'text-muted-foreground',
  },
  declining: {
    icon: TrendingDown,
    label: 'Declining',
    color: 'text-score-growth',
  },
};

export function SentimentInsights({
  sentiment,
  loading = false,
  className,
}: SentimentInsightsProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="sentiment-insights-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-[120px] animate-pulse rounded bg-muted mb-4" />
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  const config = TREND_CONFIG[sentiment.trend];
  const TrendIcon = config.icon;

  // Distribution data for visualization
  const distributionData = [
    { name: 'Positive', value: sentiment.overallPoliteRate * 100, color: 'hsl(var(--score-high))' },
    { name: 'Frustrated', value: sentiment.overallFrustratedRate * 100, color: 'hsl(var(--score-growth))' },
    {
      name: 'Neutral',
      value: Math.max(0, 100 - (sentiment.overallPoliteRate + sentiment.overallFrustratedRate) * 100),
      color: 'hsl(var(--muted-foreground))',
    },
  ];

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="sentiment-insights"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Sentiment Analysis</h3>
        <div className={cn('flex items-center gap-1 text-sm', config.color)}>
          <TrendIcon className="h-4 w-4" />
          <span>{config.label}</span>
        </div>
      </div>

      {/* Politeness Ratio Display */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Politeness Ratio</span>
            <span className="text-sm font-medium text-foreground">
              {sentiment.politenessRatio.toFixed(1)}:1
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-score-high transition-all duration-300"
              style={{
                width: `${Math.min(100, (sentiment.politenessRatio / 10) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Distribution Bars */}
      <div className="space-y-3 mb-4">
        {distributionData.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <div className="w-20 flex items-center gap-1.5">
              {item.name === 'Positive' && <Smile className="h-3.5 w-3.5 text-score-high" />}
              {item.name === 'Frustrated' && <Frown className="h-3.5 w-3.5 text-score-growth" />}
              {item.name === 'Neutral' && <Meh className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${item.value}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <span className="w-10 text-xs text-muted-foreground text-right">
              {item.value.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {/* Work Style Sentiment Breakdown */}
      {Object.keys(sentiment.byWorkStyle).length > 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Sentiment by Work Style</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(sentiment.byWorkStyle)
              .slice(0, 4)
              .map(([style, data]) => (
                <div
                  key={style}
                  className="flex items-center justify-between p-2 rounded bg-muted/30"
                >
                  <span className="text-xs text-muted-foreground capitalize">{style}</span>
                  <div className="flex items-center gap-1">
                    <Smile className="h-3 w-3 text-score-high" />
                    <span className="text-xs text-foreground">
                      {(data.politeRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Accessible description */}
      <span className="sr-only">
        Sentiment analysis showing {sentiment.overallPoliteRate * 100}% positive,
        {sentiment.overallFrustratedRate * 100}% frustrated prompts.
        Overall trend is {sentiment.trend}.
      </span>
    </div>
  );
}
