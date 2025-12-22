# Story 6.7: Team Analytics (Team Leads)

Status: ✅ Done

## Story

**As a** team lead,
**I want** to see team-wide analytics,
**So that** I can identify coaching opportunities.

## Acceptance Criteria

1. **Given** I am a team admin
   **When** I view Team Analytics
   **Then** I see team-wide score distribution
   **And** trends over time for the whole team
   **And** per-member breakdown (average scores)

2. **Given** the per-member view
   **When** I click on a team member
   **Then** I see their recent prompts and patterns
   **And** I can identify specific coaching opportunities

3. **Given** I am a regular team member
   **When** I try to access Team Analytics
   **Then** I see only aggregated team stats (not individual member data)

## Tasks / Subtasks

- [ ] **Task 1: Create team analytics page** (AC: #1, #3)
  - [ ] Update `app/(dashboard)/dashboard/team/page.tsx`
  - [ ] Check user role (admin vs member) on load
  - [ ] Show full analytics for admins via `TeamAdminAnalytics`
  - [ ] Show limited aggregated view for members via `TeamSummary`
  - [ ] Apply dark mode styling (#0a0a0a background)

- [ ] **Task 2: Fetch user role and permissions** (AC: #3)
  - [ ] Create `lib/hooks/use-team-role.ts` hook
  - [ ] Query `team_members` table for current user's role
  - [ ] Return role and isAdmin boolean
  - [ ] Use TanStack Query with `isPending`

- [ ] **Task 3: Create team score distribution chart** (AC: #1)
  - [ ] Create `components/analytics/team-distribution-chart.tsx`
  - [ ] Display histogram of score distribution
  - [ ] Use Recharts BarChart component
  - [ ] Group scores into buckets (1-3, 4-6, 7-10)
  - [ ] Apply score color coding: Coral (#f87171), Amber (#f59e0b), Teal (#14b8a6)

- [ ] **Task 4: Create team trend chart** (AC: #1)
  - [ ] Create `components/analytics/team-trend-chart.tsx`
  - [ ] Show team average score over time using Recharts LineChart
  - [ ] Add hover tooltips with team stats
  - [ ] Show total prompt count per day
  - [ ] Include date range selector (7d, 30d, 90d)

- [ ] **Task 5: Create per-member breakdown table** (AC: #1, #2)
  - [ ] Create `components/analytics/member-breakdown.tsx`
  - [ ] Display table with columns: Member, Prompts, Avg Score, Trend
  - [ ] Sort by score or prompt count
  - [ ] Make rows clickable for detail view
  - [ ] Only visible to team admins (check role before render)

- [ ] **Task 6: Create member detail modal** (AC: #2)
  - [ ] Create `components/analytics/member-detail.tsx`
  - [ ] Show selected member's recent prompts (use existing `PromptRow` from `components/prompts/`)
  - [ ] Display their dimension breakdown using `DimensionBreakdown` component
  - [ ] Highlight coaching opportunities (dimensions with score < 5)
  - [ ] Use shadcn/ui Sheet component for slide-in panel

- [ ] **Task 7: Identify coaching opportunities** (AC: #2)
  - [ ] Calculate which members have lowest average scores
  - [ ] Identify which dimensions need most improvement per member
  - [ ] Generate coaching suggestions based on patterns
  - [ ] Highlight members with declining trends (>10% drop over 2 weeks)

- [ ] **Task 8: Create useTeamAnalytics hook** (AC: #1, #2)
  - [ ] Create `lib/hooks/use-team-analytics.ts`
  - [ ] Fetch all team prompts and analyses via RLS-filtered query
  - [ ] Aggregate by member
  - [ ] Calculate team-wide statistics
  - [ ] Accept date range parameter (default: 30d)

- [ ] **Task 9: Create useMemberAnalytics hook** (AC: #2)
  - [ ] Create `lib/hooks/use-member-analytics.ts`
  - [ ] Fetch specific member's prompts and analyses
  - [ ] Calculate dimension averages and identify weak areas
  - [ ] Generate coaching opportunity suggestions
  - [ ] Accept memberId parameter (null returns no data)

- [ ] **Task 10: Create aggregated view for non-admins** (AC: #3)
  - [ ] Create `components/analytics/team-summary.tsx`
  - [ ] Show only team-wide stats (no individual data)
  - [ ] Display: team average, total prompts, trend direction
  - [ ] Encourage participation with positive messaging

- [ ] **Task 11: Create TeamAdminAnalytics container** (AC: #1, #2)
  - [ ] Create `components/analytics/team-admin-analytics.tsx`
  - [ ] Compose distribution chart, trend chart, and member breakdown
  - [ ] Handle loading and empty states
  - [ ] Pass teamId to child components

- [ ] **Task 12: Add coaching action buttons** (AC: #2)
  - [ ] Add "Share Feedback" button on member detail (future: opens feedback modal)
  - [ ] Add "View All Prompts" button to navigate to feed filtered by member
  - [ ] Track coaching interactions via URL params

- [ ] **Task 13: Handle empty and loading states**
  - [ ] Create `TeamAnalyticsSkeleton` for initial page load
  - [ ] Create `MemberDetailSkeleton` for member panel
  - [ ] Handle empty team (no prompts yet) with helpful message
  - [ ] Handle error states with retry button

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- TanStack Query 5.x - use `isPending` not `isLoading`
- Recharts for data visualization (already in project)
- TypeScript strict mode - no `any` types
- RLS policies filter by team_id automatically
- shadcn/ui components for UI elements

**Role-Based Access:**
- `role` column in `team_members`: 'admin' | 'member'
- Admins see per-member data via `MemberBreakdown` component
- Members see only aggregated stats via `TeamSummary` component
- Always verify role on server AND client before showing member data

**Database Query Pattern:**
- All queries go through Supabase client with RLS
- RLS policy: `auth.jwt() ->> 'team_id' = team_id`
- For member data, additional check: user must be admin in team_members table

### Team Role Hook

```typescript
// lib/hooks/use-team-role.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useTeamRole(teamId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['team-role', teamId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return {
        role: data.role as 'admin' | 'member',
        isAdmin: data.role === 'admin',
      };
    },
  });
}
```

### Team Analytics Page

```typescript
// app/(dashboard)/dashboard/team/page.tsx
'use client';

import { useTeamRole } from '@/lib/hooks/use-team-role';
import { useTeamContext } from '@/lib/hooks/use-team-context';
import { TeamAdminAnalytics } from '@/components/analytics/team-admin-analytics';
import { TeamSummary } from '@/components/analytics/team-summary';
import { TeamAnalyticsSkeleton } from '@/components/analytics/team-analytics-skeleton';

export default function TeamPage() {
  const { teamId } = useTeamContext();
  const { data: roleData, isPending, error } = useTeamRole(teamId);

  if (isPending) {
    return <TeamAnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">Failed to load team data</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-teal-500 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#fafafa]">Team Analytics</h1>

      {roleData?.isAdmin ? (
        <TeamAdminAnalytics teamId={teamId} />
      ) : (
        <TeamSummary teamId={teamId} />
      )}
    </div>
  );
}
```

### Team Admin Analytics Container

```typescript
// components/analytics/team-admin-analytics.tsx
'use client';

import { useTeamAnalytics } from '@/lib/hooks/use-team-analytics';
import { TeamDistributionChart } from './team-distribution-chart';
import { TeamTrendChart } from './team-trend-chart';
import { MemberBreakdown } from './member-breakdown';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamAdminAnalyticsProps {
  teamId: string;
}

export function TeamAdminAnalytics({ teamId }: TeamAdminAnalyticsProps) {
  const { data, isPending, error } = useTeamAnalytics(teamId);

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[250px] w-full bg-[#1a1a1a]" />
        <Skeleton className="h-[250px] w-full bg-[#1a1a1a]" />
        <Skeleton className="h-[300px] w-full bg-[#1a1a1a]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-400">Failed to load analytics</p>
      </div>
    );
  }

  if (!data || data.totalPrompts === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8 text-center">
        <p className="text-[#fafafa] text-lg mb-2">No analytics data yet</p>
        <p className="text-muted-foreground">
          Team analytics will appear once team members start capturing prompts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
          <p className="text-sm text-muted-foreground">Total Prompts</p>
          <p className="text-2xl font-bold text-[#fafafa]">{data.totalPrompts}</p>
        </div>
        <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
          <p className="text-sm text-muted-foreground">Team Average</p>
          <p className="text-2xl font-bold text-teal-500">
            {data.teamAverage.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
          <p className="text-sm text-muted-foreground">Active Members</p>
          <p className="text-2xl font-bold text-[#fafafa]">{data.members.length}</p>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h2 className="text-lg font-medium text-[#fafafa] mb-4">Score Distribution</h2>
        <TeamDistributionChart data={data.distribution} />
      </div>

      {/* Trend Chart */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h2 className="text-lg font-medium text-[#fafafa] mb-4">Team Trend</h2>
        <TeamTrendChart teamId={teamId} />
      </div>

      {/* Member Breakdown */}
      <div>
        <h2 className="text-lg font-medium text-[#fafafa] mb-4">Team Members</h2>
        <MemberBreakdown members={data.members} />
      </div>
    </div>
  );
}
```

### Team Distribution Chart

```typescript
// components/analytics/team-distribution-chart.tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DistributionData {
  range: string;
  count: number;
  color: string;
}

const COLORS: Record<string, string> = {
  '1-3': '#f87171',  // Coral - needs improvement
  '4-6': '#f59e0b',  // Amber - moderate
  '7-10': '#14b8a6', // Teal - good
};

interface TeamDistributionChartProps {
  data: DistributionData[];
}

export function TeamDistributionChart({ data }: TeamDistributionChartProps) {
  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="range"
            stroke="#a1a1aa"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
          />
          <YAxis
            stroke="#a1a1aa"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#fafafa' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.range] || '#a1a1aa'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Team Trend Chart

```typescript
// components/analytics/team-trend-chart.tsx
'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';

interface TeamTrendChartProps {
  teamId: string;
}

type TimeRange = '7d' | '30d' | '90d';

export function TeamTrendChart({ teamId }: TeamTrendChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Note: In implementation, fetch trend data based on timeRange
  // const { data } = useTeamTrendData(teamId, timeRange);

  // Placeholder data structure
  const data: { date: string; avgScore: number; count: number }[] = [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(range)}
          >
            {range}
          </Button>
        ))}
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey="date"
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 12 }}
            />
            <YAxis
              domain={[0, 10]}
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fafafa' }}
              formatter={(value: number) => [value.toFixed(1), 'Avg Score']}
            />
            <Line
              type="monotone"
              dataKey="avgScore"
              stroke="#14b8a6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

### Member Breakdown Table

```typescript
// components/analytics/member-breakdown.tsx
'use client';

import { useState } from 'react';
import { ArrowUpDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MemberDetail } from './member-detail';

interface MemberStats {
  userId: string;
  name: string;
  avatar?: string;
  promptCount: number;
  avgScore: number;
  trend: 'up' | 'down' | 'stable';
}

interface MemberBreakdownProps {
  members: MemberStats[];
}

export function MemberBreakdown({ members }: MemberBreakdownProps) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'count'>('score');

  const sorted = [...members].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name);
      case 'score': return b.avgScore - a.avgScore;
      case 'count': return b.promptCount - a.promptCount;
    }
  });

  const TrendIcon = ({ trend }: { trend: string }) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-teal-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-400" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <div className="rounded-lg border border-[#2a2a2a] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#1a1a1a]">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                <Button variant="ghost" size="sm" onClick={() => setSortBy('name')}>
                  Member <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                <Button variant="ghost" size="sm" onClick={() => setSortBy('count')}>
                  Prompts <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                <Button variant="ghost" size="sm" onClick={() => setSortBy('score')}>
                  Avg Score <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => (
              <tr
                key={member.userId}
                onClick={() => setSelectedMember(member.userId)}
                className="border-t border-[#2a2a2a] cursor-pointer hover:bg-[#1a1a1a] transition-colors"
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-sm text-[#fafafa]">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[#fafafa]">{member.name}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{member.promptCount}</td>
                <td className="p-3">
                  <span className={cn(
                    'font-medium',
                    member.avgScore >= 7 ? 'text-teal-500' :
                    member.avgScore >= 4 ? 'text-amber-500' : 'text-red-400'
                  )}>
                    {member.avgScore.toFixed(1)}
                  </span>
                </td>
                <td className="p-3"><TrendIcon trend={member.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MemberDetail
        memberId={selectedMember}
        onClose={() => setSelectedMember(null)}
      />
    </>
  );
}
```

### Member Detail Panel

```typescript
// components/analytics/member-detail.tsx
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemberAnalytics } from '@/lib/hooks/use-member-analytics';
import { DimensionBreakdown } from './dimension-breakdown';
import { PromptRow } from '@/components/prompts/prompt-row';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MemberDetailProps {
  memberId: string | null;
  onClose: () => void;
}

function MemberDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20 bg-[#1a1a1a]" />
        <Skeleton className="h-20 bg-[#1a1a1a]" />
      </div>
      <Skeleton className="h-32 bg-[#1a1a1a]" />
      <Skeleton className="h-48 bg-[#1a1a1a]" />
    </div>
  );
}

export function MemberDetail({ memberId, onClose }: MemberDetailProps) {
  const router = useRouter();
  const { data, isPending, error } = useMemberAnalytics(memberId);

  const handleViewAllPrompts = () => {
    if (memberId) {
      router.push(`/prompts?user=${memberId}`);
      onClose();
    }
  };

  return (
    <Sheet open={!!memberId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl bg-[#0a0a0a] border-[#2a2a2a] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#fafafa]">
            {data?.member.name ? `${data.member.name}'s Analytics` : 'Member Analytics'}
          </SheetTitle>
        </SheetHeader>

        {isPending ? (
          <div className="mt-6">
            <MemberDetailSkeleton />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-400">Failed to load member data</p>
          </div>
        ) : data ? (
          <div className="mt-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-[#1a1a1a] p-4">
                <p className="text-sm text-muted-foreground">Prompts</p>
                <p className="text-2xl font-bold text-[#fafafa]">{data.promptCount}</p>
              </div>
              <div className="rounded-lg bg-[#1a1a1a] p-4">
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className={`text-2xl font-bold ${
                  data.avgScore >= 7 ? 'text-teal-500' :
                  data.avgScore >= 4 ? 'text-amber-500' : 'text-red-400'
                }`}>
                  {data.avgScore.toFixed(1)}
                </p>
              </div>
            </div>

            {/* Coaching Opportunities */}
            {data.coachingOpportunities.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <h3 className="font-medium text-amber-500 mb-2">
                  Coaching Opportunities
                </h3>
                <ul className="space-y-1">
                  {data.coachingOpportunities.map((opp, i) => (
                    <li key={i} className="text-sm text-amber-100">{opp}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dimension Breakdown */}
            <div>
              <h3 className="font-medium text-[#fafafa] mb-3">Dimension Scores</h3>
              <DimensionBreakdown dimensions={data.dimensions} />
            </div>

            {/* Recent Prompts */}
            <div>
              <h3 className="font-medium text-[#fafafa] mb-3">Recent Prompts</h3>
              <div className="space-y-2">
                {data.recentPrompts.slice(0, 5).map((prompt) => (
                  <PromptRow key={prompt.id} prompt={prompt} />
                ))}
              </div>
              {data.recentPrompts.length === 0 && (
                <p className="text-sm text-muted-foreground">No prompts yet</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled>
                <MessageSquare className="h-4 w-4 mr-2" />
                Share Feedback
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleViewAllPrompts}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View All Prompts
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
```

### Dimension Breakdown Component

```typescript
// components/analytics/dimension-breakdown.tsx
'use client';

import { cn } from '@/lib/utils';

interface DimensionScore {
  name: string;
  score: number;
  maxScore: number;
}

interface DimensionBreakdownProps {
  dimensions: DimensionScore[];
}

export function DimensionBreakdown({ dimensions }: DimensionBreakdownProps) {
  return (
    <div className="space-y-3">
      {dimensions.map((dim) => {
        const percentage = (dim.score / dim.maxScore) * 100;
        const colorClass = dim.score >= 7 ? 'bg-teal-500' :
                          dim.score >= 4 ? 'bg-amber-500' : 'bg-red-400';

        return (
          <div key={dim.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{dim.name}</span>
              <span className={cn(
                'font-medium',
                dim.score >= 7 ? 'text-teal-500' :
                dim.score >= 4 ? 'text-amber-500' : 'text-red-400'
              )}>
                {dim.score.toFixed(1)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#2a2a2a]">
              <div
                className={cn('h-full rounded-full transition-all', colorClass)}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### Team Summary (Non-Admin View)

```typescript
// components/analytics/team-summary.tsx
'use client';

import { useTeamAnalytics } from '@/lib/hooks/use-team-analytics';
import { TeamDistributionChart } from './team-distribution-chart';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamSummaryProps {
  teamId: string;
}

export function TeamSummary({ teamId }: TeamSummaryProps) {
  const { data, isPending, error } = useTeamAnalytics(teamId);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full bg-[#1a1a1a]" />
        <Skeleton className="h-[250px] w-full bg-[#1a1a1a]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-400">Failed to load team summary</p>
      </div>
    );
  }

  if (!data || data.totalPrompts === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8 text-center">
        <p className="text-[#fafafa] text-lg mb-2">No team data yet</p>
        <p className="text-muted-foreground">
          Team statistics will appear as members start capturing prompts.
        </p>
      </div>
    );
  }

  const TrendIcon = () => {
    switch (data.teamTrend) {
      case 'up': return <TrendingUp className="h-5 w-5 text-teal-500" />;
      case 'down': return <TrendingDown className="h-5 w-5 text-red-400" />;
      default: return <Minus className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Aggregated Stats Only - No Individual Data */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
          <p className="text-sm text-muted-foreground">Team Prompts</p>
          <p className="text-2xl font-bold text-[#fafafa]">{data.totalPrompts}</p>
        </div>
        <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
          <p className="text-sm text-muted-foreground">Team Average</p>
          <p className="text-2xl font-bold text-teal-500">
            {data.teamAverage.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
          <p className="text-sm text-muted-foreground">Trend</p>
          <div className="flex items-center gap-2 mt-1">
            <TrendIcon />
            <span className="text-[#fafafa] capitalize">{data.teamTrend}</span>
          </div>
        </div>
      </div>

      {/* Score Distribution (aggregated, no individual data) */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h2 className="text-lg font-medium text-[#fafafa] mb-4">
          Team Score Distribution
        </h2>
        <TeamDistributionChart data={data.distribution} />
      </div>

      {/* Positive Messaging */}
      <div className="rounded-lg bg-teal-500/10 border border-teal-500/30 p-4">
        <p className="text-teal-100 text-sm">
          Keep up the great work! Your prompts contribute to the team's improvement journey.
        </p>
      </div>
    </div>
  );
}
```

### Team Analytics Hook

```typescript
// lib/hooks/use-team-analytics.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface MemberStats {
  userId: string;
  name: string;
  avatar?: string;
  promptCount: number;
  avgScore: number;
  trend: 'up' | 'down' | 'stable';
}

interface DistributionData {
  range: string;
  count: number;
  color: string;
}

interface TeamAnalyticsData {
  members: MemberStats[];
  distribution: DistributionData[];
  teamAverage: number;
  totalPrompts: number;
  teamTrend: 'up' | 'down' | 'stable';
}

export function useTeamAnalytics(teamId: string, timeRange: string = '30d') {
  const supabase = createClient();

  return useQuery({
    queryKey: ['team-analytics', teamId, timeRange],
    queryFn: async (): Promise<TeamAnalyticsData> => {
      // Fetch all team prompts with analyses and user info
      // RLS automatically filters by team_id
      const { data, error } = await supabase
        .from('prompts')
        .select(`
          id,
          user_id,
          created_at,
          user:users(id, name, avatar_url),
          analysis:prompt_analyses(overall_score, dimension_scores)
        `)
        .eq('team_id', teamId)
        .eq('analysis_status', 'complete')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process data for team analytics
      return processTeamData(data || []);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

function processTeamData(data: any[]): TeamAnalyticsData {
  // Aggregate by member
  const memberMap = new Map<string, {
    userId: string;
    name: string;
    avatar?: string;
    scores: number[];
    prompts: any[];
  }>();

  data.forEach(prompt => {
    const userId = prompt.user_id;
    const existing = memberMap.get(userId) || {
      userId,
      name: prompt.user?.name || 'Unknown',
      avatar: prompt.user?.avatar_url,
      scores: [],
      prompts: [],
    };

    const score = prompt.analysis?.[0]?.overall_score;
    if (score !== undefined) {
      existing.scores.push(score);
    }
    existing.prompts.push(prompt);
    memberMap.set(userId, existing);
  });

  // Calculate member stats
  const members: MemberStats[] = Array.from(memberMap.values()).map(m => ({
    userId: m.userId,
    name: m.name,
    avatar: m.avatar,
    promptCount: m.prompts.length,
    avgScore: m.scores.length > 0
      ? m.scores.reduce((a, b) => a + b, 0) / m.scores.length
      : 0,
    trend: calculateTrend(m.scores),
  }));

  // Calculate distribution
  const allScores = data
    .map(p => p.analysis?.[0]?.overall_score)
    .filter((s): s is number => s !== undefined);

  const distribution: DistributionData[] = [
    { range: '1-3', count: allScores.filter(s => s < 4).length, color: '#f87171' },
    { range: '4-6', count: allScores.filter(s => s >= 4 && s < 7).length, color: '#f59e0b' },
    { range: '7-10', count: allScores.filter(s => s >= 7).length, color: '#14b8a6' },
  ];

  // Team-wide stats
  const teamAvg = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;

  return {
    members,
    distribution,
    teamAverage: teamAvg,
    totalPrompts: data.length,
    teamTrend: calculateTrend(allScores),
  };
}

function calculateTrend(scores: number[]): 'up' | 'down' | 'stable' {
  if (scores.length < 4) return 'stable';

  const mid = Math.floor(scores.length / 2);
  const firstHalf = scores.slice(0, mid);
  const secondHalf = scores.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (firstAvg === 0) return 'stable';
  const change = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
}
```

### Member Analytics Hook

```typescript
// lib/hooks/use-member-analytics.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface DimensionScore {
  name: string;
  score: number;
  maxScore: number;
}

interface PromptData {
  id: string;
  text: string;
  created_at: string;
  overall_score: number;
}

interface MemberAnalyticsData {
  member: {
    id: string;
    name: string;
    avatar?: string;
  };
  promptCount: number;
  avgScore: number;
  dimensions: DimensionScore[];
  coachingOpportunities: string[];
  recentPrompts: PromptData[];
}

export function useMemberAnalytics(memberId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['member-analytics', memberId],
    queryFn: async (): Promise<MemberAnalyticsData | null> => {
      if (!memberId) return null;

      // Fetch member info
      const { data: member, error: memberError } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .eq('id', memberId)
        .single();

      if (memberError) throw memberError;

      // Fetch member's prompts with analyses
      const { data: prompts, error: promptsError } = await supabase
        .from('prompts')
        .select(`
          id,
          text,
          created_at,
          analysis:prompt_analyses(overall_score, dimension_scores)
        `)
        .eq('user_id', memberId)
        .eq('analysis_status', 'complete')
        .order('created_at', { ascending: false })
        .limit(50);

      if (promptsError) throw promptsError;

      // Calculate averages
      const scores = prompts
        .map(p => p.analysis?.[0]?.overall_score)
        .filter((s): s is number => s !== undefined);

      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

      // Calculate dimension averages
      const dimensionTotals: Record<string, { sum: number; count: number }> = {};

      prompts.forEach(p => {
        const dimScores = p.analysis?.[0]?.dimension_scores;
        if (dimScores && typeof dimScores === 'object') {
          Object.entries(dimScores).forEach(([name, score]) => {
            if (typeof score === 'number') {
              if (!dimensionTotals[name]) {
                dimensionTotals[name] = { sum: 0, count: 0 };
              }
              dimensionTotals[name].sum += score;
              dimensionTotals[name].count += 1;
            }
          });
        }
      });

      const dimensions: DimensionScore[] = Object.entries(dimensionTotals)
        .map(([name, { sum, count }]) => ({
          name,
          score: sum / count,
          maxScore: 10,
        }))
        .sort((a, b) => a.score - b.score);

      // Generate coaching opportunities
      const coachingOpportunities: string[] = [];
      dimensions.forEach(dim => {
        if (dim.score < 5) {
          coachingOpportunities.push(
            `${dim.name} needs improvement (avg: ${dim.score.toFixed(1)})`
          );
        }
      });

      if (avgScore < 5) {
        coachingOpportunities.unshift('Overall prompt quality could be improved');
      }

      // Format recent prompts
      const recentPrompts: PromptData[] = prompts.slice(0, 10).map(p => ({
        id: p.id,
        text: p.text,
        created_at: p.created_at,
        overall_score: p.analysis?.[0]?.overall_score ?? 0,
      }));

      return {
        member: {
          id: member.id,
          name: member.name || 'Unknown',
          avatar: member.avatar_url,
        },
        promptCount: prompts.length,
        avgScore,
        dimensions,
        coachingOpportunities,
        recentPrompts,
      };
    },
    enabled: !!memberId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Team Page | `app/(dashboard)/dashboard/team/page.tsx` |
| Team Admin Analytics | `components/analytics/team-admin-analytics.tsx` |
| Team Summary | `components/analytics/team-summary.tsx` |
| Team Distribution Chart | `components/analytics/team-distribution-chart.tsx` |
| Team Trend Chart | `components/analytics/team-trend-chart.tsx` |
| Member Breakdown | `components/analytics/member-breakdown.tsx` |
| Member Detail | `components/analytics/member-detail.tsx` |
| Dimension Breakdown | `components/analytics/dimension-breakdown.tsx` |
| useTeamRole Hook | `lib/hooks/use-team-role.ts` |
| useTeamAnalytics Hook | `lib/hooks/use-team-analytics.ts` |
| useMemberAnalytics Hook | `lib/hooks/use-member-analytics.ts` |
| PromptRow (existing) | `components/prompts/prompt-row.tsx` |

### Role-Based View Logic

| Role | Team Distribution | Team Trend | Member Breakdown | Member Detail |
|------|-------------------|------------|------------------|---------------|
| admin | Yes | Yes | Yes | Yes |
| member | Yes | Yes | No | No |

### Common Pitfalls to Avoid

1. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
2. **DO NOT** expose individual member data to non-admins
3. **DO NOT** forget to check role before rendering member breakdown
4. **DO NOT** show member names in aggregated view for non-admins
5. **DO NOT** assume user has admin role without checking
6. **DO NOT** forget loading states for role check
7. **DO NOT** use `any` type - use proper TypeScript types
8. **DO NOT** forget error boundaries and error states

### Verification Checklist

After completing this story, verify:
- [ ] Team page loads with role check
- [ ] Admins see full analytics with member breakdown
- [ ] Members see only aggregated team stats
- [ ] Score distribution chart displays correctly with color coding
- [ ] Team trend chart shows over time with date range selector
- [ ] Member breakdown table is sortable by name/score/count
- [ ] Clicking member opens detail panel
- [ ] Member detail shows coaching opportunities
- [ ] Recent prompts display in member detail
- [ ] Action buttons work (View All Prompts navigates correctly)
- [ ] Loading states show while fetching
- [ ] Empty states handled for new teams
- [ ] Error states show with retry option
- [ ] Dark mode styling applied consistently

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
