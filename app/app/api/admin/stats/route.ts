/**
 * Admin Stats API Route
 * Story 7.2: Admin Dashboard Overview
 *
 * GET /api/admin/stats - Get platform statistics and trends
 * Protected by admin authentication.
 *
 * M41 Fix: Uses consistent admin authorization pattern.
 */

import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin";
import { getAdminDashboardData } from "@/lib/db/queries/admin-stats";

export async function GET() {
  try {
    // M41 Fix: Use consistent admin authorization guard
    const auth = await requireSuperAdminApi();
    if (!auth.authorized) return auth.response;

    // Fetch platform stats and trends
    const data = await getAdminDashboardData();

    return NextResponse.json({
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // M39 Fix: Log full error details server-side only, return generic message to client
    console.error("[API] admin/stats: Error", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An error occurred while processing your request" } },
      { status: 500 }
    );
  }
}
