'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { UserFilter } from './filters/user-filter';
import { ProjectFilter } from './filters/project-filter';
import { DateFilter } from './filters/date-filter';
import { ScoreFilter } from './filters/score-filter';
import { useDebounce } from '@/lib/hooks/use-debounce';
import type { FeedFilters } from '@/lib/types/filters';

interface FilterBarProps {
  filters: FeedFilters;
  onFiltersChange: (filters: FeedFilters) => void;
  isTeamLead: boolean;
  teamId?: string;
}

export function FilterBar({ filters, onFiltersChange, isTeamLead, teamId }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 500);

  // Use refs to track previous values without causing re-renders (M34)
  const prevFiltersSearchRef = useRef(filters.search);
  const prevDebouncedSearchRef = useRef(debouncedSearch);

  // Sync local search input when filters are cleared from outside
  useEffect(() => {
    // Only reset if search was cleared externally (changed from a value to undefined)
    if (prevFiltersSearchRef.current !== undefined && filters.search === undefined) {
      setSearchInput('');
    }
    prevFiltersSearchRef.current = filters.search;
  }, [filters.search]);

  // Update filters when debounced search changes
  useEffect(() => {
    // Only update if debounced value actually changed
    if (prevDebouncedSearchRef.current !== debouncedSearch) {
      prevDebouncedSearchRef.current = debouncedSearch;
      onFiltersChange({ ...filters, search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters, onFiltersChange]);

  // Handle immediate search on Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onFiltersChange({ ...filters, search: searchInput || undefined });
    }
  }, [filters, searchInput, onFiltersChange]);

  const handleUserChange = useCallback((users: string[]) => {
    onFiltersChange({ ...filters, users: users.length ? users : undefined });
  }, [filters, onFiltersChange]);

  const handleProjectChange = useCallback((project: string | undefined) => {
    onFiltersChange({ ...filters, project });
  }, [filters, onFiltersChange]);

  const handleDateChange = useCallback((dateRange: FeedFilters['dateRange']) => {
    onFiltersChange({ ...filters, dateRange });
  }, [filters, onFiltersChange]);

  const handleScoreChange = useCallback((scoreRange: FeedFilters['scoreRange']) => {
    onFiltersChange({ ...filters, scoreRange });
  }, [filters, onFiltersChange]);

  return (
    <div
      className="flex flex-wrap items-center gap-2 mb-4"
      role="search"
      aria-label="Filter prompts"
      data-testid="filter-bar"
    >
      <div className="relative flex-1 min-w-[200px]">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          placeholder="Search prompts..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-9 bg-[#1a1a1a] border-[#2a2a2a]"
          aria-label="Search prompts by text"
          data-testid="search-input"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[#2a2a2a] rounded"
            aria-label="Clear search"
            data-testid="clear-search"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {isTeamLead && teamId && (
        <UserFilter
          value={filters.users ?? []}
          onChange={handleUserChange}
          teamId={teamId}
        />
      )}
      <ProjectFilter
        value={filters.project}
        onChange={handleProjectChange}
      />
      <DateFilter
        value={filters.dateRange}
        onChange={handleDateChange}
      />
      <ScoreFilter
        value={filters.scoreRange}
        onChange={handleScoreChange}
      />
    </div>
  );
}
