/**
 * Team Stats API for VS Code Extension
 *
 * GET /api/extension/team-stats
 *
 * Returns team member statistics for the Team tab in the extension.
 * Requires VS Code extension token authentication.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('API_EXTENSION_TEAM_STATS');

type TimeRange = 'today' | 'week' | 'month';

interface TeamMemberStats {
  userId: string;
  name: string;
  avatarUrl: string | null;
  promptCount: number;
  avgScore: number;
  scoreChange: number | null;
  avgCharCount: number;
  rank: number;
}

interface TeamStatsResponse {
  members: TeamMemberStats[];
  teamName: string;
  timeRange: TimeRange;
  currentUserId: string;
}

/**
 * Calculate date range based on time range selection
 */
function getDateRange(timeRange: TimeRange): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setDate(startDate.getDate() - 30);
      break;
  }

  return { startDate, endDate };
}

/**
 * Get previous period date range for comparison
 */
function getPreviousPeriodRange(timeRange: TimeRange): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case 'today':
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      endDate.setDate(endDate.getDate() - 7);
      startDate.setDate(startDate.getDate() - 14);
      break;
    case 'month':
      endDate.setDate(endDate.getDate() - 30);
      startDate.setDate(startDate.getDate() - 60);
      break;
  }

  return { startDate, endDate };
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

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        { status: 401 }
      );
    }

    // Parse URL params
    const url = new URL(request.url);
    const requestedTeamId = url.searchParams.get('teamId');

    // Get user's teams
    const { data: memberships, error: memberError } = await supabase
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('user_id', userId);

    if (memberError || !memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User is not a member of any team' } },
        { status: 404 }
      );
    }

    // Use requested team or default to first team
    // We already checked memberships.length > 0 above, so memberships[0] is safe
    let selectedMembership = memberships[0]!;
    if (requestedTeamId) {
      const found = memberships.find(m => m.team_id === requestedTeamId);
      if (found) {
        selectedMembership = found;
      } else {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'User is not a member of this team' } },
          { status: 403 }
        );
      }
    }

    const teamId = selectedMembership.team_id;
    // Supabase returns the joined team as a single object for many-to-one relationships
    const teamName = (selectedMembership.teams as unknown as { id: string; name: string })?.name || 'Team';

    // Parse time range
    const timeRangeParam = url.searchParams.get('timeRange') as TimeRange | null;
    const timeRange: TimeRange = ['today', 'week', 'month'].includes(timeRangeParam || '')
      ? (timeRangeParam as TimeRange)
      : 'week';

    const { startDate, endDate } = getDateRange(timeRange);
    const { startDate: prevStartDate, endDate: prevEndDate } = getPreviousPeriodRange(timeRange);

    // Get all team members
    const { data: teamMembers, error: membersError } = await supabase
      .from('team_members')
      .select(`
        user_id,
        users!inner(id, email, full_name, avatar_url)
      `)
      .eq('team_id', teamId);

    if (membersError || !teamMembers) {
      logger.error('Failed to fetch team members', membersError);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch team members' } },
        { status: 500 }
      );
    }

    // Get prompts for all team members in the current period
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('user_id, overall_score, char_count, created_at')
      .eq('team_id', teamId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (promptsError) {
      logger.error('Failed to fetch prompts', promptsError);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch prompts' } },
        { status: 500 }
      );
    }

    // Get prompts for previous period (for score change calculation)
    const { data: prevPrompts } = await supabase
      .from('prompts')
      .select('user_id, overall_score')
      .eq('team_id', teamId)
      .gte('created_at', prevStartDate.toISOString())
      .lte('created_at', prevEndDate.toISOString());

    // Calculate stats per member
    const memberStats: Map<string, {
      promptCount: number;
      totalScore: number;
      totalCharCount: number;
      prevTotalScore: number;
      prevPromptCount: number;
    }> = new Map();

    // Initialize all members
    for (const member of teamMembers) {
      memberStats.set(member.user_id, {
        promptCount: 0,
        totalScore: 0,
        totalCharCount: 0,
        prevTotalScore: 0,
        prevPromptCount: 0,
      });
    }

    // Aggregate current period stats
    for (const prompt of prompts || []) {
      const stats = memberStats.get(prompt.user_id);
      if (stats) {
        stats.promptCount++;
        stats.totalScore += prompt.overall_score || 0;
        stats.totalCharCount += prompt.char_count || 0;
      }
    }

    // Aggregate previous period stats
    for (const prompt of prevPrompts || []) {
      const stats = memberStats.get(prompt.user_id);
      if (stats) {
        stats.prevPromptCount++;
        stats.prevTotalScore += prompt.overall_score || 0;
      }
    }

    // Build member stats array
    const members: TeamMemberStats[] = teamMembers.map((member) => {
      const stats = memberStats.get(member.user_id)!;
      // Supabase returns the joined user as a single object for many-to-one relationships
      const userData = member.users as unknown as { id: string; email: string; full_name: string | null; avatar_url: string | null };

      const avgScore = stats.promptCount > 0
        ? Math.round((stats.totalScore / stats.promptCount) * 10) / 10
        : 0;

      const prevAvgScore = stats.prevPromptCount > 0
        ? stats.prevTotalScore / stats.prevPromptCount
        : null;

      const scoreChange = prevAvgScore !== null && stats.promptCount > 0
        ? Math.round((avgScore - prevAvgScore) * 10) / 10
        : null;

      const avgCharCount = stats.promptCount > 0
        ? Math.round(stats.totalCharCount / stats.promptCount)
        : 0;

      return {
        userId: member.user_id,
        name: userData.full_name || userData.email.split('@')[0] || 'Unknown',
        avatarUrl: userData.avatar_url,
        promptCount: stats.promptCount,
        avgScore,
        scoreChange,
        avgCharCount,
        rank: 0, // Will be set after sorting
      };
    });

    // Sort by average score (descending) and assign ranks
    members.sort((a, b) => b.avgScore - a.avgScore);
    members.forEach((member, index) => {
      member.rank = index + 1;
    });

    logger.log('Team stats fetched', {
      teamId,
      userId,
      timeRange,
      memberCount: members.length,
    });

    const response: TeamStatsResponse = {
      members,
      teamName,
      timeRange,
      currentUserId: userId,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    logger.error('Failed to fetch team stats', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
