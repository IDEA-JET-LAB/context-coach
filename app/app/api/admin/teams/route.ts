/**
 * Admin Teams API Route
 * Story 7.4: Team Overview
 *
 * GET /api/admin/teams - List all teams with stats
 * Protected by admin authentication.
 *
 * M41 Fix: Uses consistent admin authorization pattern.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin";
import { getTeamsWithStats } from "@/lib/db/queries/admin-teams";

export async function GET(request: NextRequest) {
  try {
    // M41 Fix: Use consistent admin authorization guard
    const auth = await requireSuperAdminApi();
    if (!auth.authorized) return auth.response;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || undefined;
    const sortBy = (searchParams.get("sortBy") as "name" | "member_count" | "prompts_count" | "created_at") || "created_at";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

    // Validate parameters
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid pagination parameters" } },
        { status: 400 }
      );
    }

    // Fetch teams with stats
    const result = await getTeamsWithStats({
      page,
      pageSize,
      search,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      data: result.teams,
      meta: {
        count: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    // M39 Fix: Log full error details server-side only, return generic message to client
    console.error("[API] admin/teams: Error", {
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
