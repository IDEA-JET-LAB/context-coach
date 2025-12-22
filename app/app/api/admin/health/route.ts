/**
 * Admin Health API Route
 * Story 7.2: Admin Dashboard Overview
 *
 * GET /api/admin/health - Get system health metrics
 * Protected by admin authentication.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSystemHealthWithStatus } from "@/lib/db/queries/system-health";

export async function GET() {
  try {
    // Verify admin authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const { data: userData } = await supabase
      .from("users")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.is_super_admin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    // Fetch system health data
    const data = await getSystemHealthWithStatus();

    return NextResponse.json({
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[API] admin/health: Error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch health metrics" } },
      { status: 500 }
    );
  }
}
