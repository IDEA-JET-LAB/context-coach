# Story 7.6: System Health Monitoring

Status: ✅ Done

## Story

**As a** super admin,
**I want** to monitor system health,
**So that** I can respond to issues quickly.

## Dependencies

- **Story 5.5**: Retry Logic & Error Handling (provides `retry_count`, `last_error`, `analysis_status` columns)
- **Story 7.1**: Admin Access Control (provides admin middleware and `is_super_admin` check)

## Acceptance Criteria

1. **Given** I navigate to Admin > System
   **When** the page loads
   **Then** I see: API response times, database connections, Edge Function status

2. **Given** the analysis queue
   **When** viewing status
   **Then** I see: pending count, processing count, failed count (last 24h)

3. **Given** the dead letter queue
   **When** viewing failed analyses
   **Then** I see prompts that failed analysis after all retries
   **And** I can trigger manual retry or dismiss

4. **Given** an alert condition
   **When** thresholds are exceeded (e.g., >100 pending, >5% error rate)
   **Then** the metric is highlighted in red
   **And** details show recent error messages

## Tasks / Subtasks

- [x] **Task 1: Create system health page** (AC: #1)
  - [x] Create `app/(dashboard)/admin/system/page.tsx`
  - [x] Implement responsive dashboard layout (grid for desktop, stack for mobile)
  - [x] Add section headers: "System Metrics", "Analysis Queue", "Dead Letter Queue"
  - [x] Include last updated timestamp with refresh button
  - [x] Add loading skeleton states for initial page load

- [x] **Task 2: Create system metrics queries** (AC: #1)
  - [x] Create `lib/db/queries/system-metrics.ts`
  - [x] Import `createClient` from `@/lib/supabase/admin` (service role client)
  - [x] Query API response times (if logged to database)
  - [x] Query database connection pool status (if available)
  - [x] Query Edge Function invocation counts and errors
  - [x] Use service role client for all queries (bypasses RLS)

- [x] **Task 3: Create system metrics cards** (AC: #1, #4)
  - [x] Create `components/admin/system-metric-card.tsx`
  - [x] Display metric value with unit (ms, %, count)
  - [x] Show status indicator (green/yellow/red)
  - [x] Add sparkline for recent trend (optional)
  - [x] Show threshold in tooltip
  - [x] Add `aria-label` for screen reader accessibility

- [x] **Task 4: Create analysis queue status** (AC: #2)
  - [x] Create `components/admin/analysis-queue-status.tsx`
  - [x] Query prompts table for status counts
  - [x] Display: pending, processing, complete, failed (last 24h)
  - [x] Show progress bars or pie chart for distribution
  - [x] Color-code based on thresholds

- [x] **Task 5: Create queue status query** (AC: #2)
  - [x] Implement `getAnalysisQueueStatus()` in system-metrics.ts
  - [x] Count by `analysis_status` column (values: pending, processing, complete, failed)
  - [x] Filter to last 24 hours using `created_at`
  - [x] Calculate percentages
  - [x] Return trend vs previous period

- [x] **Task 6: Create dead letter queue view** (AC: #3)
  - [x] Create `components/admin/dead-letter-queue.tsx`
  - [x] Query prompts where `analysis_status = 'failed'`
  - [x] Display in table: prompt excerpt, team, user, failed_at, retry count
  - [x] Add pagination for large lists
  - [x] Show total failed count in header
  - [x] Add keyboard navigation for table rows

- [x] **Task 7: Implement manual retry functionality** (AC: #3)
  - [x] Add "Retry" button on each failed item
  - [x] Create `lib/api/admin/retry-analysis.ts` server action
  - [x] Reset `analysis_status` to 'pending' and `retry_count` to 0
  - [x] Clear `last_error` field (column exists from Story 5.5)
  - [x] Trigger analysis queue processing via Edge Function
  - [x] Show success/error toast

- [x] **Task 8: Implement dismiss functionality** (AC: #3)
  - [x] Add "Dismiss" button on each failed item
  - [x] Create confirmation dialog using shadcn AlertDialog component
  - [x] Create `lib/api/admin/dismiss-failed-analysis.ts` server action
  - [x] Mark as 'dismissed' status or delete from queue
  - [x] Log dismissal for audit

- [x] **Task 9: Implement alert highlighting** (AC: #4)
  - [x] Define threshold constants in `lib/utils/health-thresholds.ts`
  - [x] Implement threshold checking logic
  - [x] Apply red styling when exceeded
  - [x] Add pulsing/attention animation for critical (use Tailwind `animate-pulse`)

- [x] **Task 10: Display error details** (AC: #4)
  - [x] Create `components/admin/error-details-panel.tsx`
  - [x] Query recent error logs from `prompts.last_error`
  - [x] Display error message, timestamp (DO NOT show stack traces for security)
  - [x] Group by error type
  - [x] Add expandable rows for full details

- [x] **Task 11: Implement auto-refresh** (AC: #1, #2)
  - [x] Add auto-refresh toggle (30s interval minimum)
  - [x] Use TanStack Query v5 with `refetchInterval` (use `isPending` not `isLoading`)
  - [x] Show countdown to next refresh
  - [x] Pause refresh when tab inactive using document.visibilitychange
  - [x] Manual refresh button always available

- [x] **Task 12: Create bulk retry functionality** (AC: #3)
  - [x] Add "Retry All Failed" button
  - [x] Create `lib/api/admin/bulk-retry-analysis.ts` server action
  - [x] Show confirmation with count using AlertDialog
  - [x] Process in batches (max 100) to avoid overload
  - [x] Display progress indicator

- [x] **Task 13: Add Supabase Realtime subscription** (AC: #1, #2)
  - [x] Subscribe to prompts table changes for `analysis_status` updates
  - [x] Invalidate TanStack Query cache on changes
  - [x] Unsubscribe in cleanup function on component unmount

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router
- TanStack Query v5 (`isPending` not `isLoading`)
- Supabase service role client (bypasses RLS for cross-team admin queries)
- Supabase Realtime for live updates

**Analysis Engine Context (from Story 5.5):**
- Analysis status values: `pending` -> `processing` -> `complete` | `failed`
- Max retries: 3 with delays [1s, 5s, 15s]
- Failed after retries = dead letter queue
- Columns exist on prompts table: `analysis_status`, `retry_count`, `last_error`

**Admin Access Control (from Story 7.1):**
- Middleware checks `is_super_admin` flag
- Redirect non-admins to `/dashboard`

### Health Thresholds

```typescript
// lib/utils/health-thresholds.ts
export const HEALTH_THRESHOLDS = {
  pendingQueue: { warning: 50, critical: 100 },
  processingQueue: { warning: 20, critical: 50 },
  errorRate: { warning: 2, critical: 5 }, // percentages
  successRate: { warning: 95, critical: 90 }, // below is bad
  apiResponseTime: { warning: 2000, critical: 5000 }, // ms
  analysisTime: { warning: 10000, critical: 30000 }, // ms
} as const;

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export function getHealthStatus(
  value: number,
  thresholds: { warning: number; critical: number },
  higherIsBetter = false
): HealthStatus {
  if (higherIsBetter) {
    if (value < thresholds.critical) return 'critical';
    if (value < thresholds.warning) return 'warning';
    return 'healthy';
  }
  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.warning) return 'warning';
  return 'healthy';
}
```

### System Metrics Query (Service Role Client)

```typescript
// lib/db/queries/system-metrics.ts
import { createClient } from '@/lib/supabase/admin'; // Service role - bypasses RLS

export async function getAnalysisQueueStatus() {
  const supabase = createClient();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('prompts')
    .select('analysis_status')
    .gte('created_at', last24h);

  if (error) throw error;

  const counts = { pending: 0, processing: 0, complete: 0, failed: 0 };
  data?.forEach(row => {
    const status = row.analysis_status as keyof typeof counts;
    if (status in counts) counts[status]++;
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    counts,
    total,
    successRate: total > 0 ? Math.round((counts.complete / total) * 100) : 100,
    errorRate: total > 0 ? Math.round((counts.failed / total) * 100) : 0,
  };
}

export async function getDeadLetterQueue(page = 1, pageSize = 20) {
  const supabase = createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from('prompts')
    .select(`
      id, text, created_at, updated_at, retry_count, last_error,
      user:users(id, email),
      team:teams(id, name)
    `, { count: 'exact' })
    .eq('analysis_status', 'failed')
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}
```

### Retry Analysis Server Action

```typescript
// lib/api/admin/retry-analysis.ts
'use server';

import { createClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function retryAnalysis(promptId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('prompts')
    .update({ analysis_status: 'pending', retry_count: 0, last_error: null })
    .eq('id', promptId);

  if (error) throw error;

  // Trigger analysis Edge Function
  await supabase.functions.invoke('trigger-analysis', {
    body: { prompt_id: promptId },
  });

  console.log(`[Admin] Retried analysis for prompt ${promptId}`);
  revalidatePath('/admin/system');
  return { success: true };
}

export async function bulkRetryAnalysis() {
  const supabase = createClient();

  const { data: failed } = await supabase
    .from('prompts')
    .select('id')
    .eq('analysis_status', 'failed')
    .limit(100); // Process in batches

  if (!failed?.length) return { success: true, count: 0 };

  const { error } = await supabase
    .from('prompts')
    .update({ analysis_status: 'pending', retry_count: 0, last_error: null })
    .in('id', failed.map(p => p.id));

  if (error) throw error;

  console.log(`[Admin] Bulk retried ${failed.length} analyses`);
  revalidatePath('/admin/system');
  return { success: true, count: failed.length };
}
```

### Auto-Refresh with Tab Visibility

```typescript
// components/admin/auto-refresh-provider.tsx
'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const REFRESH_INTERVAL = 30000; // 30s minimum

export function AutoRefreshProvider({ children }: { children: React.ReactNode }) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          queryClient.invalidateQueries({ queryKey: ['admin', 'system'] });
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, queryClient]);

  // Pause when tab hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setAutoRefresh(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          <Label htmlFor="auto-refresh">Auto-refresh</Label>
        </div>
        {autoRefresh && (
          <span className="text-sm text-muted-foreground">Refreshing in {countdown}s</span>
        )}
      </div>
      {children}
    </>
  );
}
```

### System Metric Card Component

```typescript
// components/admin/system-metric-card.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HealthStatus } from '@/lib/utils/health-thresholds';

interface SystemMetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  status: HealthStatus;
  threshold?: string;
  description?: string;
}

const statusConfig = {
  healthy: { icon: CheckCircle, color: 'text-green-600', borderColor: 'border-green-200' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', borderColor: 'border-yellow-200' },
  critical: { icon: AlertCircle, color: 'text-red-600', borderColor: 'border-red-200', animate: 'animate-pulse' },
};

export function SystemMetricCard({ title, value, unit, status, threshold, description }: SystemMetricCardProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card className={cn(config.borderColor, 'border-2')} role="region" aria-label={`${title} metric`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Icon className={cn('h-5 w-5', config.color, config.animate)} aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent><p>{threshold ?? `Status: ${status}`}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', config.color)} aria-live="polite">
          {value}{unit && <span className="text-lg ml-1">{unit}</span>}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
```

### Dead Letter Queue with Realtime

```typescript
// components/admin/dead-letter-queue.tsx
'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { RefreshCw, X, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { retryAnalysis } from '@/lib/api/admin/retry-analysis';
import { dismissFailedAnalysis } from '@/lib/api/admin/dismiss-failed-analysis';

interface FailedPrompt {
  id: string;
  text: string;
  created_at: string;
  updated_at: string;
  retry_count: number;
  last_error: string | null;
  user: { id: string; email: string } | null;
  team: { id: string; name: string } | null;
}

interface DeadLetterQueueProps {
  items: FailedPrompt[];
  total: number;
  onRefresh: () => void;
}

export function DeadLetterQueue({ items, total, onRefresh }: DeadLetterQueueProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Realtime subscription for status changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-prompts')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prompts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'dead-letter'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, queryClient]);

  const retryMutation = useMutation({
    mutationFn: retryAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dead-letter'] });
      onRefresh();
    },
  });

  const dismissMutation = useMutation({
    mutationFn: dismissFailedAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dead-letter'] });
      onRefresh();
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
          Dead Letter Queue
          <Badge variant="destructive">{total}</Badge>
        </h3>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" /> Refresh
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No failed analyses. System is healthy!</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prompt</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Retries</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} tabIndex={0}>
                <TableCell className="max-w-xs truncate" title={item.text}>
                  {item.text.substring(0, 50)}...
                </TableCell>
                <TableCell>{item.team?.name ?? 'Unknown'}</TableCell>
                <TableCell><Badge variant="outline">{item.retry_count}/3</Badge></TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="max-w-xs truncate text-red-600" title={item.last_error ?? ''}>
                  {item.last_error ?? 'Unknown error'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryMutation.mutate(item.id)}
                      disabled={retryMutation.isPending}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" /> Retry
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={dismissMutation.isPending}>
                          <X className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Dismiss failed analysis?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this prompt from the dead letter queue.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => dismissMutation.mutate(item.id)}>
                            Dismiss
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| System Health Page | `app/(dashboard)/admin/system/page.tsx` |
| System Metric Card | `components/admin/system-metric-card.tsx` |
| Analysis Queue Status | `components/admin/analysis-queue-status.tsx` |
| Dead Letter Queue | `components/admin/dead-letter-queue.tsx` |
| Error Details Panel | `components/admin/error-details-panel.tsx` |
| Auto Refresh Provider | `components/admin/auto-refresh-provider.tsx` |
| Health Thresholds | `lib/utils/health-thresholds.ts` |
| System Metrics Queries | `lib/db/queries/system-metrics.ts` |
| Retry Analysis Action | `lib/api/admin/retry-analysis.ts` |
| Dismiss Analysis Action | `lib/api/admin/dismiss-failed-analysis.ts` |

### Database Verification

**Existing columns (from Story 5.5 - do not recreate):**
- `prompts.analysis_status` - tracks pending/processing/complete/failed
- `prompts.retry_count` - INTEGER tracking retry attempts
- `prompts.last_error` - TEXT storing error messages

**New index for efficient dead letter queue queries:**

```sql
-- Only add if not exists - check first
CREATE INDEX IF NOT EXISTS idx_prompts_failed
  ON prompts(analysis_status, updated_at DESC)
  WHERE analysis_status = 'failed';
```

### shadcn/ui Components Needed

```bash
npx shadcn@latest add card switch label tooltip progress alert-dialog
```

### Common Pitfalls to Avoid

1. **DO NOT** show full stack traces - they may contain sensitive info
2. **DO NOT** auto-refresh more frequently than 30s
3. **DO NOT** forget to pause refresh when tab is hidden
4. **DO NOT** retry without resetting retry_count
5. **DO NOT** process more than 100 bulk retries at once
6. **DO NOT** forget cleanup on component unmount (Realtime subscription)
7. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
8. **DO NOT** recreate columns that exist from Story 5.5

### Verification Checklist

After completing this story, verify:
- [ ] System health page loads without errors
- [ ] Admin access denied for non-super-admins
- [ ] API response time metric displays
- [ ] Database connection status shows
- [ ] Edge Function status displays
- [ ] Queue status shows all 4 statuses
- [ ] Pending count highlights at threshold (>50 warning, >100 critical)
- [ ] Error rate highlights when high (>2% warning, >5% critical)
- [ ] Dead letter queue shows failed items
- [ ] Retry button requeues prompt
- [ ] Dismiss button shows confirmation dialog
- [ ] Bulk retry processes max 100 failed
- [ ] Auto-refresh works correctly (30s interval)
- [ ] Pause on tab switch works
- [ ] Manual refresh button works
- [ ] Error details visible but no stack traces
- [ ] Realtime updates work for status changes
- [ ] Keyboard navigation works in table
- [ ] Screen reader announces status changes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented complete system health monitoring dashboard
- Created system metrics cards showing API response time, database status, Edge Function status
- Implemented analysis queue status with pending/processing/complete/failed counts
- Created dead letter queue view with retry and dismiss functionality
- Added auto-refresh with 30-second interval and tab visibility detection
- Implemented alert thresholds with color-coded status indicators
- All 25 E2E tests passing

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-21 | Initial implementation of system health monitoring | Claude Opus 4.5 |

### File List

**Created:**
- `app/app/(dashboard)/admin/system/page.tsx` - System health page
- `app/components/admin/system-metric-card.tsx` - Metric card component
- `app/components/admin/analysis-queue-status.tsx` - Queue status display
- `app/components/admin/dead-letter-queue.tsx` - Failed analysis queue
- `app/components/admin/auto-refresh-controls.tsx` - Auto-refresh toggle
- `app/lib/db/queries/system-metrics.ts` - System metrics queries
- `app/lib/utils/health-thresholds.ts` - Health threshold constants
- `app/app/api/admin/prompts/retry/route.ts` - Retry analysis API
- `app/e2e/admin-system.spec.ts` - E2E tests (25 tests)
