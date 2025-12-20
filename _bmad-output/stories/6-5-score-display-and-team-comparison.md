# Story 6.5: Score Display & Team Comparison

Status: ready-for-dev

## Story

**As a** user,
**I want** to see how my scores compare to the team,
**So that** I understand my relative performance.

## Dependencies

- **Story 6.2** (Prompt Feed with Real-time Updates) - Feed components must exist
- **Story 5.4** (Analysis Storage) - `prompt_analyses` table with scores

## FR Coverage

- **FR45:** User can compare their scores against team average
- **FR70:** Prompt scores display team average alongside personal score

## Acceptance Criteria

1. **Given** a prompt's score display
   **When** I view it
   **Then** I see my score and the team average for that time period
   **And** an indicator shows if I'm above/below/at average

2. **Given** the score badge component
   **When** displaying scores
   **Then** colors indicate quality: Teal (7-10), Amber (4-6), Coral (1-3)
   **And** the badge is circular with the score number

3. **Given** team average calculation
   **When** computed
   **Then** it's calculated from all team prompts in the same time window
   **And** it updates as new prompts come in

## Tasks / Subtasks

- [ ] **Task 1: Enhance ScoreBadge with size variants** (AC: #2)
  - [ ] Add size prop to ScoreBadge component (sm, md, lg)
  - [ ] Define dimensions for each size:
    - sm: 32px (feed list)
    - md: 40px (default)
    - lg: 64px (detail view)
  - [ ] Adjust font size proportionally
  - [ ] Maintain circular shape at all sizes
  - [ ] Apply consistent color coding across sizes

- [ ] **Task 2: Create team average calculation hook** (AC: #3)
  - [ ] Create `lib/hooks/use-team-average.ts` hook
  - [ ] Calculate average from team prompts in specified time window
  - [ ] Accept time window parameter (7 days, 30 days, all time)
  - [ ] Use TanStack Query with `isPending`
  - [ ] Cache results with appropriate stale time

- [ ] **Task 3: Create team average badge component** (AC: #1)
  - [ ] Create `components/feed/team-average-badge.tsx`
  - [ ] Display team average score with muted styling
  - [ ] Show "Team avg: X.X" format
  - [ ] Position next to personal score
  - [ ] Apply same color coding rules

- [ ] **Task 4: Create comparison indicator component** (AC: #1)
  - [ ] Create `components/feed/comparison-indicator.tsx`
  - [ ] Show arrow up (green) if above average
  - [ ] Show arrow down (red) if below average
  - [ ] Show equals sign (gray) if at average (+/- 0.5)
  - [ ] Display difference value (e.g., "+1.2" or "-0.8")
  - [ ] Add tooltip explaining the comparison

- [ ] **Task 5: Create combined score comparison component** (AC: #1, #2)
  - [ ] Create `components/feed/score-comparison.tsx`
  - [ ] Combine personal score, team average, and indicator
  - [ ] Layout for both horizontal (feed) and vertical (detail)
  - [ ] Handle loading state for team average
  - [ ] Handle case when team has no other prompts

- [ ] **Task 6: Add real-time team average updates** (AC: #3)
  - [ ] Subscribe to team prompts changes via Supabase Realtime
  - [ ] Invalidate team average query on new prompts
  - [ ] Ensure smooth UI updates without flicker
  - [ ] Debounce updates if many prompts arrive quickly

- [ ] **Task 7: Update feed prompt row with comparison** (AC: #1)
  - [ ] Add comparison indicator to PromptRow component
  - [ ] Show compact version in feed (arrow + diff only)
  - [ ] Expand on hover or in detail view
  - [ ] Fetch team average once for feed, not per-row

- [ ] **Task 8: Create StatCard component** (AC: #1, #3)
  - [ ] Create `components/dashboard/stat-card.tsx`
  - [ ] Display: label, value, optional trend indicator
  - [ ] Style with dark mode colors
  - [ ] Support different value formats (number, percentage)
  - [ ] Add loading skeleton variant

- [ ] **Task 9: Add team stats to dashboard header** (AC: #3)
  - [ ] Display team average in dashboard header area
  - [ ] Show number of prompts this week/month
  - [ ] Update in real-time with new prompts
  - [ ] Compact display that doesn't overwhelm

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- TanStack Query 5.x - use `isPending` not `isLoading`
- Supabase Realtime for live updates
- TypeScript strict mode - no `any` types

**Score Color Mapping (from UX Design Spec):**
- Teal (#14b8a6): 7-10 (high quality)
- Amber (#f59e0b): 4-6 (medium quality)
- Coral (#f87171): 1-3 (needs improvement)

**Dark Mode Colors:**
- Background: #0a0a0a
- Card background: #1a1a1a
- Border: #2a2a2a
- Text: #fafafa

### Enhanced ScoreBadge Component

```typescript
// components/feed/score-badge.tsx
'use client';

import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';

interface ScoreBadgeProps {
  score?: number;
  status?: 'pending' | 'processing' | 'complete' | 'failed';
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
};

function getScoreColor(score: number): string {
  if (score >= 7) return 'bg-teal-500 text-white';
  if (score >= 4) return 'bg-amber-500 text-white';
  return 'bg-red-400 text-white';
}

export function ScoreBadge({ score, status = 'complete', size = 'md' }: ScoreBadgeProps) {
  const sizeClass = sizeClasses[size];

  if (status === 'pending' || status === 'processing') {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-full bg-[#2a2a2a]',
        sizeClass
      )}>
        <Loader2 className={cn(
          'animate-spin text-muted-foreground',
          size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
        )} />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-full bg-red-500/20',
        sizeClass
      )}>
        <AlertCircle className={cn(
          'text-red-400',
          size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
        )} />
      </div>
    );
  }

  if (score === undefined) return null;

  return (
    <div className={cn(
      'flex items-center justify-center rounded-full font-bold transition-colors',
      sizeClass,
      getScoreColor(score)
    )}>
      {score.toFixed(1)}
    </div>
  );
}
```

### Team Average Hook

```typescript
// lib/hooks/use-team-average.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

type TimeWindow = '7d' | '30d' | 'all';

function getDateFilter(window: TimeWindow): Date | null {
  const now = new Date();
  switch (window) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7));
    case '30d':
      return new Date(now.setDate(now.getDate() - 30));
    case 'all':
      return null;
  }
}

export function useTeamAverage(teamId: string, window: TimeWindow = '30d') {
  const supabase = createClient();

  return useQuery({
    queryKey: ['team-average', teamId, window],
    queryFn: async () => {
      let query = supabase
        .from('prompts')
        .select(`
          analysis:prompt_analyses(overall_score)
        `)
        .eq('team_id', teamId)
        .eq('analysis_status', 'complete');

      const dateFilter = getDateFilter(window);
      if (dateFilter) {
        query = query.gte('created_at', dateFilter.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const scores = data
        ?.map(p => p.analysis?.[0]?.overall_score)
        .filter((s): s is number => s !== undefined && s !== null);

      if (!scores || scores.length === 0) {
        return { average: null, count: 0 };
      }

      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { average, count: scores.length };
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
```

### Comparison Indicator Component

```typescript
// components/feed/comparison-indicator.tsx
'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ComparisonIndicatorProps {
  userScore: number;
  teamAverage: number;
  showValue?: boolean;
}

export function ComparisonIndicator({
  userScore,
  teamAverage,
  showValue = true,
}: ComparisonIndicatorProps) {
  const difference = userScore - teamAverage;
  const isAbove = difference > 0.5;
  const isBelow = difference < -0.5;

  const Icon = isAbove ? ArrowUp : isBelow ? ArrowDown : Minus;
  const color = isAbove
    ? 'text-teal-500'
    : isBelow
    ? 'text-red-400'
    : 'text-muted-foreground';

  const label = isAbove
    ? 'Above team average'
    : isBelow
    ? 'Below team average'
    : 'At team average';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn('flex items-center gap-1', color)}
            role="status"
            aria-label={`${label}: ${difference > 0 ? '+' : ''}${difference.toFixed(1)} from team average of ${teamAverage.toFixed(1)}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {showValue && (
              <span className="text-xs font-medium">
                {difference > 0 ? '+' : ''}{difference.toFixed(1)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
          <p className="text-xs text-muted-foreground">
            Team avg: {teamAverage.toFixed(1)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### Score Comparison Component

```typescript
// components/feed/score-comparison.tsx
'use client';

import { cn } from '@/lib/utils';
import { ScoreBadge } from './score-badge';
import { ComparisonIndicator } from './comparison-indicator';
import { useTeamAverage } from '@/lib/hooks/use-team-average';

interface ScoreComparisonProps {
  score: number;
  teamId: string;
  layout?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreComparison({
  score,
  teamId,
  layout = 'horizontal',
  size = 'md',
}: ScoreComparisonProps) {
  const { data, isPending } = useTeamAverage(teamId);

  return (
    <div className={cn(
      'flex items-center gap-2',
      layout === 'vertical' && 'flex-col'
    )}>
      <ScoreBadge score={score} size={size} />

      {isPending ? (
        <div className="h-4 w-12 animate-pulse rounded bg-[#2a2a2a]" />
      ) : data?.average !== null && data?.count > 1 ? (
        <ComparisonIndicator
          userScore={score}
          teamAverage={data.average}
          showValue={layout === 'vertical'}
        />
      ) : (
        <span className="text-xs text-muted-foreground">
          {data?.count === 1 ? 'Only prompt' : 'No team data'}
        </span>
      )}
    </div>
  );
}
```

### StatCard Component

```typescript
// components/dashboard/stat-card.tsx
'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  trend,
  trendValue,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <div className="h-4 w-20 animate-pulse rounded bg-[#2a2a2a] mb-2" />
        <div className="h-8 w-16 animate-pulse rounded bg-[#2a2a2a]" />
      </div>
    );
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up'
    ? 'text-teal-500'
    : trend === 'down'
    ? 'text-red-400'
    : 'text-muted-foreground';

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#fafafa]">{value}</span>
        {trend && (
          <div className={cn('flex items-center gap-1', trendColor)}>
            <TrendIcon className="h-4 w-4" aria-hidden="true" />
            {trendValue && <span className="text-xs">{trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Real-time Team Average Updates

```typescript
// lib/hooks/use-realtime-team-average.ts
'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeTeamAverage(teamId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('team-average-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prompt_analyses',
        },
        () => {
          // Debounce to prevent rapid invalidations
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ['team-average', teamId],
            });
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [teamId, queryClient, supabase]);
}
```

### Trend Calculation Helper

```typescript
// lib/utils/calculate-trend.ts
export type TrendDirection = 'up' | 'down' | 'stable';

export function calculateTrend(
  currentValue: number,
  previousValue: number,
  threshold: number = 0.1
): { direction: TrendDirection; percentage: number } {
  if (previousValue === 0) {
    return { direction: 'stable', percentage: 0 };
  }

  const change = ((currentValue - previousValue) / previousValue) * 100;

  if (change > threshold) {
    return { direction: 'up', percentage: change };
  } else if (change < -threshold) {
    return { direction: 'down', percentage: Math.abs(change) };
  }

  return { direction: 'stable', percentage: 0 };
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Score Badge (enhanced) | `components/feed/score-badge.tsx` |
| Team Average Badge | `components/feed/team-average-badge.tsx` |
| Comparison Indicator | `components/feed/comparison-indicator.tsx` |
| Score Comparison | `components/feed/score-comparison.tsx` |
| Stat Card | `components/dashboard/stat-card.tsx` |
| useTeamAverage Hook | `lib/hooks/use-team-average.ts` |
| useRealtimeTeamAverage Hook | `lib/hooks/use-realtime-team-average.ts` |
| Trend Calculator | `lib/utils/calculate-trend.ts` |

### Comparison Logic

| Difference | Display | Color |
|------------|---------|-------|
| > 0.5 | Arrow Up + value | Teal |
| < -0.5 | Arrow Down + value | Coral |
| -0.5 to 0.5 | Minus sign | Gray |

### Edge Cases to Handle

| Scenario | Expected Behavior |
|----------|-------------------|
| Only one team member | Show "Only prompt" instead of comparison |
| No completed analyses | Show "No team data" |
| User is exactly at average | Show minus sign, muted styling |
| Team average loading | Show skeleton loader |
| Real-time burst updates | Debounce to prevent flicker |

### Accessibility Requirements

- All icons must have `aria-hidden="true"` when decorative
- Comparison indicator must have `role="status"` with descriptive `aria-label`
- Color indicators must not be the only way to convey information (use icons + text)
- Tooltips must be keyboard accessible
- Minimum 4.5:1 color contrast ratio (WCAG AA)

### Common Pitfalls to Avoid

1. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
2. **DO NOT** calculate team average per-row - fetch once for feed
3. **DO NOT** forget to handle empty team (no prompts yet)
4. **DO NOT** include current prompt in its own comparison average
5. **DO NOT** forget to cleanup Realtime subscriptions
6. **DO NOT** show comparison for pending/failed prompts
7. **DO NOT** use color alone to indicate above/below - always include icon
8. **DO NOT** forget `cn` import from `@/lib/utils` in components

### Verification Checklist

After completing this story, verify:
- [ ] ScoreBadge displays with correct colors for all score ranges
- [ ] ScoreBadge works in sm, md, lg sizes
- [ ] Team average calculates correctly for 7d, 30d, all time
- [ ] Comparison indicator shows correct arrow direction
- [ ] Difference value is accurate
- [ ] Tooltip explains the comparison
- [ ] Team average updates when new prompts arrive
- [ ] StatCard displays with trend indicators
- [ ] Loading states show for team average
- [ ] Empty team state handled gracefully
- [ ] Real-time updates work without flicker
- [ ] Screen reader announces comparison status
- [ ] Keyboard navigation works on tooltips

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
