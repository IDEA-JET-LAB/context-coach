import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { updateProjectSchema } from '@/lib/validations/project';
import { ZodError } from 'zod';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
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

    // Fetch project (RLS will ensure user has access)
    const { data: project, error } = await supabase
      .from('projects')
      .select('id, team_id, name, description, api_key_prefix, created_at, created_by, is_archived')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('[API] project GET: error fetching project', error);
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { project } });
  } catch (error) {
    console.error('[API] project GET: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
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
    const validated = updateProjectSchema.parse(body);

    // Get project to verify team access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('team_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Check if user is admin
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can update projects' } },
        { status: 403 }
      );
    }

    // Update project
    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update({
        name: validated.name.trim(),
        description: validated.description?.trim() || null,
      })
      .eq('id', projectId)
      .select('id, team_id, name, description, api_key_prefix, created_at, created_by, is_archived')
      .single();

    if (updateError) {
      console.error('[API] project PATCH: error updating project', updateError);
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: updateError.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { project: updated } });
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.issues?.[0];
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: firstError?.message || 'Validation failed' } },
        { status: 400 }
      );
    }
    console.error('[API] project PATCH: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
