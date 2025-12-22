/**
 * Admin Stats API Route
 * Story 7.2: Admin Dashboard Overview
 *
 * GET /api/admin/stats - Get platform statistics and trends
 * Protected by admin authentication.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminDashboardData } from "@/lib/db/queries/admin-stats";

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

    // Fetch platform stats and trends
    const data = await getAdminDashboardData();

    return NextResponse.json({
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[API] admin/stats: Error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch stats" } },
      { status: 500 }
    );
  }
}
