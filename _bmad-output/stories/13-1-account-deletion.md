# Story 13.1: Account Deletion (Self-Service)

Status: ✅ COMPLETED (2025-12-23)
Priority: P2

## Story

**As a** user,
**I want** to delete my account,
**So that** I can remove my data from the platform if I no longer use it.

## Current State

- Display Name Edit: ✅ IMPLEMENTED
- Avatar Upload: ✅ IMPLEMENTED
- Delete Account: ❌ NOT IMPLEMENTED (this story)

## Acceptance Criteria

1. **Given** I am on the Settings page
   **When** I scroll to the "Danger Zone" section
   **Then** I see a "Delete Account" button with warning text

2. **Given** I click "Delete Account"
   **When** the confirmation modal appears
   **Then** I must type my email to confirm
   **And** I see a warning about data deletion being permanent

3. **Given** I confirm account deletion
   **When** the deletion processes
   **Then** my `auth.users` entry is deleted
   **And** my `public.users` entry is deleted
   **And** my `team_members` entries are deleted
   **And** my prompts are deleted (confirmed: full deletion, not anonymization)
   **And** I am logged out and redirected to landing page

4. **Given** I am the last admin of a team
   **When** I try to delete my account
   **Then** I see "You must transfer admin role or delete the team first"
   **And** deletion is blocked until resolved

5. **Given** deletion partially fails (e.g., one table deletion succeeds but another fails)
   **When** the error occurs
   **Then** I see a clear error message explaining what happened
   **And** the system logs the failure for support investigation
   **And** remaining data is preserved (no partial state)

## Tasks / Subtasks

- [ ] **Task 1: Add Danger Zone UI to Settings page**
  - [ ] Open `app/(dashboard)/settings/page.tsx`
  - [ ] Add "Danger Zone" section at bottom with red border
  - [ ] Add "Delete Account" button (destructive variant)
  - [ ] Add warning text explaining permanence

- [ ] **Task 2: Create confirmation modal**
  - [ ] Create `components/settings/delete-account-modal.tsx`
  - [ ] Require user to type their email to confirm
  - [ ] Show bullet list of what will be deleted
  - [ ] "Cancel" and "Delete My Account" buttons

- [ ] **Task 3: Create account deletion server action**
  - [ ] Create `lib/api/account.ts`
  - [ ] Add `deleteAccount()` server action
  - [ ] Check if user is last admin of any team
  - [ ] If last admin, return error with message
  - [ ] Delete in order: prompts → team_members → users → auth.users

- [ ] **Task 4: Implement deletion logic**
  - [ ] Use service role client for admin operations
  - [ ] Delete user's prompts: `DELETE FROM prompts WHERE user_id = ?`
  - [ ] Delete team memberships: `DELETE FROM team_members WHERE user_id = ?`
  - [ ] Delete user profile: `DELETE FROM users WHERE id = ?`
  - [ ] Delete auth user: `supabase.auth.admin.deleteUser(userId)`

- [ ] **Task 5: Handle last admin check**
  - [ ] Query teams where user is only admin
  - [ ] If any found, block deletion
  - [ ] Show list of teams needing admin transfer
  - [ ] Link to team settings for each

- [ ] **Task 6: Handle post-deletion redirect**
  - [ ] Clear all cookies/session
  - [ ] Redirect to `/?account_deleted=true`
  - [ ] Landing page checks for `account_deleted` param and shows confirmation message

- [ ] **Task 7: Add rate limiting**
  - [ ] Add rate limit to deletion endpoint (e.g., 3 attempts per hour per user)
  - [ ] Use existing `cliRateLimit` pattern from `lib/rate-limit`

- [ ] **Task 8: Add E2E test**
  - [ ] Test deletion flow for regular user
  - [ ] Test blocking for last admin
  - [ ] Test email confirmation requirement

## Dev Notes

### Deletion Order (Important!)

Delete in this order to avoid FK constraint violations:

```sql
-- 1. Delete user's prompts
DELETE FROM prompts WHERE user_id = $1;

-- 2. Delete user's prompt analyses (if user_id tracked)
-- Note: May cascade from prompts deletion

-- 3. Delete team memberships
DELETE FROM team_members WHERE user_id = $1;

-- 4. Delete user profile
DELETE FROM users WHERE id = $1;

-- 5. Delete auth user (via admin API)
-- This is done via Supabase Admin API, not SQL
```

### Server Action Implementation

```typescript
// lib/api/account.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function deleteAccount() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Check if last admin of any team
  const { data: adminTeams } = await supabase
    .from('team_members')
    .select('team_id, teams(name)')
    .eq('user_id', user.id)
    .eq('role', 'admin');

  for (const membership of adminTeams || []) {
    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', membership.team_id)
      .eq('role', 'admin');

    if (count === 1) {
      return {
        error: 'LAST_ADMIN',
        teams: adminTeams.map(t => t.teams.name)
      };
    }
  }

  // Proceed with deletion using admin client
  const adminClient = createAdminClient();

  // Delete prompts
  await adminClient.from('prompts').delete().eq('user_id', user.id);

  // Delete team memberships
  await adminClient.from('team_members').delete().eq('user_id', user.id);

  // Delete user profile
  await adminClient.from('users').delete().eq('id', user.id);

  // Delete auth user
  await adminClient.auth.admin.deleteUser(user.id);

  // Clear session and redirect with query param (toasts don't persist across redirects)
  await supabase.auth.signOut();
  redirect('/?account_deleted=true');
}
```

### Confirmation Modal UI

```tsx
// components/settings/delete-account-modal.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteAccountModal({ open, onOpenChange, userEmail, onConfirm, isPending }: Props) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const isConfirmed = confirmEmail === userEmail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Account</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete:
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>Your user profile and settings</li>
          <li>All your captured prompts</li>
          <li>Your team memberships</li>
        </ul>

        <div className="space-y-2">
          <p className="text-sm">Type <strong>{userEmail}</strong> to confirm:</p>
          <Input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!isConfirmed || isPending}
          >
            {isPending ? 'Deleting...' : 'Delete My Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `app/(dashboard)/settings/page.tsx` | Modify | Add Danger Zone section |
| `components/settings/delete-account-modal.tsx` | Create | Confirmation modal |
| `lib/api/account.ts` | Create | Server action for deletion |
| `e2e/account-deletion.spec.ts` | Create | E2E tests |

### Security Considerations

- Always verify user is authenticated before deletion
- Use service role client for cross-table deletions
- Clear all session data after deletion
- Rate limit the deletion endpoint to prevent abuse
- **Audit Logging (Required):** Log all account deletion attempts (success and failure) with user ID, timestamp, and result. This is essential for security audits and debugging partial failures. Consider using a separate audit log table or external logging service.

### References

- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
- [Source: _bmad-output/epics.md#Story-13.1]

## Verification Checklist

- [ ] Danger Zone section visible on settings page
- [ ] Delete button opens confirmation modal
- [ ] Must type email to enable delete button
- [ ] Deletion blocked if last admin of team
- [ ] All user data deleted on confirmation
- [ ] User logged out and redirected
- [ ] E2E tests pass

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

*To be filled by dev agent - list all files created/modified*
