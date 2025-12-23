'use client';

import { useTeamAnalytics } from '@/lib/hooks/use-team-analytics';
import { TeamDistributionChart } from './team-distribution-chart';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamSummaryProps {
  teamId: string;
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-5 w-5 text-teal-500" />;
    case 'down':
      return <TrendingDown className="h-5 w-5 text-red-400" />;
    default:
      return <Minus className="h-5 w-5 text-muted-foreground" />;
  }
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
      <div
        className="rounded-lg border border-border bg-card p-8 text-center"
        data-testid="team-summary-empty"
      >
        <p className="text-foreground text-lg mb-2">No team data yet</p>
        <p className="text-muted-foreground">
          Team statistics will appear as members start capturing prompts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="team-summary">
      {/* Aggregated Stats Only - No Individual Data */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-card p-4 border border-border">
          <p className="text-sm text-muted-foreground">Team Prompts</p>
          <p className="text-2xl font-bold text-foreground" data-testid="team-total-prompts">
            {data.totalPrompts}
          </p>
        </div>
        <div className="rounded-lg bg-card p-4 border border-border">
          <p className="text-sm text-muted-foreground">Team Average</p>
          <p className="text-2xl font-bold text-primary" data-testid="team-average-score">
            {data.teamAverage.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-card p-4 border border-border">
          <p className="text-sm text-muted-foreground">Trend</p>
          <div className="flex items-center gap-2 mt-1">
            <TrendIcon trend={data.teamTrend} />
            <span className="text-foreground capitalize" data-testid="team-trend">
              {data.teamTrend}
            </span>
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
