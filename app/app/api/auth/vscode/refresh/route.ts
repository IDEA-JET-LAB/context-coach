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
 * Token refresh response structure
 */
interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds until access token expires
  token_type: "Bearer";
}

/**
 * POST /api/auth/vscode/refresh
 *
 * Refreshes an access token using a refresh token.
 * This is called by the VS Code extension when the access token expires.
 *
 * Request Body:
 * - refresh_token: string (required) - Refresh token from previous token response
 *
 * Response:
 * - 200: RefreshResponse - New access token and refresh token
 * - 400: Invalid request (missing params, invalid token, expired token)
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

  let body: { refresh_token?: string };
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

  const { refresh_token: refreshToken } = body;

  if (!refreshToken) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Missing required parameter: refresh_token",
        },
      },
      { status: 400 }
    );
  }

  try {
    const adminClient = createAdminClient();

    // Look up the refresh token
    const { data: tokenRecord, error: lookupError } = await adminClient
      .from("vscode_tokens")
      .select("*")
      .eq("refresh_token", refreshToken)
      .single();

    if (lookupError || !tokenRecord) {
      console.warn("[Auth] VS Code refresh: Invalid refresh token");
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: "Invalid refresh token",
          },
        },
        { status: 400 }
      );
    }

    // Check if token is revoked
    if (tokenRecord.revoked_at) {
      console.warn("[Auth] VS Code refresh: Token was revoked");
      return NextResponse.json(
        {
          error: {
            code: "TOKEN_REVOKED",
            message: "Refresh token has been revoked",
          },
        },
        { status: 400 }
      );
    }

    // Check if refresh token is expired
    if (new Date(tokenRecord.refresh_token_expires_at) < new Date()) {
      // Mark as expired/invalid
      await adminClient
        .from("vscode_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", tokenRecord.id);

      console.warn("[Auth] VS Code refresh: Token expired");
      return NextResponse.json(
        {
          error: {
            code: "TOKEN_EXPIRED",
            message: "Refresh token has expired. Please sign in again.",
          },
        },
        { status: 400 }
      );
    }

    // Generate new access and refresh tokens
    const newAccessToken = randomUUID();
    const newRefreshToken = randomUUID();
    const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Revoke old token and create new one in a transaction-like manner
    // Mark old token as revoked
    await adminClient
      .from("vscode_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    // Create new token record
    const { error: insertError } = await adminClient
      .from("vscode_tokens")
      .insert({
        user_id: tokenRecord.user_id,
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
      });

    if (insertError) {
      console.error("[Auth] VS Code refresh: Failed to store new tokens:", insertError);
      return NextResponse.json(
        {
          error: {
            code: "SERVER_ERROR",
            message: "Failed to refresh tokens",
          },
        },
        { status: 500 }
      );
    }

    console.log("[Auth] VS Code tokens refreshed for user:", tokenRecord.user_id);

    const response: RefreshResponse = {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 3600, // 1 hour in seconds
      token_type: "Bearer",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Auth] VS Code refresh error:", error);
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
