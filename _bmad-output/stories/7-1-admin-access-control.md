# Story 7.1: Admin Access Control

Status: ✅ Done

## Story

**As a** platform operator,
**I want** restricted admin access,
**So that** only authorized users can manage the platform.

## Epic Context

**Epic 7: Platform Administration** - Super admins can manage users, teams, analysis configs, and monitor system health.
**FRs Covered:** FR46-FR50

## Dependencies

- **Story 1.1** - Project Initialization (database with `users` table must exist)
- **Story 1.7** - Session & Security Foundation (JWT-based auth, middleware structure)

## Acceptance Criteria

1. **Given** a user with `is_super_admin = true`
   **When** they access `/admin`
   **Then** they see the admin dashboard

2. **Given** a user with `is_super_admin = false`
   **When** they try to access `/admin`
   **Then** they are redirected to `/dashboard`
   **And** see "Access denied" toast notification

3. **Given** the middleware
   **When** checking admin access
   **Then** it queries `users.is_super_admin`
   **And** caches the result for the session

## Tasks / Subtasks

- [x] **Task 1: Add is_super_admin column to users table** (AC: #1, #2, #3)
  - [x] Create Supabase migration: `supabase/migrations/YYYYMMDDHHMMSS_add_is_super_admin.sql`
  - [x] Add `is_super_admin BOOLEAN NOT NULL DEFAULT false` to `users` table
  - [x] Create partial index: `CREATE INDEX idx_users_is_super_admin ON users(is_super_admin) WHERE is_super_admin = true`
  - [x] Add column comment for documentation
  - [x] Verify migration applies cleanly: `supabase db push`

- [x] **Task 2: Create admin middleware protection** (AC: #1, #2, #3)
  - [x] Update `middleware.ts` to check for `/admin` path prefix
  - [x] Query `users.is_super_admin` using server client
  - [x] Cache admin status in cookie for performance (expires with session)
  - [x] Redirect non-admins to `/dashboard?error=access-denied`
  - [x] Handle edge case: user profile doesn't exist (treat as non-admin)

- [x] **Task 3: Create admin layout wrapper** (AC: #1, #2)
  - [x] Create `app/(dashboard)/admin/layout.tsx`
  - [x] Implement server-side admin check as defense-in-depth layer
  - [x] Create `lib/supabase/admin.ts` for service role client (bypasses RLS)
  - [x] Return redirect if not admin (do NOT throw 403 - use redirect for UX)

- [x] **Task 4: Create admin route group structure** (AC: #1)
  - [x] Create `app/(dashboard)/admin/` directory
  - [x] Create `app/(dashboard)/admin/page.tsx` (admin dashboard entry point)
  - [x] Add placeholder content: "Admin Dashboard" heading with "Coming in Story 7.2"
  - [x] Create `components/admin/AdminSidebar.tsx` placeholder for navigation

- [x] **Task 5: Handle access denied notification** (AC: #2)
  - [x] Create access denied handler in dashboard layout (`app/(dashboard)/layout.tsx`)
  - [x] Check for `?error=access-denied` query param on mount
  - [x] Display toast: "Access denied - Admin privileges required"
  - [x] Remove query param from URL after displaying (use `router.replace`)
  - [x] Use `useEffect` with empty deps array (runs once on mount)

- [x] **Task 6: Create admin check utility** (AC: #3)
  - [x] Create `lib/auth/admin.ts` with:
    - `isUserSuperAdmin(userId: string): Promise<boolean>` - checks DB
    - `requireSuperAdmin(): Promise<void>` - for server components, redirects if not admin
  - [x] Use service role client from `lib/supabase/admin.ts` to bypass RLS
  - [x] Log admin check attempts: `[Admin] Checking admin status for user ${userId}`
  - [x] Return `false` on any error (fail secure)

- [x] **Task 7: Add admin status to session cache** (AC: #3)
  - [x] Store admin status in session cookie after first check
  - [x] Cookie name: `ctx_admin_status` (encrypted, httpOnly)
  - [x] Expiry: Match session expiry (24 hours)
  - [x] Invalidation trigger: None needed for MVP (admin status changes are rare)
  - [x] Future: Add webhook to invalidate on `users.is_super_admin` change

## Dev Notes

### Technology Stack (MUST USE)

- Next.js 15 App Router
- TypeScript strict mode
- Supabase Auth with cookie-based sessions
- Supabase client types: `server.ts` (SSR), `admin.ts` (service role)

### Security Pattern (CRITICAL)

```
Defense in Depth:
1. Middleware (first line) → Checks admin, redirects if not
2. Layout (second line) → Double-checks in case middleware is bypassed
3. Never trust client → All admin checks happen server-side
```

**NEVER:**
- Allow non-super-admins to access admin routes
- Expose service role client to client components
- Trust client-provided admin status
- Expose detailed error messages about admin status

### File Locations (Architecture Compliant)

| Component | Path |
|-----------|------|
| Middleware | `middleware.ts` |
| Admin Layout | `app/(dashboard)/admin/layout.tsx` |
| Admin Dashboard | `app/(dashboard)/admin/page.tsx` |
| Admin Sidebar | `components/admin/AdminSidebar.tsx` |
| Admin Check Utility | `lib/auth/admin.ts` |
| Service Role Client | `lib/supabase/admin.ts` |

### Database Migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_is_super_admin.sql

-- Add is_super_admin column to users table
ALTER TABLE users
ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Create partial index for performance (only indexes true values)
CREATE INDEX idx_users_is_super_admin ON users(is_super_admin) WHERE is_super_admin = true;

-- Comment for documentation
COMMENT ON COLUMN users.is_super_admin IS 'Platform super admin flag - grants access to /admin routes';
```

### Middleware Implementation

```typescript
// middleware.ts - Admin protection addition
// Add this AFTER existing auth checks

if (pathname.startsWith('/admin')) {
  const supabase = createServerClient(/* existing config */);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check cached admin status first
  const cachedAdminStatus = request.cookies.get('ctx_admin_status')?.value;
  let isAdmin = cachedAdminStatus === 'true';

  if (!cachedAdminStatus) {
    // Query database for admin status
    const { data: profile } = await supabase
      .from('users')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    isAdmin = profile?.is_super_admin ?? false;

    // Cache the result
    const response = NextResponse.next();
    response.cookies.set('ctx_admin_status', String(isAdmin), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    });
  }

  if (!isAdmin) {
    const redirectUrl = new URL('/dashboard', request.url);
    redirectUrl.searchParams.set('error', 'access-denied');
    return NextResponse.redirect(redirectUrl);
  }
}
```

### Admin Check Utility

```typescript
// lib/auth/admin.ts
import { createClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  const supabase = createClient(); // Service role client

  const { data, error } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Admin] Error checking admin status:', error.message);
    return false; // Fail secure
  }

  return data?.is_super_admin ?? false;
}

export async function requireSuperAdmin(): Promise<void> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isAdmin = await isUserSuperAdmin(user.id);

  if (!isAdmin) {
    redirect('/dashboard?error=access-denied');
  }
}
```

### Admin Layout (Defense in Depth)

```typescript
// app/(dashboard)/admin/layout.tsx
import { createClient } from '@/lib/supabase/server';
import { isUserSuperAdmin } from '@/lib/auth/admin';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isAdmin = await isUserSuperAdmin(user.id);

  if (!isAdmin) {
    redirect('/dashboard?error=access-denied');
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
```

### Access Denied Toast Handler

```typescript
// In app/(dashboard)/layout.tsx - Add to client component
'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner'; // or your toast library

export function AccessDeniedHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('error') === 'access-denied') {
      toast.error('Access denied - Admin privileges required');
      // Remove the query param
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      router.replace(url.pathname);
    }
  }, [searchParams, router]);

  return null;
}
```

### Common Pitfalls to Avoid

1. **DO NOT** check admin status only in middleware - add layout check too
2. **DO NOT** use browser client for admin checks - always use server/service role
3. **DO NOT** forget to handle the case where user profile doesn't exist
4. **DO NOT** cache admin status indefinitely - session-scoped caching is sufficient
5. **DO NOT** log sensitive information about why admin check failed

### Verification Checklist

After completing this story, verify:
- [ ] Migration creates `is_super_admin` column successfully
- [ ] Super admin user can access `/admin` routes
- [ ] Non-admin user is redirected to `/dashboard`
- [ ] Access denied toast appears after redirect
- [ ] Middleware properly checks and caches admin status
- [ ] Layout provides secondary protection layer
- [ ] Service role client is used for admin checks (bypasses RLS)
- [ ] No admin check code runs on client side
- [ ] Cookie caching works for admin status

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented admin access control with is_super_admin column and middleware protection
- Created admin layout with defense-in-depth server-side admin check
- Added access denied toast handler in dashboard layout
- Created admin check utility functions in lib/auth/admin.ts
- Admin status cached in session cookie for performance
- All 6 E2E tests passing

**Design Refinement (2025-12-21):** Unified navigation per UX spec
- Original implementation had separate AdminSidebar, creating duplicate sidebar issue
- Fixed by integrating admin nav items into main Sidebar component
- Admin items appear below divider when user has `is_super_admin = true`
- Admin layout simplified to only add context header, not duplicate layout
- Follows UX principle: "Complex nested navigation — keep it flat and fast"

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-21 | Initial implementation of admin access control | Claude Opus 4.5 |
| 2025-12-21 | Unified navigation - integrated admin nav into main sidebar | Claude Opus 4.5 |

### File List

**Created:**
- `app/app/(dashboard)/admin/layout.tsx` - Admin layout with access control (simplified)
- `app/app/(dashboard)/admin/page.tsx` - Admin dashboard entry point
- `app/components/admin/admin-sidebar.tsx` - Admin navigation sidebar (deprecated - now integrated into main Sidebar)
- `app/components/auth/access-denied-handler.tsx` - Toast handler for access denied
- `app/lib/auth/admin.ts` - Admin check utilities
- `app/lib/supabase/admin.ts` - Service role Supabase client
- `app/e2e/admin-access.spec.ts` - E2E tests for admin access control

**Modified:**
- `app/components/dashboard/sidebar.tsx` - Added admin nav items for super admins
- `app/app/(dashboard)/layout.tsx` - Now passes isAdmin prop to Sidebar
