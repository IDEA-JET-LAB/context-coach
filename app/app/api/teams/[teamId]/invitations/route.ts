import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { inviteEmailSchema } from '@/lib/validations/invitation';
import { parseInvitationError, generateInviteUrl } from '@/lib/utils/invitation';
import { sendInvitationEmail } from '@/lib/services/email';
import { ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

// GET - List pending invitations for a team
export async function GET(request: Request, { params }: RouteParams) {
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

    // Check if user is admin of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only team admins can view invitations' } },
        { status: 403 }
      );
    }

    // Fetch pending invitations with inviter info
    const { data: invitations, error } = await supabase
      .from('team_invitations')
      .select(`
        id,
        email,
        status,
        created_at,
        expires_at,
        invited_by
      `)
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API] teams/invitations GET: error fetching invitations', error);
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { invitations } });
  } catch (error) {
    console.error('[API] teams/invitations GET: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

// POST - Create a new invitation
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

    const body = await request.json();
    const validated = inviteEmailSchema.parse(body);

    // Get team info for email
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json(
        { error: { code: 'TEAM_NOT_FOUND', message: 'Team not found' } },
        { status: 404 }
      );
    }

    // Create invitation using RPC function
    const { data: invitation, error } = await supabase.rpc('invite_team_member', {
      p_team_id: teamId,
      p_email: validated.email,
      p_inviter_id: user.id,
    });

    if (error) {
      console.error('[API] teams/invitations POST: error creating invitation', error);
      const parsedError = parseInvitationError(error.message);
      return NextResponse.json(
        { error: { code: parsedError.code, message: parsedError.message } },
        { status: 400 }
      );
    }

    // Send invitation email
    const inviteLink = generateInviteUrl(invitation.token);
    const emailResult = await sendInvitationEmail({
      email: validated.email,
      inviteLink,
      teamName: team.name,
      inviterName: user.email?.split('@')[0] || 'A team admin',
    });

    if (!emailResult.success) {
      console.error('[API] teams/invitations POST: failed to send email', emailResult.error);
      // Continue anyway - invitation was created, email delivery is secondary
    }

    // Return invitation without token (security)
    const { token: _token, ...safeInvitation } = invitation;

    return NextResponse.json(
      { data: { invitation: safeInvitation, emailSent: emailResult.success } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.issues?.[0];
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: firstError?.message || 'Validation failed' } },
        { status: 400 }
      );
    }
    console.error('[API] teams/invitations POST: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

// PATCH - Revoke an invitation
export async function PATCH(request: Request, { params }: RouteParams) {
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

    const body = await request.json();
    const invitationId = body.invitationId;

    if (!invitationId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invitation ID is required' } },
        { status: 400 }
      );
    }

    // Verify invitation belongs to this team
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('team_id')
      .eq('id', invitationId)
      .single();

    if (!existingInvitation || existingInvitation.team_id !== teamId) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Invitation not found' } },
        { status: 404 }
      );
    }

    // Revoke using RPC function
    const { data: invitation, error } = await supabase.rpc('revoke_team_invitation', {
      p_invitation_id: invitationId,
    });

    if (error) {
      console.error('[API] teams/invitations PATCH: error revoking invitation', error);
      const parsedError = parseInvitationError(error.message);
      return NextResponse.json(
        { error: { code: parsedError.code, message: parsedError.message } },
        { status: 400 }
      );
    }

    // Return invitation without token
    const { token: _token, ...safeInvitation } = invitation;

    return NextResponse.json({ data: { invitation: safeInvitation } });
  } catch (error) {
    console.error('[API] teams/invitations PATCH: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
