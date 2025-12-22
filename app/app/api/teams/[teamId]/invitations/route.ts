import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { inviteEmailSchema } from '@/lib/validations/invitation';
import { parseInvitationError, generateInviteUrl } from '@/lib/utils/invitation';
import { sendInvitationEmail } from '@/lib/services/email';
import { isValidUuid } from '@/lib/utils/uuid';
import { ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

// GET - List pending invitations for a team
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
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: 'Failed to fetch invitations' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { invitations } });
  } catch (error) {
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

    // Get inviter's display name (prefer name from users table, fall back to email username)
    const { data: inviterProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    // Use display name if available, otherwise use email prefix
    // This avoids exposing the full email address to invitees
    const inviterDisplayName = inviterProfile?.name || user.email?.split('@')[0] || 'A team admin';

    // Create invitation using RPC function
    const { data: invitation, error } = await supabase.rpc('invite_team_member', {
      p_team_id: teamId,
      p_email: validated.email,
      p_inviter_id: user.id,
    });

    if (error) {
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
      inviterName: inviterDisplayName,
    });

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

    if (!invitationId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invitation ID is required' } },
        { status: 400 }
      );
    }

    // Validate UUID format
    if (!isValidUuid(invitationId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'Invalid invitation ID format' } },
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
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
