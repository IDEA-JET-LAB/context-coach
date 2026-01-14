import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  submitFeedbackSchema,
  feedbackListQuerySchema,
} from "@/lib/validations/feedback";
import { requireSuperAdminApi } from "@/lib/auth/admin";

/**
 * Verify VS Code access token and get user ID.
 */
async function verifyVSCodeToken(
  accessToken: string,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const { data: tokenRecord, error } = await adminClient
    .from("vscode_tokens")
    .select("user_id, access_token_expires_at, revoked_at")
    .eq("access_token", accessToken)
    .single();

  if (error || !tokenRecord) return null;
  if (tokenRecord.revoked_at) return null;
  if (new Date(tokenRecord.access_token_expires_at) < new Date()) return null;

  return tokenRecord.user_id;
}

/**
 * POST /api/feedback
 * Submit feedback from VS Code extension
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    let userId: string | null = null;

    // Check for VS Code access token in Authorization header
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const accessToken = authHeader.slice(7);
      userId = await verifyVSCodeToken(accessToken, adminClient);
    }

    // If no VS Code token, try Supabase session auth
    if (!userId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = submitFeedbackSchema.parse(body);

    // Insert feedback
    const { data, error } = await adminClient
      .from("feedback")
      .insert({
        user_id: userId,
        category: validated.category,
        message: validated.message,
        extension_version: validated.extensionVersion || null,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[API] feedback: Insert error", error);
      return NextResponse.json(
        { error: { code: "INSERT_FAILED", message: "Failed to submit feedback" } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: {
          id: data.id,
          createdAt: data.created_at,
          message: "Thank you for your feedback!",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: firstError?.message || "Validation failed",
          },
        },
        { status: 400 }
      );
    }
    console.error("[API] feedback: Unexpected error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feedback
 * List feedback (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Require super admin access
    const auth = await requireSuperAdminApi();
    if (!auth.authorized) return auth.response;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = feedbackListQuerySchema.parse({
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
      sortBy: searchParams.get("sortBy") || "created_at",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    const adminClient = createAdminClient();

    // Build query
    let dbQuery = adminClient
      .from("feedback")
      .select(
        `
        id,
        category,
        message,
        extension_version,
        created_at,
        status,
        admin_notes,
        reviewed_at,
        user_id,
        users!feedback_user_id_fkey (
          email,
          name
        )
      `,
        { count: "exact" }
      );

    // Apply filters
    if (query.category) {
      dbQuery = dbQuery.eq("category", query.category);
    }
    if (query.status) {
      dbQuery = dbQuery.eq("status", query.status);
    }

    // Apply sorting
    dbQuery = dbQuery.order(query.sortBy, { ascending: query.sortOrder === "asc" });

    // Apply pagination
    const offset = (query.page - 1) * query.limit;
    dbQuery = dbQuery.range(offset, offset + query.limit - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      console.error("[API] feedback: Query error", error);
      return NextResponse.json(
        { error: { code: "QUERY_FAILED", message: "Failed to fetch feedback" } },
        { status: 500 }
      );
    }

    // Transform data to include user email
    const feedback = data?.map((item) => ({
      id: item.id,
      category: item.category,
      message: item.message,
      extensionVersion: item.extension_version,
      createdAt: item.created_at,
      status: item.status,
      adminNotes: item.admin_notes,
      reviewedAt: item.reviewed_at,
      userId: item.user_id,
      userEmail: (item.users as { email?: string })?.email || null,
      userName: (item.users as { name?: string })?.name || null,
    }));

    return NextResponse.json({
      data: feedback,
      meta: {
        total: count || 0,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil((count || 0) / query.limit),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid query parameters" } },
        { status: 400 }
      );
    }
    console.error("[API] feedback: Unexpected error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
