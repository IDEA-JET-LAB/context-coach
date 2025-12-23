'use client';

import { useState } from 'react';
import { useTeamMembers } from '@/lib/hooks/use-team-members';
import { useCurrentTeam } from '@/lib/hooks/use-current-team';
import { TeamAdminAnalytics } from '@/components/analytics/team-admin-analytics';
import { TeamSummary } from '@/components/analytics/team-summary';
import { TeamIntelligenceDashboard } from '@/components/analytics/team-intelligence-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, BarChart3, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ViewMode = 'standard' | 'intelligence';

function TeamAnalyticsSkeleton() {
  return (
    <div className="space-y-6" data-testid="team-analytics-skeleton">
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24 bg-card" />
        <Skeleton className="h-24 bg-card" />
        <Skeleton className="h-24 bg-card" />
      </div>
      <Skeleton className="h-[250px] w-full bg-card" />
      <Skeleton className="h-[250px] w-full bg-card" />
    </div>
  );
}

export default function TeamPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('intelligence');
  const { data: team, isPending: teamPending } = useCurrentTeam();
  const { data: teamData, isPending: rolePending, error, refetch } = useTeamMembers(team?.id ?? '');

  const isPending = teamPending || (team && rolePending);
  const isAdmin = teamData?.currentUserRole === 'admin';

  if (isPending) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Team Analytics</h1>
        <TeamAnalyticsSkeleton />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Team Analytics</h1>
        <div
          className="rounded-lg border border-border bg-card p-8 text-center"
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
        <h1 className="text-2xl font-bold text-foreground">Team Analytics</h1>
        <div
          className="rounded-lg border border-status-error/30 bg-status-error-subtle p-6 text-center"
          data-testid="team-analytics-error"
        >
          <AlertCircle className="h-8 w-8 text-status-error mx-auto mb-3" />
          <p className="text-status-error mb-4">Failed to load team data</p>
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
      {/* Header with View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground" data-testid="team-analytics-title">
          Team Analytics
        </h1>

        {/* View Mode Toggle */}
        <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-1">
          <button
            onClick={() => setViewMode('intelligence')}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'intelligence'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid="view-mode-intelligence"
          >
            <Brain className="h-4 w-4" />
            Intelligence
          </button>
          <button
            onClick={() => setViewMode('standard')}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'standard'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid="view-mode-standard"
          >
            <BarChart3 className="h-4 w-4" />
            Standard
          </button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'intelligence' ? (
        <TeamIntelligenceDashboard teamId={team.id} isAdmin={isAdmin} />
      ) : isAdmin ? (
        <TeamAdminAnalytics teamId={team.id} />
      ) : (
        <TeamSummary teamId={team.id} />
      )}
    </div>
  );
}
