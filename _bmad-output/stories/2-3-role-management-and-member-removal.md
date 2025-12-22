# Story 2.3: Role Management & Member Removal

Status: ✅ Done

## Story
**As a** team admin,
**I want** to manage member roles and remove members,
**So that** I can control access to our team's data.

## Acceptance Criteria

1. **Given** I am a team admin viewing the members list **When** I click on a member's role dropdown **Then** I can change their role between `member` and `admin`, and the change takes effect immediately, and their permissions update on next request

2. **Given** I am a team admin **When** I click "Remove" on a team member **Then** I see a confirmation dialog, and upon confirmation, their `team_members` row is deleted, and they lose access to the team's data immediately

3. **Given** I am a team member (not admin) **When** I click "Leave Team" **Then** I see a confirmation dialog, and upon confirmation, my `team_members` row is deleted, and I am redirected to my next available team (or team creation)

4. **Given** I am the last admin in a team **When** I try to leave or change my role **Then** I see "You must assign another admin before leaving"

5. **Given** I am a non-admin team member **When** I view the members list **Then** role dropdowns are disabled with aria-disabled, and remove buttons are hidden

## Tasks / Subtasks

- [ ] **Task 1: Create update member role API endpoint** (AC: #1, #4)
  - [ ] Create `app/api/teams/[teamId]/members/[memberId]/route.ts` with PATCH handler
  - [ ] Use `await params` for Next.js 15 async params handling
  - [ ] Validate user is team admin and target member exists
  - [ ] Check if this is the last admin changing their role
  - [ ] Return error `LAST_ADMIN` if trying to demote last admin
  - [ ] Update role in team_members table and return updated member data

- [ ] **Task 2: Create remove member API endpoint** (AC: #2, #4)
  - [ ] Add DELETE handler to `app/api/teams/[teamId]/members/[memberId]/route.ts`
  - [ ] Use `await params` for Next.js 15 async params handling
  - [ ] Validate user is team admin
  - [ ] Check if trying to remove last admin and return error `LAST_ADMIN`
  - [ ] Delete team_members row and return success response

- [ ] **Task 3: Create leave team API endpoint** (AC: #3, #4)
  - [ ] Create `app/api/teams/[teamId]/leave/route.ts` with POST handler
  - [ ] Use `await params` for Next.js 15 async params handling
  - [ ] Check if user is last admin and return error `LAST_ADMIN`
  - [ ] Delete user's team_members row
  - [ ] Clear team_id from JWT claims
  - [ ] Return next available team or null for redirect

- [ ] **Task 4: Create database function to check last admin** (AC: #4)
  - [ ] Create `is_last_admin(team_id UUID, user_id UUID)` function
  - [ ] Returns TRUE if user is admin AND only admin in team
  - [ ] Use in RLS policies and API validation

- [ ] **Task 5: Create team members list component** (AC: #1, #2, #5)
  - [ ] Create `components/team/team-members-list.tsx`
  - [ ] Fetch team members with TanStack Query using `isPending`
  - [ ] Display member name, email, role, joined date
  - [ ] Show skeleton loading state while fetching
  - [ ] Show role dropdown for admins (disabled with `aria-disabled` for non-admins)
  - [ ] Add `aria-label` to member rows for screen readers

- [ ] **Task 6: Create role selector component** (AC: #1, #5)
  - [ ] Create `components/team/role-selector.tsx`
  - [ ] Dropdown with 'member' and 'admin' options using shadcn/ui Select
  - [ ] Optimistic update: immediately reflect change, revert on error
  - [ ] Loading state during mutation with disabled interaction
  - [ ] Add `aria-label="Change role for {memberName}"` to selector
  - [ ] Keyboard accessible (arrow keys, Enter, Escape)

- [ ] **Task 7: Create remove member confirmation dialog** (AC: #2)
  - [ ] Create `components/team/remove-member-dialog.tsx`
  - [ ] Use shadcn/ui AlertDialog with member name and warning
  - [ ] Focus trap within dialog, close on Escape key
  - [ ] Loading state on confirm button with `isPending`
  - [ ] Toast notification on success/error using sonner

- [ ] **Task 8: Create leave team confirmation dialog** (AC: #3)
  - [ ] Create `components/team/leave-team-dialog.tsx`
  - [ ] Use shadcn/ui AlertDialog with focus trap
  - [ ] Show error message if user is last admin (disable confirm button)
  - [ ] On confirm, redirect to next team or `/teams/create`

- [ ] **Task 9: Implement role change mutation** (AC: #1)
  - [ ] Create `lib/hooks/use-update-member-role.ts`
  - [ ] Use TanStack Query `useMutation` with `isPending`
  - [ ] Implement optimistic update in `onMutate`
  - [ ] Rollback in `onError` using previous data from context
  - [ ] Invalidate `['team-members', teamId]` on success
  - [ ] Handle LAST_ADMIN error with specific toast message

- [ ] **Task 10: Implement remove member mutation** (AC: #2)
  - [ ] Create `lib/hooks/use-remove-member.ts`
  - [ ] Use TanStack Query `useMutation` with `isPending`
  - [ ] Invalidate `['team-members', teamId]` on success
  - [ ] Show success toast "Member removed"

- [ ] **Task 11: Implement leave team mutation** (AC: #3)
  - [ ] Create `lib/hooks/use-leave-team.ts`
  - [ ] Use TanStack Query `useMutation` with `isPending`
  - [ ] Clear team context and redirect to next team or creation page
  - [ ] Show success toast "You have left the team"

- [ ] **Task 12: Integrate components into team settings page** (AC: #1, #2, #3, #5)
  - [ ] Add TeamMembersList component to team settings
  - [ ] Add "Leave Team" button for all members (different behavior for admin vs non-admin)
  - [ ] Conditionally show admin controls based on role
  - [ ] Add React Error Boundary around team management section

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router (use `await params` in route handlers)
- Supabase with mandatory RLS
- TanStack Query 5.x (`isPending` not `isLoading`)
- shadcn/ui AlertDialog for confirmations
- sonner for toast notifications

**Permission Rules:**
- Only admins can change roles or remove members
- Last admin cannot leave or be demoted
- Members can only leave (remove themselves)
- Non-admins see disabled role controls

### API Route Pattern (Next.js 15)

```typescript
// app/api/teams/[teamId]/members/[memberId]/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateRoleSchema = z.object({
  role: z.enum(['member', 'admin']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  try {
    const { teamId, memberId } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const validated = updateRoleSchema.parse(body);

    // Check if current user is admin
    const { data: currentMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!currentMember || currentMember.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can change roles' } },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Check if demoting last admin
    if (targetMember.role === 'admin' && validated.role === 'member') {
      const { data: isLast } = await supabase
        .rpc('is_last_admin', { p_team_id: teamId, p_user_id: targetMember.user_id });

      if (isLast) {
        return NextResponse.json(
          { error: { code: 'LAST_ADMIN', message: 'You must assign another admin before leaving' } },
          { status: 400 }
        );
      }
    }

    // Update role
    const { data: updated, error } = await supabase
      .from('team_members')
      .update({ role: validated.role })
      .eq('id', memberId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { member: updated } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  try {
    const { teamId, memberId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check if current user is admin
    const { data: currentMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!currentMember || currentMember.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can remove members' } },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Check if removing last admin
    if (targetMember.role === 'admin') {
      const { data: isLast } = await supabase
        .rpc('is_last_admin', { p_team_id: teamId, p_user_id: targetMember.user_id });

      if (isLast) {
        return NextResponse.json(
          { error: { code: 'LAST_ADMIN', message: 'Cannot remove the last admin' } },
          { status: 400 }
        );
      }
    }

    // Delete member
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      return NextResponse.json(
        { error: { code: 'DELETE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### Leave Team API

```typescript
// app/api/teams/[teamId]/leave/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check if user is last admin
    const { data: isLast } = await supabase
      .rpc('is_last_admin', { p_team_id: teamId, p_user_id: user.id });

    if (isLast) {
      return NextResponse.json(
        { error: { code: 'LAST_ADMIN', message: 'You must assign another admin before leaving' } },
        { status: 400 }
      );
    }

    // Delete membership
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: { code: 'LEAVE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    // Get next available team
    const { data: nextTeam } = await supabase
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    // Update JWT claim to next team or null
    if (nextTeam) {
      await supabase.rpc('set_team_claim', { team_id: nextTeam.team_id });
    } else {
      await supabase.rpc('clear_team_claim');
    }

    return NextResponse.json({
      data: {
        success: true,
        nextTeam: nextTeam?.teams || null,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### Database Function: Clear Team Claim

```sql
CREATE OR REPLACE FUNCTION clear_team_claim()
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data - 'team_id'
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### TanStack Query Hook with Optimistic Updates

```typescript
// lib/hooks/use-update-member-role.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UpdateRoleParams {
  teamId: string;
  memberId: string;
  role: 'member' | 'admin';
}

interface TeamMember {
  id: string;
  role: 'member' | 'admin';
  // ... other fields
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, memberId, role }: UpdateRoleParams) => {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.code || 'Failed to update role');
      }

      return data.data;
    },
    onMutate: async ({ teamId, memberId, role }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['team-members', teamId] });

      // Snapshot previous value
      const previousMembers = queryClient.getQueryData<TeamMember[]>(['team-members', teamId]);

      // Optimistically update
      queryClient.setQueryData<TeamMember[]>(['team-members', teamId], (old) =>
        old?.map((member) =>
          member.id === memberId ? { ...member, role } : member
        )
      );

      return { previousMembers };
    },
    onError: (error: Error, { teamId }, context) => {
      // Rollback on error
      if (context?.previousMembers) {
        queryClient.setQueryData(['team-members', teamId], context.previousMembers);
      }

      if (error.message === 'LAST_ADMIN') {
        toast.error('You must assign another admin first');
      } else {
        toast.error('Failed to update role');
      }
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      toast.success('Role updated successfully');
    },
  });
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Team Members List | `components/team/team-members-list.tsx` |
| Role Selector | `components/team/role-selector.tsx` |
| Remove Member Dialog | `components/team/remove-member-dialog.tsx` |
| Leave Team Dialog | `components/team/leave-team-dialog.tsx` |
| Update Role Hook | `lib/hooks/use-update-member-role.ts` |
| Remove Member Hook | `lib/hooks/use-remove-member.ts` |
| Leave Team Hook | `lib/hooks/use-leave-team.ts` |

### Accessibility Requirements

- All interactive elements keyboard accessible
- Role dropdown has `aria-label="Change role for {name}"`
- Remove button has `aria-label="Remove {name} from team"`
- AlertDialog has focus trap and closes on Escape
- Loading states announced with `aria-live="polite"`
- Disabled controls use `aria-disabled="true"` (not just disabled attribute)

### Common Pitfalls to Avoid

1. **DO NOT** allow last admin to leave without assigning another admin
2. **DO NOT** allow last admin to change their role to member
3. **DO NOT** forget to update JWT claims when leaving team
4. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
5. **DO NOT** skip confirmation dialogs for destructive actions
6. **DO NOT** forget to redirect after leaving a team
7. **DO NOT** forget `await params` in Next.js 15 route handlers
8. **DO NOT** skip optimistic updates for role changes (causes UI lag)

### Verification Checklist

After completing this story, verify:
- [ ] Admin can view team members list
- [ ] Admin can change member role to admin
- [ ] Admin can change member role to member
- [ ] Last admin cannot change their own role
- [ ] Admin can remove a team member
- [ ] Last admin cannot be removed
- [ ] Confirmation dialog appears before removal
- [ ] Member can leave team
- [ ] Last admin cannot leave team
- [ ] After leaving, user is redirected to next team
- [ ] If no teams left, user is redirected to create team
- [ ] Non-admin cannot change roles (dropdown disabled)
- [ ] Non-admin cannot remove others (button hidden)
- [ ] Role changes reflect immediately (optimistic update)
- [ ] Error toast appears for LAST_ADMIN errors
- [ ] Success toast appears after role change/removal
- [ ] All dialogs close on Escape key
- [ ] All interactive elements keyboard accessible

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
