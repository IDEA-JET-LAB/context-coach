import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Fix sessions that are missing team_id
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Get sessions without team_id
  const { data: sessions, error: fetchError } = await supabase
    .from('sessions')
    .select('id, user_id, team_id');

  // Filter for null team_id
  const sessionsToFix = sessions?.filter(s => s.team_id === null) || [];

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (sessionsToFix.length === 0) {
    return NextResponse.json({ message: 'No sessions to fix', total: sessions?.length || 0 });
  }

  let fixed = 0;
  for (const session of sessionsToFix) {
    // Get user's team
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', session.user_id)
      .single();

    if (membership) {
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ team_id: membership.team_id })
        .eq('id', session.id);

      if (!updateError) {
        fixed++;
      }
    }
  }

  return NextResponse.json({
    message: `Fixed ${fixed} of ${sessionsToFix.length} sessions`,
    fixed,
    total: sessionsToFix.length,
  });
}
