# Story 6.6: Personal Analytics & Trends

**Epic:** 6 - Dashboard, Feed & Analytics
**FRs:** FR43 (Personal score trends over time), FR44 (Team analytics - dimension level view)
**Depends On:** Story 6.5 (Score Display & Team Comparison - provides StatCard, DimensionBar components)
**Status:** done

## Story

**As a** user,
**I want** to track my prompting improvement over time,
**So that** I can see my progress.

## Acceptance Criteria

1. **Given** I navigate to the Analytics section
   **When** the page loads
   **Then** I see my score trend chart (last 30 days)
   **And** summary stats: total prompts, average score, improvement

2. **Given** the trend chart
   **When** displayed
   **Then** it shows daily average scores as a line chart
   **And** trend direction is indicated (up/down/stable)
   **And** I can hover for daily details

3. **Given** dimension-level analytics
   **When** I view them
   **Then** I see which dimensions I score highest/lowest
   **And** specific improvement suggestions for weak areas

## Tasks / Subtasks

- [ ] **Task 1: Create analytics page layout** (AC: #1)
  - [ ] Create `app/(dashboard)/dashboard/analytics/page.tsx`
  - [ ] Create two-column layout (chart + stats)
  - [ ] Add page header with title and time range selector
  - [ ] Apply dark mode styling (#0a0a0a background)
  - [ ] Responsive layout for mobile (single column < 768px)

- [ ] **Task 2: Create AnalyticsDashboard container component** (AC: #1, #2, #3)
  - [ ] Create `components/analytics/analytics-dashboard.tsx`
  - [ ] Compose ScoreTrendChart, SummaryStats, DimensionBreakdown
  - [ ] Manage time range state with localStorage persistence
  - [ ] Pass data from usePersonalAnalytics hook to child components
  - [ ] Handle loading and error states

- [ ] **Task 3: Create summary stats section** (AC: #1)
  - [ ] Create `components/analytics/summary-stats.tsx`
  - [ ] Display total prompts count
  - [ ] Display average score for period
  - [ ] Display improvement percentage vs previous period
  - [ ] Reuse StatCard component from Story 6.5
  - [ ] Add loading skeletons while fetching

- [ ] **Task 4: Create score trend line chart** (AC: #2)
  - [ ] Create `components/analytics/score-trend-chart.tsx`
  - [ ] Use Recharts library for charting
  - [ ] Display daily average scores as line chart
  - [ ] Apply dark mode chart styling (grid: #2a2a2a, line: #14b8a6)
  - [ ] Add responsive container

- [ ] **Task 5: Add chart hover interactions** (AC: #2)
  - [ ] Implement custom tooltip on hover
  - [ ] Show date, average score, and prompt count
  - [ ] Highlight data point on hover
  - [ ] Smooth hover transitions

- [ ] **Task 6: Add trend direction indicator** (AC: #2)
  - [ ] Calculate trend from first half vs second half of period
  - [ ] Display trend arrow (up/down/stable) on chart
  - [ ] Show percentage change
  - [ ] Threshold: >5% = up, <-5% = down, else stable

- [ ] **Task 7: Create dimension breakdown section** (AC: #3)
  - [ ] Create `components/analytics/dimension-breakdown.tsx`
  - [ ] Calculate average score per dimension
  - [ ] Sort dimensions by score (lowest first for improvement focus)
  - [ ] Reuse DimensionBar component from Story 6.4/6.5

- [ ] **Task 8: Identify weakest dimensions** (AC: #3)
  - [ ] Highlight bottom 2 dimensions as "Focus Areas"
  - [ ] Show specific improvement suggestions
  - [ ] Link to relevant prompts with low dimension scores
  - [ ] Calculate potential improvement impact

- [ ] **Task 9: Create usePersonalAnalytics hook** (AC: #1, #2, #3)
  - [ ] Create `lib/hooks/use-personal-analytics.ts`
  - [ ] Fetch prompts and analyses for current user
  - [ ] Accept date range parameter (7d, 30d, 90d, all)
  - [ ] Calculate aggregated statistics
  - [ ] Use TanStack Query with `isPending` (NOT `isLoading`)

- [ ] **Task 10: Add time range selector** (AC: #1, #2)
  - [ ] Create `components/analytics/time-range-selector.tsx`
  - [ ] Create time range dropdown (7 days, 30 days, 90 days, All time)
  - [ ] Update all charts and stats on range change
  - [ ] Persist selected range in localStorage
  - [ ] Handle ranges with no data gracefully

- [ ] **Task 11: Calculate improvement metrics** (AC: #1)
  - [ ] Compare current period average to previous period
  - [ ] Calculate percentage change
  - [ ] Determine trend direction
  - [ ] Handle edge cases (new users, no previous data, division by zero)

- [ ] **Task 12: Create empty state component** (AC: #1, #2, #3)
  - [ ] Create `components/analytics/analytics-empty-state.tsx`
  - [ ] Show helpful message for users with no prompts
  - [ ] Link to prompt capture instructions
  - [ ] Different states for "no data in range" vs "no data at all"

## Dev Notes

### Critical Architecture Constraints

**Technology Stack (from architecture.md):**
- TanStack Query 5.90.x - use `isPending` NOT `isLoading` (v5 breaking change)
- Recharts for data visualization
- TypeScript strict mode - no `any`, explicit null handling
- Dark mode styling required (#0a0a0a background)
- date-fns for date manipulation

**Component Reuse from Previous Stories:**
- `StatCard` from Story 6.5 - reuse for summary stats display
- `DimensionBar` from Story 6.4/6.5 - reuse for dimension breakdown
- Follow same dark mode color palette established in Epic 6

### Analytics Dashboard Component

```typescript
// components/analytics/analytics-dashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/lib/auth/session';
import { usePersonalAnalytics, TimeRange } from '@/lib/hooks/use-personal-analytics';
import { ScoreTrendChart } from './score-trend-chart';
import { SummaryStats } from './summary-stats';
import { DimensionBreakdown } from './dimension-breakdown';
import { TimeRangeSelector } from './time-range-selector';
import { AnalyticsEmptyState } from './analytics-empty-state';
import { Skeleton } from '@/components/ui/skeleton';

const STORAGE_KEY = 'contextor-analytics-time-range';

export function AnalyticsDashboard() {
  const { user } = useSession();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Restore time range from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['7d', '30d', '90d', 'all'].includes(stored)) {
      setTimeRange(stored as TimeRange);
    }
  }, []);

  // Persist time range to localStorage
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    localStorage.setItem(STORAGE_KEY, range);
  };

  const { data, isPending, error } = usePersonalAnalytics(user?.id ?? '', timeRange);

  if (isPending) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-500">Failed to load analytics. Please try again.</p>
      </div>
    );
  }

  if (!data || data.totalPrompts === 0) {
    return <AnalyticsEmptyState hasAnyData={false} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#fafafa]">Your Progress</h2>
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
      </div>

      <SummaryStats
        totalPrompts={data.totalPrompts}
        avgScore={data.avgScore}
        improvement={data.improvement}
        trend={data.trend}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
          <h3 className="mb-4 font-medium text-[#fafafa]">Score Trend</h3>
          <ScoreTrendChart data={data.trendData} trend={data.trend} />
        </div>

        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
          <DimensionBreakdown dimensions={data.dimensions} />
        </div>
      </div>
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-10 w-[140px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[350px]" />
        <Skeleton className="h-[350px]" />
      </div>
    </div>
  );
}
```

### Analytics Page Layout

```typescript
// app/(dashboard)/dashboard/analytics/page.tsx
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#fafafa]">Your Analytics</h1>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
```

### Score Trend Chart Component

```typescript
// components/analytics/score-trend-chart.tsx
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Chart color constants
const CHART_COLORS = {
  line: '#14b8a6',       // teal-500
  grid: '#2a2a2a',
  axisText: '#a1a1aa',
  tooltipBg: '#1a1a1a',
  dot: '#14b8a6',
} as const;

interface TrendDataPoint {
  date: string;
  avgScore: number;
  promptCount: number;
}

type TrendDirection = 'up' | 'down' | 'stable';

interface ScoreTrendChartProps {
  data: TrendDataPoint[];
  trend: TrendDirection;
}

export function ScoreTrendChart({ data, trend }: ScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No data available for this time range
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrendIndicator direction={trend} />
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="date"
              stroke={CHART_COLORS.axisText}
              tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
              tickFormatter={(value) => format(new Date(value), 'MMM d')}
            />
            <YAxis
              domain={[0, 10]}
              stroke={CHART_COLORS.axisText}
              tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={5} stroke="#52525b" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="avgScore"
              stroke={CHART_COLORS.line}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.dot, r: 4 }}
              activeDot={{ r: 6, fill: CHART_COLORS.dot }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendIndicator({ direction }: { direction: TrendDirection }) {
  switch (direction) {
    case 'up':
      return (
        <span className="flex items-center gap-1 text-teal-500">
          <TrendingUp className="h-4 w-4" />
          Improving
        </span>
      );
    case 'down':
      return (
        <span className="flex items-center gap-1 text-red-500">
          <TrendingDown className="h-4 w-4" />
          Declining
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-zinc-400">
          <Minus className="h-4 w-4" />
          Stable
        </span>
      );
  }
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as TrendDataPoint;

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-3 shadow-lg">
      <p className="text-sm font-medium text-[#fafafa]">
        {format(new Date(label), 'MMMM d, yyyy')}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Average Score: <span className="font-bold text-teal-500">{data.avgScore.toFixed(1)}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        Prompts: {data.promptCount}
      </p>
    </div>
  );
}
```

### Dimension Breakdown Component

```typescript
// components/analytics/dimension-breakdown.tsx
'use client';

import { DimensionBar } from '@/components/feed/dimension-bar';

interface DimensionAverage {
  dimension_id: string;
  name: string;
  avgScore: number;
  suggestion?: string;
}

interface DimensionBreakdownProps {
  dimensions: DimensionAverage[];
}

// Default suggestions for weak dimensions
const DIMENSION_SUGGESTIONS: Record<string, string> = {
  'clarity': 'Try using more specific language and avoid ambiguous terms.',
  'context': 'Include more background information about your situation or codebase.',
  'specificity': 'Add concrete examples and specific requirements.',
  'goal': 'Clearly state what you want to achieve or the expected outcome.',
  'constraints': 'Mention any limitations, requirements, or boundaries.',
};

export function DimensionBreakdown({ dimensions }: DimensionBreakdownProps) {
  if (dimensions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No dimension data available
      </div>
    );
  }

  // Sort by score ascending (weakest first)
  const sorted = [...dimensions].sort((a, b) => a.avgScore - b.avgScore);
  const weakest = sorted.slice(0, 2);

  // Add suggestions to weak dimensions
  const weakestWithSuggestions = weakest.map((dim) => ({
    ...dim,
    suggestion: dim.suggestion || DIMENSION_SUGGESTIONS[dim.name.toLowerCase()] ||
      `Focus on improving your ${dim.name.toLowerCase()} scores.`,
  }));

  return (
    <div className="space-y-6">
      {/* Focus Areas */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <h3 className="mb-3 font-medium text-amber-500">Focus Areas</h3>
        <div className="space-y-3">
          {weakestWithSuggestions.map((dim) => (
            <div key={dim.dimension_id} className="space-y-1">
              <DimensionBar
                name={dim.name}
                score={dim.avgScore}
              />
              <p className="text-xs text-muted-foreground pl-1">{dim.suggestion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* All Dimensions */}
      <div>
        <h3 className="mb-3 font-medium text-[#fafafa]">All Dimensions</h3>
        <div className="space-y-3">
          {dimensions.map((dim) => (
            <DimensionBar
              key={dim.dimension_id}
              name={dim.name}
              score={dim.avgScore}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Summary Stats Component

```typescript
// components/analytics/summary-stats.tsx
'use client';

import { StatCard } from '@/components/feed/stat-card';
import { TrendingUp, TrendingDown, Minus, FileText, Target, Sparkles } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'stable';

interface SummaryStatsProps {
  totalPrompts: number;
  avgScore: number;
  improvement: number;
  trend: TrendDirection;
}

export function SummaryStats({ totalPrompts, avgScore, improvement, trend }: SummaryStatsProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-teal-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-zinc-400" />;
    }
  };

  const getImprovementColor = () => {
    if (improvement > 0) return 'text-teal-500';
    if (improvement < 0) return 'text-red-500';
    return 'text-zinc-400';
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard
        title="Total Prompts"
        value={totalPrompts.toString()}
        icon={<FileText className="h-4 w-4" />}
      />
      <StatCard
        title="Average Score"
        value={avgScore.toFixed(1)}
        icon={<Target className="h-4 w-4" />}
        suffix="/10"
      />
      <StatCard
        title="Improvement"
        value={`${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`}
        icon={getTrendIcon()}
        valueClassName={getImprovementColor()}
        subtitle="vs previous period"
      />
    </div>
  );
}
```

### Personal Analytics Hook

```typescript
// lib/hooks/use-personal-analytics.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { startOfDay, subDays, eachDayOfInterval, format } from 'date-fns';

export type TimeRange = '7d' | '30d' | '90d' | 'all';
export type TrendDirection = 'up' | 'down' | 'stable';

interface TrendDataPoint {
  date: string;
  avgScore: number;
  promptCount: number;
}

interface DimensionAverage {
  dimension_id: string;
  name: string;
  avgScore: number;
}

interface PersonalAnalyticsData {
  trendData: TrendDataPoint[];
  totalPrompts: number;
  avgScore: number;
  improvement: number;
  dimensions: DimensionAverage[];
  trend: TrendDirection;
}

export function usePersonalAnalytics(userId: string, timeRange: TimeRange = '30d') {
  const supabase = createClient();

  return useQuery<PersonalAnalyticsData>({
    queryKey: ['personal-analytics', userId, timeRange],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const endDate = new Date();
      const startDate = getStartDate(timeRange);

      // Fetch prompts with analyses
      let query = supabase
        .from('prompts')
        .select(`
          id,
          created_at,
          analysis:prompt_analyses(
            overall_score,
            dimension_scores
          )
        `)
        .eq('user_id', userId)
        .eq('analysis_status', 'complete')
        .order('created_at', { ascending: true });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return processAnalyticsData(data ?? [], startDate, endDate);
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

function getStartDate(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case '7d':
      return subDays(now, 7);
    case '30d':
      return subDays(now, 30);
    case '90d':
      return subDays(now, 90);
    case 'all':
      return null;
  }
}

function processAnalyticsData(
  data: any[],
  startDate: Date | null,
  endDate: Date
): PersonalAnalyticsData {
  // Group by day for trend chart
  const dailyData = new Map<string, { scores: number[]; count: number }>();

  // Initialize all days in range (for continuous chart)
  if (startDate) {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    days.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      dailyData.set(key, { scores: [], count: 0 });
    });
  }

  // Aggregate scores by day
  data.forEach((prompt) => {
    const day = format(new Date(prompt.created_at), 'yyyy-MM-dd');
    const score = prompt.analysis?.[0]?.overall_score;

    if (score !== undefined && score !== null) {
      const existing = dailyData.get(day) || { scores: [], count: 0 };
      existing.scores.push(score);
      existing.count++;
      dailyData.set(day, existing);
    }
  });

  // Convert to chart format (only days with data)
  const trendData = Array.from(dailyData.entries())
    .map(([date, { scores, count }]) => ({
      date,
      avgScore: scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0,
      promptCount: count,
    }))
    .filter((d) => d.promptCount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate summary stats
  const allScores = data
    .map((p) => p.analysis?.[0]?.overall_score)
    .filter((s): s is number => s !== undefined && s !== null);

  const totalPrompts = data.length;
  const avgScore =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

  // Calculate improvement (compare first half to second half)
  const midpoint = Math.floor(allScores.length / 2);
  const firstHalf = allScores.slice(0, midpoint);
  const secondHalf = allScores.slice(midpoint);

  const firstAvg =
    firstHalf.length > 0
      ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      : 0;
  const secondAvg =
    secondHalf.length > 0
      ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      : 0;

  // Safe division - handle edge case where firstAvg is 0
  const improvement =
    firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

  // Determine trend direction: >5% up, <-5% down, else stable
  const trend: TrendDirection =
    improvement > 5 ? 'up' : improvement < -5 ? 'down' : 'stable';

  // Calculate dimension averages
  const dimensionScores = new Map<string, { name: string; scores: number[] }>();
  data.forEach((prompt) => {
    const dims = prompt.analysis?.[0]?.dimension_scores || [];
    dims.forEach((dim: any) => {
      if (dim.dimension_id && dim.score !== undefined) {
        const existing = dimensionScores.get(dim.dimension_id) || {
          name: dim.name || dim.dimension_id,
          scores: [],
        };
        existing.scores.push(dim.score);
        dimensionScores.set(dim.dimension_id, existing);
      }
    });
  });

  const dimensions = Array.from(dimensionScores.entries()).map(
    ([id, { name, scores }]) => ({
      dimension_id: id,
      name,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    })
  );

  return {
    trendData,
    totalPrompts,
    avgScore,
    improvement,
    dimensions,
    trend,
  };
}
```

### Time Range Selector Component

```typescript
// components/analytics/time-range-selector.tsx
'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimeRange } from '@/lib/hooks/use-personal-analytics';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TimeRange)}>
      <SelectTrigger className="w-[140px] bg-[#1a1a1a] border-[#2a2a2a]">
        <SelectValue placeholder="Time range" />
      </SelectTrigger>
      <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
        {TIME_RANGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Analytics Empty State Component

```typescript
// components/analytics/analytics-empty-state.tsx
'use client';

import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AnalyticsEmptyStateProps {
  hasAnyData: boolean;
}

export function AnalyticsEmptyState({ hasAnyData }: AnalyticsEmptyStateProps) {
  if (hasAnyData) {
    // User has data but not in selected range
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-[#fafafa]">No data in this range</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Try selecting a different time range to see your analytics.
        </p>
      </div>
    );
  }

  // User has no data at all
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium text-[#fafafa]">Start tracking your progress</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        Once you capture some prompts, you'll see your score trends and improvement areas here.
      </p>
      <Link href="/prompts" className="mt-4">
        <Button variant="outline">
          View Prompts
        </Button>
      </Link>
    </div>
  );
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Analytics Page | `app/(dashboard)/dashboard/analytics/page.tsx` |
| Analytics Dashboard | `components/analytics/analytics-dashboard.tsx` |
| Score Trend Chart | `components/analytics/score-trend-chart.tsx` |
| Dimension Breakdown | `components/analytics/dimension-breakdown.tsx` |
| Summary Stats | `components/analytics/summary-stats.tsx` |
| Time Range Selector | `components/analytics/time-range-selector.tsx` |
| Analytics Empty State | `components/analytics/analytics-empty-state.tsx` |
| usePersonalAnalytics Hook | `lib/hooks/use-personal-analytics.ts` |

### NPM Packages Needed

```bash
npm install recharts date-fns
```

### shadcn/ui Components Needed

```bash
npx shadcn@latest add select skeleton
```

### Chart Color Scheme

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Line | teal-500 | #14b8a6 | Score trend line |
| Grid | zinc-800 | #2a2a2a | Chart grid lines |
| Axis Text | zinc-400 | #a1a1aa | Axis labels |
| Tooltip BG | zinc-900 | #1a1a1a | Tooltip background |
| Dots | teal-500 | #14b8a6 | Data points |
| Reference | zinc-600 | #52525b | Middle score line |

### Common Pitfalls to Avoid

1. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
2. **DO NOT** forget to handle empty data states (new users)
3. **DO NOT** assume all prompts have completed analyses
4. **DO NOT** forget responsive chart sizing
5. **DO NOT** calculate improvement without checking for division by zero
6. **DO NOT** skip loading skeletons for slow queries
7. **DO NOT** forget to export TimeRange type from hook for reuse
8. **DO NOT** mutate the dimensions array directly - always copy first

### Verification Checklist

After completing this story, verify:
- [ ] Analytics page loads with summary stats
- [ ] Total prompts count is accurate
- [ ] Average score calculates correctly
- [ ] Improvement percentage shows vs previous period
- [ ] Trend chart displays daily averages
- [ ] Chart tooltip shows on hover with details
- [ ] Trend direction indicator is accurate (up/down/stable)
- [ ] Dimension breakdown shows all dimensions
- [ ] Weakest dimensions highlighted as Focus Areas
- [ ] Time range selector changes all data
- [ ] Time range persists in localStorage
- [ ] Empty state handles users with no prompts
- [ ] Empty state handles "no data in range" scenario
- [ ] Loading skeletons display while fetching
- [ ] Error state displays on fetch failure

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
