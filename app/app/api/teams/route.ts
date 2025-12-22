import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createTeamSchema } from '@/lib/validations/team';
import { ZodError } from 'zod';

export async function POST(request: Request) {
  try {
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
    const validated = createTeamSchema.parse(body);

    const { data, error } = await supabase.rpc('create_team_with_admin', {
      team_name: validated.name,
      team_description: validated.description || null,
    });

    if (error) {
      console.error('[API] teams POST: error creating team', error);
      return NextResponse.json(
        { error: { code: 'TEAM_CREATION_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { team: data } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const zodError = error as ZodError & { issues?: Array<{ message: string }>; errors?: Array<{ message: string }> };
      const firstError = zodError.issues?.[0] || zodError.errors?.[0];
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: firstError?.message || 'Validation failed' } },
        { status: 400 }
      );
    }
    console.error('[API] teams POST: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
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

    const { data: teams, error } = await supabase
      .from('team_members')
      .select(
        `
        role,
        team:teams(id, name, description, created_at)
      `
      )
      .eq('user_id', user.id);

    if (error) {
      console.error('[API] teams GET: error fetching teams', error);
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    const formattedTeams = teams.map((item) => ({
      ...item.team,
      role: item.role,
    }));

    return NextResponse.json({ data: { teams: formattedTeams } });
  } catch (error) {
    console.error('[API] teams GET: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
