import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

// POST - Leave team
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check if user is member of the team
    const { data: membership } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: { code: 'NOT_MEMBER', message: 'You are not a member of this team' } },
        { status: 400 }
      );
    }

    // Check if user is last admin
    const { data: isLast } = await supabase.rpc('is_last_admin', {
      p_team_id: teamId,
      p_user_id: user.id,
    });

    if (isLast) {
      return NextResponse.json(
        { error: { code: 'LAST_ADMIN', message: 'You must assign another admin before leaving' } },
        { status: 400 }
      );
    }

    // Delete membership
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[API] teams/leave POST: error leaving team', error);
      return NextResponse.json(
        { error: { code: 'LEAVE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    // Get next available team
    const { data: nextMembership } = await supabase
      .from('team_members')
      .select(`
        team_id,
        teams(id, name)
      `)
      .eq('user_id', user.id)
      .limit(1)
      .single();

    // Update JWT claim to next team or clear it
    if (nextMembership) {
      await supabase.rpc('set_team_claim', { team_id: nextMembership.team_id });
    } else {
      await supabase.rpc('clear_team_claim');
    }

    const nextTeam = nextMembership?.teams as unknown as { id: string; name: string } | null;

    return NextResponse.json({
      data: {
        success: true,
        nextTeam: nextTeam || null,
      },
    });
  } catch (error) {
    console.error('[API] teams/leave POST: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
