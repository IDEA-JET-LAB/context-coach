import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isValidUuid } from '@/lib/utils/uuid';
import { getOriginFromRequest } from '@/lib/utils/get-origin';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

interface CreateLinkInviteBody {
  maxUses?: number;
  expiresDays?: number;
}

// POST - Create a new invite link
export async function POST(request: Request, { params }: RouteParams) {
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

    // Check if user is admin of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only team admins can create invite links' } },
        { status: 403 }
      );
    }

    // Parse body with defaults
    let body: CreateLinkInviteBody = {};
    try {
      body = await request.json();
    } catch {
      // Use defaults if no body
    }

    const maxUses = body.maxUses ?? 10;
    const expiresDays = body.expiresDays ?? 7;

    // Validate parameters
    if (maxUses < 1 || maxUses > 1000) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'maxUses must be between 1 and 1000' } },
        { status: 400 }
      );
    }

    if (expiresDays < 1 || expiresDays > 30) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'expiresDays must be between 1 and 30' } },
        { status: 400 }
      );
    }

    // Create link invitation using RPC function
    const { data: invitation, error } = await supabase.rpc('create_link_invite', {
      p_team_id: teamId,
      p_inviter_id: user.id,
      p_max_uses: maxUses,
      p_expires_days: expiresDays,
    });

    if (error) {
      console.error('[Create Link Invite] Error:', error);

      // Parse error message for known error codes
      if (error.message.includes('FORBIDDEN')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Only team admins can create invite links' } },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: { code: 'CREATE_FAILED', message: 'Failed to create invite link' } },
        { status: 400 }
      );
    }

    // Build the invite URL
    const origin = getOriginFromRequest(request);
    const inviteUrl = `${origin}/join/${invitation.invite_token}`;

    return NextResponse.json(
      {
        data: {
          id: invitation.id,
          token: invitation.invite_token,
          url: inviteUrl,
          expires_at: invitation.expires_at,
          max_uses: invitation.max_uses,
          current_uses: invitation.current_uses,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Create Link Invite] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

// GET - List link invites for a team
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

    // Check if user is admin of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only team admins can view invite links' } },
        { status: 403 }
      );
    }

    // Fetch link invitations
    const { data: invitations, error } = await supabase
      .from('team_invitations')
      .select(`
        id,
        invite_token,
        status,
        created_at,
        expires_at,
        max_uses,
        current_uses
      `)
      .eq('team_id', teamId)
      .eq('invite_type', 'link')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[List Link Invites] Error:', error);
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: 'Failed to fetch invite links' } },
        { status: 400 }
      );
    }

    // Build URLs for each invitation
    const origin = getOriginFromRequest(request);
    const invitationsWithUrls = invitations.map((inv) => ({
      ...inv,
      url: `${origin}/join/${inv.invite_token}`,
    }));

    return NextResponse.json({ data: { invitations: invitationsWithUrls } });
  } catch (error) {
    console.error('[List Link Invites] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

// DELETE - Revoke a link invite
export async function DELETE(request: Request, { params }: RouteParams) {
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

    const body = await request.json();
    const invitationId = body.invitationId;

    if (!invitationId || !isValidUuid(invitationId)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Valid invitation ID is required' } },
        { status: 400 }
      );
    }

    // Verify invitation belongs to this team
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('team_id, invite_type')
      .eq('id', invitationId)
      .single();

    if (!existingInvitation || existingInvitation.team_id !== teamId) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Invite link not found' } },
        { status: 404 }
      );
    }

    if (existingInvitation.invite_type !== 'link') {
      return NextResponse.json(
        { error: { code: 'INVALID_TYPE', message: 'This is not a link invitation' } },
        { status: 400 }
      );
    }

    // Revoke using RPC function
    const { data: invitation, error } = await supabase.rpc('revoke_link_invite', {
      p_invitation_id: invitationId,
    });

    if (error) {
      console.error('[Revoke Link Invite] Error:', error);

      if (error.message.includes('FORBIDDEN')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Only team admins can revoke invite links' } },
          { status: 403 }
        );
      }

      if (error.message.includes('INVALID_INVITATION')) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Invite link not found or already revoked' } },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: { code: 'REVOKE_FAILED', message: 'Failed to revoke invite link' } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: {
        id: invitation.id,
        status: invitation.status,
      },
    });
  } catch (error) {
    console.error('[Revoke Link Invite] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
