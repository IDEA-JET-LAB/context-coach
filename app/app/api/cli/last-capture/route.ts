import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, extractApiKey } from "@/lib/api/validate-api-key";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cliRateLimit,
  ipRateLimit,
  checkRateLimit,
  getClientIp,
  calculateRetryAfter,
} from "@/lib/rate-limit";

/**
 * UUID v4 format validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 */
function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * GET /api/cli/last-capture
 *
 * Gets the last capture timestamp for the CLI status command.
 *
 * Authorization: Bearer <api_key>
 *
 * Query params:
 * - project_id: string (required)
 * - user_id: string (optional) - if provided, returns last capture for this user
 *
 * Response:
 * - 200: { last_capture_at: string | null }
 * - 401: { error: { code: 'INVALID_API_KEY', message } }
 * - 429: { error: { code: 'RATE_LIMITED', message } } - Rate limit exceeded
 */
export async function GET(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIp = getClientIp(request);

    // Check IP rate limit first (protects against brute force before auth)
    const ipLimit = await checkRateLimit(ipRateLimit, clientIp);
    if (!ipLimit.success) {
      console.warn("[API] cli/last-capture: IP rate limit exceeded", { clientIp });
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
            "Retry-After": calculateRetryAfter(ipLimit.reset),
          },
        }
      );
    }

    // Extract API key from Authorization header
    const authHeader = request.headers.get("Authorization");
    const apiKey = extractApiKey(authHeader);

    if (!apiKey) {
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

    // Check CLI rate limit (30 requests per minute per API key/project)
    const cliLimit = await checkRateLimit(cliRateLimit, keyResult.project_id!);
    if (!cliLimit.success) {
      console.warn("[API] cli/last-capture: CLI rate limit exceeded", {
        projectId: keyResult.project_id,
      });
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
            "Retry-After": calculateRetryAfter(cliLimit.reset),
          },
        }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");
    const userId = searchParams.get("user_id");

    // Validate project_id matches
    if (projectId !== keyResult.project_id) {
      return NextResponse.json({ last_capture_at: null });
    }

    // Query for last capture
    const supabase = createAdminClient();
    let query = supabase
      .from("prompts")
      .select("created_at")
      .eq("project_id", keyResult.project_id)
      .order("created_at", { ascending: false })
      .limit(1);

    // Filter by user if provided and valid UUID format
    if (userId) {
      // Validate user_id is a valid UUID to prevent SQL injection or invalid queries
      if (!isValidUUID(userId)) {
        console.warn("[API] cli/last-capture: Invalid user_id format", { userId: userId.substring(0, 50) });
        return NextResponse.json({ last_capture_at: null });
      }
      query = query.eq("user_id", userId);
    }

    const { data: prompts } = await query;

    const lastCaptureAt = prompts?.[0]?.created_at || null;

    return NextResponse.json({ last_capture_at: lastCaptureAt });
  } catch (error) {
    console.error("[API] cli/last-capture: error", error);
    return NextResponse.json({ last_capture_at: null });
  }
}
