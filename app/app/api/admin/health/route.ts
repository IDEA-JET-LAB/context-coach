/**
 * Admin Health API Route
 * Story 7.2: Admin Dashboard Overview
 *
 * GET /api/admin/health - Get system health metrics
 * Protected by admin authentication.
 *
 * M41 Fix: Uses consistent admin authorization pattern.
 *
 * Rate Limiting: Not rate-limited by design.
 * - Docker/Cloud Run health checks call this endpoint every 30s
 * - Admin authentication provides sufficient protection
 * - System health queries are lightweight (cached in database views)
 * - False positives from rate limiting could cause container restarts
 */

import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin";
import { getSystemHealthWithStatus } from "@/lib/db/queries/system-health";

export async function GET() {
  try {
    // M41 Fix: Use consistent admin authorization guard
    const auth = await requireSuperAdminApi();
    if (!auth.authorized) return auth.response;

    // Fetch system health data
    const data = await getSystemHealthWithStatus();

    return NextResponse.json({
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // M39 Fix: Log full error details server-side only, return generic message to client
    console.error("[API] admin/health: Error", {
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
