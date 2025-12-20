# Story 7.4: Team Overview

**Epic:** 7 - Platform Administration
**FRs Covered:** FR46 (partially)
**Dependencies:** Story 7.1 (Admin Access Control) must be complete

Status: ready-for-dev

## Story

**As a** super admin,
**I want** to see all teams,
**So that** I can understand platform usage.

## Acceptance Criteria

1. **Given** I navigate to Admin > Teams
   **When** the page loads
   **Then** I see all teams with: name, member count, project count, prompts count

2. **Given** I click on a team
   **When** viewing details
   **Then** I see team members and their roles
   **And** I can view (but not modify) team settings

3. **Given** I access the teams list
   **When** there are no teams
   **Then** I see an appropriate empty state message

4. **Given** I am viewing team details
   **When** the team has recent activity
   **Then** I see activity summary (prompts last 7 days, trend, most active members)

## Tasks / Subtasks

- [ ] **Task 1: Create teams list page** (AC: #1, #3)
  - [ ] Create `app/(dashboard)/admin/teams/page.tsx`
  - [ ] Implement server component for initial data load
  - [ ] Use service role client to fetch all teams (bypasses RLS)
  - [ ] Display teams in a data table with pagination (default 20 per page)
  - [ ] Style using shadcn/ui Table component
  - [ ] Add empty state when no teams exist

- [ ] **Task 2: Create team stats query** (AC: #1)
  - [ ] Create `lib/db/queries/admin-teams.ts`
  - [ ] Implement query to get teams with aggregated counts
  - [ ] Include member count (from team_members)
  - [ ] Include project count (from projects)
  - [ ] Include prompts count (from prompts)
  - [ ] Use efficient JOIN or subqueries (avoid N+1)
  - [ ] Add proper error handling with try/catch and logging

- [ ] **Task 3: Implement teams data table** (AC: #1)
  - [ ] Create `components/admin/teams-table.tsx`
  - [ ] Add columns: team name, member count, project count, prompts count, created date
  - [ ] Add sortable columns for all numeric fields
  - [ ] Add click handler to navigate to team detail
  - [ ] Add pagination controls
  - [ ] Add loading skeleton state
  - [ ] Add ARIA labels for accessibility

- [ ] **Task 4: Add search and filtering** (AC: #1)
  - [ ] Add search input for team name (debounced, 300ms)
  - [ ] Add sort options (name, member count, prompts, created)
  - [ ] Implement server-side search with ILIKE
  - [ ] Update URL query params for filter state persistence
  - [ ] Use TanStack Query with `isPending` for loading state

- [ ] **Task 5: Create team detail page** (AC: #2, #3, #4)
  - [ ] Create `app/(dashboard)/admin/teams/[id]/page.tsx`
  - [ ] Fetch team with service role client
  - [ ] Display team name and description
  - [ ] Display created date
  - [ ] Add breadcrumb navigation using shadcn/ui Breadcrumb
  - [ ] Handle team not found with appropriate error state

- [ ] **Task 6: Display team members list** (AC: #2)
  - [ ] Query team_members with user details
  - [ ] Display member list with columns: name, email, role, joined date
  - [ ] Show role badges (owner/admin/member) using shadcn/ui Badge
  - [ ] Add member count summary
  - [ ] Handle empty members state

- [ ] **Task 7: Display team projects** (AC: #2)
  - [ ] Query projects table for team
  - [ ] Display project list with: name, created date, prompts count
  - [ ] Show project API key status (active/revoked) - never expose actual key
  - [ ] Read-only view - no edit functionality
  - [ ] Handle empty projects state

- [ ] **Task 8: Display team settings (read-only)** (AC: #2)
  - [ ] Show team configuration settings
  - [ ] Display any team-level preferences
  - [ ] Clearly indicate read-only mode with visual cue
  - [ ] Add informational tooltip explaining admin view-only access

- [ ] **Task 9: Add team activity summary** (AC: #4)
  - [ ] Show recent activity: prompts last 7 days
  - [ ] Display activity trend (up/down vs previous period)
  - [ ] Show most active members (top 3)
  - [ ] Display last prompt timestamp

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router
- TypeScript in strict mode
- Service role client for all queries

**Security Pattern (CRITICAL):**
- All queries use service role client from `lib/supabase/admin.ts` (bypasses RLS)
- Admin can VIEW all team data but NOT modify
- No edit/delete actions on this page
- Modification requires team owner access
- Super admin access verified in middleware (Story 7.1)

### Data Fetching Pattern

Use TanStack Query v5 for client-side data:
- Use `isPending` not `isLoading` (TanStack Query v5 change)
- Query keys: `['admin', 'teams', ...filters]`
- Mutations not needed (read-only page)

### API Response Format

Follow standard response format from architecture:
```typescript
// Success response
{ data: Team[], meta: { count: number, page: number, pageSize: number, totalPages: number } }

// Error response
{ error: { code: string, message: string } }
```

### Teams List Query with Stats

```typescript
// lib/db/queries/admin-teams.ts
import { createClient } from '@/lib/supabase/admin';

interface GetTeamsParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'name' | 'member_count' | 'prompts_count' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

interface TeamWithStats {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
  project_count: number;
  prompts_count: number;
}

interface TeamsResponse {
  teams: TeamWithStats[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getTeamsWithStats({
  page,
  pageSize,
  search,
  sortBy = 'created_at',
  sortOrder = 'desc'
}: GetTeamsParams): Promise<TeamsResponse> {
  const supabase = createClient();

  try {
    let query = supabase
      .from('teams')
      .select(`
        id,
        name,
        description,
        created_at,
        team_members(count),
        projects(count),
        prompts(count)
      `, { count: 'exact' });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (error) {
      console.error('[API] admin/teams: Error fetching teams', error);
      throw error;
    }

    // Transform nested counts
    const teams: TeamWithStats[] = data?.map(team => ({
      id: team.id,
      name: team.name,
      description: team.description,
      created_at: team.created_at,
      member_count: team.team_members?.[0]?.count ?? 0,
      project_count: team.projects?.[0]?.count ?? 0,
      prompts_count: team.prompts?.[0]?.count ?? 0,
    })) ?? [];

    return {
      teams,
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  } catch (error) {
    console.error('[API] admin/teams: Failed to fetch teams with stats', error);
    throw error;
  }
}
```

### Team Detail Query

```typescript
// lib/db/queries/admin-teams.ts (continued)
interface TeamDetail {
  team: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
  };
  members: Array<{
    role: string;
    created_at: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
  projects: Array<{
    id: string;
    name: string;
    created_at: string;
    api_key_hash: string | null;
  }>;
  recentPromptsCount: number;
  previousPeriodPromptsCount: number;
}

export async function getTeamDetail(teamId: string): Promise<TeamDetail> {
  const supabase = createClient();

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [teamResult, membersResult, projectsResult, recentActivityResult, previousActivityResult] = await Promise.all([
      // Get team details
      supabase
        .from('teams')
        .select('id, name, description, created_at')
        .eq('id', teamId)
        .single(),

      // Get team members with user info
      supabase
        .from('team_members')
        .select(`
          role,
          created_at,
          user:users(id, name, email)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: true }),

      // Get team projects (never expose full API key)
      supabase
        .from('projects')
        .select('id, name, created_at, api_key_hash')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false }),

      // Get recent prompts count (last 7 days)
      supabase
        .from('prompts')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .gte('created_at', sevenDaysAgo),

      // Get previous period prompts count (7-14 days ago)
      supabase
        .from('prompts')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .gte('created_at', fourteenDaysAgo)
        .lt('created_at', sevenDaysAgo),
    ]);

    if (teamResult.error) {
      console.error('[API] admin/teams/[id]: Team not found', teamResult.error);
      throw new Error('Team not found');
    }

    return {
      team: teamResult.data,
      members: membersResult.data ?? [],
      projects: projectsResult.data ?? [],
      recentPromptsCount: recentActivityResult.count ?? 0,
      previousPeriodPromptsCount: previousActivityResult.count ?? 0,
    };
  } catch (error) {
    console.error('[API] admin/teams/[id]: Failed to fetch team detail', error);
    throw error;
  }
}
```

### Teams Table Component

```typescript
// components/admin/teams-table.tsx
'use client';

import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface Team {
  id: string;
  name: string;
  member_count: number;
  project_count: number;
  prompts_count: number;
  created_at: string;
}

interface TeamsTableProps {
  teams: Team[];
  isPending?: boolean;
}

export function TeamsTable({ teams, isPending }: TeamsTableProps) {
  const router = useRouter();

  if (isPending) {
    return <TeamsTableSkeleton />;
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No teams found</p>
      </div>
    );
  }

  return (
    <Table aria-label="Teams list">
      <TableHeader>
        <TableRow>
          <TableHead>Team Name</TableHead>
          <TableHead className="text-right">Members</TableHead>
          <TableHead className="text-right">Projects</TableHead>
          <TableHead className="text-right">Prompts</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => (
          <TableRow
            key={team.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/admin/teams/${team.id}`)}
            tabIndex={0}
            role="button"
            aria-label={`View details for team ${team.name}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                router.push(`/admin/teams/${team.id}`);
              }
            }}
          >
            <TableCell className="font-medium">{team.name}</TableCell>
            <TableCell className="text-right">{team.member_count}</TableCell>
            <TableCell className="text-right">{team.project_count}</TableCell>
            <TableCell className="text-right">{team.prompts_count.toLocaleString()}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDistanceToNow(new Date(team.created_at), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TeamsTableSkeleton() {
  return (
    <Table aria-label="Loading teams">
      <TableHeader>
        <TableRow>
          <TableHead>Team Name</TableHead>
          <TableHead className="text-right">Members</TableHead>
          <TableHead className="text-right">Projects</TableHead>
          <TableHead className="text-right">Prompts</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Team Members Display

```typescript
// components/admin/team-members-list.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Member {
  role: string;
  created_at: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface TeamMembersListProps {
  members: Member[];
}

const roleVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
};

export function TeamMembersList({ members }: TeamMembersListProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No members in this team</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">
        Team Members ({members.length})
      </h3>
      <Table aria-label="Team members">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.user.id}>
              <TableCell>{member.user.name ?? 'No name'}</TableCell>
              <TableCell className="text-muted-foreground">
                {member.user.email}
              </TableCell>
              <TableCell>
                <Badge variant={roleVariants[member.role] ?? 'outline'}>
                  {member.role}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(member.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Read-Only Settings Display

```typescript
// components/admin/team-settings-readonly.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TeamSettingsReadonlyProps {
  team: {
    name: string;
    description: string | null;
    created_at: string;
  };
}

export function TeamSettingsReadonly({ team }: TeamSettingsReadonlyProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Team Settings
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 cursor-help">
                  <AlertCircle className="h-3 w-3" />
                  View only
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Super admins can view team settings but cannot modify them.</p>
                <p>Team owners manage their own settings.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Team Name
          </label>
          <p className="mt-1">{team.name}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Description
          </label>
          <p className="mt-1">{team.description ?? 'No description'}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Created
          </label>
          <p className="mt-1">{new Date(team.created_at).toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Team Activity Summary Component

```typescript
// components/admin/team-activity-summary.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TeamActivitySummaryProps {
  recentPromptsCount: number;
  previousPeriodPromptsCount: number;
  mostActiveMembers?: Array<{ name: string; count: number }>;
  lastPromptAt?: string;
}

export function TeamActivitySummary({
  recentPromptsCount,
  previousPeriodPromptsCount,
  mostActiveMembers = [],
  lastPromptAt,
}: TeamActivitySummaryProps) {
  const trend = recentPromptsCount - previousPeriodPromptsCount;
  const trendPercent = previousPeriodPromptsCount > 0
    ? Math.round((trend / previousPeriodPromptsCount) * 100)
    : recentPromptsCount > 0 ? 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Prompts</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{recentPromptsCount}</span>
            {trend > 0 && (
              <span className="text-green-500 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                +{trendPercent}%
              </span>
            )}
            {trend < 0 && (
              <span className="text-red-500 flex items-center text-sm">
                <TrendingDown className="h-4 w-4 mr-1" />
                {trendPercent}%
              </span>
            )}
            {trend === 0 && (
              <span className="text-muted-foreground flex items-center text-sm">
                <Minus className="h-4 w-4 mr-1" />
                0%
              </span>
            )}
          </div>
        </div>

        {mostActiveMembers.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground">Most Active</span>
            <ul className="mt-2 space-y-1">
              {mostActiveMembers.slice(0, 3).map((member, idx) => (
                <li key={idx} className="text-sm flex justify-between">
                  <span>{member.name}</span>
                  <span className="text-muted-foreground">{member.count} prompts</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lastPromptAt && (
          <div className="text-sm text-muted-foreground">
            Last prompt: {new Date(lastPromptAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Teams List Page | `app/(dashboard)/admin/teams/page.tsx` |
| Team Detail Page | `app/(dashboard)/admin/teams/[id]/page.tsx` |
| Teams Table | `components/admin/teams-table.tsx` |
| Team Members List | `components/admin/team-members-list.tsx` |
| Team Settings Readonly | `components/admin/team-settings-readonly.tsx` |
| Team Activity Summary | `components/admin/team-activity-summary.tsx` |
| Admin Teams Queries | `lib/db/queries/admin-teams.ts` |

### shadcn/ui Components Needed

```bash
npx shadcn@latest add table card badge skeleton tooltip breadcrumb
```

### Common Pitfalls to Avoid

1. **DO NOT** add edit/delete actions - this is view-only
2. **DO NOT** use browser client - always use service role from `lib/supabase/admin.ts`
3. **DO NOT** expose sensitive project data (like full API keys)
4. **DO NOT** forget pagination for teams with many members (default 20 per page)
5. **DO NOT** make N+1 queries - use efficient JOINs with Promise.all
6. **DO NOT** forget to handle empty states (no teams, no members, no projects)
7. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
8. **DO NOT** skip error handling - always wrap in try/catch with logging

### Verification Checklist

After completing this story, verify:
- [ ] Teams list shows all platform teams
- [ ] Member count is accurate for each team
- [ ] Project count is accurate for each team
- [ ] Prompts count is accurate for each team
- [ ] Search by team name works
- [ ] Sorting works for all columns
- [ ] Pagination works correctly (20 per page default)
- [ ] Team detail shows all members
- [ ] Member roles are displayed with badges
- [ ] Projects are listed with status (no API key exposure)
- [ ] Settings are displayed as read-only with tooltip
- [ ] No edit/modify actions are available
- [ ] Activity summary shows recent prompts with trend
- [ ] Empty states display appropriately
- [ ] Loading skeletons appear during data fetch
- [ ] Keyboard navigation works (Enter/Space on rows)
- [ ] Error states handled gracefully

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
