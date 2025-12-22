import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/lib/utils/uuid';

/**
 * API endpoint to remove super admin status from a user.
 * Only available in development/test environments.
 * Requires a secret to prevent unauthorized access.
 *
 * M42 Fix: Added self-demotion protection to prevent admins from
 * removing their own super admin status.
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: { code: 'NOT_ALLOWED', message: 'Not allowed in production' } },
      { status: 403 }
    );
  }

  try {
    const { userId, secret } = await request.json();

    // SECURITY: Require ADMIN_SECRET to be explicitly configured
    // No fallback - fail if not set
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret) {
      console.error('[Admin] ADMIN_SECRET environment variable is not configured');
      return NextResponse.json(
        { error: { code: 'NOT_CONFIGURED', message: 'Admin secret not configured' } },
        { status: 500 }
      );
    }

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid secret' } },
        { status: 401 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'User ID required' } },
        { status: 400 }
      );
    }

    if (!isValidUuid(userId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'User ID must be a valid UUID' } },
        { status: 400 }
      );
    }

    // M42 Fix: Check if the current user is trying to remove their own admin status
    const supabaseClient = await createClient();
    const { data: { user: currentUser } } = await supabaseClient.auth.getUser();

    if (currentUser && currentUser.id === userId) {
      console.warn(`[Admin] User ${userId} attempted to remove their own super admin status`);
      return NextResponse.json(
        { error: { code: 'SELF_DEMOTION', message: 'Cannot remove your own super admin status' } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Update user to remove super admin
    const { error } = await supabase
      .from('users')
      .update({ is_super_admin: false })
      .eq('id', userId);

    if (error) {
      console.error('[Admin] Error removing super admin:', error.message);
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Failed to update user status' } },
        { status: 500 }
      );
    }

    console.log(`[Admin] User ${userId} is no longer a super admin`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An error occurred while processing your request' } },
      { status: 500 }
    );
  }
}
