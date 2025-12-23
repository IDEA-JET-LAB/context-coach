import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import {
  ipRateLimit,
  checkRateLimit,
  getClientIp,
  calculateRetryAfter,
} from "@/lib/rate-limit";

/**
 * Token response structure for VS Code extension
 */
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds until access token expires
  token_type: "Bearer";
  user: {
    id: string;
    email: string;
    name?: string;
    avatar_url?: string;
  };
}

/**
 * POST /api/auth/vscode/token
 *
 * Exchanges an authorization code for access and refresh tokens.
 * This is called by the VS Code extension after receiving the callback.
 *
 * Request Body:
 * - code: string (required) - Authorization code from /authorize callback
 * - state: string (required) - CSRF token that was sent to /authorize
 *
 * Response:
 * - 200: TokenResponse - Access token, refresh token, and user info
 * - 400: Invalid request (missing params, invalid code, expired code)
 * - 429: Rate limited
 */
export async function POST(request: NextRequest) {
  // Rate limit check
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimit(ipRateLimit, clientIp);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": calculateRetryAfter(rateLimitResult.reset),
        },
      }
    );
  }

  let body: { code?: string; state?: string };
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

  const { code, state } = body;

  if (!code || !state) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Missing required parameters: code and state",
        },
      },
      { status: 400 }
    );
  }

  try {
    const adminClient = createAdminClient();

    // Look up the authorization code
    const { data: authCode, error: lookupError } = await adminClient
      .from("vscode_auth_codes")
      .select("*")
      .eq("code", code)
      .single();

    if (lookupError || !authCode) {
      console.warn("[Auth] VS Code token: Invalid code");
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CODE",
            message: "Invalid or expired authorization code",
          },
        },
        { status: 400 }
      );
    }

    // Validate the state matches
    if (authCode.state !== state) {
      console.warn("[Auth] VS Code token: State mismatch");
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: "State parameter mismatch",
          },
        },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (new Date(authCode.expires_at) < new Date()) {
      // Delete expired code
      await adminClient.from("vscode_auth_codes").delete().eq("code", code);
      console.warn("[Auth] VS Code token: Expired code");
      return NextResponse.json(
        {
          error: {
            code: "EXPIRED_CODE",
            message: "Authorization code has expired",
          },
        },
        { status: 400 }
      );
    }

    // Check if code was already used
    if (authCode.used_at) {
      console.warn("[Auth] VS Code token: Code already used");
      return NextResponse.json(
        {
          error: {
            code: "CODE_ALREADY_USED",
            message: "Authorization code has already been used",
          },
        },
        { status: 400 }
      );
    }

    // Mark code as used (prevent replay)
    await adminClient
      .from("vscode_auth_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("code", code);

    // Get user profile
    const { data: user, error: userError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .eq("id", authCode.user_id)
      .single();

    if (userError || !user) {
      console.error("[Auth] VS Code token: Failed to get user profile:", userError);
      return NextResponse.json(
        {
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        },
        { status: 400 }
      );
    }

    // Generate access and refresh tokens
    const accessToken = randomUUID();
    const refreshToken = randomUUID();
    const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store tokens in database
    const { error: tokenError } = await adminClient
      .from("vscode_tokens")
      .insert({
        user_id: authCode.user_id,
        access_token: accessToken,
        refresh_token: refreshToken,
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("[Auth] VS Code token: Failed to store tokens:", tokenError);
      return NextResponse.json(
        {
          error: {
            code: "SERVER_ERROR",
            message: "Failed to generate tokens",
          },
        },
        { status: 500 }
      );
    }

    console.log("[Auth] VS Code tokens issued for user:", authCode.user_id);

    const response: TokenResponse = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600, // 1 hour in seconds
      token_type: "Bearer",
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name || undefined,
        avatar_url: user.avatar_url || undefined,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Auth] VS Code token error:", error);
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
