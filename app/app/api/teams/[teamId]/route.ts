import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateTeamSchema } from '@/lib/validations/team';
import { isValidUuid } from '@/lib/utils/uuid';
import { ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

// GET - Fetch team details
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

    // Fetch team details
    const { data: team, error } = await supabase
      .from('teams')
      .select('id, name, description, created_at')
      .eq('id', teamId)
      .single();

    if (error || !team) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Team not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { team, role: membership.role } });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

// PATCH - Update team settings
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

    // Check if user is admin of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only team admins can update team settings' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateTeamSchema.parse(body);

    // Update team (validation schema already sanitizes inputs)
    const { data: team, error } = await supabase
      .from('teams')
      .update({
        name: validated.name,
        description: validated.description,
      })
      .eq('id', teamId)
      .select('id, name, description, created_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Failed to update team' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { team } });
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
