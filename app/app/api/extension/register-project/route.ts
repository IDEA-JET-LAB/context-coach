/**
 * Extension Project Registration API
 *
 * Allows the VS Code extension to register the current workspace as a project.
 * Returns the install token which the extension uses to create local config.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/utils/api-key';
import { generateInstallToken, getApiEndpoint, TOKEN_EXPIRATION_HOURS } from '@/lib/utils/install-token';
import { encryptApiKey } from '@/lib/utils/encryption';
import { z } from 'zod';

const registerProjectSchema = z.object({
  name: z.string().min(1).max(100),
  workspacePath: z.string().optional(), // For reference/debugging
  teamId: z.string().uuid().optional(), // Team to create project in (optional, uses session team if not provided)
});

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
    const adminClient = createAdminClient();
    let userId: string | null = null;
    let userEmail: string | null = null;

    // Check for VS Code access token in Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7);
      userId = await verifyVSCodeToken(accessToken, adminClient);

      // Get user email from auth.users for display purposes
      if (userId) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
        userEmail = authUser?.user?.email || null;
      }
    }

    // If no VS Code token, try Supabase session auth
    if (!userId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email || null;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated. Please sign in to the extension first.' } },
        { status: 401 }
      );
    }

    // Parse and validate request body first to get teamId if provided
    const body = await request.json();
    const validated = registerProjectSchema.parse(body);

    // Use provided teamId (required from extension UI)
    const teamId = validated.teamId;

    if (!teamId) {
      return NextResponse.json(
        { error: { code: 'NO_TEAM', message: 'No team selected. Please select a team.' } },
        { status: 400 }
      );
    }

    // Get team info using admin client
    const { data: team, error: teamError } = await adminClient
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

    // Check membership (any member can register projects from extension)
    const { data: membership, error: membershipError } = await adminClient
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You are not a member of the selected team' } },
        { status: 403 }
      );
    }

    // Check if project with same name already exists for this team
    const { data: existingProject } = await adminClient
      .from('projects')
      .select('id, name')
      .eq('team_id', teamId)
      .eq('name', validated.name)
      .eq('is_archived', false)
      .single();

    if (existingProject) {
      return NextResponse.json(
        {
          error: {
            code: 'PROJECT_EXISTS',
            message: `A project named "${validated.name}" already exists in this team. Choose a different name or use the existing project.`
          }
        },
        { status: 409 }
      );
    }

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);
    const apiKeyEncrypted = encryptApiKey(apiKey);

    // Create project using admin client
    const { data: project, error: createError } = await adminClient
      .from('projects')
      .insert({
        team_id: teamId,
        name: validated.name,
        description: `Registered from VS Code extension`,
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
        api_key_encrypted: apiKeyEncrypted,
        created_by: userId,
      })
      .select('id, team_id, name, description, api_key_prefix, created_at, created_by')
      .single();

    if (createError) {
      console.error('Failed to create project:', createError);
      return NextResponse.json(
        { error: { code: 'CREATE_FAILED', message: 'Failed to create project' } },
        { status: 400 }
      );
    }

    // Generate install token
    const installToken = generateInstallToken({
      project_id: project.id,
      project_name: project.name,
      team_id: teamId,
      team_name: team.name,
      user_id: userId,
      user_name: userEmail?.split('@')[0] || 'User',
      api_key: apiKey,
      api_endpoint: getApiEndpoint(),
      expires_at: new Date(Date.now() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json(
      {
        data: {
          project: {
            id: project.id,
            name: project.name,
            team_id: teamId,
            team_name: team.name,
          },
          installToken,
          // Config that the extension should save to .contextor/config.json
          config: {
            project_id: project.id,
            project_name: project.name,
            team_id: teamId,
            team_name: team.name,
            api_endpoint: getApiEndpoint(),
            created_at: new Date().toISOString(),
            created_by: userEmail?.split('@')[0] || 'User',
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues?.[0];
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: firstError?.message || 'Validation failed' } },
        { status: 400 }
      );
    }
    console.error('Extension project registration error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
