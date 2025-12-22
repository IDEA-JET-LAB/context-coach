# Story 2.5: Team Switching

Status: ✅ Done

## Story

**As a** user belonging to multiple teams,
**I want** to switch between my teams,
**So that** I can access different projects and data contexts.

## Acceptance Criteria

1. **Given** I belong to multiple teams
   **When** I click the team switcher in the header
   **Then** I see a dropdown list of all my teams
   **And** my current team is highlighted
   **And** dropdown is keyboard navigable (arrow keys, Enter, Escape)

2. **Given** I select a different team from the switcher
   **When** the selection is made
   **Then** my JWT `team_id` claim is updated
   **And** all RLS-filtered queries now return data for the new team
   **And** the dashboard refreshes to show the new team's data
   **And** the team name in the header updates
   **And** a success toast confirms the switch

3. **Given** I have only one team
   **When** I view the header
   **Then** the team switcher shows my team name but no dropdown

4. **Given** the team switch fails
   **When** an error occurs
   **Then** an error toast displays the failure reason
   **And** the UI remains on the current team

5. **Given** teams are loading
   **When** I open the switcher
   **Then** I see a loading skeleton in the dropdown

## Tasks / Subtasks

- [ ] **Task 1: Create switch team API endpoint** (AC: #2, #4)
  - [ ] Create `app/api/teams/switch/route.ts` with POST handler
  - [ ] Validate user membership in target team via RPC
  - [ ] Update JWT claims with new team_id
  - [ ] Return team info or error response

- [ ] **Task 2: Create database function** (AC: #2)
  - [ ] Create `switch_team(new_team_id UUID)` function
  - [ ] Validate membership, update `raw_app_meta_data`
  - [ ] Return success/failure with team info

- [ ] **Task 3: Create team switcher component** (AC: #1, #2, #3, #5)
  - [ ] Create `components/layout/team-switcher.tsx`
  - [ ] Implement dropdown with shadcn/ui DropdownMenu
  - [ ] Handle loading, error, single-team, and multi-team states
  - [ ] Add keyboard navigation and focus management
  - [ ] Include "Create New Team" option

- [ ] **Task 4: Implement switch team mutation** (AC: #2, #4)
  - [ ] Create `lib/hooks/use-switch-team.ts` with useMutation
  - [ ] Refresh session, clear query cache, navigate to dashboard
  - [ ] Handle success/error with toast notifications

- [ ] **Task 5: Create fetch user teams hook** (AC: #1, #5)
  - [ ] Create `lib/hooks/use-teams.ts` with useQuery
  - [ ] Fetch teams via team_members join
  - [ ] Use `isPending` (TanStack Query v5)

- [ ] **Task 6: Handle session refresh** (AC: #2)
  - [ ] Add `refreshSession()` utility in `lib/supabase/client.ts`
  - [ ] Verify JWT contains updated team_id

- [ ] **Task 7: Implement dashboard refresh** (AC: #2)
  - [ ] Use `queryClient.clear()` after team switch
  - [ ] Navigate to `/dashboard` for fresh context

- [ ] **Task 8: Add team switcher to header** (AC: #1, #3)
  - [ ] Import into `components/layout/header.tsx`
  - [ ] Add ARIA labels and responsive styling

- [ ] **Task 9: Create current team hook** (AC: #2)
  - [ ] Create `lib/hooks/use-current-team.ts`
  - [ ] Extract team_id from JWT, fetch team details

- [ ] **Task 10: Handle single team case** (AC: #3)
  - [ ] Show team name without dropdown functionality
  - [ ] Allow click to navigate to team settings

## Test Scenarios

### Unit Tests
- [ ] `switch_team` RPC rejects non-members
- [ ] `switch_team` RPC updates JWT claims correctly
- [ ] TeamSwitcher renders loading state
- [ ] TeamSwitcher renders single team without dropdown
- [ ] TeamSwitcher renders multi-team with dropdown
- [ ] useSwitchTeam clears cache on success

### Integration Tests
- [ ] Full switch flow: click team -> API call -> session refresh -> cache clear -> navigation
- [ ] Error handling: API failure shows toast, stays on current team
- [ ] Keyboard navigation: Tab, Arrow keys, Enter, Escape work correctly

### E2E Tests
- [ ] User with 3 teams can switch between all teams
- [ ] Dashboard data updates to reflect new team context
- [ ] Single-team user sees team name without dropdown

## Dev Notes

### Architecture Constraints

- **Next.js 15** App Router with Server/Client components
- **Supabase RLS** - team context via `auth.jwt() ->> 'team_id'`
- **TanStack Query 5.x** - use `isPending` not `isLoading`
- **JWT claims** - team_id in `raw_app_meta_data`

### Database Function

```sql
CREATE OR REPLACE FUNCTION switch_team(new_team_id UUID)
RETURNS jsonb AS $$
DECLARE
  is_member BOOLEAN;
  team_info teams;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = new_team_id AND user_id = auth.uid()
  ) INTO is_member;

  IF NOT is_member THEN
    RETURN jsonb_build_object('error', 'NOT_A_MEMBER');
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('team_id', new_team_id)
  WHERE id = auth.uid();

  SELECT * INTO team_info FROM teams WHERE id = new_team_id;
  RETURN jsonb_build_object('success', true, 'team', row_to_json(team_info));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### API Route

```typescript
// app/api/teams/switch/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({ teamId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { teamId } = schema.parse(await request.json());
    const { data, error } = await supabase.rpc('switch_team', { new_team_id: teamId });

    if (error || data?.error) {
      const code = data?.error || 'SWITCH_FAILED';
      return NextResponse.json(
        { error: { code, message: error?.message || 'Not a team member' } },
        { status: error ? 400 : 403 }
      );
    }

    return NextResponse.json({ data: { team: data.team } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: e.errors[0].message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } },
      { status: 500 }
    );
  }
}
```

### Team Switcher Component

```typescript
// components/layout/team-switcher.tsx
'use client';

import { Check, ChevronDown, Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeams } from '@/lib/hooks/use-teams';
import { useSwitchTeam } from '@/lib/hooks/use-switch-team';
import { useCurrentTeam } from '@/lib/hooks/use-current-team';
import { useRouter } from 'next/navigation';

export function TeamSwitcher() {
  const router = useRouter();
  const { data: teams, isPending: isLoadingTeams, error } = useTeams();
  const { data: currentTeam } = useCurrentTeam();
  const { mutate: switchTeam, isPending: isSwitching } = useSwitchTeam();

  // Loading state
  if (isLoadingTeams) {
    return <Skeleton className="h-9 w-32" />;
  }

  // Error state - show current team name only
  if (error) {
    return (
      <Button variant="ghost" disabled>
        {currentTeam?.name || 'Team'}
      </Button>
    );
  }

  // No teams - show create button
  if (!teams?.length) {
    return (
      <Button variant="outline" onClick={() => router.push('/teams/new')}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Create Team
      </Button>
    );
  }

  // Single team - no dropdown
  if (teams.length === 1) {
    return (
      <Button
        variant="ghost"
        onClick={() => router.push(`/teams/${teams[0].id}/settings`)}
        aria-label={`Current team: ${teams[0].name}`}
      >
        {teams[0].name}
      </Button>
    );
  }

  // Multi-team dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={isSwitching}
          aria-label="Switch team"
          aria-haspopup="menu"
        >
          {isSwitching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Switching...
            </>
          ) : (
            <>
              {currentTeam?.name || 'Select Team'}
              <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onClick={() => team.id !== currentTeam?.id && switchTeam({ teamId: team.id })}
            className="flex items-center justify-between"
            aria-selected={team.id === currentTeam?.id}
          >
            <span>{team.name}</span>
            {team.id === currentTeam?.id && <Check className="h-4 w-4" aria-label="Current" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/teams/new')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New Team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Switch Team Hook

```typescript
// lib/hooks/use-switch-team.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function useSwitchTeam() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ teamId }: { teamId: string }) => {
      const res = await fetch('/api/teams/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Switch failed');
      return data.data;
    },
    onSuccess: async (data) => {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        toast.error('Please refresh the page to complete team switch');
        return;
      }
      queryClient.clear();
      router.push('/dashboard');
      toast.success(`Switched to ${data.team.name}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
```

### Fetch Teams Hook

```typescript
// lib/hooks/use-teams.ts
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface Team {
  id: string;
  name: string;
  description: string | null;
  role: 'member' | 'admin';
}

export function useTeams() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['teams'],
    queryFn: async (): Promise<Team[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('team_members')
        .select('role, team:teams(id, name, description)')
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);

      return data.map((item) => ({
        id: item.team.id,
        name: item.team.name,
        description: item.team.description,
        role: item.role,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

### Current Team Hook

```typescript
// lib/hooks/use-current-team.ts
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useCurrentTeam() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['current-team'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const teamId = session.user.app_metadata?.team_id;
      if (!teamId) return null;

      const { data } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

### File Locations

| Component | Path |
|-----------|------|
| Team Switcher | `components/layout/team-switcher.tsx` |
| Teams Hook | `lib/hooks/use-teams.ts` |
| Current Team Hook | `lib/hooks/use-current-team.ts` |
| Switch Team Hook | `lib/hooks/use-switch-team.ts` |
| Switch Team API | `app/api/teams/switch/route.ts` |

### shadcn/ui Dependencies

```bash
npx shadcn@latest add dropdown-menu button skeleton
```

### Common Pitfalls

1. **Session refresh required** - JWT must be refreshed after switch
2. **Query cache must be cleared** - stale data shows wrong team
3. **Use `isPending`** not `isLoading` (TanStack Query v5)
4. **Validate membership** - never allow switching to non-member team
5. **Single team UX** - no dropdown, just team name display

### Verification Checklist

- [ ] Multi-team user sees dropdown with all teams
- [ ] Current team has checkmark indicator
- [ ] Clicking different team triggers switch
- [ ] JWT updated with new team_id after switch
- [ ] Dashboard data refreshes with new team context
- [ ] Header shows new team name
- [ ] Single-team user sees name without dropdown
- [ ] No-team user sees "Create Team" button
- [ ] "Create New Team" option in dropdown works
- [ ] Loading state shows during switch
- [ ] Error toast shows if switch fails
- [ ] Keyboard navigation works (Tab, Arrow, Enter, Escape)

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
