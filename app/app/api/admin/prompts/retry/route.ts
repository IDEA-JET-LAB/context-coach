/**
 * Admin Retry API Endpoint
 * Story 5.5: Retry Logic and Error Handling
 *
 * POST /api/admin/prompts/retry
 * Resets a failed prompt for reprocessing.
 * Only accessible by super admins.
 *
 * Request body: { prompt_id: string }
 *
 * Response codes:
 * - 200 OK: Prompt reset successfully
 * - 400 BAD_REQUEST: Missing prompt_id
 * - 401 UNAUTHORIZED: Not authenticated
 * - 403 FORBIDDEN: Not super admin
 * - 404 NOT_FOUND: Prompt not found or not in failed state
 * - 500 INTERNAL_ERROR: Database operation failed
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserProfile } from "@/lib/auth/session";
import { retryFailedPrompt } from "@/lib/db/queries/dead-letter";
import { isValidUuid } from "@/lib/utils/uuid";

interface RetryRequest {
  prompt_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const profile = await getUserProfile();

    if (!profile) {
      console.warn("[API] admin/prompts/retry: unauthenticated request");
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Check super admin status
    if (!profile.is_super_admin) {
      console.warn(
        "[API] admin/prompts/retry: non-admin access attempt by user_id=%s",
        profile.id
      );
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Super admin access required",
          },
        },
        { status: 403 }
      );
    }

    // Parse request body
    let body: RetryRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const { prompt_id } = body;

    // Validate prompt_id is present
    if (!prompt_id) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "prompt_id is required" } },
        { status: 400 }
      );
    }

    // Validate prompt_id format
    if (!isValidUuid(prompt_id)) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "prompt_id must be a valid UUID",
          },
        },
        { status: 400 }
      );
    }

    // Attempt to reset the prompt
    const success = await retryFailedPrompt(prompt_id);

    if (!success) {
      console.log(
        "[API] admin/prompts/retry: prompt not found or not in failed state, prompt_id=%s",
        prompt_id
      );
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message:
              "Prompt not found or not in failed state. Only failed prompts can be retried.",
          },
        },
        { status: 404 }
      );
    }

    console.log(
      "[API] admin/prompts/retry: success, prompt_id=%s, admin_id=%s",
      prompt_id,
      profile.id
    );

    return NextResponse.json({
      success: true,
      message: "Prompt reset for retry",
      prompt_id,
    });
  } catch (error) {
    // M39 Fix: Log full error details server-side only, return generic message to client
    console.error("[API] admin/prompts/retry: unexpected error", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred while processing your request",
        },
      },
      { status: 500 }
    );
  }
}
