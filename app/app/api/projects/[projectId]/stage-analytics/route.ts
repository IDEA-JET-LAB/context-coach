/**
 * Project Stage Analytics API - Story 31-5
 *
 * GET: Returns aggregated stage analytics data for a project
 * Supports time range filtering (7d, 30d, all)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/utils/uuid";
import type {
  ProjectStageAnalytics,
  StageBreakdownItem,
  TimeRangeFilter,
} from "@/lib/types/stage-analytics";
import type { ProjectStage } from "@/lib/types/conversations";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

/**
 * Helper to get date filter based on time range.
 */
function getDateFilter(range: TimeRangeFilter): Date | null {
  switch (range) {
    case "7d":
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return null;
  }
}

/**
 * GET /api/projects/[id]/stage-analytics
 *
 * Returns aggregated stage analytics data for the project.
 *
 * Query parameters:
 * - range: '7d' | '30d' | 'all' (default: 'all')
 *
 * Response:
 * {
 *   "data": {
 *     "projectId": "uuid",
 *     "projectName": "My Project",
 *     "analysisStatus": {...},
 *     "summary": {...},
 *     "primaryStage": "development",
 *     "averageSessionMinutes": 45.5
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
      .select("id, name, team_id")
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
    const range = (searchParams.get("range") || "all") as TimeRangeFilter;
    const dateFilter = getDateFilter(range);

    // Build sessions query
    let query = supabase
      .from("sessions")
      .select("id, stage_breakdown, primary_stage, stage_analysis_status, started_at, stage_analysis_at")
      .eq("project_id", projectId);

    if (dateFilter) {
      query = query.gte("started_at", dateFilter.toISOString());
    }

    const { data: sessions, error: sessionsError } = await query;

    if (sessionsError) {
      console.error("[stage-analytics] Sessions query error:", sessionsError);
      return NextResponse.json(
        { error: { code: "QUERY_ERROR", message: "Failed to fetch sessions" } },
        { status: 500 }
      );
    }

    // Calculate analysis status
    const statusCounts = {
      total: sessions?.length || 0,
      complete: 0,
      pending: 0,
      processing: 0,
      error: 0,
    };

    let lastAnalyzedAt: string | null = null;

    for (const session of sessions || []) {
      const status = session.stage_analysis_status;
      if (status === "complete") {
        statusCounts.complete++;
        if (session.stage_analysis_at) {
          if (!lastAnalyzedAt || session.stage_analysis_at > lastAnalyzedAt) {
            lastAnalyzedAt = session.stage_analysis_at;
          }
        }
      } else if (status === "processing") {
        statusCounts.processing++;
      } else if (status === "error") {
        statusCounts.error++;
      } else {
        statusCounts.pending++;
      }
    }

    // Aggregate stage data from analyzed sessions
    const stageAccumulator: Map<
      ProjectStage,
      { minutes: number; prompts: number; sessions: Set<string> }
    > = new Map();

    let totalMinutes = 0;
    let totalPrompts = 0;
    let dateStart: string | null = null;
    let dateEnd: string | null = null;

    for (const session of sessions || []) {
      if (session.stage_breakdown && session.stage_analysis_status === "complete") {
        const breakdown = session.stage_breakdown as {
          stages?: Record<string, { activeMinutes?: number; promptCount?: number }>;
          totalActiveMinutes?: number;
          totalPrompts?: number;
        };

        // Aggregate by stage
        for (const [stage, data] of Object.entries(breakdown.stages || {})) {
          const existing = stageAccumulator.get(stage as ProjectStage) || {
            minutes: 0,
            prompts: 0,
            sessions: new Set<string>(),
          };
          existing.minutes += data.activeMinutes || 0;
          existing.prompts += data.promptCount || 0;
          existing.sessions.add(session.id);
          stageAccumulator.set(stage as ProjectStage, existing);
        }

        totalMinutes += breakdown.totalActiveMinutes || 0;
        totalPrompts += breakdown.totalPrompts || 0;

        // Track date range
        if (session.started_at) {
          if (!dateStart || session.started_at < dateStart) {
            dateStart = session.started_at;
          }
          if (!dateEnd || session.started_at > dateEnd) {
            dateEnd = session.started_at;
          }
        }
      }
    }

    // Build stage breakdown array
    const stageBreakdown: StageBreakdownItem[] = Array.from(stageAccumulator.entries())
      .map(([stage, data]) => ({
        stage,
        activeMinutes: Math.round(data.minutes * 10) / 10,
        promptCount: data.prompts,
        percentage:
          totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0,
        sessionCount: data.sessions.size,
      }))
      .sort((a, b) => b.activeMinutes - a.activeMinutes);

    // Determine primary stage
    const firstStage = stageBreakdown[0];
    const primaryStage: ProjectStage = firstStage ? firstStage.stage : "unknown";

    const response: ProjectStageAnalytics = {
      projectId: project.id,
      projectName: project.name,
      analysisStatus: {
        totalSessions: statusCounts.total,
        analyzedSessions: statusCounts.complete,
        pendingSessions: statusCounts.pending,
        errorSessions: statusCounts.error,
        lastAnalyzedAt,
      },
      summary: {
        totalActiveMinutes: Math.round(totalMinutes * 10) / 10,
        totalPrompts,
        sessionsAnalyzed: statusCounts.complete,
        dateRange: {
          start: dateStart || new Date().toISOString(),
          end: dateEnd || new Date().toISOString(),
        },
        stageBreakdown,
      },
      primaryStage,
      averageSessionMinutes:
        statusCounts.complete > 0
          ? Math.round((totalMinutes / statusCounts.complete) * 10) / 10
          : 0,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("[stage-analytics] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
