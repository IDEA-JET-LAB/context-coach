/**
 * GET /api/analytics/insights
 *
 * Returns comprehensive insights data for the Interactive Insights Dashboard.
 * Story 21-11: Interactive Insights Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchInsights } from '@/lib/analytics/insights';
import type { InsightsTimeRange } from '@/lib/types/insights';

const VALID_TIME_RANGES: InsightsTimeRange[] = ['7d', '30d', '90d', 'all'];

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') as InsightsTimeRange || '7d';
    const teamId = searchParams.get('teamId') || undefined;

    // Validate time range
    if (!VALID_TIME_RANGES.includes(timeRange)) {
      return NextResponse.json(
        { error: 'Invalid timeRange. Must be one of: 7d, 30d, 90d, all' },
        { status: 400 }
      );
    }

    // Fetch insights data
    const insights = await fetchInsights(supabase, user.id, timeRange, teamId);

    const responseTime = Date.now() - startTime;

    // Return response with cache headers
    return NextResponse.json(insights, {
      headers: {
        'Cache-Control': 'private, max-age=300', // 5 minute cache
        'X-Response-Time': `${responseTime}ms`,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching insights:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
