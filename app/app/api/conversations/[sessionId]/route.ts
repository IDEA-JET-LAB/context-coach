/**
 * Conversation Thread API - Story 25-3: Conversation Thread Endpoint
 *
 * GET /api/conversations/[sessionId]
 *
 * Returns the full threaded message history for a conversation session.
 * Includes user prompts and assistant responses with all metadata.
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getConversationThread } from "@/lib/conversations/get-conversation-thread";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidUuid } from "@/lib/utils/uuid";

const logger = createScopedLogger("API_CONVERSATION_THREAD");

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/conversations/[sessionId]
 *
 * Returns the full threaded conversation including metadata and messages.
 *
 * Authorization:
 * - User must be authenticated
 * - User must be a member of the team that owns the session
 *
 * Query Parameters:
 * - include_responses: boolean (default true) - Include assistant responses
 * - include_tools: boolean (default true) - Include tool execution details
 *
 * Response:
 * - 200: { data: { conversation: ConversationDetail, messages: ThreadedMessage[] } }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 400: { error: { code: 'NO_TEAM', message } }
 * - 404: { error: { code: 'NOT_FOUND', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 *
 * SECURITY:
 * - Returns 404 for both "not found" and "no access" to prevent information leakage
 * - Validates sessionId format before database query to prevent SQL injection
 *
 * @example Response (200 OK)
 * {
 *   "data": {
 *     "conversation": {
 *       "id": "uuid",
 *       "sessionId": "claude-session-id",
 *       "slug": "feature-development",
 *       "startedAt": "2025-01-15T10:00:00Z",
 *       "duration": 45,
 *       "primaryStage": "development",
 *       ...
 *     },
 *     "messages": [
 *       {
 *         "id": "uuid",
 *         "role": "user",
 *         "content": "Help me implement feature X",
 *         "timestamp": "2025-01-15T10:00:00Z",
 *         "sequenceNumber": 1,
 *         "promptType": "initiating",
 *         "score": 85,
 *         ...
 *       },
 *       {
 *         "id": "uuid",
 *         "role": "assistant",
 *         "content": "I'll help you implement...",
 *         "timestamp": "2025-01-15T10:00:30Z",
 *         "sequenceNumber": 1.5,
 *         "toolsUsed": ["Read", "Edit"],
 *         "model": "claude-3-opus",
 *         ...
 *       }
 *     ]
 *   }
 * }
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { sessionId } = await context.params;

    // ========================================================================
    // Step 1: Authenticate user
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
    // Step 2: Get user's current team
    // ========================================================================
    const { data: membership, error: membershipError } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membershipError || !membership) {
      logger.warn("User has no team membership", { userId: user.id });
      return NextResponse.json(
        {
          error: {
            code: "NO_TEAM",
            message: "User has no team",
          },
        },
        { status: 400 }
      );
    }

    // Validate team_id
    if (!isValidUuid(membership.team_id)) {
      logger.error("Invalid team_id in membership", undefined, {
        userId: user.id,
      });
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

    // ========================================================================
    // Step 3: Parse query parameters
    // ========================================================================
    const searchParams = request.nextUrl.searchParams;
    const includeResponses = searchParams.get("include_responses") !== "false";
    const includeTools = searchParams.get("include_tools") !== "false";

    // ========================================================================
    // Step 4: Get conversation thread
    // ========================================================================
    const result = await getConversationThread(sessionId, membership.team_id, {
      includeResponses,
      includeTools,
    });

    // Return 404 for not found OR no access (security: no info leak)
    if (!result) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Conversation not found",
          },
        },
        { status: 404 }
      );
    }

    logger.log("Conversation thread fetched", {
      sessionId: result.conversation.id,
      userId: user.id,
      messageCount: result.messages.length,
      includeResponses,
      includeTools,
    });

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    logger.error("Unexpected error in conversation thread API", error);

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
