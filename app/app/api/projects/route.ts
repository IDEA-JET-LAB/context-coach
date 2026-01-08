import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createProjectSchema } from '@/lib/validations/project';
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/utils/api-key';
import { generateInstallToken, getApiEndpoint, TOKEN_EXPIRATION_HOURS } from '@/lib/utils/install-token';
import { encryptApiKey } from '@/lib/utils/encryption';
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

    // Get current team from session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const teamId = session?.user?.app_metadata?.team_id;

    if (!teamId) {
      return NextResponse.json(
        { error: { code: 'NO_TEAM', message: 'No team selected. Please select or create a team first.' } },
        { status: 400 }
      );
    }

    // Get team info and check membership
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json(
        { error: { code: 'TEAM_NOT_FOUND', message: 'Team not found' } },
        { status: 404 }
      );
    }

    // Check if user is admin of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You are not a member of this team' } },
        { status: 403 }
      );
    }

    if (membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only team admins can create projects' } },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validated = createProjectSchema.parse(body);

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);
    const apiKeyEncrypted = encryptApiKey(apiKey);

    // Create project
    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        team_id: teamId,
        name: validated.name,
        description: validated.description || null,
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
        api_key_encrypted: apiKeyEncrypted,
        created_by: user.id,
      })
      .select('id, team_id, name, description, api_key_prefix, created_at, created_by, is_archived')
      .single();

    if (createError) {
      return NextResponse.json(
        { error: { code: 'CREATE_FAILED', message: 'Failed to create project' } },
        { status: 400 }
      );
    }

    // Generate install token with all required fields
    // SECURITY: Token expiration is intentionally short to minimize exposure window
    const installToken = generateInstallToken({
      project_id: project.id,
      project_name: project.name,
      team_id: teamId,
      team_name: team.name,
      user_id: user.id,
      user_name: user.email?.split('@')[0] || 'User',
      api_key: apiKey,
      api_endpoint: getApiEndpoint(),
      expires_at: new Date(Date.now() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json(
      {
        data: {
          project,
          apiKey, // Only time this is returned!
          installToken,
          // Security warning for clients to display
          warning: 'This API key will only be shown once. Store it securely - it cannot be recovered. If lost, you must regenerate a new key which will invalidate the old one.',
        },
      },
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

    // Get current team from session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const teamId = session?.user?.app_metadata?.team_id;

    if (!teamId) {
      return NextResponse.json(
        { error: { code: 'NO_TEAM', message: 'No team selected' } },
        { status: 400 }
      );
    }

    // Fetch projects for the team (non-archived)
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, team_id, name, description, api_key_prefix, created_at, created_by, is_archived, metadata')
      .eq('team_id', teamId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: 'Failed to fetch projects' } },
        { status: 400 }
      );
    }

    // Transform to include isImported flag based on metadata.import_source_path
    const projectsWithImportStatus = (projects || []).map((project) => {
      const metadata = project.metadata as Record<string, unknown> | null;
      const isImported = Boolean(metadata?.import_source_path);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { metadata: _, ...projectWithoutMetadata } = project;
      return { ...projectWithoutMetadata, isImported };
    });

    return NextResponse.json({ data: { projects: projectsWithImportStatus } });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
