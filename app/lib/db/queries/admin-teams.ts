/**
 * Admin Teams Query Helpers
 * Story 7.4: Team Overview
 *
 * Server-side queries for admin team management.
 * Uses service role client to bypass RLS (read-only access).
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ============================================
// TYPES
// ============================================

export interface GetTeamsParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: "name" | "member_count" | "prompts_count" | "created_at";
  sortOrder?: "asc" | "desc";
}

export interface TeamWithStats {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
  project_count: number;
  prompts_count: number;
}

export interface TeamsResponse {
  teams: TeamWithStats[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TeamMember {
  role: string;
  joined_at: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface TeamProject {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  is_archived: boolean;
  api_key_prefix: string;
}

export interface TeamDetail {
  team: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
  } | null;
  members: TeamMember[];
  projects: TeamProject[];
  recentPromptsCount: number;
  previousPeriodPromptsCount: number;
  mostActiveMembers: Array<{ userId: string; name: string | null; count: number }>;
  lastPromptAt: string | null;
}

// ============================================
// QUERIES
// ============================================

/**
 * Get all teams with aggregated stats for admin view.
 * Bypasses RLS using service role client.
 */
export async function getTeamsWithStats({
  page,
  pageSize,
  search,
  sortBy = "created_at",
  sortOrder = "desc",
}: GetTeamsParams): Promise<TeamsResponse> {
  const supabase = createAdminClient();

  try {
    // Build the query with count aggregations
    // Supabase doesn't support COUNT on related tables in select directly,
    // so we need to do separate queries
    let query = supabase
      .from("teams")
      .select("id, name, description, created_at", { count: "exact" });

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    // Apply sorting for simple fields
    if (sortBy === "name" || sortBy === "created_at") {
      query = query.order(sortBy, { ascending: sortOrder === "asc" });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: teamsData, count, error } = await query.range(from, to);

    if (error) {
      console.error("[API] admin/teams: Error fetching teams", error);
      throw error;
    }

    if (!teamsData || teamsData.length === 0) {
      return {
        teams: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    // Get counts for each team in parallel
    const teamIds = teamsData.map((t) => t.id);

    const [memberCounts, projectCounts, promptCounts] = await Promise.all([
      // Member counts
      supabase
        .from("team_members")
        .select("team_id")
        .in("team_id", teamIds),
      // Project counts
      supabase
        .from("projects")
        .select("team_id")
        .in("team_id", teamIds)
        .eq("is_archived", false),
      // Prompt counts
      supabase
        .from("prompts")
        .select("team_id")
        .in("team_id", teamIds),
    ]);

    // Build count maps
    const memberCountMap = new Map<string, number>();
    const projectCountMap = new Map<string, number>();
    const promptCountMap = new Map<string, number>();

    memberCounts.data?.forEach((m) => {
      memberCountMap.set(m.team_id, (memberCountMap.get(m.team_id) || 0) + 1);
    });

    projectCounts.data?.forEach((p) => {
      projectCountMap.set(p.team_id, (projectCountMap.get(p.team_id) || 0) + 1);
    });

    promptCounts.data?.forEach((p) => {
      promptCountMap.set(p.team_id, (promptCountMap.get(p.team_id) || 0) + 1);
    });

    // Build response with stats
    let teams: TeamWithStats[] = teamsData.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      created_at: team.created_at,
      member_count: memberCountMap.get(team.id) || 0,
      project_count: projectCountMap.get(team.id) || 0,
      prompts_count: promptCountMap.get(team.id) || 0,
    }));

    // Apply sorting for computed fields
    if (sortBy === "member_count") {
      teams = teams.sort((a, b) =>
        sortOrder === "asc"
          ? a.member_count - b.member_count
          : b.member_count - a.member_count
      );
    } else if (sortBy === "prompts_count") {
      teams = teams.sort((a, b) =>
        sortOrder === "asc"
          ? a.prompts_count - b.prompts_count
          : b.prompts_count - a.prompts_count
      );
    }

    return {
      teams,
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  } catch (error) {
    console.error("[API] admin/teams: Failed to fetch teams with stats", error);
    throw error;
  }
}

