import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import {
  ipRateLimit,
  checkRateLimit,
  getClientIp,
  calculateRetryAfter,
} from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validations/auth";
import { z } from "zod";

/**
 * Signup response for VS Code extension
 */
interface SignupResponse {
  success: boolean;
  message: string;
  requiresEmailConfirmation: boolean;
  // Tokens are only returned if email confirmation is disabled
  tokens?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: "Bearer";
    user: {
      id: string;
      email: string;
      name?: string;
    };
  };
}

/**
 * POST /api/auth/vscode/signup
 *
 * Creates a new user account from the VS Code extension.
 *
 * Request Body:
 * - email: string (required)
 * - password: string (required) - Min 12 chars, must include lowercase, uppercase, number
 * - confirmPassword: string (required) - Must match password
 *
 * Response:
 * - 200: SignupResponse - Success with optional tokens
 * - 400: Validation error or signup failed
 * - 429: Rate limited
 */
export async function POST(request: NextRequest) {
  // Rate limit check - stricter for signup
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

  let body: { email?: string; password?: string; confirmPassword?: string };
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

  // Validate input
  try {
    signupSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: firstIssue?.message || "Invalid input",
            field: firstIssue?.path?.[0],
          },
        },
        { status: 400 }
      );
    }
    throw error;
  }

  const { email, password } = body as { email: string; password: string };

  try {
    const adminClient = createAdminClient();

    // Create user using admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Send confirmation email
    });

    if (createError) {
      console.warn("[Auth] VS Code signup error:", createError.message);

      // Handle specific error cases
      if (createError.message.includes("already registered")) {
        return NextResponse.json(
          {
            error: {
              code: "EMAIL_EXISTS",
              message: "An account with this email already exists. Please sign in instead.",
            },
          },
          { status: 400 }
        );
      }

      // Generic error for security
      return NextResponse.json(
        {
          error: {
            code: "SIGNUP_FAILED",
            message: "Unable to create account. Please try again.",
          },
        },
        { status: 400 }
      );
    }

    if (!newUser?.user) {
      return NextResponse.json(
        {
          error: {
            code: "SIGNUP_FAILED",
            message: "Unable to create account. Please try again.",
          },
        },
        { status: 400 }
      );
    }

    console.log("[Auth] VS Code signup: User created:", newUser.user.id);

    // Check if user requires email confirmation
    const requiresEmailConfirmation = !newUser.user.email_confirmed_at;

    if (requiresEmailConfirmation) {
      // User needs to confirm email first
      const response: SignupResponse = {
        success: true,
        message: "Account created! Please check your email to verify your account.",
        requiresEmailConfirmation: true,
      };
      return NextResponse.json(response);
    }

    // Email confirmation disabled - issue tokens immediately
    const accessToken = randomUUID();
    const refreshToken = randomUUID();
    const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store tokens in database
    const { error: tokenError } = await adminClient
      .from("vscode_tokens")
      .insert({
        user_id: newUser.user.id,
        access_token: accessToken,
        refresh_token: refreshToken,
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("[Auth] VS Code signup: Failed to store tokens:", tokenError);
      // Still return success, user can sign in manually
      const response: SignupResponse = {
        success: true,
        message: "Account created! Please sign in to continue.",
        requiresEmailConfirmation: false,
      };
      return NextResponse.json(response);
    }

    const response: SignupResponse = {
      success: true,
      message: "Account created successfully!",
      requiresEmailConfirmation: false,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        token_type: "Bearer",
        user: {
          id: newUser.user.id,
          email: newUser.user.email || email,
          name: newUser.user.user_metadata?.full_name,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Auth] VS Code signup error:", error);
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
