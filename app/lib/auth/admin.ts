import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

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
