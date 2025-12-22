import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isValidUuid } from '@/lib/utils/uuid';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;

    // Validate UUID format
    if (!isValidUuid(projectId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'Invalid project ID format' } },
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

    // Get project to verify team access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('team_id, is_archived')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Check if already archived
    if (project.is_archived) {
      return NextResponse.json(
        { error: { code: 'ALREADY_ARCHIVED', message: 'Project is already archived' } },
        { status: 400 }
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
        { error: { code: 'FORBIDDEN', message: 'Only admins can archive projects' } },
        { status: 403 }
      );
    }

    // Archive project (API key validation should check is_archived)
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        is_archived: true,
      })
      .eq('id', projectId);

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'ARCHIVE_FAILED', message: 'Failed to archive project' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
