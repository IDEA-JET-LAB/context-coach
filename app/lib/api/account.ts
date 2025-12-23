'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkRateLimit, calculateRetryAfter } from '@/lib/rate-limit';

/**
 * Account deletion rate limiter.
 * Limit: 3 attempts per hour per user.
 * Purpose: Prevent abuse of account deletion endpoint.
 */
const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
  : null;

const accountDeletionRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      prefix: 'ratelimit:account-deletion',
    })
  : null;

export interface DeleteAccountResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
  retryAfter?: string;
}

/**
 * Checks if a user is the last admin of any team.
 * Returns an array of team names where the user is the sole admin.
 */
async function getTeamsWhereUserIsLastAdmin(userId: string): Promise<string[]> {
  const adminClient = createAdminClient();

  // Get all teams where the user is an admin
  const { data: adminMemberships } = await adminClient
    .from('team_members')
    .select('team_id, teams(id, name)')
    .eq('user_id', userId)
    .eq('role', 'admin');

  if (!adminMemberships || adminMemberships.length === 0) {
    return [];
  }

  const teamsWhereLastAdmin: string[] = [];

  // For each team where user is admin, check if they're the only admin
  for (const membership of adminMemberships) {
    const teamId = membership.team_id;

    // Count total admins in this team
    const { count } = await adminClient
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('role', 'admin');

    if (count === 1) {
      // User is the only admin
      const team = Array.isArray(membership.teams)
        ? membership.teams[0]
        : membership.teams;
      teamsWhereLastAdmin.push((team as { name: string })?.name || 'Unknown Team');
    }
  }

  return teamsWhereLastAdmin;
}

/**
 * Deletes the current user's account.
 *
 * This performs a complete account deletion:
 * 1. Validates user session and email confirmation
 * 2. Checks if user is last admin of any team (blocks if so)
 * 3. Deletes all user's prompts
 * 4. Removes user from all team memberships
 * 5. Deletes user profile from users table
 * 6. Deletes user from Supabase Auth
 *
 * Rate limited to 3 attempts per hour.
 *
 * @param confirmEmail - The user's email for confirmation
 */
export async function deleteAccount(confirmEmail: string): Promise<DeleteAccountResult> {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You must be logged in to delete your account' },
      };
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(accountDeletionRateLimit, user.id);
    if (!rateLimitResult.success) {
      const retryAfter = calculateRetryAfter(rateLimitResult.reset);
      console.warn(`[Account] Rate limit exceeded for account deletion by user ${user.id}`);
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many deletion attempts. Please try again in ${retryAfter} seconds.`,
        },
        retryAfter,
      };
    }

    // Verify email matches for confirmation
    if (user.email !== confirmEmail) {
      return {
        success: false,
        error: { code: 'EMAIL_MISMATCH', message: 'The email you entered does not match your account email' },
      };
    }

    // Check if user is last admin of any team
    const teamsWhereLastAdmin = await getTeamsWhereUserIsLastAdmin(user.id);
    if (teamsWhereLastAdmin.length > 0) {
      const teamList = teamsWhereLastAdmin.join(', ');
      return {
        success: false,
        error: {
          code: 'LAST_ADMIN',
          message: `You are the only admin of the following team(s): ${teamList}. Please assign another admin or delete these teams before deleting your account.`,
        },
      };
    }

    // Use admin client for deletions (bypasses RLS)
    const adminClient = createAdminClient();

    // Delete in order respecting FK constraints:
    // 1. Delete user's prompts
    const { error: promptsError } = await adminClient
      .from('prompts')
      .delete()
      .eq('user_id', user.id);

    if (promptsError) {
      console.error('[Account] Error deleting prompts:', promptsError);
      return {
        success: false,
        error: { code: 'DELETE_PROMPTS_FAILED', message: 'Failed to delete your prompts. Please try again.' },
      };
    }

    // 2. Delete team memberships
    const { error: membershipsError } = await adminClient
      .from('team_members')
      .delete()
      .eq('user_id', user.id);

    if (membershipsError) {
      console.error('[Account] Error deleting team memberships:', membershipsError);
      return {
        success: false,
        error: { code: 'DELETE_MEMBERSHIPS_FAILED', message: 'Failed to remove you from teams. Please try again.' },
      };
    }

    // 3. Delete user profile from users table
    const { error: userProfileError } = await adminClient
      .from('users')
      .delete()
      .eq('id', user.id);

    if (userProfileError) {
      console.error('[Account] Error deleting user profile:', userProfileError);
      return {
        success: false,
        error: { code: 'DELETE_PROFILE_FAILED', message: 'Failed to delete your profile. Please try again.' },
      };
    }

    // 4. Delete from Supabase Auth (this also invalidates all sessions)
    const { error: authError } = await adminClient.auth.admin.deleteUser(user.id);

    if (authError) {
      console.error('[Account] Error deleting auth user:', authError);
      // At this point, user data is deleted but auth remains
      // This is a partial state - log for manual cleanup
      console.error('[Account] MANUAL CLEANUP NEEDED: Auth user still exists:', user.id);
      return {
        success: false,
        error: { code: 'DELETE_AUTH_FAILED', message: 'Account partially deleted. Please contact support.' },
      };
    }

    console.log(`[Account] Successfully deleted account for user ${user.id}`);

    return { success: true };
  } catch (error) {
    console.error('[Account] Unexpected error deleting account:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' },
    };
  }
}
