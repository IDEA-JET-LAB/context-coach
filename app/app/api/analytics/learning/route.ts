/**
 * Story 21-9: Learning Progression API
 *
 * GET /api/analytics/learning
 *
 * Returns learning progression data including week-over-week improvements,
 * achievements, and suggestions for the authenticated user.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/utils/logger";
import {
  WeeklyMetrics,
  LearningProgression,
  calculateProgression,
  getWeekStart,
  getPreviousWeekStart,
  createEmptyWeeklyMetrics,
} from "@/lib/analysis/learning-progression";

const logger = createScopedLogger("API_LEARNING_PROGRESSION");

/**
 * Database row type for user_weekly_metrics
 */
interface WeeklyMetricsRow {
  id: string;
  user_id: string;
  week_start: string;
  avg_prompt_score: number | null;
  frustration_rate: number | null;
  prompts_per_goal: number | null;
  context_exhaustion_rate: number | null;
  total_prompts: number;
  total_sessions: number;
  created_at: string;
  updated_at: string;
}

/**
 * Achievement with metadata for frontend display
 */
interface AchievementWithMeta {
  id: string;
  title: string;
  description: string;
  earnedAt: string | null;
  progress: number;
}

/**
 * Milestone tracking for frontend display
 */
interface Milestone {
  metric: string;
  baseline: number;
  current: number;
  target: number;
  progress: number;
}

/**
 * Full API response type
 */
interface LearningProgressionResponse {
  currentWeek: WeeklyMetrics;
  previousWeek: WeeklyMetrics | null;
  weeklyHistory: WeeklyMetrics[];
  improvements: LearningProgression["improvements"];
  achievements: AchievementWithMeta[];
  milestones: Milestone[];
  recommendations: string[];
}

/**
 * Converts a database row to a WeeklyMetrics object
 */
function rowToWeeklyMetrics(row: WeeklyMetricsRow): WeeklyMetrics {
  return {
    weekStart: row.week_start,
    avgPromptScore: row.avg_prompt_score ?? 0,
    frustrationRate: row.frustration_rate ?? 0,
    promptsPerGoal: row.prompts_per_goal ?? 0,
    contextExhaustionRate: row.context_exhaustion_rate ?? 0,
    totalPrompts: row.total_prompts,
    totalSessions: row.total_sessions,
  };
}

/**
 * Converts achievement strings to achievement objects with metadata
 */
function createAchievementMeta(
  achievements: string[],
  weekStart: string
): AchievementWithMeta[] {
  return achievements.map((achievement, index) => {
    // Generate ID from content
    const id = `ach-${weekStart}-${index}`;

    // Determine type based on content
    let title = "Achievement";
    if (achievement.includes("Prompt quality")) {
      title = "Quality Boost";
    } else if (achievement.includes("Frustration")) {
      title = "Clear Communicator";
    } else if (achievement.includes("Workflow efficiency")) {
      title = "Efficiency Expert";
    } else if (achievement.includes("Context management")) {
      title = "Context Master";
    } else if (achievement.includes("First week")) {
      title = "Getting Started";
    }

    return {
      id,
      title,
      description: achievement,
      earnedAt: new Date().toISOString(),
      progress: 100,
    };
  });
}

/**
 * Creates milestone objects based on metrics history
 */
function createMilestones(
  currentWeek: WeeklyMetrics,
  history: WeeklyMetrics[]
): Milestone[] {
  const milestones: Milestone[] = [];

  // Get baseline from first week in history (or use current week if no history)
  const baseline: WeeklyMetrics = history.length > 0
    ? (history[history.length - 1] ?? currentWeek)
    : currentWeek;

  // Prompt Score milestone (target: 8.0)
  const scoreTarget = 8.0;
  milestones.push({
    metric: "Prompt Score",
    baseline: baseline.avgPromptScore,
    current: currentWeek.avgPromptScore,
    target: scoreTarget,
    progress: Math.min(100, (currentWeek.avgPromptScore / scoreTarget) * 100),
  });

  // Frustration Rate milestone (target: < 0.05)
  const frustrationTarget = 0.05;
  milestones.push({
    metric: "Low Frustration",
    baseline: baseline.frustrationRate,
    current: currentWeek.frustrationRate,
    target: frustrationTarget,
    progress: currentWeek.frustrationRate <= frustrationTarget
      ? 100
      : Math.max(0, (1 - currentWeek.frustrationRate / baseline.frustrationRate) * 100),
  });

  // Efficiency milestone (target: < 3 prompts per goal)
  const efficiencyTarget = 3.0;
  milestones.push({
    metric: "High Efficiency",
    baseline: baseline.promptsPerGoal,
    current: currentWeek.promptsPerGoal,
    target: efficiencyTarget,
    progress: currentWeek.promptsPerGoal <= efficiencyTarget
      ? 100
      : Math.max(0, (1 - currentWeek.promptsPerGoal / baseline.promptsPerGoal) * 100),
  });

  return milestones;
}

/**
 * GET /api/analytics/learning
 *
 * Query parameters:
 * - weeks: number of weeks of history to include (default: 12, max: 52)
 *
 * Authorization:
 * - User must be authenticated
 *
 * Response:
 * - 200: { data: LearningProgressionResponse }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
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
    const weeksParam = url.searchParams.get("weeks");
    const weeks = Math.min(Math.max(1, parseInt(weeksParam || "12", 10)), 52);

    // Get current week start
    const currentWeekStart = getWeekStart(new Date());
    const previousWeekStart = getPreviousWeekStart(currentWeekStart);

    // Fetch weekly metrics for the user (up to 'weeks' weeks)
    const { data: metricsData, error: metricsError } = await supabase
      .from("user_weekly_metrics")
      .select("*")
      .eq("user_id", user.id)
      .gte("week_start", getPreviousWeekStart(currentWeekStart).repeat(weeks))
      .order("week_start", { ascending: false })
      .limit(weeks);

    if (metricsError) {
      // Table might not exist yet - handle gracefully
      if (metricsError.code === "42P01") {
        logger.log("user_weekly_metrics table not found, returning empty data", {
          userId: user.id,
        });
      } else {
        logger.error("Failed to fetch weekly metrics", metricsError);
      }
    }

    // Convert to WeeklyMetrics objects
    const allMetrics: WeeklyMetrics[] = (metricsData || []).map(rowToWeeklyMetrics);

    // Find current and previous week metrics
    let currentWeek = allMetrics.find((m) => m.weekStart === currentWeekStart);
    let previousWeek = allMetrics.find((m) => m.weekStart === previousWeekStart);

    // If no current week data, create empty metrics
    if (!currentWeek) {
      currentWeek = createEmptyWeeklyMetrics(currentWeekStart);
    }

    // Calculate progression
    const progression = calculateProgression(currentWeek, previousWeek || null);

    // Build response
    const response: LearningProgressionResponse = {
      currentWeek: progression.currentWeek,
      previousWeek: progression.previousWeek,
      weeklyHistory: allMetrics,
      improvements: progression.improvements,
      achievements: createAchievementMeta(
        progression.achievements,
        currentWeekStart
      ),
      milestones: createMilestones(currentWeek, allMetrics),
      recommendations: progression.suggestions,
    };

    logger.log("Learning progression fetched", {
      userId: user.id,
      weeks,
      hasCurrentWeek: !!progression.currentWeek,
      hasPreviousWeek: !!progression.previousWeek,
      achievementCount: progression.achievements.length,
      suggestionCount: progression.suggestions.length,
    });

    return NextResponse.json({ data: response });
  } catch (error) {
    logger.error("Failed to fetch learning progression", error);

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
