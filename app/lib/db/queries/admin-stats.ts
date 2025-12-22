/**
 * Admin Statistics Query Functions
 * Story 7.2: Admin Dashboard Overview
 *
 * Platform-wide statistics for the admin dashboard.
 * Uses service role client to bypass RLS for cross-team queries.
 *
 * IMPORTANT: These functions should ONLY be called from server-side code
 * and ONLY after admin access has been verified.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformStats {
  totalUsers: number;
  totalTeams: number;
  totalPrompts: number;
  promptsToday: number;
}

export interface TrendData {
  current: number;
  previous: number;
  percentChange: number;
  direction: "up" | "down" | "neutral";
}

export interface PlatformTrends {
  users: TrendData;
  teams: TrendData;
  prompts: TrendData;
}

/**
 * Get platform-wide statistics for the admin dashboard.
 * Uses service role client to bypass RLS.
 *
 * @returns Platform statistics with counts
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const supabase = createAdminClient();

  try {
    // Get start of today in UTC
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [usersResult, teamsResult, promptsResult, todayResult] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("teams").select("id", { count: "exact", head: true }),
      supabase.from("prompts").select("id", { count: "exact", head: true }),
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),
    ]);

    return {
      totalUsers: usersResult.count ?? 0,
      totalTeams: teamsResult.count ?? 0,
      totalPrompts: promptsResult.count ?? 0,
      promptsToday: todayResult.count ?? 0,
    };
  } catch (error) {
    console.error("[ADMIN] getPlatformStats failed:", error);
    return { totalUsers: 0, totalTeams: 0, totalPrompts: 0, promptsToday: 0 };
  }
}

/**
 * Get trend comparison data for the admin dashboard.
 * Compares current period with previous period.
 *
 * @param periodDays - Number of days to compare (default: 7)
 * @returns Trend data for users, teams, and prompts
 */
export async function getPlatformTrends(periodDays: number = 7): Promise<PlatformTrends> {
  const supabase = createAdminClient();

  try {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // Fetch all trend data in parallel
    const [
      currentUsers,
      previousUsers,
      currentTeams,
      previousTeams,
      currentPrompts,
      previousPrompts,
    ] = await Promise.all([
      // Users created this period
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("created_at", periodStart.toISOString()),
      // Users created previous period
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("created_at", previousStart.toISOString())
        .lt("created_at", periodStart.toISOString()),
      // Teams created this period
      supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .gte("created_at", periodStart.toISOString()),
      // Teams created previous period
      supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .gte("created_at", previousStart.toISOString())
        .lt("created_at", periodStart.toISOString()),
      // Prompts created this period
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", periodStart.toISOString()),
      // Prompts created previous period
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", previousStart.toISOString())
        .lt("created_at", periodStart.toISOString()),
    ]);

    return {
      users: calculateTrend(currentUsers.count ?? 0, previousUsers.count ?? 0),
      teams: calculateTrend(currentTeams.count ?? 0, previousTeams.count ?? 0),
      prompts: calculateTrend(currentPrompts.count ?? 0, previousPrompts.count ?? 0),
    };
  } catch (error) {
    console.error("[ADMIN] getPlatformTrends failed:", error);
    return {
      users: { current: 0, previous: 0, percentChange: 0, direction: "neutral" },
      teams: { current: 0, previous: 0, percentChange: 0, direction: "neutral" },
      prompts: { current: 0, previous: 0, percentChange: 0, direction: "neutral" },
    };
  }
}

/**
 * Calculate trend data from current and previous values.
 *
 * @param current - Current period count
 * @param previous - Previous period count
 * @returns Trend data with percentage change and direction
 */
function calculateTrend(current: number, previous: number): TrendData {
  let percentChange: number;

  if (previous === 0) {
    percentChange = current > 0 ? 100 : 0;
  } else {
    percentChange = Math.round(((current - previous) / previous) * 100);
  }

  const direction: "up" | "down" | "neutral" =
    percentChange > 0 ? "up" : percentChange < 0 ? "down" : "neutral";

  return {
    current,
    previous,
    percentChange,
    direction,
  };
}

/**
 * Get combined platform stats and trends in one call.
 * More efficient for the dashboard initial load.
 *
 * @returns Combined stats and trends data
 */
export async function getAdminDashboardData(): Promise<{
  stats: PlatformStats;
  trends: PlatformTrends;
}> {
  const [stats, trends] = await Promise.all([
    getPlatformStats(),
    getPlatformTrends(),
  ]);

  return { stats, trends };
}
