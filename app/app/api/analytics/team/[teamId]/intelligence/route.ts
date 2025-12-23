/**
 * Team Intelligence Analytics API - Story 21-12
 *
 * GET /api/analytics/team/:teamId/intelligence
 *
 * Returns comprehensive team-level analytics including:
 * - Team summary (size, active users, prompts, sessions, scores)
 * - Work style and persona distributions
 * - Sentiment and session health metrics
 * - Top performers (admin only)
 * - Common struggles and best practices
 * - Week-over-week changes
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/utils/logger';
import { getTeamIntelligence } from '@/lib/analytics/team-intelligence';
import { AnalyticsTimeRange } from '@/lib/types/team-intelligence';

const logger = createScopedLogger('API_TEAM_INTELLIGENCE');

// Cache duration: 15 minutes
const CACHE_MAX_AGE = 15 * 60;

/**
 * Validate time range parameter
 */
function isValidTimeRange(value: string | null): value is AnalyticsTimeRange {
  return value === '7d' || value === '30d' || value === '90d';
}

/**
 * GET /api/analytics/team/:teamId/intelligence
 *
 * Query parameters:
 * - timeRange: "7d" | "30d" | "90d" (default: "30d")
 *
 * Authorization:
 * - User must be a member of the team
 * - Admin role required for top performers list
 *
 * Response:
 * - 200: { data: TeamIntelligenceResponse }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 403: { error: { code: 'FORBIDDEN', message } }
 * - 404: { error: { code: 'NOT_FOUND', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        },
        { status: 401 }
      );
    }

    const { teamId } = await params;

    // Validate teamId format
    if (!teamId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid team ID format',
          },
        },
        { status: 400 }
      );
    }

    // Check if user is a member of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'You are not a member of this team',
          },
        },
        { status: 403 }
      );
    }

    // Check if team exists
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Team not found',
          },
        },
        { status: 404 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const timeRangeParam = url.searchParams.get('timeRange');
    const timeRange: AnalyticsTimeRange = isValidTimeRange(timeRangeParam)
      ? timeRangeParam
      : '30d';

    // Determine if user is admin
    const isAdmin = membership.role === 'admin';

    // Fetch team intelligence data
    const intelligence = await getTeamIntelligence(teamId, timeRange, isAdmin);

    logger.log('Team intelligence fetched', {
      teamId,
      userId: user.id,
      timeRange,
      isAdmin,
      totalPrompts: intelligence.summary.totalPrompts,
    });

    // Return response with cache headers
    const response = NextResponse.json({
      data: {
        ...intelligence,
        meta: {
          teamId,
          teamName: team.name,
          timeRange,
          isAdmin,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    // Set cache headers (15 minutes)
    response.headers.set(
      'Cache-Control',
      `private, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE * 2}`
    );

    return response;
  } catch (error) {
    logger.error('Failed to fetch team intelligence', error);

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
