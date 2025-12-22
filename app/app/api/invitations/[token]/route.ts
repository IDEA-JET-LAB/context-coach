import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET - Validate invitation token and get invitation details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    // Use RPC function to get invitation by token (bypasses RLS)
    const { data: invitations, error } = await supabase.rpc('get_invitation_by_token', {
      p_token: token,
    });

    if (error) {
      console.error('[API] invitations/[token] GET: error fetching invitation', error);
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: 'Failed to validate invitation' } },
        { status: 500 }
      );
    }

    const invitation = invitations?.[0];

    if (!invitation) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'This invitation link is invalid' } },
        { status: 404 }
      );
    }

    // Check status
    if (invitation.status === 'revoked') {
      return NextResponse.json(
        { error: { code: 'REVOKED', message: 'This invitation was revoked by the team admin' } },
        { status: 410 }
      );
    }

    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { error: { code: 'ALREADY_ACCEPTED', message: 'This invitation has already been accepted' } },
        { status: 410 }
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: { code: 'EXPIRED', message: 'This invitation has expired. Please request a new one.' } },
        { status: 410 }
      );
    }

    // Return safe invitation data
    return NextResponse.json({
      data: {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          teamName: invitation.team_name,
          expiresAt: invitation.expires_at,
        },
      },
    });
  } catch (error) {
    console.error('[API] invitations/[token] GET: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
