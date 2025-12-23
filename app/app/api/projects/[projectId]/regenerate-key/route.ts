import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/utils/api-key';
import { generateInstallToken, getApiEndpoint, TOKEN_EXPIRATION_HOURS } from '@/lib/utils/install-token';
import { encryptApiKey } from '@/lib/utils/encryption';
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
      .select('team_id, name, is_archived')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Cannot regenerate key for archived projects
    if (project.is_archived) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Cannot regenerate key for archived projects' } },
        { status: 403 }
      );
    }

    // Get team info
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', project.team_id)
      .single();

    // Check if user is admin
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can regenerate API keys' } },
        { status: 403 }
      );
    }

    // Generate new API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);
    const apiKeyEncrypted = encryptApiKey(apiKey);

    // Update project with new key
    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update({
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
        api_key_encrypted: apiKeyEncrypted,
      })
      .eq('id', projectId)
      .select('id, team_id, name, description, api_key_prefix, created_at, created_by, is_archived')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'REGENERATE_FAILED', message: 'Failed to regenerate API key' } },
        { status: 400 }
      );
    }

    // Generate new Install Token with all required fields
    // SECURITY: Token expiration is intentionally short to minimize exposure window
    const installToken = generateInstallToken({
      project_id: projectId,
      project_name: project.name,
      team_id: project.team_id,
      team_name: team?.name || 'Team',
      user_id: user.id,
      user_name: user.email?.split('@')[0] || 'User',
      api_key: apiKey,
      api_endpoint: getApiEndpoint(),
      expires_at: new Date(Date.now() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({
      data: {
        project: updated,
        apiKey, // Only returned once
        installToken,
        // Security warning for clients to display
        warning: 'This API key will only be shown once. Store it securely - it cannot be recovered. The previous key has been invalidated immediately.',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
