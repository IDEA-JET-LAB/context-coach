/**
 * Session Thread API - Story 16-4: Conversation Threading
 *
 * GET /api/sessions/[sessionId]/thread
 *
 * Returns the session's prompts as a threaded conversation tree.
 * Validates user access via team membership.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isValidUuid } from "@/lib/utils/uuid";
import {
  getSessionThread,
  verifySessionAccess,
  SessionNotFoundError,
  AccessDeniedError,
} from "@/lib/sessions/thread-query";
import { createScopedLogger } from "@/lib/utils/logger";

const logger = createScopedLogger("API_SESSION_THREAD");

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/sessions/[sessionId]/thread
 *
 * Returns the session's prompts as a conversation tree.
 *
 * Authorization:
 * - User must be authenticated
 * - User must be a member of the team that owns the session
 *
 * Response:
 * - 200: { data: ConversationTree }
 * - 400: { error: { code: 'INVALID_SESSION_ID', message } }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 403: { error: { code: 'FORBIDDEN', message } }
 * - 404: { error: { code: 'NOT_FOUND', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 *
 * @example Response
 * {
 *   "data": {
 *     "roots": [
 *       {
 *         "id": "prompt-uuid-1",
 *         "text": "Help me with this code",
 *         "sequence_number": 1,
 *         "parent_prompt_id": null,
 *         "depth": 0,
 *         "children": [
 *           {
 *             "id": "prompt-uuid-2",
 *             "text": "Can you also add tests?",
 *             "sequence_number": 2,
 *             "parent_prompt_id": "prompt-uuid-1",
 *             "depth": 1,
 *             "children": [],
 *             "created_at": "2025-01-15T10:31:00Z"
 *           }
 *         ],
 *         "created_at": "2025-01-15T10:30:00Z",
 *         "analysis": {
 *           "overall_score": 75,
 *           "categories": { "clarity": 80, "specificity": 70 }
 *         }
 *       }
 *     ],
 *     "type": "threaded",
 *     "totalPrompts": 2,
 *     "maxDepth": 1
 *   }
 * }
 */
export async function GET(request: Request, context: RouteParams) {
  try {
    const { sessionId } = await context.params;

    // Validate session ID format
    if (!sessionId || !isValidUuid(sessionId)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SESSION_ID",
            message: "Invalid session ID format",
          },
        },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          },
        },
        { status: 401 }
      );
    }

    // Verify user has access to this session
    try {
      await verifySessionAccess(sessionId, user.id);
    } catch (err) {
      if (err instanceof SessionNotFoundError) {
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
      if (err instanceof AccessDeniedError) {
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
      throw err;
    }

    // Get the threaded conversation
    const tree = await getSessionThread(sessionId);

    logger.log("Session thread fetched", {
      sessionId,
      userId: user.id,
      type: tree.type,
      totalPrompts: tree.totalPrompts,
    });

    return NextResponse.json({ data: tree });
  } catch (error) {
    // Handle known errors
    if (error instanceof SessionNotFoundError) {
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

    // Log and return generic error for unknown errors
    logger.error("Unexpected error in session thread API", error);

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
