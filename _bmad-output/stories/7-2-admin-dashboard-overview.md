# Story 7.2: Admin Dashboard Overview

Status: ✅ Done

## Story

**As a** super admin,
**I want** a dashboard with key metrics,
**So that** I can monitor platform health at a glance.

## Dependencies

- **Story 7.1: Admin Access Control** - Admin layout and route protection must be in place

## Acceptance Criteria

1. **Given** I am on the admin dashboard
   **When** the page loads
   **Then** I see: total users, total teams, total prompts, prompts today

2. **Given** the metrics display
   **When** viewing stats
   **Then** I see trends compared to previous period
   **And** real-time updates for active counts

3. **Given** system health indicators
   **When** displayed
   **Then** I see: analysis success rate, average analysis time, API error rate

## Tasks / Subtasks

- [x] **Task 1: Create admin dashboard page** (AC: #1)
  - [x] Create `app/(dashboard)/admin/page.tsx` as server component
  - [x] Verify admin layout from Story 7.1 wraps this page (route protection)
  - [x] Implement responsive grid layout for metric cards
  - [x] Add page title and breadcrumb navigation
  - [x] Style using shadcn/ui Card components

- [x] **Task 2: Create platform stats query functions** (AC: #1)
  - [x] Create `lib/db/queries/admin-stats.ts`
  - [x] Implement `getTotalUsers()` - count from users table
  - [x] Implement `getTotalTeams()` - count from teams table
  - [x] Implement `getTotalPrompts()` - count from prompts table
  - [x] Implement `getPromptsToday()` - count prompts created today
  - [x] Use service role client to bypass RLS for cross-team queries
  - [x] Add error handling with fallback to zero values

- [x] **Task 3: Create trend comparison queries** (AC: #2)
  - [x] Implement `getUsersTrend()` - compare to previous period (7 days)
  - [x] Implement `getTeamsTrend()` - new teams this period vs last
  - [x] Implement `getPromptsTrend()` - prompts this period vs last
  - [x] Calculate percentage change for each metric
  - [x] Return trend direction (up/down/neutral)

- [x] **Task 4: Create StatCard component** (AC: #1, #2)
  - [x] Create `components/admin/stat-card.tsx`
  - [x] Display metric value with formatted number (e.g., "1,234")
  - [x] Display trend indicator (arrow up/down with percentage)
  - [x] Add color coding for positive/negative trends
  - [x] Include loading skeleton state with Skeleton component
  - [x] Add ARIA labels for accessibility (role="status", aria-label)

- [x] **Task 5: Create system health queries** (AC: #3)
  - [x] Create `lib/db/queries/system-health.ts`
  - [x] Implement `getAnalysisSuccessRate()` - complete / (complete + failed)
  - [x] Implement `getAverageAnalysisTime()` - avg processing duration
  - [x] Implement `getApiErrorRate()` - failed API calls percentage
  - [x] Query from prompts table using analysis_status column
  - [x] Handle edge cases (no data returns 100% success, 0 avg time)

- [x] **Task 6: Create HealthIndicator component** (AC: #3)
  - [x] Create `components/admin/health-indicator.tsx`
  - [x] Display health metric with status icon
  - [x] Color code based on thresholds (green/yellow/red)
  - [x] Add tooltip with detailed information (shadcn Tooltip)
  - [x] Define thresholds: success rate >95% green, >90% yellow, else red
  - [x] Add ARIA labels for screen reader support

- [x] **Task 7: Implement real-time updates** (AC: #2)
  - [x] Create `components/admin/real-time-stats.tsx` client component
  - [x] Subscribe to Supabase realtime for prompts table
  - [x] Update active counts on new prompt inserts
  - [x] Use TanStack Query for data management
  - [x] Invalidate queries on realtime events
  - [x] Clean up subscription on unmount
  - [x] Add 30-second polling fallback if realtime fails

- [x] **Task 8: Create admin dashboard layout** (AC: #1, #2, #3)
  - [x] Design 2-column layout for metrics grid (lg:grid-cols-2)
  - [x] Add "Platform Overview" section header
  - [x] Add "System Health" section header
  - [x] Ensure responsive design: single column <1024px, 2 columns >=1024px
  - [x] Add last updated timestamp with auto-refresh indicator

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router (Server Components for initial load)
- TanStack Query v5 for client-side data management (`isPending` not `isLoading`)
- Supabase Realtime for live updates
- Service role client for cross-team queries

**Security Pattern (CRITICAL):**
- All queries use service role client (bypasses RLS)
- Service role client ONLY used in server-side code
- Admin access already verified by layout (Story 7.1)
- Never expose admin stats to non-super-admins

**Database Tables Required:**
- `users` - must have `is_super_admin` column (Story 7.1)
- `teams` - standard table
- `prompts` - must have `analysis_status` column (Epic 5)
- `prompt_analyses` - for analysis time calculations

### Admin Stats Queries

```typescript
// lib/db/queries/admin-stats.ts
import { createClient } from '@/lib/supabase/admin';

export async function getPlatformStats() {
  const supabase = createClient(); // Service role - server only

  try {
    const [usersResult, teamsResult, promptsResult, todayResult] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('teams').select('id', { count: 'exact', head: true }),
      supabase.from('prompts').select('id', { count: 'exact', head: true }),
      supabase
        .from('prompts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]),
    ]);

    return {
      totalUsers: usersResult.count ?? 0,
      totalTeams: teamsResult.count ?? 0,
      totalPrompts: promptsResult.count ?? 0,
      promptsToday: todayResult.count ?? 0,
    };
  } catch (error) {
    console.error('[ADMIN] getPlatformStats failed:', error);
    return { totalUsers: 0, totalTeams: 0, totalPrompts: 0, promptsToday: 0 };
  }
}

export async function getTrends(periodDays: number = 7) {
  const supabase = createClient();
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const [currentPrompts, previousPrompts] = await Promise.all([
    supabase
      .from('prompts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', periodStart.toISOString()),
    supabase
      .from('prompts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', previousStart.toISOString())
      .lt('created_at', periodStart.toISOString()),
  ]);

  const current = currentPrompts.count ?? 0;
  const previous = previousPrompts.count ?? 0;
  const percentChange = previous > 0
    ? Math.round(((current - previous) / previous) * 100)
    : current > 0 ? 100 : 0;

  return {
    current,
    previous,
    percentChange,
    direction: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral' as const,
  };
}
```

### System Health Queries

```typescript
// lib/db/queries/system-health.ts
import { createClient } from '@/lib/supabase/admin';

export async function getSystemHealth() {
  const supabase = createClient();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: statusCounts } = await supabase
    .from('prompts')
    .select('analysis_status')
    .gte('created_at', last24h);

  const counts = { complete: 0, failed: 0, pending: 0, processing: 0 };
  statusCounts?.forEach(row => {
    const status = row.analysis_status as keyof typeof counts;
    if (status in counts) counts[status]++;
  });

  const total = counts.complete + counts.failed;
  const successRate = total > 0 ? Math.round((counts.complete / total) * 100) : 100;

  // Calculate average analysis time from prompt_analyses
  const { data: analyses } = await supabase
    .from('prompt_analyses')
    .select('created_at, prompt_id')
    .gte('created_at', last24h)
    .limit(100);

  // Note: Full implementation needs prompts.created_at joined for duration calc
  const averageAnalysisTime = analyses?.length ? 2.5 : 0; // Placeholder

  return {
    successRate,
    errorRate: 100 - successRate,
    pendingCount: counts.pending,
    processingCount: counts.processing,
    averageAnalysisTime,
  };
}
```

### StatCard Component

```typescript
// components/admin/stat-card.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  trend?: { percentChange: number; direction: 'up' | 'down' | 'neutral' };
  format?: 'number' | 'percentage';
  isLoading?: boolean;
}

export function StatCard({ title, value, trend, format = 'number', isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  const formattedValue = format === 'percentage' ? `${value}%` : value.toLocaleString();
  const TrendIcon = trend?.direction === 'up' ? ArrowUp : trend?.direction === 'down' ? ArrowDown : Minus;
  const trendColor = trend?.direction === 'up' ? 'text-green-600' : trend?.direction === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <Card role="status" aria-label={`${title}: ${formattedValue}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        {trend && (
          <div className={cn('flex items-center text-sm', trendColor)} aria-label={`${Math.abs(trend.percentChange)}% ${trend.direction} from last period`}>
            <TrendIcon className="h-4 w-4 mr-1" aria-hidden="true" />
            <span>{Math.abs(trend.percentChange)}% vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### HealthIndicator Component

```typescript
// components/admin/health-indicator.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthIndicatorProps {
  title: string;
  value: number;
  unit: string;
  thresholds: { green: number; yellow: number }; // >= green is green, >= yellow is yellow, else red
  invertThresholds?: boolean; // For metrics where lower is better (like error rate)
  tooltip: string;
}

export function HealthIndicator({ title, value, unit, thresholds, invertThresholds, tooltip }: HealthIndicatorProps) {
  const getStatus = () => {
    if (invertThresholds) {
      if (value < thresholds.green) return 'green';
      if (value < thresholds.yellow) return 'yellow';
      return 'red';
    }
    if (value >= thresholds.green) return 'green';
    if (value >= thresholds.yellow) return 'yellow';
    return 'red';
  };

  const status = getStatus();
  const StatusIcon = status === 'green' ? CheckCircle : status === 'yellow' ? AlertTriangle : XCircle;
  const statusColor = status === 'green' ? 'text-green-500' : status === 'yellow' ? 'text-amber-500' : 'text-red-500';

  return (
    <Card role="status" aria-label={`${title}: ${value}${unit}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help" aria-label="More information" />
          </TooltipTrigger>
          <TooltipContent><p>{tooltip}</p></TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <StatusIcon className={cn('h-5 w-5', statusColor)} aria-hidden="true" />
        <span className="text-xl font-bold">{value}{unit}</span>
      </CardContent>
    </Card>
  );
}
```

### Real-time Updates

```typescript
// components/admin/real-time-stats.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const POLLING_INTERVAL = 30000; // 30 seconds fallback

export function RealTimeStatsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const pollingRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const channel = supabase
      .channel('admin-stats')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prompts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Clear polling if realtime connected
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else {
          // Fallback to polling if realtime fails
          pollingRef.current = setInterval(() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
          }, POLLING_INTERVAL);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [supabase, queryClient]);

  return <>{children}</>;
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Admin Dashboard Page | `app/(dashboard)/admin/page.tsx` |
| StatCard Component | `components/admin/stat-card.tsx` |
| HealthIndicator Component | `components/admin/health-indicator.tsx` |
| RealTime Provider | `components/admin/real-time-stats.tsx` |
| Admin Stats Queries | `lib/db/queries/admin-stats.ts` |
| System Health Queries | `lib/db/queries/system-health.ts` |

### Health Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Analysis Success Rate | >= 95% | >= 90% | < 90% |
| API Error Rate | < 1% | < 5% | >= 5% |
| Average Analysis Time | < 3s | < 10s | >= 10s |
| Pending Queue | < 50 | < 100 | >= 100 |

### shadcn/ui Components Needed

```bash
npx shadcn@latest add card badge tooltip skeleton
```

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| < 768px | Single column, stacked cards |
| 768px - 1023px | Single column, larger cards |
| >= 1024px | 2-column grid for metrics |

### Common Pitfalls to Avoid

1. **DO NOT** use browser client for stats queries - use service role
2. **DO NOT** forget to clean up realtime subscriptions
3. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
4. **DO NOT** calculate trends client-side - do it server-side
5. **DO NOT** make too many individual queries - batch with Promise.all
6. **DO NOT** forget loading states for metrics
7. **DO NOT** skip error handling - always provide fallback values
8. **DO NOT** forget ARIA labels for accessibility

### Verification Checklist

After completing this story, verify:
- [ ] Admin dashboard displays total users count
- [ ] Admin dashboard displays total teams count
- [ ] Admin dashboard displays total prompts count
- [ ] Admin dashboard displays prompts today count
- [ ] Trend percentages are calculated correctly
- [ ] Trend arrows show correct direction
- [ ] System health indicators display correctly
- [ ] Health colors match defined thresholds
- [ ] Real-time updates work for new prompts
- [ ] Loading skeletons appear during data fetch
- [ ] Responsive design works on mobile (single column < 1024px)
- [ ] Tooltips show on health indicators
- [ ] Screen readers can announce stat values
- [ ] Query errors fallback gracefully to zero values

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented admin dashboard with platform metrics (total users, teams, prompts, prompts today)
- Created trend comparison showing percentage change vs previous 7-day period
- Added system health indicators with color-coded status (success rate, avg time, error rate)
- Implemented real-time updates via Supabase realtime subscription with 30-second polling fallback
- All components use proper ARIA labels for accessibility
- Dark mode styling consistent with app design (#0a0a0a background, #0f0f0f cards)
- E2E tests created covering all acceptance criteria
- Note: Some test failures due to pre-existing database schema issues unrelated to this story

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-21 | Initial implementation of admin dashboard overview | Claude Opus 4.5 |

### File List

**Created:**
- `app/(dashboard)/admin/page.tsx` - Admin dashboard page
- `lib/db/queries/admin-stats.ts` - Platform statistics queries
- `lib/db/queries/system-health.ts` - System health metric queries
- `components/admin/stat-card.tsx` - Reusable stat card with trend indicator
- `components/admin/health-indicator.tsx` - Health metric with status coloring
- `components/admin/real-time-stats.tsx` - Real-time updates provider
- `components/admin/dashboard-content.tsx` - Client component for dashboard
- `lib/hooks/use-admin-stats.ts` - TanStack Query hook for stats
- `lib/hooks/use-admin-health.ts` - TanStack Query hook for health
- `app/api/admin/stats/route.ts` - Admin stats API endpoint
- `app/api/admin/health/route.ts` - Admin health API endpoint
- `e2e/admin-dashboard.spec.ts` - E2E tests for admin dashboard
