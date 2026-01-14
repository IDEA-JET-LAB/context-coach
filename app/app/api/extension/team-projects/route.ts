/**
 * Extension Team Projects API
 * GET /api/extension/team-projects
 *
 * Returns list of projects for ALL teams the user is a member of,
 * grouped by team. Authenticated via VS Code access token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('EXTENSION-TEAM-PROJECTS');

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

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();

    // Verify VS Code access token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);
    const userId = await verifyVSCodeToken(accessToken, adminClient);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get all teams the user is a member of
    const { data: memberships, error: membershipError } = await adminClient
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('user_id', userId);

    if (membershipError) {
      logger.error('Failed to fetch team memberships', { error: membershipError });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch teams' },
        { status: 500 }
      );
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({
        success: true,
        teams: [],
      });
    }

    // Extract team IDs and build team info map
    const teamIds = memberships.map(m => m.team_id);
    const teamInfoMap = new Map<string, string>();
    for (const m of memberships) {
      const team = m.teams as unknown as { id: string; name: string } | null;
      if (team) {
        teamInfoMap.set(team.id, team.name);
      }
    }

    // Fetch projects for all teams
    const { data: projects, error: fetchError } = await adminClient
      .from('projects')
      .select('id, name, team_id')
      .in('team_id', teamIds)
      .eq('is_archived', false)
      .order('name', { ascending: true });

    if (fetchError) {
      logger.error('Failed to fetch projects', { error: fetchError });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    // Group projects by team
    const teamProjectsMap = new Map<string, Array<{ id: string; name: string }>>();

    // Initialize all teams (even those without projects)
    for (const teamId of teamIds) {
      teamProjectsMap.set(teamId, []);
    }

    // Add projects to their teams
    for (const project of projects || []) {
      const teamProjects = teamProjectsMap.get(project.team_id);
      if (teamProjects) {
        teamProjects.push({ id: project.id, name: project.name });
      }
    }

    // Build response with teams and their projects
    const teams = Array.from(teamProjectsMap.entries())
      .map(([teamId, teamProjects]) => ({
        id: teamId,
        name: teamInfoMap.get(teamId) || 'Unknown Team',
        projects: teamProjects,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    logger.log('Fetched all team projects', {
      teamCount: teams.length,
      projectCount: projects?.length || 0
    });

    return NextResponse.json({
      success: true,
      teams,
    });
  } catch (error) {
    logger.error('Error fetching team projects', { error });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
