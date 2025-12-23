/**
 * Session Duration Analytics API - Story 16-6: Session Duration Calculation
 *
 * GET /api/analytics/sessions/duration
 *
 * Returns duration statistics and period summaries for the authenticated user.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/utils/logger";
import { getSessionDurationStats } from "@/lib/sessions/duration-aggregates";
import {
  getDailySummary,
  getWeeklySummary,
  getMonthlySummary,
} from "@/lib/sessions/duration-summaries";
import { getUserEfficiencyMetrics } from "@/lib/sessions/efficiency";
import { formatDuration } from "@/lib/sessions/duration";

const logger = createScopedLogger("API_SESSION_DURATION");

/**
 * Period type for summaries
 */
type PeriodType = "daily" | "weekly" | "monthly";

/**
 * GET /api/analytics/sessions/duration
 *
 * Query parameters:
 * - period: "daily" | "weekly" | "monthly" (default: "daily")
 * - count: number of periods to include (default: 7 for daily, 4 for weekly, 6 for monthly)
 * - includeEfficiency: "true" to include efficiency metrics (default: "false")
 *
 * Authorization:
 * - User must be authenticated
 *
 * Response:
 * - 200: { data: { stats, summaries, efficiency? } }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 *
 * @example Response
 * {
 *   "data": {
 *     "stats": {
 *       "totalMinutes": 1200,
 *       "totalHours": 20,
 *       "totalFormatted": "20h",
 *       "averageMinutes": 60,
 *       "averageFormatted": "1h",
 *       "longestMinutes": 120,
 *       "longestFormatted": "2h",
 *       "shortestMinutes": 15,
 *       "shortestFormatted": "15m",
 *       "sessionCount": 20,
 *       "activeCount": 1,
 *       "medianMinutes": 55,
 *       "trimmedMeanMinutes": 58
 *     },
 *     "summaries": [
 *       {
 *         "period": "2025-01-15",
 *         "periodLabel": "Today",
 *         "totalMinutes": 180,
 *         "totalFormatted": "3h",
 *         "sessionCount": 3,
 *         "averageMinutes": 60,
 *         "averageFormatted": "1h"
 *       }
 *     ],
 *     "efficiency": {
 *       "promptsPerHour": 12.5,
 *       "averageTimeBetweenPrompts": 4.8,
 *       "sessionDensity": 0.85,
 *       "peakHour": 14,
 *       "hourlyDistribution": [...]
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
    const periodParam = url.searchParams.get("period") || "daily";
    const countParam = url.searchParams.get("count");
    const includeEfficiency = url.searchParams.get("includeEfficiency") === "true";

    // Validate period
    const validPeriods: PeriodType[] = ["daily", "weekly", "monthly"];
    const period: PeriodType = validPeriods.includes(periodParam as PeriodType)
      ? (periodParam as PeriodType)
      : "daily";

    // Default counts by period type
    const defaultCounts: Record<PeriodType, number> = {
      daily: 7,
      weekly: 4,
      monthly: 6,
    };

    const count = countParam ? parseInt(countParam, 10) : defaultCounts[period];

    // Validate count (max 365 days, 52 weeks, 24 months)
    const maxCounts: Record<PeriodType, number> = {
      daily: 365,
      weekly: 52,
      monthly: 24,
    };

    const validCount = Math.min(Math.max(1, count || 1), maxCounts[period]);

    // Get overall stats
    const stats = await getSessionDurationStats(user.id);

    // Get period summaries
    let summaries;
    switch (period) {
      case "weekly":
        summaries = await getWeeklySummary(user.id, validCount);
        break;
      case "monthly":
        summaries = await getMonthlySummary(user.id, validCount);
        break;
      default:
        summaries = await getDailySummary(user.id, validCount);
    }

    // Format summaries with human-readable durations
    const formattedSummaries = summaries.map((summary) => ({
      ...summary,
      totalFormatted: formatDuration(summary.totalMinutes),
      averageFormatted: formatDuration(summary.averageMinutes),
    }));

    // Build response
    const response: {
      stats: typeof stats & {
        totalFormatted: string;
        averageFormatted: string;
        longestFormatted: string;
        shortestFormatted: string;
      };
      summaries: typeof formattedSummaries;
      efficiency?: Awaited<ReturnType<typeof getUserEfficiencyMetrics>>;
      period: PeriodType;
      count: number;
    } = {
      stats: {
        ...stats,
        totalFormatted: formatDuration(stats.totalMinutes),
        averageFormatted: formatDuration(stats.averageMinutes),
        longestFormatted: formatDuration(stats.longestMinutes),
        shortestFormatted: formatDuration(stats.shortestMinutes),
      },
      summaries: formattedSummaries,
      period,
      count: validCount,
    };

    // Optionally include efficiency metrics
    if (includeEfficiency) {
      response.efficiency = await getUserEfficiencyMetrics(user.id);
    }

    logger.log("Duration analytics fetched", {
      userId: user.id,
      period,
      count: validCount,
      sessionCount: stats.sessionCount,
    });

    return NextResponse.json({ data: response });
  } catch (error) {
    logger.error("Failed to fetch duration analytics", error);

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
