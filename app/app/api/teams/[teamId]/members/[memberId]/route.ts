import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ teamId: string; memberId: string }>;
}

const updateRoleSchema = z.object({
  role: z.enum(['member', 'admin']),
});

// PATCH - Update member role
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { teamId, memberId } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const validated = updateRoleSchema.parse(body);

    // Check if current user is admin
    const { data: currentMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!currentMember || currentMember.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can change roles' } },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('id, user_id, role')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Check if demoting last admin
    if (targetMember.role === 'admin' && validated.role === 'member') {
      const { data: isLast } = await supabase.rpc('is_last_admin', {
        p_team_id: teamId,
        p_user_id: targetMember.user_id,
      });

      if (isLast) {
        return NextResponse.json(
          { error: { code: 'LAST_ADMIN', message: 'You must assign another admin before leaving' } },
          { status: 400 }
        );
      }
    }

    // Update role
    const { data: updated, error } = await supabase
      .from('team_members')
      .update({ role: validated.role })
      .eq('id', memberId)
      .select('id, user_id, role, joined_at')
      .single();

    if (error) {
      console.error('[API] teams/members PATCH: error updating role', error);
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { member: updated } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues?.[0];
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: firstError?.message || 'Validation failed' } },
        { status: 400 }
      );
    }
    console.error('[API] teams/members PATCH: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

// DELETE - Remove member from team
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { teamId, memberId } = await params;
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

    // Check if current user is admin
    const { data: currentMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!currentMember || currentMember.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can remove members' } },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('id, user_id, role')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Check if removing last admin
    if (targetMember.role === 'admin') {
      const { data: isLast } = await supabase.rpc('is_last_admin', {
        p_team_id: teamId,
        p_user_id: targetMember.user_id,
      });

      if (isLast) {
        return NextResponse.json(
          { error: { code: 'LAST_ADMIN', message: 'Cannot remove the last admin' } },
          { status: 400 }
        );
      }
    }

    // Delete member
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      console.error('[API] teams/members DELETE: error removing member', error);
      return NextResponse.json(
        { error: { code: 'DELETE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('[API] teams/members DELETE: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
