/**
 * Project Stage Analysis API - Story 31-2
 *
 * POST: Trigger stage analysis for all sessions in a project
 * GET: Check the current analysis status
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/utils/uuid";
import {
  analyzeProjectStages,
  getProjectAnalysisStatus,
  type BatchAnalysisOptions,
} from "@/lib/analysis/stage-persistence";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

/**
 * POST /api/projects/[id]/analyze-stages
 *
 * Triggers stage analysis for all sessions in the project.
 * By default, analyzes ALL pending sessions (no limit).
 * Only analyzes sessions that haven't been analyzed yet unless
 * reanalyze=true is passed in the body.
 *
 * Request body (optional):
 * {
 *   "batchSize": 100,     // Max sessions to process (default: all pending)
 *   "reanalyze": false    // Re-analyze completed sessions (default: false)
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "projectId": "uuid",
 *     "sessionsProcessed": 10,
 *     "sessionsSucceeded": 9,
 *     "sessionsFailed": 1,
 *     "results": [...]
 *   }
 * }
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    // Parse request body for options
    let options: BatchAnalysisOptions = {};
    try {
      const body = await request.json();
      if (typeof body.batchSize === "number" && body.batchSize > 0) {
        options.batchSize = body.batchSize; // No cap - process as requested
      }
      if (typeof body.reanalyze === "boolean") {
        options.reanalyze = body.reanalyze;
      }
    } catch {
      // Empty body is fine - will process all pending sessions
    }

    // Run analysis
    const result = await analyzeProjectStages(projectId, options);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[analyze-stages] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/analyze-stages
 *
 * Gets the current stage analysis status for the project.
 *
 * Response:
 * {
 *   "data": {
 *     "projectId": "uuid",
 *     "totalSessions": 100,
 *     "pendingSessions": 20,
 *     "processingSessions": 0,
 *     "completedSessions": 75,
 *     "errorSessions": 5,
 *     "isComplete": false
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

    // Get analysis status
    const status = await getProjectAnalysisStatus(projectId);

    if (!status) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to get analysis status" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: status });
  } catch (error) {
    console.error("[analyze-stages] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
