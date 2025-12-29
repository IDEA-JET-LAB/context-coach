/**
 * Teams List API for VS Code Extension
 *
 * GET /api/extension/teams
 *
 * Returns list of teams the user belongs to.
 * Requires VS Code extension token authentication.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('API_EXTENSION_TEAMS');

interface TeamInfo {
  id: string;
  name: string;
  memberCount: number;
}

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

export async function GET(request: Request) {
  try {
    // Get authorization header (VS Code extension token)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);
    const supabase = createAdminClient();

    // Verify VS Code access token
    const userId = await verifyVSCodeToken(accessToken, supabase);

    logger.log('Auth check', {
      hasUser: !!userId,
      userId: userId,
    });

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        { status: 401 }
      );
    }

    // Get all teams user belongs to
    const { data: memberships, error: memberError } = await supabase
      .from('team_members')
      .select(`
        team_id,
        teams!inner(id, name)
      `)
      .eq('user_id', userId);

    logger.log('Memberships query result', {
      memberships: memberships?.length || 0,
      memberError: memberError?.message,
      rawData: JSON.stringify(memberships)
    });

    if (memberError) {
      logger.error('Failed to fetch user teams', memberError);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch teams' } },
        { status: 500 }
      );
    }

    if (!memberships || memberships.length === 0) {
      logger.log('No memberships found for user', { userId });
      return NextResponse.json({ data: { teams: [] } });
    }

    // Get member counts for each team
    const teamIds = memberships.map(m => m.team_id);
    const { data: memberCounts } = await supabase
      .from('team_members')
      .select('team_id')
      .in('team_id', teamIds);

    // Count members per team
    const countMap = new Map<string, number>();
    for (const m of memberCounts || []) {
      countMap.set(m.team_id, (countMap.get(m.team_id) || 0) + 1);
    }

    // Build team list
    const teams: TeamInfo[] = memberships.map((membership) => {
      // Supabase returns the joined team as a single object for many-to-one relationships
      const teamData = membership.teams as unknown as { id: string; name: string };
      return {
        id: teamData.id,
        name: teamData.name,
        memberCount: countMap.get(membership.team_id) || 0,
      };
    });

    logger.log('Teams fetched', {
      userId,
      teamCount: teams.length,
    });

    return NextResponse.json({ data: { teams } });
  } catch (error) {
    logger.error('Failed to fetch teams', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
