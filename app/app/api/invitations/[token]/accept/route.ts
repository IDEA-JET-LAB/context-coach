import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { parseInvitationError } from '@/lib/utils/invitation';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST - Accept an invitation
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
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

    // Accept invitation using RPC function
    const { data: team, error } = await supabase.rpc('accept_team_invitation', {
      p_token: token,
      p_user_id: user.id,
    });

    if (error) {
      console.error('[API] invitations/accept POST: error accepting invitation', error);
      const parsedError = parseInvitationError(error.message);

      const statusMap: Record<string, number> = {
        INVALID_TOKEN: 400,
        EMAIL_MISMATCH: 403,
        ALREADY_MEMBER: 409,
      };

      return NextResponse.json(
        { error: { code: parsedError.code, message: parsedError.message } },
        { status: statusMap[parsedError.code] || 400 }
      );
    }

    // Set team claim in JWT
    await supabase.rpc('set_team_claim', { team_id: team.id });

    return NextResponse.json({ data: { team } });
  } catch (error) {
    console.error('[API] invitations/accept POST: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
