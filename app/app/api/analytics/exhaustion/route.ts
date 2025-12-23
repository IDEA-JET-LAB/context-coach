/**
 * Context Exhaustion Analytics API - Story 21-1: Context Window Management
 *
 * GET /api/analytics/exhaustion
 *
 * Returns context exhaustion metrics for the authenticated user including
 * exhaustion rate, average duration before exhaustion, and feedback.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/utils/logger";
import {
  calculateUserExhaustionRate,
  calculateTeamExhaustionRate,
} from "@/lib/analytics/exhaustion-metrics";
import { generateExhaustionFeedback } from "@/lib/analysis";

const logger = createScopedLogger("API_EXHAUSTION_ANALYTICS");

/**
 * GET /api/analytics/exhaustion
 *
 * Query parameters:
 * - startDate: ISO date string (optional, default: 30 days ago)
 * - endDate: ISO date string (optional, default: now)
 * - projectId: Filter by project (optional)
 * - teamId: Get team-wide metrics instead of user metrics (optional)
 *
 * Authorization:
 * - User must be authenticated
 *
 * Response:
 * - 200: { data: ExhaustionAnalyticsResponse }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 *
 * @example Response
 * {
 *   "data": {
 *     "metrics": {
 *       "exhaustionRate": 0.35,
 *       "totalSessions": 20,
 *       "exhaustedSessions": 7,
 *       "avgDurationBeforeExhaustion": 85
 *     },
 *     "feedback": {
 *       "message": "You hit context limits in 35% of sessions",
 *       "severity": "moderate",
 *       "suggestion": "Try summarizing progress before sessions get too long."
 *     },
 *     "dateRange": {
 *       "startDate": "2024-01-01T00:00:00.000Z",
 *       "endDate": "2024-01-31T23:59:59.999Z"
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
    const projectId = url.searchParams.get("projectId") || undefined;
    const teamId = url.searchParams.get("teamId") || undefined;

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

    const options = { startDate, endDate, projectId };

    // Calculate metrics (user or team level)
    const metrics = teamId
      ? await calculateTeamExhaustionRate(teamId, options)
      : await calculateUserExhaustionRate(user.id, options);

    // Generate feedback
    const feedback = generateExhaustionFeedback(metrics.exhaustionRate);

    logger.log("Exhaustion analytics calculated", {
      userId: user.id,
      teamId,
      exhaustionRate: metrics.exhaustionRate,
      totalSessions: metrics.totalSessions,
      severity: feedback.severity,
    });

    return NextResponse.json({
      data: {
        metrics,
        feedback,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error("Failed to calculate exhaustion analytics", error);

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
