'use server';

import { createClient } from '@/lib/supabase/server';

export async function generateInstallToken(projectId?: string): Promise<string> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Get user's current team membership
  const { data: teamMembership, error: membershipError } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (membershipError || !teamMembership) {
    throw new Error('No team selected');
  }

  const teamId = teamMembership.team_id;

  // If projectId provided, verify user has access
  if (projectId) {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, team_id, api_key_prefix')
      .eq('id', projectId)
      .single();

    if (projectError || !project || project.team_id !== teamId) {
      throw new Error('Project not found or access denied');
    }
  }

  // Generate token payload
  const payload = {
    project_id: projectId,
    team_id: teamId,
    user_id: user.id,
    api_endpoint: process.env.NEXT_PUBLIC_API_URL || 'https://api.contextor.co',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };

  // Encode as base64
  const token = `ctx_${Buffer.from(JSON.stringify(payload)).toString('base64')}`;

  return token;
}
