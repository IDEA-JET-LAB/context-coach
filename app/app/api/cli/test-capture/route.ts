import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, extractApiKey } from "@/lib/api/validate-api-key";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/cli/test-capture
 *
 * Tests the capture connection for the CLI.
 * Called after installation to verify everything is configured correctly.
 *
 * Authorization: Bearer <api_key>
 *
 * Request body:
 * - project_id: string (required)
 * - user_id: string (required)
 * - cli_version: string (optional)
 * - test: boolean (optional)
 *
 * Response:
 * - 200: { success: true }
 * - 401: { error: { code: 'AUTH_FAILED', message } }
 * - 403: { error: { code: 'FORBIDDEN', message } }
 * - 404: { error: { code: 'PROJECT_NOT_FOUND', message } }
 */
export async function POST(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get("Authorization");
    const apiKey = extractApiKey(authHeader);

    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_FAILED",
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
            code: "AUTH_FAILED",
            message: "Invalid or missing API key",
          },
        },
        { status: 401 }
      );
    }

    // Parse request body
    let body: {
      project_id?: string;
      user_id?: string;
      cli_version?: string;
      test?: boolean;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Request body must be valid JSON",
          },
        },
        { status: 400 }
      );
    }

    // Validate project_id matches
    if (body.project_id !== keyResult.project_id) {
      return NextResponse.json(
        {
          error: {
            code: "PROJECT_NOT_FOUND",
            message: "Project not found",
          },
        },
        { status: 404 }
      );
    }

    // Verify user is a member of the team
    if (body.user_id) {
      const supabase = createAdminClient();
      const { data: membership } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", keyResult.team_id)
        .eq("user_id", body.user_id)
        .single();

      if (!membership) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "User is not a member of this team",
            },
          },
          { status: 403 }
        );
      }
    }

    console.log("[API] cli/test-capture: success", {
      project_id: keyResult.project_id,
      cli_version: body.cli_version,
      is_test: body.test,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] cli/test-capture: error", error);
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
