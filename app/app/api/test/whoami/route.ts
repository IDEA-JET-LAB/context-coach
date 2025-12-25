import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Debug endpoint to check current user session
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({
      authenticated: false,
      error: authError?.message || 'No user',
    });
  }

  // Get team membership
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id, role, teams(id, name)')
    .eq('user_id', user.id)
    .single();

  // Try to fetch sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, session_id, slug, team_id')
    .limit(5);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
    },
    teamMembership: membership,
    sessionsQuery: {
      count: sessions?.length || 0,
      error: sessionsError ? { code: sessionsError.code, message: sessionsError.message } : null,
      data: sessions,
    },
  });
}
