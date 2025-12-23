'use client';

import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import type { InsightsSummary } from '@/lib/types/insights';

export interface SummaryCardsProps {
  summary: InsightsSummary;
  loading?: boolean;
  className?: string;
}

interface SummaryCardData {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
  icon: typeof MessageSquare;
}

function SummaryCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="summary-card-loading">
      <div className="h-4 w-24 animate-pulse rounded bg-muted mb-2" />
      <div className="h-8 w-16 animate-pulse rounded bg-muted mb-1" />
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
}: SummaryCardData) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-score-high'
      : trend === 'down'
        ? 'text-score-growth'
        : 'text-muted-foreground';

  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      data-testid="summary-card"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {trend && change && (
          <div className={cn('flex items-center gap-0.5 text-sm', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>{change}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SummaryCards({ summary, loading = false, className }: SummaryCardsProps) {
  if (loading) {
    return (
      <div
        className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}
        data-testid="summary-cards-loading"
      >
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
      </div>
    );
  }

  // Format duration
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Determine trend based on scoreChange
  const scoreTrend: 'up' | 'down' | 'stable' =
    summary.scoreChange !== null
      ? summary.scoreChange > 5
        ? 'up'
        : summary.scoreChange < -5
          ? 'down'
          : 'stable'
      : 'stable';

  const cards: SummaryCardData[] = [
    {
      title: 'Total Prompts',
      value: summary.totalPrompts.toLocaleString(),
      icon: MessageSquare,
    },
    {
      title: 'Total Sessions',
      value: summary.totalSessions.toLocaleString(),
      icon: Activity,
    },
    {
      title: 'Avg Session Duration',
      value: formatDuration(summary.avgSessionDurationMinutes),
      icon: Clock,
    },
    {
      title: 'Average Score',
      value: summary.avgPromptScore !== null
        ? summary.avgPromptScore.toFixed(1)
        : 'N/A',
      change: summary.scoreChange !== null
        ? `${summary.scoreChange > 0 ? '+' : ''}${summary.scoreChange.toFixed(1)}%`
        : undefined,
      trend: scoreTrend,
      icon: TrendingUp,
    },
  ];

  return (
    <div
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}
      data-testid="summary-cards"
    >
      {cards.map((card) => (
        <SummaryCard key={card.title} {...card} />
      ))}
    </div>
  );
}
