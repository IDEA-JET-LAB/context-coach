# Story 6.3: Feed Filtering & Search

Status: ready-for-dev

## Story

**As a** user,
**I want** to filter and search my prompts,
**So that** I can find specific prompts quickly.

## Related Stories

- **Story 6.2** - Prompt Feed with Real-time Updates (prerequisite - provides the feed this story filters)
- **Story 6.1** - Dashboard Layout & Navigation (prerequisite - provides dashboard container)

## Acceptance Criteria

1. **Given** filter controls above the feed
   **When** I select filters
   **Then** I can filter by: user (team leads), project, date range, score range

2. **Given** I apply a filter
   **When** the filter is active
   **Then** the feed updates instantly (client-side with TanStack Query)
   **And** filter chips show active filters
   **And** I can clear individual filters or all filters

3. **Given** I type in the search box
   **When** I press Enter or wait 500ms
   **Then** prompts are filtered by text content
   **And** search highlights matching text

4. **Given** I close and reopen the dashboard
   **When** I return
   **Then** my last-used filters are preserved (localStorage)

5. **Given** filter results return no matches
   **When** viewing the feed
   **Then** I see an appropriate empty state with option to clear filters

## Tasks / Subtasks

- [ ] **Task 1: Create filter bar component** (AC: #1, #2)
  - [ ] Create `components/feed/filter-bar.tsx` component
  - [ ] Add search input with magnifying glass icon
  - [ ] Add filter dropdown buttons:
    - User filter (team leads only see this)
    - Project filter
    - Date range filter
    - Score range filter
  - [ ] Style with dark mode colors matching dashboard
  - [ ] Position above the prompt feed
  - [ ] Add ARIA labels and keyboard navigation support

- [ ] **Task 2: Implement search input with debounce** (AC: #3)
  - [ ] Create `lib/hooks/use-debounce.ts` utility hook
  - [ ] Add controlled search input to filter bar
  - [ ] Debounce search input by 500ms
  - [ ] Trigger filter on Enter key press immediately
  - [ ] Clear button appears when search has value
  - [ ] Update query params or local state with search term

- [ ] **Task 3: Create user filter dropdown (team leads)** (AC: #1)
  - [ ] Create `components/feed/filters/user-filter.tsx`
  - [ ] Fetch team members from `team_members` table
  - [ ] Show dropdown only if user has `admin` role
  - [ ] Multi-select with checkboxes for team members
  - [ ] "All users" option to clear filter
  - [ ] Display selected user names in trigger

- [ ] **Task 4: Create project filter dropdown** (AC: #1)
  - [ ] Create `components/feed/filters/project-filter.tsx`
  - [ ] Fetch projects from `projects` table for current team
  - [ ] Single or multi-select for project filtering
  - [ ] "All projects" option to clear filter
  - [ ] Display project name in trigger when selected

- [ ] **Task 5: Create date range filter** (AC: #1)
  - [ ] Create `components/feed/filters/date-filter.tsx`
  - [ ] Use shadcn/ui DatePicker or Calendar component
  - [ ] Preset options: Today, Last 7 days, Last 30 days, Custom
  - [ ] Custom range allows from/to date selection
  - [ ] Display selected range in trigger

- [ ] **Task 6: Create score range filter** (AC: #1)
  - [ ] Create `components/feed/filters/score-filter.tsx`
  - [ ] Use slider or range input (1-10)
  - [ ] Preset options: Low (1-3), Medium (4-6), High (7-10)
  - [ ] Show score range in trigger when active
  - [ ] Apply score color coding to options

- [ ] **Task 7: Implement active filter chips** (AC: #2)
  - [ ] Create `components/feed/active-filters.tsx` component
  - [ ] Display chip for each active filter
  - [ ] Each chip shows filter type and value
  - [ ] X button on each chip to remove that filter
  - [ ] "Clear all" button when multiple filters active
  - [ ] Chips appear between filter bar and feed

- [ ] **Task 8: Update TanStack Query with filter params** (AC: #2)
  - [ ] Update `usePrompts` hook to accept filter parameters
  - [ ] Build Supabase query dynamically based on filters
  - [ ] Ensure query key includes all filter values
  - [ ] Refetch on filter change with instant UI update
  - [ ] Handle empty results gracefully with empty state
  - [ ] Use `isPending` (not `isLoading`) for loading states

- [ ] **Task 9: Implement search text highlighting** (AC: #3)
  - [ ] Create `lib/utils/highlight-text.tsx` utility
  - [ ] Wrap matching text in `<mark>` or styled span
  - [ ] Apply highlight styling (background color)
  - [ ] Handle case-insensitive matching
  - [ ] Update PromptRow to use highlighted text

- [ ] **Task 10: Persist filters in localStorage** (AC: #4)
  - [ ] Create `lib/hooks/use-persisted-filters.ts` hook
  - [ ] Save filter state to localStorage on change
  - [ ] Load filter state from localStorage on mount
  - [ ] Key by team_id to separate per-team filters
  - [ ] Handle localStorage unavailable gracefully
  - [ ] Handle date serialization/deserialization

- [ ] **Task 11: Create filtered empty state** (AC: #5)
  - [ ] Create empty state component for no filter matches
  - [ ] Display "No prompts match your filters" message
  - [ ] Include "Clear filters" button
  - [ ] Differentiate from "no prompts yet" empty state

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- TanStack Query 5.x - use `isPending` not `isLoading` (v5 breaking change)
- Supabase for database queries with RLS
- localStorage for filter persistence
- shadcn/ui components (Badge, Calendar, Popover, Select, Slider)

**Client-Side Filtering Pattern:**
Filters modify the Supabase query parameters, not post-fetch filtering, for performance with large datasets.

**Accessibility Requirements (NFR-A1, NFR-A3):**
- All filter controls must be keyboard navigable
- ARIA labels required for filter dropdowns and chips
- Focus management when filters are applied/cleared

### Filter Types Interface

```typescript
// lib/types/filters.ts
export interface FeedFilters {
  search?: string;
  users?: string[];          // user IDs (team leads only)
  project?: string;          // project ID
  dateRange?: {
    from: Date;
    to: Date;
  };
  scoreRange?: {
    min: number;
    max: number;
  };
}

export interface SerializedFeedFilters {
  search?: string;
  users?: string[];
  project?: string;
  dateRange?: {
    from: string;  // ISO string for localStorage
    to: string;
  };
  scoreRange?: {
    min: number;
    max: number;
  };
}
```

### Filter Bar Component Structure

```typescript
// components/feed/filter-bar.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
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
}

export function FilterBar({ filters, onFiltersChange, isTeamLead }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 500);

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
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
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {isTeamLead && (
        <UserFilter
          value={filters.users ?? []}
          onChange={handleUserChange}
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
```

### Debounce Hook

```typescript
// lib/hooks/use-debounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### Updated usePrompts Hook with Filters

```typescript
// lib/hooks/use-prompts.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { FeedFilters } from '@/lib/types/filters';

export function usePrompts(teamId: string, filters: FeedFilters) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['prompts', teamId, filters],
    queryFn: async () => {
      let query = supabase
        .from('prompts')
        .select(`
          *,
          analysis:prompt_analyses(overall_score, dimension_scores)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      // Apply search filter (text content)
      if (filters.search) {
        query = query.ilike('text', `%${filters.search}%`);
      }

      // Apply user filter (team leads only)
      if (filters.users?.length) {
        query = query.in('user_id', filters.users);
      }

      // Apply project filter
      if (filters.project) {
        query = query.eq('project_id', filters.project);
      }

      // Apply date range filter
      if (filters.dateRange) {
        query = query
          .gte('created_at', filters.dateRange.from.toISOString())
          .lte('created_at', filters.dateRange.to.toISOString());
      }

      // Apply score range filter via inner join filtering
      // Note: This filters on the related prompt_analyses.overall_score
      if (filters.scoreRange) {
        query = query
          .not('analysis', 'is', null)
          .gte('analysis.overall_score', filters.scoreRange.min)
          .lte('analysis.overall_score', filters.scoreRange.max);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}
```

### Active Filter Chips Component

```typescript
// components/feed/active-filters.tsx
'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FeedFilters } from '@/lib/types/filters';

interface ActiveFiltersProps {
  filters: FeedFilters;
  onRemove: (key: keyof FeedFilters) => void;
  onClearAll: () => void;
}

function formatFilterLabel(key: string, value: unknown): string {
  switch (key) {
    case 'search':
      return `Search: "${value}"`;
    case 'users':
      return `Users: ${(value as string[]).length} selected`;
    case 'project':
      return `Project: ${value}`;
    case 'dateRange': {
      const range = value as { from: Date; to: Date };
      return `Date: ${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`;
    }
    case 'scoreRange': {
      const range = value as { min: number; max: number };
      return `Score: ${range.min}-${range.max}`;
    }
    default:
      return `${key}: ${value}`;
  }
}

export function ActiveFilters({ filters, onRemove, onClearAll }: ActiveFiltersProps) {
  const activeFilters = Object.entries(filters).filter(([_, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return true;
    return Boolean(value);
  });

  if (activeFilters.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 mb-4"
      role="list"
      aria-label="Active filters"
    >
      {activeFilters.map(([key, value]) => (
        <Badge
          key={key}
          variant="secondary"
          className="bg-[#2a2a2a] text-[#fafafa] pr-1"
          role="listitem"
        >
          <span className="mr-1">{formatFilterLabel(key, value)}</span>
          <button
            onClick={() => onRemove(key as keyof FeedFilters)}
            className="ml-1 rounded-full p-0.5 hover:bg-[#3a3a3a]"
            aria-label={`Remove ${key} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {activeFilters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-muted-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
```

### Search Highlighting Utility

```typescript
// lib/utils/highlight-text.tsx
import { Fragment } from 'react';

interface HighlightTextProps {
  text: string;
  search: string;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function HighlightText({ text, search }: HighlightTextProps) {
  if (!search) return <>{text}</>;

  const regex = new RegExp(`(${escapeRegex(search)})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-amber-500/30 text-inherit rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
```

### Persisted Filters Hook

```typescript
// lib/hooks/use-persisted-filters.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FeedFilters, SerializedFeedFilters } from '@/lib/types/filters';

const STORAGE_KEY_PREFIX = 'contextor-filters-';

function serializeFilters(filters: FeedFilters): SerializedFeedFilters {
  return {
    ...filters,
    dateRange: filters.dateRange
      ? {
          from: filters.dateRange.from.toISOString(),
          to: filters.dateRange.to.toISOString(),
        }
      : undefined,
  };
}

function deserializeFilters(stored: SerializedFeedFilters): FeedFilters {
  return {
    ...stored,
    dateRange: stored.dateRange
      ? {
          from: new Date(stored.dateRange.from),
          to: new Date(stored.dateRange.to),
        }
      : undefined,
  };
}

export function usePersistedFilters(teamId: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${teamId}`;

  const [filters, setFiltersState] = useState<FeedFilters>(() => {
    if (typeof window === 'undefined') return {};

    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return {};
      const parsed = JSON.parse(stored) as SerializedFeedFilters;
      return deserializeFilters(parsed);
    } catch {
      // Invalid stored data, return empty
      return {};
    }
  });

  const setFilters = useCallback((newFilters: FeedFilters) => {
    setFiltersState(newFilters);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      const serialized = serializeFilters(filters);
      localStorage.setItem(storageKey, JSON.stringify(serialized));
    } catch {
      // localStorage unavailable or quota exceeded
    }
  }, [filters, storageKey]);

  return [filters, setFilters] as const;
}
```

### Filtered Empty State Component

```typescript
// components/feed/filtered-empty-state.tsx
'use client';

import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FilteredEmptyStateProps {
  onClearFilters: () => void;
}

export function FilteredEmptyState({ onClearFilters }: FilteredEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Search className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium text-[#fafafa] mb-2">
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
```

### Component File Locations

| Component | Path |
|-----------|------|
| Filter Bar | `components/feed/filter-bar.tsx` |
| User Filter | `components/feed/filters/user-filter.tsx` |
| Project Filter | `components/feed/filters/project-filter.tsx` |
| Date Filter | `components/feed/filters/date-filter.tsx` |
| Score Filter | `components/feed/filters/score-filter.tsx` |
| Active Filters | `components/feed/active-filters.tsx` |
| Filtered Empty State | `components/feed/filtered-empty-state.tsx` |
| Debounce Hook | `lib/hooks/use-debounce.ts` |
| Persisted Filters Hook | `lib/hooks/use-persisted-filters.ts` |
| Highlight Text Util | `lib/utils/highlight-text.tsx` |
| Filter Types | `lib/types/filters.ts` |

### shadcn/ui Components Needed

```bash
npx shadcn@latest add badge calendar popover select slider
```

### Common Pitfalls to Avoid

1. **DO NOT** filter client-side after fetching all data - use Supabase query params
2. **DO NOT** forget to include filters in TanStack Query key
3. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
4. **DO NOT** forget to debounce search input
5. **DO NOT** expose user filter to non-team-leads
6. **DO NOT** forget to escape regex special characters in search
7. **DO NOT** forget to serialize dates when storing in localStorage
8. **DO NOT** skip ARIA labels on interactive filter elements
9. **DO NOT** forget to handle the filtered empty state differently from "no prompts" empty state

### Mobile Responsive Considerations

- Filter bar should wrap to multiple lines on smaller screens (flex-wrap is included)
- On mobile (<768px), consider collapsing filters into a "Filters" button with a slide-out panel
- Minimum touch target size of 44x44px for filter buttons

### Verification Checklist

After completing this story, verify:
- [ ] Filter bar appears above the feed
- [ ] Search input debounces by 500ms
- [ ] Enter key triggers search immediately
- [ ] User filter only visible to team leads (admin role)
- [ ] Project filter shows team's projects
- [ ] Date range filter works with presets and custom range
- [ ] Score range filter applies correctly
- [ ] Active filter chips display for each filter
- [ ] Individual filters can be cleared via chip X
- [ ] "Clear all" removes all filters
- [ ] Feed updates instantly when filters change
- [ ] Search highlighting works in prompt text
- [ ] Filters persist across page reloads (localStorage)
- [ ] Filters are team-specific (keyed by team_id)
- [ ] Empty state shows when no prompts match filters
- [ ] All filter controls are keyboard accessible
- [ ] Loading state shows while filtering (isPending)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
