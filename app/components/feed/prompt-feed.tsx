'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePrompts } from '@/lib/hooks/use-prompts';
import { useRealtimePrompts } from '@/lib/hooks/use-realtime-prompts';
import { useCurrentTeam } from '@/lib/hooks/use-current-team';
import { useProjects } from '@/lib/hooks/use-projects';
import { usePersistedFilters } from '@/lib/hooks/use-persisted-filters';
import { useTeamMembers } from '@/lib/hooks/use-team-members';
import { PromptRow } from './prompt-row';
import { PromptFeedSkeleton } from './prompt-feed-skeleton';
import { EmptyPromptFeed } from './empty-prompt-feed';
import { FilterBar } from './filter-bar';
import { ActiveFilters } from './active-filters';
import { FilteredEmptyState } from './filtered-empty-state';
import type { FeedFilters } from '@/lib/types/filters';

export function PromptFeed() {
  const router = useRouter();
  const { data: currentTeam } = useCurrentTeam();
  const teamId = currentTeam?.id;

  const [filters, setFilters] = usePersistedFilters(teamId);
  const { data: prompts, isPending, error } = usePrompts(teamId, filters);
  const { data: projects } = useProjects();
  const { data: membersData } = useTeamMembers(teamId ?? '');

  // Check if user is team lead (admin)
  const isTeamLead = membersData?.currentUserRole === 'admin';

  // Set up realtime subscription
  useRealtimePrompts(teamId);

  const handlePromptClick = (promptId: string) => {
    router.push(`/prompts/${promptId}`);
  };

  const handleRemoveFilter = useCallback((key: keyof FeedFilters) => {
    setFilters({ ...filters, [key]: undefined });
  }, [filters, setFilters]);

  const handleClearAllFilters = useCallback(() => {
    setFilters({});
  }, [setFilters]);

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some((v) => {
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });

  if (isPending) {
    return (
      <>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          isTeamLead={isTeamLead}
          teamId={teamId}
        />
        <PromptFeedSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <div
        className="text-center py-8"
        data-testid="prompt-feed-error"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-red-400">Failed to load prompts</p>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  // Show empty state for no projects (before filters)
  if ((projects?.projects?.length ?? 0) === 0 && !hasActiveFilters) {
    return <EmptyPromptFeed hasProjects={false} />;
  }

  return (
    <div data-testid="prompt-feed-container">
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        isTeamLead={isTeamLead}
        teamId={teamId}
      />
      <ActiveFilters
        filters={filters}
        onRemove={handleRemoveFilter}
        onClearAll={handleClearAllFilters}
      />

      {(!prompts || prompts.length === 0) ? (
        hasActiveFilters ? (
          <FilteredEmptyState onClearFilters={handleClearAllFilters} />
        ) : (
          <EmptyPromptFeed hasProjects={(projects?.projects?.length ?? 0) > 0} />
        )
      ) : (
        <div
          className="space-y-3"
          data-testid="prompt-feed"
          role="feed"
          aria-live="polite"
          aria-label="Prompt feed with real-time updates"
        >
          {prompts.map((prompt) => (
            <PromptRow
              key={prompt.id}
              prompt={prompt}
              onClick={() => handlePromptClick(prompt.id)}
              searchTerm={filters.search}
            />
          ))}
        </div>
      )}
    </div>
  );
}
