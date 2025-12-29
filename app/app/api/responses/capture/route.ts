/**
 * Response Capture API Route
 * Story 25-1: Response Capture Endpoint
 *
 * POST /api/responses/capture
 *
 * Receives Claude Code assistant responses from the Stop hook for storage.
 * Responses are stored with encrypted text and linked to sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, extractApiKey } from "@/lib/api/validate-api-key";
import {
  responseCaptureSchema,
  mapResponseValidationError,
} from "@/lib/validations/response-capture";
import { upsertSessionForResponse } from "@/lib/sessions/upsert-session";
import {
  storeResponse,
  requestToStoreParams,
} from "@/lib/responses/store-response";
import {
  cliRateLimit,
  ipRateLimit,
  checkRateLimit,
  getClientIp,
  calculateRetryAfter,
} from "@/lib/rate-limit";
import { createScopedLogger } from "@/lib/utils/logger";
import { incrementSessionTokens } from "@/lib/sessions";

const logger = createScopedLogger("RESPONSE-CAPTURE");

/**
 * Creates a rate limit exceeded response.
 */
function rateLimitResponse(reset: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": calculateRetryAfter(reset),
      },
    }
  );
}

/**
 * POST /api/responses/capture
 *
 * Receives Claude Code responses from the Stop hook for storage.
 *
 * Authorization: Bearer <api_key>
 *
 * Request body:
 * - session_id: string (required) - Claude Code session ID
 * - message_uuid: string (required) - Unique message ID from transcript
 * - response_text: string (required) - Full assistant response
 * - thinking_summary: string (optional) - Compressed thinking (max 500 chars)
 * - thinking_word_count: number (optional) - Original thinking word count
 * - tools_used: Array<{name, id}> (required) - Tools invoked
 * - model: string (required) - Model that generated response
 * - usage: {input_tokens, output_tokens, cache_*} (required) - Token metrics
 * - stop_reason: string (required) - Why Claude stopped
 * - timestamp: string (required) - ISO 8601 timestamp
 *
 * Response:
 * - 201: { data: { id, sessionId } }
 * - 400: { error: { code: 'VALIDATION_ERROR', message } }
 * - 401: { error: { code: 'INVALID_API_KEY', message } }
 * - 429: { error: { code: 'RATE_LIMITED', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIp = getClientIp(request);

    // Check IP rate limit first (protects against brute force before auth)
    const ipLimit = await checkRateLimit(ipRateLimit, clientIp);
    if (!ipLimit.success) {
      logger.warn("IP rate limit exceeded", { clientIp });
      return rateLimitResponse(ipLimit.reset);
    }

    // Extract API key from Authorization header
    const authHeader = request.headers.get("Authorization");
    const apiKey = extractApiKey(authHeader);

    if (!apiKey) {
      logger.warn("Missing or malformed auth header");
      return NextResponse.json(
        {
          error: {
            code: "INVALID_API_KEY",
            message: "Invalid or missing API key",
          },
        },
        { status: 401 }
      );
    }

    // Validate API key
    const keyResult = await validateApiKey(apiKey);
    if (!keyResult.valid) {
      logger.warn("Invalid API key");
      return NextResponse.json(
        {
          error: {
            code: "INVALID_API_KEY",
            message: "Invalid or missing API key",
          },
        },
        { status: 401 }
      );
    }

    // Check CLI rate limit (after successful auth)
    const cliLimit = await checkRateLimit(cliRateLimit, keyResult.project_id!);
    if (!cliLimit.success) {
      logger.warn("CLI rate limit exceeded", { projectId: keyResult.project_id });
      return rateLimitResponse(cliLimit.reset);
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logger.warn("Invalid JSON body");
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
          },
        },
        { status: 400 }
      );
    }

    // Validate request body
    const parsed = responseCaptureSchema.safeParse(body);
    if (!parsed.success) {
      const { code, message } = mapResponseValidationError(parsed.error);
      logger.warn("Validation failed", { errorCode: code });
      return NextResponse.json(
        {
          error: {
            code,
            message,
          },
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Upsert session
    // This creates a session if it doesn't exist (edge case: response before prompt)
    const session = await upsertSessionForResponse({
      sessionId: data.session_id,
      projectId: keyResult.project_id!,
      teamId: keyResult.team_id!,
    });

    // Convert request to storage params
    const storeParams = requestToStoreParams(data, session.id);

    // Store the response
    const result = await storeResponse(storeParams);

    // Update session token stats (non-blocking)
    const totalTokens = data.usage.input_tokens + data.usage.output_tokens;
    void incrementSessionTokens(session.id, totalTokens).catch((err) => {
      logger.warn("Failed to increment session tokens", {
        sessionId: session.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    logger.log("Response captured successfully", {
      responseId: result.id,
      sessionId: session.id,
      isNewSession: session.isNew,
      projectId: keyResult.project_id,
      model: data.model,
      toolCount: data.tools_used.length,
      tokensIn: data.usage.input_tokens,
      tokensOut: data.usage.output_tokens,
    });

    return NextResponse.json(
      {
        data: {
          id: result.id,
          sessionId: session.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Unexpected error", error);
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
