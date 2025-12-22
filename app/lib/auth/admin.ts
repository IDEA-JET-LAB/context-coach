import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

/**
 * Checks if a user is a super admin.
 * Uses service role client to bypass RLS.
 *
 * @param userId - The user ID to check
 * @returns true if user is super admin, false otherwise
 */
export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();

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
  } catch (error) {
    console.error('[Admin] Unexpected error checking admin status:', error);
    return false; // Fail secure
  }
}

/**
 * Requires the current user to be a super admin.
 * Redirects to dashboard with error if not admin.
 * Use in Server Components for admin-only pages.
 */
export async function requireSuperAdmin(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isAdmin = await isUserSuperAdmin(user.id);

  if (!isAdmin) {
    redirect('/prompts?error=access-denied');
  }
}

/**
 * Gets admin status for current user.
 * Returns null if not authenticated.
 */
export async function getAdminStatus(): Promise<boolean | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return isUserSuperAdmin(user.id);
}

/**
 * Error thrown when super admin verification fails.
 */
export class SuperAdminError extends Error {
  constructor(
    message: string,
    public readonly code: 'UNAUTHORIZED' | 'FORBIDDEN' = 'FORBIDDEN'
  ) {
    super(message);
    this.name = 'SuperAdminError';
  }
}

/**
 * Verifies the current user is a super admin.
 * Throws SuperAdminError if not authenticated or not admin.
 * Use in server actions where redirect is not appropriate.
 */
export async function verifySuperAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new SuperAdminError('Authentication required', 'UNAUTHORIZED');
  }

  const isAdmin = await isUserSuperAdmin(user.id);

  if (!isAdmin) {
    throw new SuperAdminError('Super admin access required', 'FORBIDDEN');
  }

  return user.id;
}

/**
 * M41 Fix: Consistent admin authorization result type for API routes.
 */
export interface AdminAuthResult {
  authorized: true;
  userId: string;
}

export interface AdminAuthError {
  authorized: false;
  response: NextResponse;
}

export type AdminAuthCheck = AdminAuthResult | AdminAuthError;

/**
 * M41 Fix: Consistent admin authorization guard for API routes.
 *
 * Use this at the start of every admin API route handler for consistent
 * authorization checks and error responses.
 *
 * @example
 * ```typescript
 * export async function GET() {
 *   const auth = await requireSuperAdminApi();
 *   if (!auth.authorized) return auth.response;
 *
 *   // auth.userId is now available
 *   const data = await getAdminData();
 *   return NextResponse.json({ data });
 * }
 * ```
 */
export async function requireSuperAdminApi(): Promise<AdminAuthCheck> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
          { status: 401 }
        ),
      };
    }

    const isAdmin = await isUserSuperAdmin(user.id);

    if (!isAdmin) {
      console.warn(`[Admin] Non-admin access attempt by user ${user.id}`);
      return {
        authorized: false,
        response: NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
          { status: 403 }
        ),
      };
    }

    return {
      authorized: true,
      userId: user.id,
    };
  } catch (error) {
    console.error('[Admin] Authorization error:', error);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Authorization check failed' } },
        { status: 500 }
      ),
    };
  }
}
