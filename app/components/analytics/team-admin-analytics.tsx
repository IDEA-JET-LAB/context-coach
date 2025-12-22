'use client';

import { useTeamAnalytics } from '@/lib/hooks/use-team-analytics';
import { TeamDistributionChart } from './team-distribution-chart';
import { TeamTrendChart } from './team-trend-chart';
import { MemberBreakdown } from './member-breakdown';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamAdminAnalyticsProps {
  teamId: string;
}

export function TeamAdminAnalytics({ teamId }: TeamAdminAnalyticsProps) {
  const { data, isPending, error } = useTeamAnalytics(teamId);

  if (isPending) {
    return (
      <div className="space-y-6" data-testid="team-admin-analytics-loading">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 bg-[#1a1a1a]" />
          <Skeleton className="h-24 bg-[#1a1a1a]" />
          <Skeleton className="h-24 bg-[#1a1a1a]" />
        </div>
        <Skeleton className="h-[250px] w-full bg-[#1a1a1a]" />
        <Skeleton className="h-[250px] w-full bg-[#1a1a1a]" />
        <Skeleton className="h-[300px] w-full bg-[#1a1a1a]" />
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
      <div
        className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8 text-center"
        data-testid="team-admin-analytics-empty"
      >
        <p className="text-[#fafafa] text-lg mb-2">No analytics data yet</p>
        <p className="text-muted-foreground">
          Team analytics will appear once team members start capturing prompts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="team-admin-analytics">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
          <p className="text-sm text-muted-foreground">Total Prompts</p>
          <p className="text-2xl font-bold text-[#fafafa]" data-testid="admin-total-prompts">
            {data.totalPrompts}
          </p>
        </div>
        <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
          <p className="text-sm text-muted-foreground">Team Average</p>
          <p className="text-2xl font-bold text-teal-500" data-testid="admin-team-average">
            {data.teamAverage.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
          <p className="text-sm text-muted-foreground">Active Members</p>
          <p className="text-2xl font-bold text-[#fafafa]" data-testid="admin-active-members">
            {data.members.length}
          </p>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h2 className="text-lg font-medium text-[#fafafa] mb-4">Score Distribution</h2>
        <TeamDistributionChart data={data.distribution} />
      </div>

      {/* Trend Chart */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h2 className="text-lg font-medium text-[#fafafa] mb-4">Team Trend</h2>
        <TeamTrendChart teamId={teamId} />
      </div>

      {/* Member Breakdown */}
      <div>
        <h2 className="text-lg font-medium text-[#fafafa] mb-4">Team Members</h2>
        <MemberBreakdown members={data.members} teamId={teamId} />
      </div>
    </div>
  );
}
