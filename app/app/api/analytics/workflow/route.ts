/**
 * Workflow Efficiency Analytics API - Story 21-10: Workflow Efficiency Metrics
 *
 * GET /api/analytics/workflow
 *
 * Returns workflow efficiency metrics for the authenticated user including
 * prompts per task, context resets, debugging loops, and efficiency score.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/utils/logger";
import {
  calculateWorkflowEfficiency,
  TEAM_BENCHMARKS,
  type UserEfficiencyInput,
} from "@/lib/analysis";
import { createAdminClient } from "@/lib/supabase/admin";

const logger = createScopedLogger("API_WORKFLOW_EFFICIENCY");

/**
 * Aggregate user metrics from database
 */
async function aggregateUserMetrics(
  userId: string,
  dateRange?: { startDate: Date; endDate: Date }
): Promise<UserEfficiencyInput> {
  const supabase = createAdminClient();

  // Build date filter
  const startDate = dateRange?.startDate || new Date(0);
  const endDate = dateRange?.endDate || new Date();

  // Get prompts count
  const { count: totalPrompts } = await supabase
    .from("prompts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  // Get sessions count
  const { count: totalSessions } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("started_at", startDate.toISOString())
    .lte("started_at", endDate.toISOString());

  // Get total session time in minutes
  const { data: sessions } = await supabase
    .from("sessions")
    .select("started_at, ended_at, total_prompts")
    .eq("user_id", userId)
    .gte("started_at", startDate.toISOString())
    .lte("started_at", endDate.toISOString())
    .not("ended_at", "is", null);

  let totalTimeMinutes = 0;
  let completedTasks = 0;

  if (sessions) {
    for (const session of sessions) {
      if (session.started_at && session.ended_at) {
        const duration =
          (new Date(session.ended_at).getTime() -
            new Date(session.started_at).getTime()) /
          60000;
        totalTimeMinutes += duration;
      }
      // Count sessions as completed tasks (rough approximation)
      // In future, this could be derived from session goals or commit patterns
      completedTasks++;
    }
  }

  // For context resets and debugging - we'll estimate from prompt patterns
  // In a full implementation, these would be tracked explicitly
  // For now, we use reasonable defaults based on session count

  // Estimate context resets (roughly 30% of sessions have context resets)
  const contextResets = Math.round((totalSessions || 0) * 0.3);

  // Estimate debugging prompts (roughly 20% of prompts are debugging-related)
  const debuggingPrompts = Math.round((totalPrompts || 0) * 0.2);

  // Debugging resolutions (roughly 70% of debugging sessions resolve the issue)
  const debuggingResolutions = Math.round(debuggingPrompts / 3);

  return {
    totalPrompts: totalPrompts || 0,
    completedTasks,
    contextResets,
    totalSessions: totalSessions || 0,
    debuggingPrompts,
    debuggingResolutions,
    totalTimeMinutes,
  };
}

/**
 * GET /api/analytics/workflow
 *
 * Query parameters:
 * - startDate: ISO date string (optional, default: 30 days ago)
 * - endDate: ISO date string (optional, default: now)
 *
 * Authorization:
 * - User must be authenticated
 *
 * Response:
 * - 200: { data: WorkflowEfficiencyMetrics }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 *
 * @example Response
 * {
 *   "data": {
 *     "metrics": {
 *       "promptsPerTask": 5.2,
 *       "contextResetsPerSession": 0.35,
 *       "debuggingLoopAverage": 2.8,
 *       "timeToResolutionMinutes": 45,
 *       "efficiencyScore": 78,
 *       "benchmark": "above_average"
 *     },
 *     "benchmarks": {
 *       "promptsPerTask": 5.8,
 *       "contextResetsPerSession": 0.5,
 *       "debuggingLoopAverage": 3.0
 *     },
 *     "input": {
 *       "totalPrompts": 156,
 *       "completedTasks": 30,
 *       "contextResets": 9,
 *       "totalSessions": 26,
 *       "debuggingPrompts": 31,
 *       "debuggingResolutions": 11,
 *       "totalTimeMinutes": 1350
 *     }
 *   }
 * }
 */
export async function GET(request: Request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          },
        },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    // Default to last 30 days
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_DATE",
            message: "Invalid date format. Use ISO date strings.",
          },
        },
        { status: 400 }
      );
    }

    // Aggregate user metrics
    const userMetrics = await aggregateUserMetrics(user.id, {
      startDate,
      endDate,
    });

    // Calculate workflow efficiency
    const efficiencyMetrics = calculateWorkflowEfficiency(userMetrics);

    logger.log("Workflow efficiency calculated", {
      userId: user.id,
      score: efficiencyMetrics.efficiencyScore,
      benchmark: efficiencyMetrics.benchmark,
    });

    return NextResponse.json({
      data: {
        metrics: efficiencyMetrics,
        benchmarks: TEAM_BENCHMARKS,
        input: userMetrics,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error("Failed to calculate workflow efficiency", error);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
