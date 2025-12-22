import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Test endpoint to delete a user directly via Supabase Admin API.
 * Only available in development/test environments.
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
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Email required' } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Find user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('[Test] Error listing users:', listError.message);
      return NextResponse.json(
        { error: { code: 'LIST_FAILED', message: listError.message } },
        { status: 500 }
      );
    }

    const user = users.users.find((u) => u.email === email);

    if (!user) {
      // User not found - that's okay for cleanup
      return NextResponse.json({ success: true, message: 'User not found' });
    }

    // Delete user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[Test] Error deleting user:', deleteError.message);
      return NextResponse.json(
        { error: { code: 'DELETE_FAILED', message: deleteError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Test] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
