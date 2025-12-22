# Story 7.3: User Management

Status: ✅ Done

## Story

**As a** super admin,
**I want** to manage user accounts,
**So that** I can handle support issues and enforce policies.

## Acceptance Criteria

1. **Given** I navigate to Admin > Users
   **When** the page loads
   **Then** I see a paginated list of all users (excluding soft-deleted)
   **And** search/filter by email, name, status

2. **Given** I click on a user
   **When** viewing their details
   **Then** I see: email, teams, prompts count, last active, account status

3. **Given** I click "Disable Account"
   **When** I confirm the action
   **Then** the user can no longer log in
   **And** their data is preserved but inaccessible

4. **Given** I click "Delete Account"
   **When** I confirm with extra verification
   **Then** the user account is deleted
   **And** their data is anonymized or deleted per retention policy

## Tasks / Subtasks

- [x] **Task 1: Create users list page** (AC: #1)
  - [x] Create `app/(dashboard)/admin/users/page.tsx`
  - [x] Implement server component for initial data load
  - [x] Use service role client to fetch all users (bypasses RLS)
  - [x] Exclude soft-deleted users (`deleted_at IS NULL`)
  - [x] Display users in a data table with columns: email, name, status, last active
  - [x] Style using shadcn/ui Table component

- [x] **Task 2: Implement pagination** (AC: #1)
  - [x] Create pagination component with page size selector (10/25/50)
  - [x] Implement server-side pagination with offset/limit
  - [x] Display total count and current page info
  - [x] Sync pagination state with URL query params using `useSearchParams`
  - [x] Handle page changes with `useRouter().push()`

- [x] **Task 3: Implement search and filtering** (AC: #1)
  - [x] Add search input for email/name (debounced, 300ms)
  - [x] Add status filter dropdown (all/active/disabled)
  - [x] Implement server-side search query with ILIKE
  - [x] Sync filter state with URL query params
  - [x] Clear filters button

- [x] **Task 4: Create user detail page** (AC: #2)
  - [x] Create `app/(dashboard)/admin/users/[id]/page.tsx`
  - [x] Fetch user profile with service role client
  - [x] Display email address
  - [x] Display account status (active/disabled)
  - [x] Display last active timestamp

- [x] **Task 5: Display user teams and stats** (AC: #2)
  - [x] Query team_members to get user's teams
  - [x] Display list of teams with member role
  - [x] Query prompts count for the user
  - [x] Display prompts count with link to filter by user

- [x] **Task 6: Implement account disable functionality** (AC: #3)
  - [x] Add "Disable Account" button on user detail page
  - [x] Create confirmation dialog with warning message
  - [x] Create `lib/services/admin-users.ts` server action (disableUser)
  - [x] Verify caller is super admin before proceeding
  - [x] Update user record with `is_disabled = true`
  - [x] Call Supabase Auth Admin API to ban user
  - [x] Create audit log entry
  - [x] Show success toast and update UI

- [x] **Task 7: Add is_disabled column to users table** (AC: #3)
  - [x] Create migration to add `is_disabled` boolean column (default: false)
  - [x] Create migration to add `deleted_at` timestamptz column
  - [x] Create migration to add `last_active_at` timestamptz column
  - [x] Add index for filtering disabled users
  - [x] Add partial index on deleted_at for soft-delete queries
  - [ ] Update middleware to check disabled status on login (not implemented - using Supabase Auth ban instead)

- [x] **Task 8: Implement account deletion** (AC: #4)
  - [x] Add "Delete Account" button on user detail page
  - [x] Create multi-step confirmation dialog
  - [x] Require admin to type user's email to confirm
  - [x] Create `lib/services/admin-users.ts` server action (deleteUser)
  - [x] Verify caller is super admin before proceeding
  - [x] Implement soft delete: anonymize email, clear personal data
  - [x] Delete from Supabase Auth using Admin API
  - [x] Create audit log entry
  - [x] Show success toast and redirect to users list

- [x] **Task 9: Implement data retention policy** (AC: #4)
  - [x] Anonymize user email: `deleted_user_[hash]@anonymized.local`
  - [x] Clear name and profile fields
  - [x] Preserve prompts with anonymized user reference
  - [x] Log deletion action for audit trail

- [x] **Task 10: Add re-enable account functionality** (AC: #3)
  - [x] Add "Enable Account" button for disabled users
  - [x] Create `lib/services/admin-users.ts` server action (enableUser)
  - [x] Verify caller is super admin before proceeding
  - [x] Update `is_disabled = false`
  - [x] Call Supabase Auth Admin API to unban user
  - [x] Create audit log entry
  - [x] Show success toast

- [x] **Task 11: Create audit log table and logging** (NEW)
  - [x] Create migration for `admin_audit_logs` table
  - [x] Create audit log utility in `lib/services/admin-users.ts`
  - [x] Log all admin actions with: admin_id, action, target_user_id, details, timestamp

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router
- TypeScript in strict mode
- Supabase Auth Admin API for user management
- Service role client for all queries (bypasses RLS)

**Security Pattern (CRITICAL):**
- All operations use service role client
- MUST verify `is_super_admin = true` before any operation
- Never expose user management APIs to non-admins
- Audit log all destructive actions
- Require extra confirmation for deletion

**API Response Format (from architecture):**
```typescript
// Success
{ data: T, meta?: { count: number, page: number } }

// Error
{ error: { code: string, message: string } }
```

### Audit Log Table

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_admin_audit_logs.sql

CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,  -- 'disable_user', 'enable_user', 'delete_user'
  target_user_id UUID REFERENCES users(id),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by admin or target
CREATE INDEX idx_audit_logs_admin ON admin_audit_logs(admin_id, created_at DESC);
CREATE INDEX idx_audit_logs_target ON admin_audit_logs(target_user_id, created_at DESC);

-- RLS: Only super admins can read audit logs
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_audit_read ON admin_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = TRUE)
  );
```

### Audit Log Utility

```typescript
// lib/api/admin/audit-log.ts
import { createClient } from '@/lib/supabase/admin';

interface AuditLogEntry {
  adminId: string;
  action: 'disable_user' | 'enable_user' | 'delete_user';
  targetUserId: string;
  details?: Record<string, unknown>;
}

export async function createAuditLog(entry: AuditLogEntry) {
  const supabase = createClient();

  await supabase.from('admin_audit_logs').insert({
    admin_id: entry.adminId,
    action: entry.action,
    target_user_id: entry.targetUserId,
    details: entry.details,
  });
}
```

### Super Admin Verification Helper

```typescript
// lib/api/admin/verify-admin.ts
import { createClient } from '@/lib/supabase/server';

export async function verifySuperAdmin(): Promise<{ adminId: string } | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_super_admin) return null;

  return { adminId: user.id };
}
```

### User List Query

```typescript
// lib/db/queries/admin-users.ts
import { createClient } from '@/lib/supabase/admin';

interface GetUsersParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'all' | 'active' | 'disabled';
}

export async function getUsers({ page, pageSize, search, status }: GetUsersParams) {
  const supabase = createClient();

  let query = supabase
    .from('users')
    .select('id, email, name, is_disabled, last_active_at, created_at', { count: 'exact' })
    .is('deleted_at', null);  // Exclude soft-deleted users

  // Apply search filter
  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
  }

  // Apply status filter
  if (status === 'active') {
    query = query.eq('is_disabled', false);
  } else if (status === 'disabled') {
    query = query.eq('is_disabled', true);
  }

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    users: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}
```

### User Detail Query

```typescript
// lib/db/queries/admin-users.ts (continued)
export async function getUserDetail(userId: string) {
  const supabase = createClient();

  const [userResult, teamsResult, promptsResult] = await Promise.all([
    supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single(),
    supabase
      .from('team_members')
      .select(`
        role,
        team:teams(id, name)
      `)
      .eq('user_id', userId),
    supabase
      .from('prompts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  if (userResult.error) throw userResult.error;

  return {
    user: userResult.data,
    teams: teamsResult.data ?? [],
    promptsCount: promptsResult.count ?? 0,
  };
}
```

### Disable User Server Action

```typescript
// lib/api/admin/disable-user.ts
'use server';

import { createClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from './verify-admin';
import { createAuditLog } from './audit-log';
import { revalidatePath } from 'next/cache';

export async function disableUser(userId: string) {
  // Verify caller is super admin
  const admin = await verifySuperAdmin();
  if (!admin) {
    return { error: { code: 'FORBIDDEN', message: 'Super admin access required' } };
  }

  const supabase = createClient();

  // Update users table
  const { error: dbError } = await supabase
    .from('users')
    .update({ is_disabled: true })
    .eq('id', userId);

  if (dbError) {
    return { error: { code: 'DB_ERROR', message: dbError.message } };
  }

  // Disable in Supabase Auth (ban the user)
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none', // Permanent ban until re-enabled
  });

  if (authError) {
    return { error: { code: 'AUTH_ERROR', message: authError.message } };
  }

  // Create audit log entry
  await createAuditLog({
    adminId: admin.adminId,
    action: 'disable_user',
    targetUserId: userId,
    details: { reason: 'Admin disabled account' },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);

  return { data: { success: true } };
}
```

### Enable User Server Action

```typescript
// lib/api/admin/enable-user.ts
'use server';

import { createClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from './verify-admin';
import { createAuditLog } from './audit-log';
import { revalidatePath } from 'next/cache';

export async function enableUser(userId: string) {
  // Verify caller is super admin
  const admin = await verifySuperAdmin();
  if (!admin) {
    return { error: { code: 'FORBIDDEN', message: 'Super admin access required' } };
  }

  const supabase = createClient();

  // Update users table
  const { error: dbError } = await supabase
    .from('users')
    .update({ is_disabled: false })
    .eq('id', userId);

  if (dbError) {
    return { error: { code: 'DB_ERROR', message: dbError.message } };
  }

  // Re-enable in Supabase Auth (unban the user)
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
    user_metadata: { disabled: false },
  });

  if (authError) {
    return { error: { code: 'AUTH_ERROR', message: authError.message } };
  }

  // Create audit log entry
  await createAuditLog({
    adminId: admin.adminId,
    action: 'enable_user',
    targetUserId: userId,
    details: { reason: 'Admin re-enabled account' },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);

  return { data: { success: true } };
}
```

### Delete User with Anonymization

```typescript
// lib/api/admin/delete-user.ts
'use server';

import { createClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from './verify-admin';
import { createAuditLog } from './audit-log';
import { createHash } from 'crypto';
import { revalidatePath } from 'next/cache';

export async function deleteUser(userId: string, confirmEmail: string) {
  // Verify caller is super admin
  const admin = await verifySuperAdmin();
  if (!admin) {
    return { error: { code: 'FORBIDDEN', message: 'Super admin access required' } };
  }

  const supabase = createClient();

  // Verify email matches for extra confirmation
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (user?.email !== confirmEmail) {
    return { error: { code: 'EMAIL_MISMATCH', message: 'Email confirmation does not match' } };
  }

  // Anonymize user data
  const hash = createHash('md5').update(userId).digest('hex').slice(0, 8);
  const anonymizedEmail = `deleted_user_${hash}@anonymized.local`;

  const { error: dbError } = await supabase
    .from('users')
    .update({
      email: anonymizedEmail,
      name: 'Deleted User',
      avatar_url: null,
      is_disabled: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (dbError) {
    return { error: { code: 'DB_ERROR', message: dbError.message } };
  }

  // Delete from Supabase Auth
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) {
    return { error: { code: 'AUTH_ERROR', message: authError.message } };
  }

  // Create audit log entry
  await createAuditLog({
    adminId: admin.adminId,
    action: 'delete_user',
    targetUserId: userId,
    details: {
      originalEmail: user.email,
      anonymizedEmail,
    },
  });

  revalidatePath('/admin/users');

  return { data: { success: true } };
}
```

### Confirmation Dialog

```typescript
// components/admin/delete-user-dialog.tsx
'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DeleteUserDialogProps {
  userId: string;
  userEmail: string;
  onDelete: (confirmEmail: string) => Promise<{ data?: { success: boolean }; error?: { message: string } }>;
}

export function DeleteUserDialog({ userId, userEmail, onDelete }: DeleteUserDialogProps) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);

  const isConfirmed = confirmEmail === userEmail;

  async function handleDelete() {
    setIsPending(true);
    try {
      const result = await onDelete(confirmEmail);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success('User account deleted');
        setOpen(false);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User Account</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The user's account will be permanently
            deleted and their data will be anonymized.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-2">
            Type <strong>{userEmail}</strong> to confirm:
          </p>
          <Input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Enter user's email"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting...' : 'Delete Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Database Migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_user_status_columns.sql

-- Add is_disabled column
ALTER TABLE users
ADD COLUMN is_disabled BOOLEAN NOT NULL DEFAULT false;

-- Add deleted_at for soft delete tracking
ALTER TABLE users
ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add last_active_at for tracking
ALTER TABLE users
ADD COLUMN last_active_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX idx_users_is_disabled ON users(is_disabled);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_users_not_deleted ON users(id) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON COLUMN users.is_disabled IS 'Whether the user account is disabled';
COMMENT ON COLUMN users.deleted_at IS 'Timestamp when user was soft deleted';
COMMENT ON COLUMN users.last_active_at IS 'Last activity timestamp';
```

### Pagination with URL State

```typescript
// components/admin/users-pagination.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UsersPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  total: number;
}

export function UsersPagination({ currentPage, totalPages, pageSize, total }: UsersPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      params.set(key, value);
    });
    router.push(`/admin/users?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, total)} of {total} users
      </div>
      <div className="flex items-center gap-4">
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => updateUrl({ pageSize: value, page: '1' })}
        >
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => updateUrl({ page: (currentPage - 1).toString() })}
                aria-disabled={currentPage <= 1}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>{currentPage}</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => updateUrl({ page: (currentPage + 1).toString() })}
                aria-disabled={currentPage >= totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Users List Page | `app/(dashboard)/admin/users/page.tsx` |
| User Detail Page | `app/(dashboard)/admin/users/[id]/page.tsx` |
| Users Data Table | `components/admin/users-table.tsx` |
| Users Pagination | `components/admin/users-pagination.tsx` |
| Delete Dialog | `components/admin/delete-user-dialog.tsx` |
| Disable Dialog | `components/admin/disable-user-dialog.tsx` |
| Admin User Queries | `lib/db/queries/admin-users.ts` |
| Verify Admin | `lib/api/admin/verify-admin.ts` |
| Audit Log | `lib/api/admin/audit-log.ts` |
| Disable User Action | `lib/api/admin/disable-user.ts` |
| Delete User Action | `lib/api/admin/delete-user.ts` |
| Enable User Action | `lib/api/admin/enable-user.ts` |

### shadcn/ui Components Needed

```bash
npx shadcn@latest add table alert-dialog input badge dropdown-menu pagination select
```

### Common Pitfalls to Avoid

1. **DO NOT** allow operations without verifying `is_super_admin` first
2. **DO NOT** allow deletion without email confirmation
3. **DO NOT** hard delete user data - always anonymize
4. **DO NOT** forget to handle Supabase Auth alongside database
5. **DO NOT** expose user management endpoints to non-admins
6. **DO NOT** skip audit logging for destructive actions
7. **DO NOT** forget to revalidate cache after mutations
8. **DO NOT** display soft-deleted users in the list
9. **DO NOT** forget to use consistent API response format

### Verification Checklist

After completing this story, verify:
- [ ] Super admin check works (non-admins get 403)
- [ ] Users list page displays all non-deleted users
- [ ] Soft-deleted users are excluded from list
- [ ] Pagination works correctly with URL sync
- [ ] Search by email/name works
- [ ] Status filter works
- [ ] User detail page shows all required info
- [ ] Teams list shows user's memberships
- [ ] Prompts count is accurate
- [ ] Disable account prevents login
- [ ] Disabled user data is preserved
- [ ] Enable account restores login
- [ ] Delete requires email confirmation
- [ ] Deleted user data is anonymized
- [ ] Auth user is removed on delete
- [ ] Audit logs are created for all admin actions
- [ ] API responses follow standard format

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- All 24 E2E tests passing for user management functionality
- Implemented TDD approach: wrote tests first, then implementation
- Used Supabase Auth Admin API for user banning/unbanning instead of custom middleware
- Added email column to users table via migration for efficient searching
- Consolidated all admin user services into single file `lib/services/admin-users.ts`
- Audit logs automatically created for all disable/enable/delete actions
- Protected super admin accounts from being modified through the UI
- Tests run serially to avoid race conditions with user creation

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-21 | Initial implementation of user management | Claude Opus 4.5 |

### File List

**Created:**
- `app/app/(dashboard)/admin/users/page.tsx` - User list page
- `app/app/(dashboard)/admin/users/[id]/page.tsx` - User detail page
- `app/components/admin/user-table.tsx` - User table component
- `app/components/admin/user-actions.tsx` - Disable/enable/delete dialogs
- `app/components/admin/users-filters.tsx` - Search and status filters
- `app/components/admin/users-pagination.tsx` - Pagination component
- `app/lib/services/admin-users.ts` - Server actions for user management
- `app/e2e/admin-users.spec.ts` - E2E tests (24 tests)
- `app/supabase/migrations/20251221200000_add_user_status_columns.sql` - User status columns
- `app/supabase/migrations/20251221200001_create_admin_audit_logs.sql` - Audit logs table
- `app/supabase/migrations/20251221200002_add_email_to_users.sql` - Email column for users
