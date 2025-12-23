'use client';

import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FilteredEmptyStateProps {
  onClearFilters: () => void;
}

export function FilteredEmptyState({ onClearFilters }: FilteredEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      data-testid="filtered-empty-state"
    >
      <Search className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">
        No prompts match your filters
      </h3>
      <p className="text-muted-foreground mb-4">
        Try adjusting your filters or search terms
      </p>
      <Button onClick={onClearFilters} variant="outline">
        Clear all filters
      </Button>
    </div>
  );
}
