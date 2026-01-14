/**
 * Project Stage Analytics Timeline API - Story 31-5
 *
 * GET: Returns timeline data for stage analytics visualization
 * Supports daily and weekly granularity
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/utils/uuid";
import type {
  StageTimelineData,
  StageTimelineDataPoint,
  TimeRangeFilter,
  TimelineGranularity,
} from "@/lib/types/stage-analytics";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

/**
 * Get the start of the week (Monday) for a given date string.
 */
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getUTCDay();
  // Shift to Monday (day 1), handling Sunday (day 0) as the end of previous week
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  const isoDate = date.toISOString().split("T")[0];
  return isoDate ?? dateStr;
}

/**
 * GET /api/projects/[id]/stage-analytics/timeline
 *
 * Returns timeline data for stage analytics visualization.
 *
 * Query parameters:
 * - granularity: 'day' | 'week' (default: 'day')
 * - range: '7d' | '30d' | 'all' (default: '30d')
 *
 * Response:
 * {
 *   "data": {
 *     "projectId": "uuid",
 *     "granularity": "day",
 *     "dataPoints": [
 *       {
 *         "date": "2026-01-14",
 *         "stages": { "development": { ... }, "debugging": { ... } },
 *         "totalMinutes": 120.5
 *       }
 *     ]
 *   }
 * }
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;

    // Validate UUID format
    if (!isValidUuid(projectId)) {
      return NextResponse.json(
        { error: { code: "INVALID_ID", message: "Invalid project ID format" } },
        { status: 400 }
      );
    }

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

    // Verify user has access to this project (via team membership)
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, team_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        { status: 404 }
      );
    }

    // Verify team membership
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", project.team_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not a member of this team" } },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const granularity = (searchParams.get("granularity") || "day") as TimelineGranularity;
    const range = (searchParams.get("range") || "30d") as TimeRangeFilter;

    // Calculate date filter
    let sinceDate: Date | null = null;
    if (range === "7d") {
      sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build sessions query
    let query = supabase
      .from("sessions")
      .select("id, stage_breakdown, started_at")
      .eq("project_id", projectId)
      .eq("stage_analysis_status", "complete")
      .order("started_at", { ascending: true });

    if (sinceDate) {
      query = query.gte("started_at", sinceDate.toISOString());
    }

    const { data: sessions, error: sessionsError } = await query;

    if (sessionsError) {
      console.error("[stage-analytics/timeline] Sessions query error:", sessionsError);
      return NextResponse.json(
        { error: { code: "QUERY_ERROR", message: "Failed to fetch sessions" } },
        { status: 500 }
      );
    }

    // Group by date/week
    const dateGroups: Map<
      string,
      {
        stages: Record<string, { activeMinutes: number; promptCount: number; sessionCount: number }>;
        totalMinutes: number;
      }
    > = new Map();

    for (const session of sessions || []) {
      if (!session.started_at || !session.stage_breakdown) continue;

      // Get the date key based on granularity
      const dateStr = session.started_at.split("T")[0];
      const dateKey = granularity === "week" ? getWeekStart(dateStr) : dateStr;

      // Initialize date group if needed
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, { stages: {}, totalMinutes: 0 });
      }

      const group = dateGroups.get(dateKey)!;
      const breakdown = session.stage_breakdown as {
        stages?: Record<string, { activeMinutes?: number; promptCount?: number }>;
        totalActiveMinutes?: number;
      };

      // Aggregate stage data
      for (const [stage, data] of Object.entries(breakdown.stages || {})) {
        if (!group.stages[stage]) {
          group.stages[stage] = { activeMinutes: 0, promptCount: 0, sessionCount: 0 };
        }
        group.stages[stage].activeMinutes += data.activeMinutes || 0;
        group.stages[stage].promptCount += data.promptCount || 0;
        group.stages[stage].sessionCount++;
      }

      group.totalMinutes += breakdown.totalActiveMinutes || 0;
    }

    // Convert to data points array
    const dataPoints: StageTimelineDataPoint[] = Array.from(dateGroups.entries())
      .map(([date, data]) => ({
        date,
        stages: Object.fromEntries(
          Object.entries(data.stages).map(([stage, stats]) => [
            stage,
            {
              activeMinutes: Math.round(stats.activeMinutes * 10) / 10,
              promptCount: stats.promptCount,
              sessionCount: stats.sessionCount,
            },
          ])
        ),
        totalMinutes: Math.round(data.totalMinutes * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const response: StageTimelineData = {
      projectId,
      granularity,
      dataPoints,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("[stage-analytics/timeline] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
