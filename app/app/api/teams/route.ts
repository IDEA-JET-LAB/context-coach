import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { createTeamSchema } from '@/lib/validations/team';
import { ZodError } from 'zod';

/**
 * Verify VS Code access token and get user ID.
 */
async function verifyVSCodeToken(
  accessToken: string,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const { data: tokenRecord, error } = await adminClient
    .from('vscode_tokens')
    .select('user_id, access_token_expires_at, revoked_at')
    .eq('access_token', accessToken)
    .single();

  if (error || !tokenRecord) return null;
  if (tokenRecord.revoked_at) return null;
  if (new Date(tokenRecord.access_token_expires_at) < new Date()) return null;

  return tokenRecord.user_id;
}

export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { error: { code: 'TEAM_CREATION_FAILED', message: 'Failed to create team' } },
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
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    let userId: string | null = null;

    // Check for VS Code access token in Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7);
      userId = await verifyVSCodeToken(accessToken, adminClient);
    }

    // If no VS Code token, try Supabase session auth
    if (!userId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { data: teams, error } = await adminClient
      .from('team_members')
      .select(
        `
        role,
        team:teams(id, name, description, created_at)
      `
      )
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: 'Failed to fetch teams' } },
        { status: 400 }
      );
    }

    const formattedTeams = teams.map((item) => ({
      ...item.team,
      role: item.role,
    }));

    return NextResponse.json({ data: { teams: formattedTeams } });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
