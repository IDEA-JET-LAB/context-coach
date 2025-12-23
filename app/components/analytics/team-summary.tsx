'use client';

import { useTeamAnalytics } from '@/lib/hooks/use-team-analytics';
import { TeamDistributionChart } from './team-distribution-chart';
import { MetricCard } from '@/components/analytics/metric-card';
import { TrendIndicator } from '@/components/analytics/trend-indicator';
import { NoAnalyticsDataEmptyState } from '@/components/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Target } from 'lucide-react';

interface TeamSummaryProps {
  teamId: string;
}

export function TeamSummary({ teamId }: TeamSummaryProps) {
  const { data, isPending, error } = useTeamAnalytics(teamId);

  if (isPending) {
    return (
      <div className="space-y-4" data-testid="team-summary-loading">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 bg-card" />
          <Skeleton className="h-24 bg-card" />
          <Skeleton className="h-24 bg-card" />
        </div>
        <Skeleton className="h-[250px] w-full bg-card" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-500/30 bg-red-500/10 p-4"
        data-testid="team-summary-error"
      >
        <p className="text-red-400">Failed to load team summary</p>
      </div>
    );
  }

  if (!data || data.totalPrompts === 0) {
    return (
      <div data-testid="team-summary-empty">
        <NoAnalyticsDataEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="team-summary">
      {/* Aggregated Stats Only - No Individual Data */}
      <div className="grid grid-cols-3 gap-4">
        <div data-testid="team-total-prompts">
          <MetricCard
            title="Team Prompts"
            value={data.totalPrompts}
            icon={FileText}
          />
        </div>
        <div data-testid="team-average-score">
          <MetricCard
            title="Team Average"
            value={`${data.teamAverage.toFixed(1)}/10`}
            icon={Target}
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-4" data-testid="team-trend">
          <p className="text-sm font-medium text-muted-foreground">Trend</p>
          <div className="mt-2">
            <TrendIndicator direction={data.teamTrend} size="lg" />
          </div>
        </div>
      </div>

      {/* Score Distribution (aggregated, no individual data) */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium text-foreground mb-4">
          Team Score Distribution
        </h2>
        <TeamDistributionChart data={data.distribution} />
      </div>

      {/* Positive Messaging */}
      <div className="rounded-lg bg-teal-500/10 border border-teal-500/30 p-4">
        <p className="text-teal-100 text-sm">
          Keep up the great work! Your prompts contribute to the team&apos;s improvement journey.
        </p>
      </div>
    </div>
  );
}
