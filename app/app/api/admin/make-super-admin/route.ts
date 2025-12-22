import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * API endpoint to make a user a super admin.
 * Only available in development/test environments.
 * Requires a secret to prevent unauthorized access.
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

    // Basic secret check for test environments
    const expectedSecret = process.env.ADMIN_SECRET || 'test-admin-secret';
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

    const supabase = createAdminClient();

    // Update user to be super admin
    const { error } = await supabase
      .from('users')
      .update({ is_super_admin: true })
      .eq('id', userId);

    if (error) {
      console.error('[Admin] Error making user super admin:', error.message);
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: error.message } },
        { status: 500 }
      );
    }

    console.log(`[Admin] User ${userId} is now a super admin`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
