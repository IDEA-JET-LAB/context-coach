/**
 * Conversation Statistics API - Story 30-2: Deterministic Stats Service
 *
 * GET /api/conversations/[sessionId]/stats
 *
 * Returns deterministic statistics for a conversation session.
 * Includes turn count, token usage, tool usage, context window metrics, and outcome.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import {
  calculateConversationStats,
  verifySessionAccess,
} from "@/lib/analysis/conversation-stats";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidUuid } from "@/lib/utils/uuid";

const logger = createScopedLogger("API_CONVERSATION_STATS");

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/conversations/[sessionId]/stats
 *
 * Returns comprehensive statistics for a conversation session.
 *
 * Authorization:
 * - User must be authenticated
 * - User must be a member of the team that owns the session
 *
 * Response:
 * - 200: { data: ConversationStats }
 * - 400: { error: { code: 'INVALID_SESSION_ID', message } }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 403: { error: { code: 'FORBIDDEN', message } }
 * - 404: { error: { code: 'NOT_FOUND', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 *
 * @example Response (200 OK)
 * {
 *   "data": {
 *     "sessionId": "uuid",
 *     "turnCount": 15,
 *     "durationMinutes": 45,
 *     "isOngoing": false,
 *     "tokens": {
 *       "input": 25000,
 *       "output": 75000,
 *       "total": 100000
 *     },
 *     "tools": [
 *       { "name": "Read", "count": 12 },
 *       { "name": "Edit", "count": 8 }
 *     ],
 *     "agents": [
 *       { "type": "general-purpose", "count": 2 }
 *     ],
 *     "contextWindow": {
 *       "peakPercentage": 45,
 *       "peakTurn": 12,
 *       "avgPercentage": 30
 *     },
 *     "outcome": {
 *       "status": "completed",
 *       "indicators": ["Git commit detected", "Test execution detected"]
 *     },
 *     "category": "development"
 *   }
 * }
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { sessionId: sessionIdParam } = await context.params;

    // ========================================================================
    // Step 1: Validate session ID is present
    // ========================================================================
    if (!sessionIdParam) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SESSION_ID",
            message: "Session ID is required",
          },
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // Step 2: Authenticate user
    // ========================================================================
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // Step 3: Resolve session identifier to UUID
    // The sessionIdParam can be either:
    //   - A database UUID (id column)
    //   - A Claude Code session_id (which can also be a UUID!)
    // Use admin client for lookup to bypass RLS (access is verified in step 4)
    // ========================================================================
    let sessionId: string;
    const adminSupabase = createAdminClient();

    if (isValidUuid(sessionIdParam)) {
      // UUID format - could be database id OR session_id column
      // Check BOTH columns like getConversationThread does
      const { data: session, error: lookupError } = await adminSupabase
        .from("sessions")
        .select("id")
        .or(`id.eq.${sessionIdParam},session_id.eq.${sessionIdParam}`)
        .single();

      if (lookupError || !session) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }
      sessionId = session.id;
    } else {
      // Not a UUID, lookup by session_id column only
      const { data: session, error: lookupError } = await adminSupabase
        .from("sessions")
        .select("id")
        .eq("session_id", sessionIdParam)
        .single();

      if (lookupError || !session) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }
      sessionId = session.id;
    }

    // ========================================================================
    // Step 4: Verify access to this session
    // Use admin client to bypass RLS for the access check query
    // ========================================================================
    const accessResult = await verifySessionAccess(adminSupabase, sessionId, user.id);

    if (!accessResult.hasAccess) {
      // Return 404 for "not found" and 403 for "no access" (security best practice)
      if (accessResult.error === "Session not found") {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this session",
          },
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // Step 5: Calculate conversation statistics
    // Use admin client to bypass RLS for the stats calculation queries
    // ========================================================================
    const startTime = Date.now();
    const stats = await calculateConversationStats(adminSupabase, sessionId);
    const elapsed = Date.now() - startTime;

    logger.log("Conversation stats calculated", {
      sessionId,
      userId: user.id,
      turnCount: stats.turnCount,
      totalTokens: stats.tokens.total,
      toolCount: stats.tools.length,
      outcomeStatus: stats.outcome.status,
      elapsedMs: elapsed,
    });

    return NextResponse.json({
      data: stats,
    });
  } catch (error) {
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }
    }

    // Log and return generic error for unknown errors
    logger.error("Unexpected error in conversation stats API", error);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
