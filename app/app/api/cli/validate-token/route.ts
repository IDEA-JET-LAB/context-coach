import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, extractApiKey } from "@/lib/api/validate-api-key";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/cli/validate-token
 *
 * Validates an install token for the CLI.
 * Called during `npx @contextor/cli init <token>` to verify the token is valid.
 *
 * Authorization: Bearer <api_key>
 *
 * Request body:
 * - project_id: string (required)
 * - team_id: string (required)
 * - user_id: string (required)
 *
 * Response:
 * - 200: { valid: true }
 * - 401: { error: { code: 'INVALID_API_KEY' | 'TOKEN_EXPIRED', message } }
 * - 403: { error: { code: 'FORBIDDEN', message } }
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

    // Parse request body
    let body: { project_id?: string; team_id?: string; user_id?: string };
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

    // Validate that the token's project_id matches the API key's project
    if (body.project_id !== keyResult.project_id) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Token does not match API key",
          },
        },
        { status: 403 }
      );
    }

    // Validate that the token's team_id matches
    if (body.team_id !== keyResult.team_id) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Token team does not match project team",
          },
        },
        { status: 403 }
      );
    }

    // Verify user exists and is a member of the team
    if (body.user_id) {
      const supabase = createAdminClient();
      const { data: membership } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", body.team_id)
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

    console.log("[API] cli/validate-token: success", {
      project_id: keyResult.project_id,
    });

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("[API] cli/validate-token: error", error);
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
