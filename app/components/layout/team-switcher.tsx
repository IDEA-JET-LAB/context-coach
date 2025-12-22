'use client';

import { Check, ChevronDown, Loader2, PlusCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeams } from '@/lib/hooks/use-teams';
import { useSwitchTeam } from '@/lib/hooks/use-switch-team';
import { useCurrentTeam } from '@/lib/hooks/use-current-team';
import { useRouter } from 'next/navigation';

export function TeamSwitcher() {
  const router = useRouter();
  const { data: teams, isPending: isLoadingTeams, error } = useTeams();
  const { data: currentTeam } = useCurrentTeam();
  const { mutate: switchTeam, isPending: isSwitching } = useSwitchTeam();

  // Loading state
  if (isLoadingTeams) {
    return <Skeleton className="h-9 w-32" data-testid="team-switcher-skeleton" />;
  }

  // Error state - show current team name only
  if (error) {
    return (
      <Button variant="ghost" disabled>
        <Building2 className="mr-2 h-4 w-4" />
        {currentTeam?.name || 'Team'}
      </Button>
    );
  }

  // No teams - show create button
  if (!teams?.length) {
    return (
      <Button variant="outline" onClick={() => router.push('/teams/new')}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Create Team
      </Button>
    );
  }

  // Team dropdown (works for single or multiple teams)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={isSwitching}
          aria-label="Switch team"
          aria-haspopup="menu"
          data-testid="team-switcher-dropdown"
        >
          {isSwitching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Switching...
            </>
          ) : (
            <>
              <Building2 className="mr-2 h-4 w-4" />
              {currentTeam?.name || 'Select Team'}
              <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onClick={() => {
              if (team.id !== currentTeam?.id) {
                switchTeam({ teamId: team.id });
              }
            }}
            className="flex items-center justify-between cursor-pointer"
            aria-selected={team.id === currentTeam?.id}
            data-testid={`team-option-${team.id}`}
          >
            <span>{team.name}</span>
            {team.id === currentTeam?.id && (
              <Check className="h-4 w-4" aria-label="Current team" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/teams/new')}
          className="cursor-pointer"
          data-testid="create-team-option"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New Team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
