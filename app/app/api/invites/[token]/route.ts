import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isValidUuid } from '@/lib/utils/uuid';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET - Get invite link details (public - no auth required for viewing)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    // Validate UUID format for invite token
    if (!isValidUuid(token)) {
      return NextResponse.json(
        {
          error: { code: 'INVALID_TOKEN', message: 'Invalid invitation link' },
          data: { valid: false, reason: 'invalid_token' },
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get invite details using RPC function
    const { data: inviteData, error } = await supabase.rpc('get_link_invite_by_token', {
      p_invite_token: token,
    });

    if (error) {
      console.error('[Get Link Invite] Error:', error);
      return NextResponse.json(
        {
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch invitation' },
          data: { valid: false, reason: 'fetch_error' },
        },
        { status: 400 }
      );
    }

    // Check if invitation exists
    if (!inviteData || inviteData.length === 0) {
      return NextResponse.json(
        {
          error: { code: 'NOT_FOUND', message: 'Invitation not found' },
          data: { valid: false, reason: 'not_found' },
        },
        { status: 404 }
      );
    }

    const invite = inviteData[0];

    // Check if invitation is still pending
    if (invite.status !== 'pending') {
      return NextResponse.json({
        data: {
          valid: false,
          reason: invite.status === 'revoked' ? 'revoked' : 'used',
          team_name: invite.team_name,
        },
      });
    }

    // Check if invitation has expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({
        data: {
          valid: false,
          reason: 'expired',
          team_name: invite.team_name,
          expires_at: invite.expires_at,
        },
      });
    }

    // Check if max uses reached
    if (invite.max_uses !== null && invite.current_uses >= invite.max_uses) {
      return NextResponse.json({
        data: {
          valid: false,
          reason: 'max_uses',
          team_name: invite.team_name,
        },
      });
    }

    // Get current user (if logged in) to check if already a member
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let alreadyMember = false;
    if (user) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', invite.team_id)
        .eq('user_id', user.id)
        .single();

      alreadyMember = !!membership;
    }

    return NextResponse.json({
      data: {
        valid: true,
        team_name: invite.team_name,
        invited_by: invite.invited_by_name,
        expires_at: invite.expires_at,
        max_uses: invite.max_uses,
        current_uses: invite.current_uses,
        already_member: alreadyMember,
        is_authenticated: !!user,
      },
    });
  } catch (error) {
    console.error('[Get Link Invite] Unexpected error:', error);
    return NextResponse.json(
      {
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        data: { valid: false, reason: 'error' },
      },
      { status: 500 }
    );
  }
}

// POST - Accept invite link and join team
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    // Validate UUID format for invite token
    if (!isValidUuid(token)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid invitation link' } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'You must be logged in to join a team' } },
        { status: 401 }
      );
    }

    // Accept the link invite using RPC function
    const { data: team, error } = await supabase.rpc('accept_link_invite', {
      p_invite_token: token,
      p_user_id: user.id,
    });

    if (error) {
      console.error('[Accept Link Invite] Error:', error);

      // Parse error message for known error codes
      if (error.message.includes('INVALID_TOKEN')) {
        return NextResponse.json(
          { error: { code: 'INVALID_TOKEN', message: 'This invitation link is no longer valid' } },
          { status: 400 }
        );
      }

      if (error.message.includes('MAX_USES_REACHED')) {
        return NextResponse.json(
          { error: { code: 'MAX_USES_REACHED', message: 'This invitation link has reached its maximum uses' } },
          { status: 400 }
        );
      }

      if (error.message.includes('ALREADY_MEMBER')) {
        return NextResponse.json(
          { error: { code: 'ALREADY_MEMBER', message: 'You are already a member of this team' } },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: { code: 'JOIN_FAILED', message: 'Failed to join team' } },
        { status: 400 }
      );
    }

    // Update user's app_metadata with new team_id
    // This is done via the admin API in a real scenario, but for now we'll return success
    // and let the client handle team switching

    return NextResponse.json({
      data: {
        team: {
          id: team.id,
          name: team.name,
        },
        message: `Welcome to ${team.name}!`,
      },
    });
  } catch (error) {
    console.error('[Accept Link Invite] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
