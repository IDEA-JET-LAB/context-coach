import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isValidUuid } from '@/lib/utils/uuid';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

// GET - Fetch team members
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { teamId } = await params;

    // Validate UUID format
    if (!isValidUuid(teamId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'Invalid team ID format' } },
        { status: 400 }
      );
    }

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

    // Check if user is a member of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You are not a member of this team' } },
        { status: 403 }
      );
    }

    // Fetch team members with user profiles from public.users table
    // Use left join (remove !inner) to handle edge cases where profile might not exist yet
    const { data: members, error } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        user:users(id, name, avatar_url)
      `)
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: 'Failed to fetch team members' } },
        { status: 400 }
      );
    }

    // We also need to get email addresses from auth - use admin API or handle in client
    // For now, return what we have and let the client resolve additional info if needed
    const membersFormatted = members.map((member) => {
      const userInfo = member.user as unknown as { id: string; name: string | null; avatar_url: string | null };
      return {
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        name: userInfo?.name || null,
        avatar_url: userInfo?.avatar_url || null,
      };
    });

    return NextResponse.json({
      data: {
        members: membersFormatted,
        currentUserRole: membership.role,
        currentUserId: user.id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
