# Story 2.4: Team Settings

Status: ✅ Done

## Story

**As a** team admin,
**I want** to update my team's settings,
**So that** the team name and description are accurate.

## Acceptance Criteria

1. **Given** I am a team admin on the team settings page
   **When** I update the team name
   **Then** the `teams.name` field is updated
   **And** the new name appears in the header and team switcher

2. **Given** I update the team description
   **When** I save changes
   **Then** the `teams.description` field is updated
   **And** I see a success toast

3. **Given** I am a regular team member
   **When** I view team settings
   **Then** I can see settings but cannot edit them

4. **Given** I submit invalid data
   **When** validation fails
   **Then** I see inline error messages
   **And** form submission is prevented

## Tasks / Subtasks

- [ ] **Task 1: Create team settings API endpoint** (AC: #1, #2, #4)
  - [ ] Create `app/api/teams/[teamId]/route.ts`
  - [ ] GET handler to fetch team details
  - [ ] PATCH handler to update team settings:
    - Await params (Next.js 15 requirement)
    - Validate user is team admin (return 403 if not)
    - Validate team name: required, 1-100 chars
    - Validate description: optional, max 500 chars
    - Trim whitespace before saving
    - Return updated team data
  - [ ] Use Zod for request validation

- [ ] **Task 2: Create team settings form component** (AC: #1, #2, #3, #4)
  - [ ] Create `components/team/team-settings-form.tsx`
  - [ ] Form fields with accessibility:
    - Team name: required, max 100 chars, `aria-describedby` for errors
    - Description: optional, textarea, max 500 chars, character counter
  - [ ] Form validation with Zod + react-hook-form
  - [ ] Disable inputs for non-admin users
  - [ ] Save button with loading state (only for admins)
  - [ ] Keyboard support: Enter submits form
  - [ ] Track form dirty state for unsaved changes warning

- [ ] **Task 3: Create team settings page** (AC: #1, #2, #3)
  - [ ] Create `app/(dashboard)/teams/[teamId]/settings/page.tsx`
  - [ ] Await params before use (Next.js 15)
  - [ ] Server component to fetch initial team data
  - [ ] Loading skeleton during data fetch
  - [ ] Pass data and user role to client components
  - [ ] Breadcrumb navigation

- [ ] **Task 4: Implement update team mutation** (AC: #1, #2)
  - [ ] Create `lib/hooks/use-update-team.ts`
  - [ ] Use TanStack Query `useMutation` with `isPending`
  - [ ] Invalidate queries on success: `['team', teamId]`, `['teams']`, `['current-team']`
  - [ ] Success toast: "Team settings updated"
  - [ ] Error toast with specific message

- [ ] **Task 5: Create read-only view for non-admins** (AC: #3)
  - [ ] Use same form component with `isAdmin={false}`
  - [ ] Display fields as disabled inputs (maintain visual consistency)
  - [ ] Show info message: "Only team admins can edit settings"

- [ ] **Task 6: Integrate with header and team switcher** (AC: #1)
  - [ ] Header must use TanStack Query for team name
  - [ ] Team switcher must use TanStack Query for team list
  - [ ] Query key invalidation triggers automatic updates

- [ ] **Task 7: Add settings page tabs layout**
  - [ ] Use shadcn/ui Tabs component
  - [ ] Tabs: General (this story), Members (2.3), Invitations (2.2)
  - [ ] URL-based tab navigation via query params
  - [ ] Hide Invitations tab from non-admins

## Dev Notes

### Critical Architecture Constraints

| Constraint | Requirement |
|------------|-------------|
| Framework | Next.js 15 App Router |
| Params | Must `await params` before use |
| Database | Supabase with mandatory RLS |
| State | TanStack Query 5.x (`isPending` not `isLoading`) |
| Forms | react-hook-form + Zod |
| UI | shadcn/ui components |

### Permission Rules

- Only admins can PATCH team settings (enforce in API + UI)
- All team members can GET team settings
- RLS policy: `team_id = auth.jwt() ->> 'team_id'`

### API Route

```typescript
// app/api/teams/[teamId]/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Max 100 characters'),
  description: z.string().max(500, 'Max 500 characters').optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();

    const { data: team, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error || !team) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Team not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { team } });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Validate request body
    const parseResult = updateTeamSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message } },
        { status: 400 }
      );
    }

    // Check admin role
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can update team settings' } },
        { status: 403 }
      );
    }

    // Update team
    const { data: team, error } = await supabase
      .from('teams')
      .update({
        name: parseResult.data.name.trim(),
        description: parseResult.data.description?.trim() || null,
      })
      .eq('id', teamId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { team } });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### Form Component

```typescript
// components/team/team-settings-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useUpdateTeam } from '@/lib/hooks/use-update-team';

const MAX_DESCRIPTION_LENGTH = 500;

const teamSettingsSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Max 100 characters'),
  description: z.string().max(MAX_DESCRIPTION_LENGTH, `Max ${MAX_DESCRIPTION_LENGTH} characters`).optional(),
});

type TeamSettingsValues = z.infer<typeof teamSettingsSchema>;

interface TeamSettingsFormProps {
  team: { id: string; name: string; description: string | null };
  isAdmin: boolean;
}

export function TeamSettingsForm({ team, isAdmin }: TeamSettingsFormProps) {
  const { mutate: updateTeam, isPending } = useUpdateTeam();

  const form = useForm<TeamSettingsValues>({
    resolver: zodResolver(teamSettingsSchema),
    defaultValues: {
      name: team.name,
      description: team.description ?? '',
    },
  });

  const descriptionLength = form.watch('description')?.length ?? 0;

  const onSubmit = (values: TeamSettingsValues) => {
    updateTeam({ teamId: team.id, ...values });
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      aria-label="Team settings form"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Team Name</Label>
        <Input
          id="name"
          {...form.register('name')}
          disabled={!isAdmin || isPending}
          aria-describedby={form.formState.errors.name ? 'name-error' : undefined}
          aria-invalid={!!form.formState.errors.name}
        />
        {form.formState.errors.name && (
          <p id="name-error" className="text-sm text-destructive" role="alert">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          {...form.register('description')}
          disabled={!isAdmin || isPending}
          rows={4}
          aria-describedby="description-count"
        />
        <p id="description-count" className="text-sm text-muted-foreground">
          {descriptionLength}/{MAX_DESCRIPTION_LENGTH} characters
        </p>
      </div>

      {isAdmin ? (
        <Button type="submit" disabled={isPending || !form.formState.isDirty}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          Only team admins can edit settings.
        </p>
      )}
    </form>
  );
}
```

### Update Hook

```typescript
// lib/hooks/use-update-team.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UpdateTeamParams {
  teamId: string;
  name: string;
  description?: string;
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, name, description }: UpdateTeamParams) => {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update team');
      }
      return data.data;
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['current-team'] });
      toast.success('Team settings updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
```

### Settings Page

```typescript
// app/(dashboard)/teams/[teamId]/settings/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamSettingsForm } from '@/components/team/team-settings-form';
import { TeamMembersList } from '@/components/team/team-members-list';
import { PendingInvitationsList } from '@/components/team/pending-invitations-list';
import { Skeleton } from '@/components/ui/skeleton';
import { Suspense } from 'react';

interface PageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function SettingsFormSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-24" />
    </div>
  );
}

export default async function TeamSettingsPage({ params, searchParams }: PageProps) {
  const { teamId } = await params;
  const { tab } = await searchParams;
  const activeTab = tab || 'general';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [teamResult, membershipResult] = await Promise.all([
    supabase.from('teams').select('*').eq('id', teamId).single(),
    supabase.from('team_members').select('role').eq('team_id', teamId).eq('user_id', user.id).single(),
  ]);

  if (!teamResult.data || !membershipResult.data) {
    redirect('/dashboard');
  }

  const team = teamResult.data;
  const isAdmin = membershipResult.data.role === 'admin';

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Team Settings</h1>

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          {isAdmin && <TabsTrigger value="invitations">Invitations</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Suspense fallback={<SettingsFormSkeleton />}>
            <TeamSettingsForm team={team} isAdmin={isAdmin} />
          </Suspense>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <TeamMembersList teamId={teamId} isAdmin={isAdmin} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="invitations" className="mt-6">
            <PendingInvitationsList teamId={teamId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
```

### File Locations

| Component | Path |
|-----------|------|
| API Route | `app/api/teams/[teamId]/route.ts` |
| Settings Form | `components/team/team-settings-form.tsx` |
| Settings Page | `app/(dashboard)/teams/[teamId]/settings/page.tsx` |
| Update Hook | `lib/hooks/use-update-team.ts` |

### Required shadcn/ui Components

```bash
npx shadcn@latest add tabs input textarea label button skeleton
```

### Common Pitfalls

| Pitfall | Prevention |
|---------|------------|
| Forgetting to await params | Use `const { teamId } = await params` |
| Using `isLoading` | Use `isPending` (TanStack Query v5) |
| Empty team name | Validate min length 1 |
| Missing whitespace trim | Trim in API before save |
| Stale header/switcher | Invalidate all team-related queries |
| Non-admin submission | Disable form + enforce in API |

### Verification Checklist

After implementation, verify:

- [ ] Page loads with correct team data
- [ ] Admin can edit and save team name
- [ ] Admin can edit and save description
- [ ] Character counter updates as user types
- [ ] Save button disabled when form is clean
- [ ] Save button shows loading state during submission
- [ ] Non-admin sees disabled form with info message
- [ ] Validation errors display inline
- [ ] Success toast appears after save
- [ ] Header reflects new team name immediately
- [ ] Team switcher reflects new name immediately
- [ ] Tab navigation works via URL params
- [ ] Invitations tab hidden from non-admins
- [ ] Form has proper aria attributes
- [ ] Keyboard navigation works (Tab, Enter)

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
