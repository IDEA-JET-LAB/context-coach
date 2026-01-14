import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateFeedbackStatusSchema } from "@/lib/validations/feedback";
import { requireSuperAdminApi } from "@/lib/auth/admin";

/**
 * PATCH /api/feedback/[id]
 * Update feedback status (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require super admin access
    const auth = await requireSuperAdminApi();
    if (!auth.authorized) return auth.response;

    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: { code: "INVALID_ID", message: "Invalid feedback ID format" } },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = updateFeedbackStatusSchema.parse(body);

    const adminClient = createAdminClient();

    // Update feedback
    const { data, error } = await adminClient
      .from("feedback")
      .update({
        status: validated.status,
        admin_notes: validated.adminNotes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.userId,
      })
      .eq("id", id)
      .select("id, status, admin_notes, reviewed_at")
      .single();

    if (error) {
      console.error("[API] feedback update: Error", error);
      return NextResponse.json(
        { error: { code: "UPDATE_FAILED", message: "Failed to update feedback" } },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Feedback not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: data.id,
        status: data.status,
        adminNotes: data.admin_notes,
        reviewedAt: data.reviewed_at,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
        { status: 400 }
      );
    }
    console.error("[API] feedback update: Unexpected error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
