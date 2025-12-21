import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, extractApiKey } from "@/lib/api/validate-api-key";
import { createAdminClient } from "@/lib/supabase/admin";

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
 */
export async function GET(request: NextRequest) {
  try {
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

    // Filter by user if provided
    if (userId) {
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
