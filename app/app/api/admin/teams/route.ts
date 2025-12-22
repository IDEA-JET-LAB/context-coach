/**
 * Admin Teams API Route
 * Story 7.4: Team Overview
 *
 * GET /api/admin/teams - List all teams with stats
 * Protected by admin authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamsWithStats } from "@/lib/db/queries/admin-teams";

export async function GET(request: NextRequest) {
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
    console.error("[API] admin/teams: Error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch teams" } },
      { status: 500 }
    );
  }
}
