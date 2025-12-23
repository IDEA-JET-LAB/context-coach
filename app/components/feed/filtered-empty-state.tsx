'use client';

import { EmptyState } from '@/components/feedback';

interface FilteredEmptyStateProps {
  onClearFilters: () => void;
}

export function FilteredEmptyState({ onClearFilters }: FilteredEmptyStateProps) {
  return (
    <div data-testid="filtered-empty-state">
      <EmptyState
        variant="search"
        title="No prompts match your filters"
        description="Try adjusting your filters or search terms"
        action={{ label: 'Clear all filters', onClick: onClearFilters }}
        size="sm"
      />
    </div>
  );
}