/**
 * Get detailed team information for admin view.
 * Includes members, projects, and activity metrics.
 */
export async function getTeamDetail(teamId: string): Promise<TeamDetail> {
  const supabase = createAdminClient();

  try {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const fourteenDaysAgo = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [
      teamResult,
      membersResult,
      projectsResult,
      recentActivityResult,
      previousActivityResult,
      recentPromptsResult,
    ] = await Promise.all([
      // Get team details
      supabase
        .from("teams")
        .select("id, name, description, created_at")
        .eq("id", teamId)
        .single(),

      // Get team members with user info from auth.users
      supabase
        .from("team_members")
        .select(
          `
          role,
          joined_at,
          user_id
        `
        )
        .eq("team_id", teamId)
        .order("joined_at", { ascending: true }),

      // Get team projects (never expose full API key)
      supabase
        .from("projects")
        .select("id, name, description, created_at, is_archived, api_key_prefix")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false }),

      // Get recent prompts count (last 7 days)
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .gte("created_at", sevenDaysAgo),

      // Get previous period prompts count (7-14 days ago)
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo),

      // Get recent prompts for activity analysis
      supabase
        .from("prompts")
        .select("user_id, created_at")
        .eq("team_id", teamId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false }),
    ]);

    // Handle team not found or error
    if (teamResult.error || !teamResult.data) {
      if (teamResult.error?.code !== "PGRST116") {
        console.error("[API] admin/teams/[id]: Team error", teamResult.error);
      }
      return {
        team: null,
        members: [],
        projects: [],
        recentPromptsCount: 0,
        previousPeriodPromptsCount: 0,
        mostActiveMembers: [],
        lastPromptAt: null,
      };
    }

    // Get user details for members
    const memberUserIds = membersResult.data?.map((m) => m.user_id) || [];
    let usersMap = new Map<
      string,
      { id: string; name: string | null; email: string }
    >();

    if (memberUserIds.length > 0) {
      // Get from public.users table
      const usersResult = await supabase
        .from("users")
        .select("id, name")
        .in("id", memberUserIds);

      // Get emails from auth.users via admin API
      const { data: authData } = await supabase.auth.admin.listUsers();

      const authUsersMap = new Map<string, string>();
      authData?.users?.forEach((u) => {
        if (u.email) authUsersMap.set(u.id, u.email);
      });

      usersResult.data?.forEach((u) => {
        usersMap.set(u.id, {
          id: u.id,
          name: u.name,
          email: authUsersMap.get(u.id) || "Unknown",
        });
      });
    }

    // Build members with user info
    const members: TeamMember[] =
      membersResult.data?.map((m) => ({
        role: m.role,
        joined_at: m.joined_at,
        user: usersMap.get(m.user_id) || null,
      })) || [];

    // Build projects list
    const projects: TeamProject[] =
      projectsResult.data?.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        created_at: p.created_at,
        is_archived: p.is_archived,
        api_key_prefix: p.api_key_prefix,
      })) || [];

    // Calculate most active members
    const userPromptCounts = new Map<string, number>();
    recentPromptsResult.data?.forEach((p) => {
      userPromptCounts.set(
        p.user_id,
        (userPromptCounts.get(p.user_id) || 0) + 1
      );
    });

    const mostActiveMembers = Array.from(userPromptCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([userId, count]) => ({
        userId,
        name: usersMap.get(userId)?.name || userId,
        count,
      }));

    // Get last prompt timestamp
    const lastPromptAt = recentPromptsResult.data?.[0]?.created_at || null;

    return {
      team: teamResult.data,
      members,
      projects,
      recentPromptsCount: recentActivityResult.count ?? 0,
      previousPeriodPromptsCount: previousActivityResult.count ?? 0,
      mostActiveMembers,
      lastPromptAt,
    };
  } catch (error) {
    console.error("[API] admin/teams/[id]: Failed to fetch team detail", error);
    throw error;
  }
}
