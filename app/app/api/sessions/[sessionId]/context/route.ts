/**
 * Session Context API - Story 25-4: Conversation Context Endpoint
 *
 * GET /api/sessions/[sessionId]/context
 *
 * Returns conversation context for a session, formatted for LLM analysis.
 * Supports both API key authentication (for analysis pipeline) and
 * session cookie authentication (for dashboard).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateApiKey,
  extractApiKey,
} from "@/lib/api/validate-api-key";
import {
  buildConversationContext,
  type ContextResult,
} from "@/lib/conversations/build-context";
import { isValidUuid } from "@/lib/utils/uuid";
import { createScopedLogger } from "@/lib/utils/logger";

const logger = createScopedLogger("API_SESSION_CONTEXT");

/**
 * Route parameter types for Next.js 15 App Router
 */
interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * API response types
 */
interface SuccessResponse {
  data: {
    sessionId: string;
    context: ContextResult;
  };
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Parameter validation limits
 */
const LIMITS = {
  tokenBudget: { min: 100, max: 100000, default: 10000 },
  messageLimit: { min: 1, max: 200, default: 50 },
};

/**
 * GET /api/sessions/[id]/context
 *
 * Returns conversation context for LLM analysis.
 *
 * Authentication:
 * - API key via Authorization header (Bearer token)
 * - Session cookie (browser authentication)
 *
 * Query Parameters:
 * - token_budget: Max tokens to include (100-100000, default 10000)
 * - message_limit: Max messages to include (1-200, default 50)
 * - prompt_id: Include context up to this prompt (optional)
 *
 * Response:
 * - 200: { data: { sessionId, context } }
 * - 400: { error: { code: 'VALIDATION_ERROR' | 'INVALID_SESSION_ID', message } }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 403: { error: { code: 'FORBIDDEN', message } }
 * - 404: { error: { code: 'NOT_FOUND', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
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

    // Authenticate via API key or session cookie
    const authResult = await authenticateRequest(request, sessionId);

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error! },
        { status: authResult.status }
      );
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;

    const tokenBudgetParam = searchParams.get("token_budget");
    const messageLimitParam = searchParams.get("message_limit");
    const promptId = searchParams.get("prompt_id") || undefined;

    // Parse token_budget
    let tokenBudget = LIMITS.tokenBudget.default;
    if (tokenBudgetParam) {
      const parsed = parseInt(tokenBudgetParam, 10);
      if (isNaN(parsed)) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "token_budget must be a number",
            },
          },
          { status: 400 }
        );
      }
      if (parsed < LIMITS.tokenBudget.min || parsed > LIMITS.tokenBudget.max) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `token_budget must be ${LIMITS.tokenBudget.min}-${LIMITS.tokenBudget.max}`,
            },
          },
          { status: 400 }
        );
      }
      tokenBudget = parsed;
    }

    // Parse message_limit
    let messageLimit = LIMITS.messageLimit.default;
    if (messageLimitParam) {
      const parsed = parseInt(messageLimitParam, 10);
      if (isNaN(parsed)) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "message_limit must be a number",
            },
          },
          { status: 400 }
        );
      }
      if (parsed < LIMITS.messageLimit.min || parsed > LIMITS.messageLimit.max) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `message_limit must be ${LIMITS.messageLimit.min}-${LIMITS.messageLimit.max}`,
            },
          },
          { status: 400 }
        );
      }
      messageLimit = parsed;
    }

    // Validate prompt_id if provided
    if (promptId && !isValidUuid(promptId)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "prompt_id must be a valid UUID",
          },
        },
        { status: 400 }
      );
    }

    // Build conversation context
    const result = await buildConversationContext(sessionId, {
      tokenBudget,
      messageLimit,
      promptId,
    });

    if (!result) {
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

    logger.log("Context retrieved", {
      sessionId,
      messageCount: result.metadata.messageCount,
      totalTokens: result.metadata.totalTokens,
      truncated: result.metadata.truncated,
      authMethod: authResult.method,
    });

    return NextResponse.json({
      data: {
        sessionId,
        context: result,
      },
    });
  } catch (error) {
    logger.error("Unexpected error in session context API", error);

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

/**
 * Authentication result
 */
interface AuthResult {
  authorized: boolean;
  method?: "api_key" | "session";
  teamId?: string;
  userId?: string;
  error?: { code: string; message: string };
  status: number;
}

/**
 * Authenticate the request via API key or session cookie.
 *
 * Also verifies the user/API key has access to the specified session.
 *
 * @param request - The incoming request
 * @param sessionId - The session ID being accessed
 * @returns Authentication result
 */
async function authenticateRequest(
  request: NextRequest,
  sessionId: string
): Promise<AuthResult> {
  // Try API key authentication first (for analysis pipeline)
  const authHeader = request.headers.get("Authorization");
  const apiKey = extractApiKey(authHeader);

  if (apiKey) {
    const keyResult = await validateApiKey(apiKey);

    if (keyResult.valid && keyResult.team_id) {
      // Verify API key's team has access to this session
      const hasAccess = await verifyTeamSessionAccess(
        keyResult.team_id,
        sessionId
      );

      if (!hasAccess) {
        return {
          authorized: false,
          error: {
            code: "FORBIDDEN",
            message: "API key does not have access to this session",
          },
          status: 403,
        };
      }

      return {
        authorized: true,
        method: "api_key",
        teamId: keyResult.team_id,
        status: 200,
      };
    }

    // Invalid API key
    return {
      authorized: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid API key",
      },
      status: 401,
    };
  }

  // Fall back to session cookie authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
      status: 401,
    };
  }

  // Verify user has access to this session through team membership
  const hasAccess = await verifyUserSessionAccess(user.id, sessionId);

  if (!hasAccess) {
    return {
      authorized: false,
      error: {
        code: "FORBIDDEN",
        message: "You do not have access to this session",
      },
      status: 403,
    };
  }

  return {
    authorized: true,
    method: "session",
    userId: user.id,
    status: 200,
  };
}

/**
 * Verify a team has access to a session.
 *
 * @param teamId - The team ID to check
 * @param sessionId - The session ID to check access for
 * @returns true if the team owns the session
 */
async function verifyTeamSessionAccess(
  teamId: string,
  sessionId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("team_id")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return false;
  }

  return session.team_id === teamId;
}

/**
 * Verify a user has access to a session through team membership.
 *
 * @param userId - The user ID to check
 * @param sessionId - The session ID to check access for
 * @returns true if the user is a member of the team that owns the session
 */
async function verifyUserSessionAccess(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // Get session's team
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("team_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return false;
  }

  // Check if user is a member of that team
  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", session.team_id)
    .eq("user_id", userId)
    .single();

  if (membershipError || !membership) {
    return false;
  }

  return true;
}
