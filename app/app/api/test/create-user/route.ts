import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Test endpoint to create a user directly via Supabase Admin API.
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
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Email and password required' } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create user using admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for testing
    });

    if (error) {
      console.error('[Test] Error creating user:', error.message);
      return NextResponse.json(
        { error: { code: 'CREATE_FAILED', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ userId: data.user.id });
  } catch (error) {
    console.error('[Test] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
