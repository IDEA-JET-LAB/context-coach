# Story 6.2: Prompt Feed with Real-time Updates

Status: ready-for-dev

## Story

**As a** user,
**I want** to see my prompts in a real-time feed,
**So that** new prompts appear without refreshing.

## Acceptance Criteria

1. **Given** I am on the feed page
   **When** the page loads
   **Then** I see my team's prompts sorted by newest first
   **And** each prompt shows: timestamp, score badge, truncated text, analysis status

2. **Given** a new prompt is captured
   **When** it's inserted in the database
   **Then** Supabase Realtime pushes the update
   **And** the new prompt appears at the top of my feed
   **And** no page refresh is needed

3. **Given** an analysis completes
   **When** the status updates
   **Then** the prompt card updates from "Analyzing..." to showing the score
   **And** the transition is smooth

## Tasks / Subtasks

- [ ] **Task 1: Create PromptRow component** (AC: #1)
  - [ ] Create `components/feed/prompt-row.tsx` component
  - [ ] Display timestamp in relative format (e.g., "2 minutes ago")
  - [ ] Show ScoreBadge component (or placeholder if pending)
  - [ ] Truncate prompt text to ~150 characters with ellipsis
  - [ ] Display analysis status indicator
  - [ ] Style with dark mode colors and hover state
  - [ ] Make entire row clickable for detail view (Story 6.4)

- [ ] **Task 2: Create ScoreBadge component** (AC: #1, #3)
  - [ ] Create `components/feed/score-badge.tsx` component
  - [ ] Display score as circular badge with number
  - [ ] Apply color based on score range:
    - Teal (`#14b8a6`): 7-10 (good)
    - Amber (`#f59e0b`): 4-6 (medium)
    - Coral (`#f87171`): 1-3 (needs improvement)
  - [ ] Show spinner for `pending` or `processing` status
  - [ ] Show error icon for `failed` status
  - [ ] Add smooth color transition animation

- [ ] **Task 3: Create feed page with initial data fetch** (AC: #1)
  - [ ] Update `app/(dashboard)/prompts/page.tsx` with feed UI
  - [ ] Create `lib/hooks/use-prompts.ts` hook with TanStack Query
  - [ ] Fetch prompts from `prompts` table with `team_id` filter
  - [ ] Join `prompt_analyses` for score data
  - [ ] Sort by `created_at` descending (newest first)
  - [ ] Use `isPending` (not `isLoading`) for loading state
  - [ ] Implement pagination or infinite scroll

- [ ] **Task 4: Set up Supabase Realtime subscription** (AC: #2)
  - [ ] Create `lib/hooks/use-realtime-prompts.ts` hook
  - [ ] Subscribe to `prompts` table INSERT events
  - [ ] Filter subscription by `team_id` to match current team
  - [ ] Use `useEffect` with proper cleanup on unmount
  - [ ] Invalidate TanStack Query cache on new prompt
  - [ ] Add new prompt to top of feed optimistically

- [ ] **Task 5: Handle real-time analysis status updates** (AC: #3)
  - [ ] Subscribe to `prompts` table UPDATE events for `analysis_status`
  - [ ] Subscribe to `prompt_analyses` table INSERT events
  - [ ] Update specific prompt in cache when analysis completes
  - [ ] Apply smooth transition animation when status changes
  - [ ] Handle `failed` status with error indicator

- [ ] **Task 6: Create feed list container** (AC: #1, #2)
  - [ ] Create `components/feed/prompt-feed.tsx` container component
  - [ ] Render list of PromptRow components
  - [ ] Show loading skeleton while fetching
  - [ ] Handle empty state (no prompts yet)
  - [ ] Add visual indicator for new items arriving
  - [ ] Implement scroll position preservation

- [ ] **Task 7: Add analysis status indicator** (AC: #1, #3)
  - [ ] Create `components/feed/analysis-status.tsx` component
  - [ ] Display different states:
    - `pending`: "Queued" with clock icon
    - `processing`: "Analyzing..." with spinner
    - `complete`: Show score badge
    - `failed`: "Failed" with warning icon + retry option
  - [ ] Apply appropriate colors for each state

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router
- TanStack Query 5.x - use `isPending` not `isLoading`
- Supabase Realtime for live updates
- TypeScript strict mode

**Realtime Pattern (FROM project-context.md):**
- Subscribe in `useEffect`
- Invalidate Query cache on updates
- Cleanup on unmount to prevent memory leaks

### Feed Page Location

Per architecture.md, the feed/prompts page is located at `app/(dashboard)/prompts/` NOT `app/(dashboard)/dashboard/`. The architecture specifies:
```
app/(dashboard)/
├── prompts/          # Feed page
├── analytics/
├── team/
├── projects/
├── settings/
└── admin/
```

### Prompt Row Component

```typescript
// components/feed/prompt-row.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { ScoreBadge } from './score-badge';
import { AnalysisStatus } from './analysis-status';
import type { Prompt } from '@/lib/types';

interface PromptRowProps {
  prompt: Prompt;
  onClick?: () => void;
}

export function PromptRow({ prompt, onClick }: PromptRowProps) {
  const truncatedText = prompt.text.length > 150
    ? prompt.text.slice(0, 150) + '...'
    : prompt.text;

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-4 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4 transition-colors hover:bg-[#242424]"
    >
      <ScoreBadge
        score={prompt.analysis?.overall_score}
        status={prompt.analysis_status}
      />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm text-[#fafafa]">{truncatedText}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(prompt.created_at), { addSuffix: true })}
        </p>
      </div>
      <AnalysisStatus status={prompt.analysis_status} />
    </div>
  );
}
```

### Score Badge with Color Coding

```typescript
// components/feed/score-badge.tsx
'use client';

import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';
import type { AnalysisStatus } from '@/lib/types';

interface ScoreBadgeProps {
  score?: number;
  status: AnalysisStatus;
}

function getScoreColor(score: number): string {
  if (score >= 7) return 'bg-teal-500 text-white'; // Teal: 7-10
  if (score >= 4) return 'bg-amber-500 text-white'; // Amber: 4-6
  return 'bg-red-400 text-white'; // Coral: 1-3
}

export function ScoreBadge({ score, status }: ScoreBadgeProps) {
  if (status === 'pending' || status === 'processing') {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2a2a2a]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
        <AlertCircle className="h-5 w-5 text-red-400" />
      </div>
    );
  }

  if (score === undefined) return null;

  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full font-bold transition-colors',
        getScoreColor(score)
      )}
    >
      {score.toFixed(1)}
    </div>
  );
}
```

### TanStack Query Hook for Prompts

```typescript
// lib/hooks/use-prompts.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function usePrompts(teamId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['prompts', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompts')
        .select(`
          *,
          analysis:prompt_analyses(
            overall_score,
            dimension_scores
          )
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });
}
```

### Supabase Realtime Subscription

```typescript
// lib/hooks/use-realtime-prompts.ts
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useRealtimePrompts(teamId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('prompts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prompts',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          // Invalidate cache to refetch with new data
          queryClient.invalidateQueries({ queryKey: ['prompts', teamId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'prompts',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          // Update specific prompt in cache
          queryClient.invalidateQueries({ queryKey: ['prompts', teamId] });
        }
      )
      .subscribe();

    // Cleanup on unmount - CRITICAL to prevent memory leaks
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, queryClient, supabase]);
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Feed Page | `app/(dashboard)/prompts/page.tsx` |
| Prompt Row | `components/feed/prompt-row.tsx` |
| Score Badge | `components/feed/score-badge.tsx` |
| Analysis Status | `components/feed/analysis-status.tsx` |
| Prompt Feed Container | `components/feed/prompt-feed.tsx` |
| usePrompts Hook | `lib/hooks/use-prompts.ts` |
| useRealtimePrompts Hook | `lib/hooks/use-realtime-prompts.ts` |

### Score Color Reference

| Score Range | Color Name | Hex Value | Tailwind Class |
|-------------|------------|-----------|----------------|
| 7-10 | Teal | #14b8a6 | `bg-teal-500` |
| 4-6 | Amber | #f59e0b | `bg-amber-500` |
| 1-3 | Coral | #f87171 | `bg-red-400` |

### Analysis Status Values

```typescript
type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed';
```

### Database Query Pattern

```sql
-- Prompts with analysis join
SELECT
  p.*,
  pa.overall_score,
  pa.dimension_scores
FROM prompts p
LEFT JOIN prompt_analyses pa ON pa.prompt_id = p.id
WHERE p.team_id = $team_id
ORDER BY p.created_at DESC
LIMIT 50;
```

### Empty State Component

The empty state should follow the pattern from architecture.md:

```typescript
// components/feed/empty-prompt-feed.tsx
'use client';

import { Terminal, FolderPlus } from 'lucide-react';

interface EmptyPromptFeedProps {
  hasProjects: boolean;
}

export function EmptyPromptFeed({ hasProjects }: EmptyPromptFeedProps) {
  if (!hasProjects) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FolderPlus className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-[#fafafa]">No projects yet</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Create a project to start capturing prompts
        </p>
        {/* CreateProjectButton component */}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium text-[#fafafa]">Waiting for your first prompt</h3>
      <p className="text-sm text-muted-foreground mt-2">
        Install Contextor in your project to start capturing
      </p>
      {/* InstallInstructions component */}
    </div>
  );
}
```

### Loading Skeleton Pattern

```typescript
// components/feed/prompt-feed-skeleton.tsx
export function PromptFeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
          <div className="h-10 w-10 rounded-full bg-[#2a2a2a] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-[#2a2a2a] animate-pulse" />
            <div className="h-3 w-1/4 rounded bg-[#2a2a2a] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Prompt Type Definition

Ensure the Prompt type is defined in `lib/types.ts`:

```typescript
// lib/types.ts
export type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface PromptAnalysis {
  overall_score: number;
  dimension_scores: Record<string, number>;
}

export interface Prompt {
  id: string;
  team_id: string;
  project_id: string;
  user_id: string;
  text: string;
  char_count: number;
  word_count: number;
  created_at: string;
  analysis_status: AnalysisStatus;
  analysis?: PromptAnalysis;
}
```

### Dependency Requirements

The following packages must be installed (check `package.json`):

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.90.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.400.0"
  }
}
```

### Common Pitfalls to Avoid

1. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
2. **DO NOT** forget to cleanup Realtime subscriptions on unmount
3. **DO NOT** subscribe without team_id filter - will receive all teams' data
4. **DO NOT** block UI during real-time updates - use optimistic updates
5. **DO NOT** forget to handle all analysis status states
6. **DO NOT** use inline colors - use defined color tokens
7. **DO NOT** put feed page at `/dashboard/` - use `/prompts/` per architecture

### Verification Checklist

After completing this story, verify:
- [ ] Feed page displays prompts from current team
- [ ] Prompts are sorted by newest first
- [ ] Each prompt shows timestamp, score, truncated text
- [ ] ScoreBadge shows correct color based on score range
- [ ] New prompts appear at top without page refresh
- [ ] Analysis status updates in real-time
- [ ] "Analyzing..." spinner shows for pending prompts
- [ ] Score appears with smooth transition when analysis completes
- [ ] Failed analysis shows error indicator
- [ ] Realtime subscription cleans up on unmount
- [ ] Loading skeleton shows while fetching
- [ ] Empty state shows when no prompts exist

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
