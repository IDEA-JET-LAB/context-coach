import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import {
  ipRateLimit,
  checkRateLimit,
  getClientIp,
  calculateRetryAfter,
} from "@/lib/rate-limit";

/**
 * GET /api/auth/vscode/authorize
 *
 * Initiates the VS Code OAuth flow. This endpoint:
 * 1. Checks if the user is authenticated
 * 2. Generates a one-time authorization code
 * 3. Stores it temporarily in the database
 * 4. Redirects to the VS Code URI handler with the code
 *
 * Query Parameters:
 * - state: string (required) - CSRF token from the VS Code extension
 * - redirect_uri: string (required) - VS Code callback URI (vscode://contextor.contextor-vscode/callback)
 *
 * Redirects to:
 * - {redirect_uri}?code={code}&state={state} on success
 * - {redirect_uri}?error=access_denied&state={state} if not authenticated
 * - /login?next=/api/auth/vscode/authorize?... if user needs to login
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get("state");
  const redirectUri = searchParams.get("redirect_uri");

  // Validate required parameters
  if (!state || !redirectUri) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Missing required parameters: state and redirect_uri",
        },
      },
      { status: 400 }
    );
  }

  // Validate redirect_uri is a VS Code protocol
  if (
    !redirectUri.startsWith("vscode://") &&
    !redirectUri.startsWith("vscode-insiders://")
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REDIRECT_URI",
          message: "redirect_uri must be a VS Code protocol URI",
        },
      },
      { status: 400 }
    );
  }

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

  try {
    // Check if user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // User not authenticated - redirect to login page
      // The login page will redirect back here after authentication
      const currentUrl = request.url;
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", currentUrl);
      return NextResponse.redirect(loginUrl);
    }

    // Generate a one-time authorization code
    const code = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store the code in the database using admin client
    const adminClient = createAdminClient();
    const { error: insertError } = await adminClient
      .from("vscode_auth_codes")
      .insert({
        code,
        user_id: user.id,
        state,
        redirect_uri: redirectUri,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("[Auth] Failed to store VS Code auth code:", insertError);
      const errorUrl = new URL(redirectUri);
      errorUrl.searchParams.set("error", "server_error");
      errorUrl.searchParams.set("state", state);
      return NextResponse.redirect(errorUrl.toString());
    }

    // Redirect to VS Code with the authorization code
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);

    console.log("[Auth] VS Code auth code generated for user:", user.id);
    return NextResponse.redirect(callbackUrl.toString());
  } catch (error) {
    console.error("[Auth] VS Code authorize error:", error);
    // Redirect to VS Code with an error
    const errorUrl = new URL(redirectUri);
    errorUrl.searchParams.set("error", "server_error");
    errorUrl.searchParams.set("state", state);
    return NextResponse.redirect(errorUrl.toString());
  }
}
