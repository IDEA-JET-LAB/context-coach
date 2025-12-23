'use client';

import { useEffect } from 'react';
import { showToast, NoAnalyticsDataEmptyState } from '@/components/feedback';
import { MetricCard } from '@/components/analytics/metric-card';
import { ComparisonBar } from '@/components/analytics/comparison-bar';
import { useTeamAnalytics } from '@/lib/hooks/use-team-analytics';
import { TeamDistributionChart } from './team-distribution-chart';
import { TeamTrendChart } from './team-trend-chart';
import { MemberBreakdown } from './member-breakdown';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Target, Users } from 'lucide-react';

interface TeamAdminAnalyticsProps {
  teamId: string;
}

export function TeamAdminAnalytics({ teamId }: TeamAdminAnalyticsProps) {
  const { data, isPending, error } = useTeamAnalytics(teamId);

  // Show error toast notification
  useEffect(() => {
    if (error) {
      showToast.error('Failed to load team analytics', { description: 'Please try refreshing the page.' });
    }
  }, [error]);

  if (isPending) {
    return (
      <div className="space-y-6" data-testid="team-admin-analytics-loading">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 bg-card" />
          <Skeleton className="h-24 bg-card" />
          <Skeleton className="h-24 bg-card" />
        </div>
        <Skeleton className="h-[250px] w-full bg-card" />
        <Skeleton className="h-[250px] w-full bg-card" />
        <Skeleton className="h-[300px] w-full bg-card" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-500/30 bg-red-500/10 p-4"
        data-testid="team-admin-analytics-error"
      >
        <p className="text-red-400">Failed to load analytics</p>
      </div>
    );
  }

  if (!data || data.totalPrompts === 0) {
    return (
      <div data-testid="team-admin-analytics-empty">
        <NoAnalyticsDataEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="team-admin-analytics">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div data-testid="admin-total-prompts">
          <MetricCard
            title="Total Prompts"
            value={data.totalPrompts}
            icon={FileText}
          />
        </div>
        <div data-testid="admin-team-average">
          <MetricCard
            title="Team Average"
            value={`${data.teamAverage.toFixed(1)}/10`}
            icon={Target}
          />
        </div>
        <div data-testid="admin-active-members">
          <MetricCard
            title="Active Members"
            value={data.members.length}
            icon={Users}
          />
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium text-foreground mb-4">Score Distribution</h2>
        <TeamDistributionChart data={data.distribution} />
      </div>

      {/* Member Comparison - Top performers vs team average */}
      {data.members.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-4">Member Performance vs Team</h2>
          <div className="space-y-4">
            {data.members.slice(0, 5).map((member) => (
              <ComparisonBar
                key={member.userId}
                label={member.name}
                userValue={member.avgScore}
                compareValue={data.teamAverage}
                userLabel="Score"
                compareLabel="Team Avg"
                maxValue={10}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trend Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium text-foreground mb-4">Team Trend</h2>
        <TeamTrendChart teamId={teamId} />
      </div>

      {/* Member Breakdown */}
      <div>
        <h2 className="text-lg font-medium text-foreground mb-4">Team Members</h2>
        <MemberBreakdown members={data.members} teamId={teamId} />
      </div>
    </div>
  );
}
