'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createHash } from 'crypto';

// ============================================
// TYPES
// ============================================

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  is_disabled: boolean;
  is_super_admin: boolean;
  last_active_at: string | null;
  created_at: string;
}

interface UserDetail extends AdminUser {
  teams: Array<{
    role: string;
    team: {
      id: string;
      name: string;
    };
  }>;
  promptsCount: number;
}

interface GetUsersParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'all' | 'active' | 'disabled';
}

interface GetUsersResult {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ActionResult<T = { success: boolean }> {
  data?: T;
  error?: { code: string; message: string };
}

// ============================================
// SUPER ADMIN VERIFICATION
// ============================================

export async function verifySuperAdmin(): Promise<{ adminId: string } | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_super_admin) return null;

  return { adminId: user.id };
}

// ============================================
// AUDIT LOGGING
// ============================================

interface AuditLogEntry {
  adminId: string;
  action: 'disable_user' | 'enable_user' | 'delete_user';
  targetUserId: string;
  details?: Record<string, unknown>;
}

async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from('admin_audit_logs').insert({
    admin_id: entry.adminId,
    action: entry.action,
    target_user_id: entry.targetUserId,
    details: entry.details,
  });
}

// ============================================
// USER QUERIES
// ============================================

export async function getUsers({
  page,
  pageSize,
  search,
  status,
}: GetUsersParams): Promise<GetUsersResult> {
  // Verify admin access
  const admin = await verifySuperAdmin();
  if (!admin) {
    return { users: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const supabase = createAdminClient();

  let query = supabase
    .from('users')
    .select('id, email, name, is_disabled, is_super_admin, last_active_at, created_at', { count: 'exact' })
    .is('deleted_at', null); // Exclude soft-deleted users

  // Apply search filter (search in both email and name)
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

  if (error) {
    console.error('[Admin Users] Error fetching users:', error);
    return { users: [], total: 0, page, pageSize, totalPages: 0 };
  }

  // Ensure all users have email (fetch from auth if missing)
  const usersWithEmail = await Promise.all(
    (data ?? []).map(async (user) => {
      if (!user.email) {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
          return { ...user, email: authUser?.user?.email ?? 'unknown' };
        } catch {
          return { ...user, email: 'unknown' };
        }
      }
      return user;
    })
  );

  return {
    users: usersWithEmail as AdminUser[],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  // Verify admin access
  const admin = await verifySuperAdmin();
  if (!admin) {
    return null;
  }

  const supabase = createAdminClient();

  const [userResult, teamsResult, promptsResult, authResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, name, is_disabled, is_super_admin, last_active_at, created_at')
      .eq('id', userId)
      .is('deleted_at', null)
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
    supabase.auth.admin.getUserById(userId),
  ]);

  if (userResult.error) {
    console.error('[Admin Users] Error fetching user:', userResult.error);
    return null;
  }

  // Get email from auth if not in users table
  const email = userResult.data.email ?? authResult.data?.user?.email ?? '';

  return {
    ...userResult.data,
    email,
    teams: (teamsResult.data ?? []).map((tm) => {
      // Supabase returns team as an array from join, get first element
      const teamData = Array.isArray(tm.team) ? tm.team[0] : tm.team;
      return {
        role: tm.role,
        team: teamData as { id: string; name: string },
      };
    }),
    promptsCount: promptsResult.count ?? 0,
  };
}

// ============================================
// USER ACTIONS
// ============================================

export async function disableUser(userId: string): Promise<ActionResult> {
  // Verify caller is super admin
  const admin = await verifySuperAdmin();
  if (!admin) {
    return { error: { code: 'FORBIDDEN', message: 'Super admin access required' } };
  }

  // Prevent disabling self
  if (userId === admin.adminId) {
    return { error: { code: 'INVALID_ACTION', message: 'Cannot disable your own account' } };
  }

  const supabase = createAdminClient();

  // Check if user exists and is not already disabled
  const { data: existingUser } = await supabase
    .from('users')
    .select('is_disabled')
    .eq('id', userId)
    .single();

  if (!existingUser) {
    return { error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  if (existingUser.is_disabled) {
    return { error: { code: 'ALREADY_DISABLED', message: 'User is already disabled' } };
  }

  // Update users table
  const { error: dbError } = await supabase
    .from('users')
    .update({ is_disabled: true })
    .eq('id', userId);

  if (dbError) {
    console.error('[Admin Users] DB error disabling user:', dbError);
    return { error: { code: 'DB_ERROR', message: dbError.message } };
  }

  // Disable in Supabase Auth (ban the user)
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: '876000h', // ~100 years = effectively permanent
  });

  if (authError) {
    console.error('[Admin Users] Auth error banning user:', authError);
    // Rollback DB change
    await supabase.from('users').update({ is_disabled: false }).eq('id', userId);
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

export async function enableUser(userId: string): Promise<ActionResult> {
  // Verify caller is super admin
  const admin = await verifySuperAdmin();
  if (!admin) {
    return { error: { code: 'FORBIDDEN', message: 'Super admin access required' } };
  }

  const supabase = createAdminClient();

  // Check if user exists and is disabled
  const { data: existingUser } = await supabase
    .from('users')
    .select('is_disabled')
    .eq('id', userId)
    .single();

  if (!existingUser) {
    return { error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  if (!existingUser.is_disabled) {
    return { error: { code: 'ALREADY_ENABLED', message: 'User is already enabled' } };
  }

  // Update users table
  const { error: dbError } = await supabase
    .from('users')
    .update({ is_disabled: false })
    .eq('id', userId);

  if (dbError) {
    console.error('[Admin Users] DB error enabling user:', dbError);
    return { error: { code: 'DB_ERROR', message: dbError.message } };
  }

  // Re-enable in Supabase Auth (unban the user)
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  });

  if (authError) {
    console.error('[Admin Users] Auth error unbanning user:', authError);
    // Rollback DB change
    await supabase.from('users').update({ is_disabled: true }).eq('id', userId);
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

export async function deleteUser(userId: string, confirmEmail: string): Promise<ActionResult> {
  // Verify caller is super admin
  const admin = await verifySuperAdmin();
  if (!admin) {
    return { error: { code: 'FORBIDDEN', message: 'Super admin access required' } };
  }

  // Prevent deleting self
  if (userId === admin.adminId) {
    return { error: { code: 'INVALID_ACTION', message: 'Cannot delete your own account' } };
  }

  const supabase = createAdminClient();

  // Get user to verify email and get original data for audit
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  const userEmail = user?.email ?? authUser?.user?.email;

  if (!userEmail) {
    return { error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  // Verify email matches for extra confirmation
  if (userEmail !== confirmEmail) {
    return { error: { code: 'EMAIL_MISMATCH', message: 'Email confirmation does not match' } };
  }

  // Anonymize user data (soft delete)
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
    console.error('[Admin Users] DB error anonymizing user:', dbError);
    return { error: { code: 'DB_ERROR', message: dbError.message } };
  }

  // Delete from Supabase Auth
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) {
    console.error('[Admin Users] Auth error deleting user:', authError);
    // Note: We don't rollback the anonymization since the user data
    // should remain anonymized even if auth deletion fails
    return { error: { code: 'AUTH_ERROR', message: authError.message } };
  }

  // Create audit log entry
  await createAuditLog({
    adminId: admin.adminId,
    action: 'delete_user',
    targetUserId: userId,
    details: {
      originalEmail: userEmail,
      anonymizedEmail,
    },
  });

  revalidatePath('/admin/users');

  return { data: { success: true } };
}
