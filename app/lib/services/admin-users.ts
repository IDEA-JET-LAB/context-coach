'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createHash } from 'crypto';
import { getRequestContext } from '@/lib/utils/request-context';

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

/**
 * M40 Fix: Maximum pagination limits to prevent memory issues.
 */
const PAGINATION_LIMITS = {
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE: 10000, // Reasonable upper bound for page number
} as const;

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

/**
 * Comprehensive audit log actions for admin operations.
 * M37 Fix: Ensure all admin actions are logged to audit trail.
 */
type AuditAction =
  | 'disable_user'
  | 'enable_user'
  | 'delete_user'
  | 'view_user_list'
  | 'view_user_detail'
  | 'grant_super_admin'
  | 'revoke_super_admin'
  | 'bulk_retry_analysis'
  | 'retry_analysis'
  | 'view_teams'
  | 'view_system_health'
  | 'view_admin_stats';

interface AuditLogEntry {
  adminId: string;
  action: AuditAction;
  targetUserId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Request context for audit logging - H10 fix
 * Callers should pass IP and user agent when available
 */
export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase.from('admin_audit_logs').insert({
      admin_id: entry.adminId,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      details: entry.details,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
    });

    if (error) {
      // Log but don't fail the operation - audit logging should not block admin actions
      console.error('[Admin Audit] Failed to create audit log:', error.message, entry);
    }
  } catch (err) {
    // Catch any unexpected errors to ensure audit failures don't break admin operations
    console.error('[Admin Audit] Unexpected error creating audit log:', err);
  }
}

/**
 * M37 Fix: Exported function to create audit logs from other modules.
 * This allows API routes and other services to log admin actions.
 */
