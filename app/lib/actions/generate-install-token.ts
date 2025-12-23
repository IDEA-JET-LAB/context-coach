'use server';

import { createClient } from '@/lib/supabase/server';
import {
  generateInstallToken as createToken,
  getApiEndpoint,
  TOKEN_EXPIRATION_HOURS,
} from '@/lib/utils/install-token';
import { decryptApiKey } from '@/lib/utils/encryption';

interface GenerateTokenResult {
  token: string;
  expiresAt: string;
}

/**
 * Generates a complete install token for a project.
 * Any team member can generate a token for projects in their team.
 *
 * @param projectId - The project ID to generate a token for (required)
 * @returns The install token and expiration time
 * @throws Error if unauthorized, project not found, or encryption key not available
 */
export async function generateInstallToken(projectId: string): Promise<GenerateTokenResult> {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Get user's team from session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userTeamId = session?.user?.app_metadata?.team_id;

  if (!userTeamId) {
    throw new Error('No team selected');
  }

  // Verify user is a member of the team (any role)
  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', userTeamId)
    .eq('user_id', user.id)
    .single();

  if (membershipError || !membership) {
    throw new Error('You are not a member of the current team');
  }

  // Get project with encrypted API key
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, team_id, api_key_encrypted')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    throw new Error('Project not found');
  }

  // Verify project belongs to user's current team
  if (project.team_id !== userTeamId) {
    throw new Error('Project not found or access denied');
  }

  // Check if encrypted API key exists
  if (!project.api_key_encrypted) {
    throw new Error(
      'This project was created before team member token generation was available. ' +
        'An admin must regenerate the API key to enable this feature.'
    );
  }

  // Decrypt the API key
  const apiKey = decryptApiKey(project.api_key_encrypted);
  if (!apiKey) {
    throw new Error('Failed to decrypt API key. Please contact support.');
  }

  // Get team info
  const { data: team } = await supabase.from('teams').select('name').eq('id', userTeamId).single();

  // Calculate expiration
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString();

  // Generate complete install token
  const token = createToken({
    project_id: project.id,
    project_name: project.name,
    team_id: userTeamId,
    team_name: team?.name || 'Team',
    user_id: user.id,
    user_name: user.email?.split('@')[0] || 'User',
    api_key: apiKey,
    api_endpoint: getApiEndpoint(),
    expires_at: expiresAt,
  });

  return { token, expiresAt };
}
