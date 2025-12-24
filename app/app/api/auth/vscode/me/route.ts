import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * User profile response structure
 */
interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

/**
 * GET /api/auth/vscode/me
 *
 * Returns the current user's profile based on the access token.
 * This is used by the VS Code extension to get user info when
 * the cached profile is missing (e.g., after token refresh).
 *
 * Headers:
 * - Authorization: Bearer <access_token>
 *
 * Response:
 * - 200: UserProfile - User profile data
 * - 401: Unauthorized (missing/invalid token)
 */
export async function GET(request: NextRequest) {
  // Extract access token from Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid Authorization header",
        },
      },
      { status: 401 }
    );
  }

  const accessToken = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const adminClient = createAdminClient();

    // Look up the access token
    const { data: tokenRecord, error: lookupError } = await adminClient
      .from("vscode_tokens")
      .select("user_id, access_token_expires_at, revoked_at")
      .eq("access_token", accessToken)
      .single();

    if (lookupError || !tokenRecord) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: "Invalid access token",
          },
        },
        { status: 401 }
      );
    }

    // Check if token is revoked
    if (tokenRecord.revoked_at) {
      return NextResponse.json(
        {
          error: {
            code: "TOKEN_REVOKED",
            message: "Access token has been revoked",
          },
        },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (new Date(tokenRecord.access_token_expires_at) < new Date()) {
      return NextResponse.json(
        {
          error: {
            code: "TOKEN_EXPIRED",
            message: "Access token has expired",
          },
        },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: user, error: userError } = await adminClient
      .from("users")
      .select("id, email, name, avatar_url")
      .eq("id", tokenRecord.user_id)
      .single();

    if (userError || !user) {
      console.error("[Auth] VS Code /me: Failed to fetch user:", userError);
      return NextResponse.json(
        {
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        },
        { status: 404 }
      );
    }

    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      avatar_url: user.avatar_url || undefined,
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[Auth] VS Code /me error:", error);
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
