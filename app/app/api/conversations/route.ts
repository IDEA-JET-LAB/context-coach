/**
 * Conversations API - Story 25-2: Conversations List Endpoint
 *
 * GET /api/conversations
 *
 * Returns paginated list of conversations (sessions) for the user's team.
 * Supports filtering by project, stage, debugging loops, and date range.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  conversationsQuerySchema,
  mapConversationsQueryError,
} from '@/lib/validations/conversations-query';
import { getConversations } from '@/lib/conversations/get-conversations';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('API_CONVERSATIONS');

/**
 * GET /api/conversations
 *
 * Returns paginated conversations for the user's current team.
 *
 * Query Parameters:
 * - project_id?: string - Filter by project UUID, or "unlinked" for null project_id
 * - stage?: string - Filter by primary_stage value
 * - has_loop?: 'true' | 'false' - Filter by debugging loop presence
 * - date_from?: string - Filter by start date (ISO 8601, inclusive)
 * - date_to?: string - Filter by end date (ISO 8601, inclusive)
 * - limit?: number - Max results (1-100, default: 50)
 * - offset?: number - Pagination offset (default: 0)
 * - sort_by?: 'date' | 'messages' | 'score' - Sort field (default: 'date')
 *
 * Response:
 * - 200: { data: { conversations, pagination } }
 * - 400: { error: { code, message } }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Get user's current team
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_TEAM',
            message: 'User has no team',
          },
        },
        { status: 400 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = conversationsQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      const errorResponse = mapConversationsQueryError(parsed.error);
      return NextResponse.json(
        { error: errorResponse },
        { status: 400 }
      );
    }

    // Fetch conversations
    const result = await getConversations(membership.team_id, parsed.data);

    logger.log('Conversations fetched', {
      userId: user.id,
      teamId: membership.team_id,
      count: result.conversations.length,
      total: result.total,
      filters: {
        project_id: parsed.data.project_id,
        stage: parsed.data.stage,
        has_loop: parsed.data.has_loop,
      },
    });

    return NextResponse.json({
      data: {
        conversations: result.conversations,
        pagination: {
          total: result.total,
          limit: parsed.data.limit,
          offset: parsed.data.offset,
          hasMore: parsed.data.offset + result.conversations.length < result.total,
        },
      },
    });
  } catch (error) {
    logger.error('Unexpected error in conversations API', error);

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
