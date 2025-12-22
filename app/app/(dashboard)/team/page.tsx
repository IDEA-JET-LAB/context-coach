'use client';

import { useTeamMembers } from '@/lib/hooks/use-team-members';
import { useCurrentTeam } from '@/lib/hooks/use-current-team';
import { TeamAdminAnalytics } from '@/components/analytics/team-admin-analytics';
import { TeamSummary } from '@/components/analytics/team-summary';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function TeamAnalyticsSkeleton() {
  return (
    <div className="space-y-6" data-testid="team-analytics-skeleton">
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24 bg-[#1a1a1a]" />
        <Skeleton className="h-24 bg-[#1a1a1a]" />
        <Skeleton className="h-24 bg-[#1a1a1a]" />
      </div>
      <Skeleton className="h-[250px] w-full bg-[#1a1a1a]" />
      <Skeleton className="h-[250px] w-full bg-[#1a1a1a]" />
    </div>
  );
}

export default function TeamPage() {
  const { data: team, isPending: teamPending } = useCurrentTeam();
  const { data: teamData, isPending: rolePending, error, refetch } = useTeamMembers(team?.id ?? '');

  const isPending = teamPending || (team && rolePending);
  const isAdmin = teamData?.currentUserRole === 'admin';

  if (isPending) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#fafafa]">Team Analytics</h1>
        <TeamAnalyticsSkeleton />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#fafafa]">Team Analytics</h1>
        <div
          className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8 text-center"
          data-testid="no-team-state"
        >
          <p className="text-muted-foreground">
            No team selected. Please select or create a team.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#fafafa]">Team Analytics</h1>
        <div
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center"
          data-testid="team-analytics-error"
        >
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 mb-4">Failed to load team data</p>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#fafafa]" data-testid="team-analytics-title">
        Team Analytics
      </h1>

      {isAdmin ? (
        <TeamAdminAnalytics teamId={team.id} />
      ) : (
        <TeamSummary teamId={team.id} />
      )}
    </div>
  );
}