export async function logAdminAction(
  adminId: string,
  action: AuditAction,
  details?: Record<string, unknown>,
  targetUserId?: string,
  context?: RequestContext
): Promise<void> {
  const requestContext = context ?? await getRequestContext();
  await createAuditLog({
    adminId,
    action,
    targetUserId,
    details,
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
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

  // M40 Fix: Enforce pagination limits to prevent memory issues
  const sanitizedPage = Math.max(1, Math.min(page, PAGINATION_LIMITS.MAX_PAGE));
  const sanitizedPageSize = Math.max(1, Math.min(pageSize, PAGINATION_LIMITS.MAX_PAGE_SIZE));

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

  // Apply pagination with sanitized values
  const from = (sanitizedPage - 1) * sanitizedPageSize;
  const to = from + sanitizedPageSize - 1;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[Admin Users] Error fetching users:', error);
    return { users: [], total: 0, page: sanitizedPage, pageSize: sanitizedPageSize, totalPages: 0 };
  }

  // Ensure all users have email (fetch from auth if missing)
  // NOTE: Email desync possible - users.email may be outdated if user changes email in auth.
  // This fallback ensures we display current email from auth.users table.
  // Future improvement: Add database trigger to sync email changes automatically.
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
    page: sanitizedPage,
    pageSize: sanitizedPageSize,
    totalPages: Math.ceil((count ?? 0) / sanitizedPageSize),
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
  // NOTE: Email desync possible - users.email may be outdated if user changes email in auth.
  // This fallback ensures we always display current email from auth.users table.
  // Future improvement: Add trigger to sync email changes from auth.users to public.users.
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

/**
 * Disable a user account
 *
 * H9 Fix: Uses optimistic locking with updated_at timestamp to prevent TOCTOU race conditions.
 * The update query includes a WHERE clause checking the expected state, and we verify
 * the row was actually modified before proceeding.
 *
 * H10 Fix: Accepts optional request context for IP/user agent in audit logs.
 */
export async function disableUser(userId: string, context?: RequestContext): Promise<ActionResult> {
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

  // H9 Fix: Use optimistic locking - atomically update only if is_disabled=false
  // This prevents TOCTOU race conditions by making the check-and-update atomic
  const { data: updatedRows, error: dbError } = await supabase
    .from('users')
    .update({ is_disabled: true })
    .eq('id', userId)
    .eq('is_disabled', false) // Optimistic lock: only update if not already disabled
    .select('id');

  if (dbError) {
    console.error('[Admin Users] DB error disabling user:', dbError);
    return { error: { code: 'DB_ERROR', message: dbError.message } };
  }

  // Check if any row was actually updated
  if (!updatedRows || updatedRows.length === 0) {
    // Either user doesn't exist or was already disabled (possibly by another admin)
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
    // Shouldn't reach here, but handle edge case
    return { error: { code: 'CONFLICT', message: 'User state changed during operation. Please retry.' } };
  }

  // Disable in Supabase Auth (ban the user)
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: '876000h', // ~100 years = effectively permanent
  });

  if (authError) {
    console.error('[Admin Users] Auth error banning user:', authError);
    // H9 Fix: Use atomic rollback with optimistic lock to prevent overwriting concurrent changes
    // Only rollback if the user is still in the disabled state we set
    const { data: rollbackResult } = await supabase
      .from('users')
      .update({ is_disabled: false })
      .eq('id', userId)
      .eq('is_disabled', true) // Only rollback if still disabled (our change)
      .select('id');

    if (!rollbackResult || rollbackResult.length === 0) {
      console.warn('[Admin Users] Rollback skipped - user state was modified by another operation');
    }
    return { error: { code: 'AUTH_ERROR', message: authError.message } };
  }

  // Create audit log entry with H10 fix: include IP and user agent
  // Auto-extract from request headers if not explicitly provided
  const requestContext = context ?? await getRequestContext();
  await createAuditLog({
    adminId: admin.adminId,
    action: 'disable_user',
    targetUserId: userId,
    details: { reason: 'Admin disabled account' },
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);

  return { data: { success: true } };
}

/**
 * Enable a disabled user account
 *
 * H9 Fix: Uses optimistic locking to prevent TOCTOU race conditions.
 * H10 Fix: Accepts optional request context for IP/user agent in audit logs.
 */
export async function enableUser(userId: string, context?: RequestContext): Promise<ActionResult> {
  // Verify caller is super admin
  const admin = await verifySuperAdmin();
  if (!admin) {
    return { error: { code: 'FORBIDDEN', message: 'Super admin access required' } };
  }

  const supabase = createAdminClient();

  // H9 Fix: Use optimistic locking - atomically update only if is_disabled=true
  const { data: updatedRows, error: dbError } = await supabase
    .from('users')
    .update({ is_disabled: false })
    .eq('id', userId)
    .eq('is_disabled', true) // Optimistic lock: only update if currently disabled
    .select('id');

  if (dbError) {
    console.error('[Admin Users] DB error enabling user:', dbError);
    return { error: { code: 'DB_ERROR', message: dbError.message } };
  }

  // Check if any row was actually updated
  if (!updatedRows || updatedRows.length === 0) {
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
    return { error: { code: 'CONFLICT', message: 'User state changed during operation. Please retry.' } };
  }

  // Re-enable in Supabase Auth (unban the user)
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  });

  if (authError) {
    console.error('[Admin Users] Auth error unbanning user:', authError);
    // H9 Fix: Use atomic rollback with optimistic lock
    const { data: rollbackResult } = await supabase
      .from('users')
      .update({ is_disabled: true })
      .eq('id', userId)
      .eq('is_disabled', false) // Only rollback if still enabled (our change)
      .select('id');

    if (!rollbackResult || rollbackResult.length === 0) {
      console.warn('[Admin Users] Rollback skipped - user state was modified by another operation');
    }
    return { error: { code: 'AUTH_ERROR', message: authError.message } };
  }

  // Create audit log entry with H10 fix
  // Auto-extract from request headers if not explicitly provided
  const requestContext = context ?? await getRequestContext();
  await createAuditLog({
    adminId: admin.adminId,
    action: 'enable_user',
    targetUserId: userId,
    details: { reason: 'Admin re-enabled account' },
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);

  return { data: { success: true } };
}

/**
 * Delete (anonymize) a user account
 *
 * H10 Fix: Accepts optional request context for IP/user agent in audit logs.
 */
export async function deleteUser(userId: string, confirmEmail: string, context?: RequestContext): Promise<ActionResult> {
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

  // Create audit log entry with H10 fix
  // Auto-extract from request headers if not explicitly provided
  const requestContext = context ?? await getRequestContext();
  await createAuditLog({
    adminId: admin.adminId,
    action: 'delete_user',
    targetUserId: userId,
    details: {
      originalEmail: userEmail,
      anonymizedEmail,
    },
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });

  revalidatePath('/admin/users');

  return { data: { success: true } };
}
