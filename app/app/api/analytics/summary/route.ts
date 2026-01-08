import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/analytics/summary
 *
 * Returns analytics summary for VS Code extension.
 * Requires VS Code token authentication.
 *
 * Query Parameters:
 * - range: '1d' | '7d' | '30d' (default: '7d')
 * - project_id: UUID (optional) - Filter to specific project
 */
export async function GET(request: NextRequest) {
  // Get authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Missing authorization header" } },
      { status: 401 }
    );
  }

  const accessToken = authHeader.replace("Bearer ", "");

  try {
    const adminClient = createAdminClient();

    // Validate the VS Code access token
    const { data: tokenData, error: tokenError } = await adminClient
      .from("vscode_tokens")
      .select("user_id, access_token_expires_at, revoked_at")
      .eq("access_token", accessToken)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: { code: "INVALID_TOKEN", message: "Invalid access token" } },
        { status: 401 }
      );
    }

    // Check if token is expired or revoked
    if (tokenData.revoked_at || new Date(tokenData.access_token_expires_at) < new Date()) {
      return NextResponse.json(
        { error: { code: "TOKEN_EXPIRED", message: "Access token expired" } },
        { status: 401 }
      );
    }

    const userId = tokenData.user_id;
    const range = request.nextUrl.searchParams.get("range") || "7d";
    const projectId = request.nextUrl.searchParams.get("project_id");

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (range) {
      case "1d":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // 7d
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // First, get the actual count of prompts (no Supabase 1000 row limit)
    let countQuery = adminClient
      .from("prompts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    if (projectId) {
      countQuery = countQuery.eq("project_id", projectId);
    }

    const { count: totalPromptCount, error: countError } = await countQuery;

    if (countError) {
      console.error("[Analytics] Error counting prompts:", countError);
    }

    // Fetch prompts with analyses for score calculation
    // Limit to 5000 for performance (enough for accurate averages)
    let promptsQuery = adminClient
      .from("prompts")
      .select(`
        id,
        created_at,
        prompt_analyses (
          overall_score,
          dimension_scores
        )
      `)
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    if (projectId) {
      promptsQuery = promptsQuery.eq("project_id", projectId);
    }

    const { data: promptsWithAnalyses, error: fetchError } = await promptsQuery
      .order("created_at", { ascending: false })
      .limit(5000);

    if (fetchError) {
      console.error("[Analytics] Error fetching prompts:", fetchError);
      return NextResponse.json(
        { error: { code: "FETCH_ERROR", message: "Failed to fetch analytics" } },
        { status: 500 }
      );
    }

    // Filter to only prompts with analyses and extract scores
    // Note: prompt_analyses can be an array or object depending on Supabase response
    const analyzedPrompts = (promptsWithAnalyses || [])
      .filter(p => {
        if (!p.prompt_analyses) return false;
        // Handle both array and object response from Supabase
        if (Array.isArray(p.prompt_analyses)) return p.prompt_analyses.length > 0;
        return true; // It's an object with data
      })
      .map(p => {
        // Handle both array and object response
        const analysis = Array.isArray(p.prompt_analyses)
          ? p.prompt_analyses[0]
          : p.prompt_analyses;
        return {
          overall_score: analysis?.overall_score || 0,
          dimension_scores: analysis?.dimension_scores || {},
          created_at: p.created_at,
        };
      });

    // Calculate summary statistics
    // Use the actual COUNT result, not array length (which is capped by limit)
    const promptCount = totalPromptCount ?? promptsWithAnalyses?.length ?? 0;
    const analyzedCount = analyzedPrompts.length;
    const overallScore = analyzedCount > 0
      ? Math.round(analyzedPrompts.reduce((sum, p) => sum + (p.overall_score * 10), 0) / analyzedCount) // Convert 1-10 to 0-100
      : 0;

    // Calculate dimension averages from dimension_scores JSONB
    const dimensions = calculateDimensions(analyzedPrompts);

    return NextResponse.json({
      overallScore,
      promptCount,
      analyzedCount,
      timeRange: range,
      dimensions,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Analytics] Summary error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

interface DimensionScores {
  [key: string]: { score: number; reasoning?: string };
}

interface AnalyzedPrompt {
  overall_score: number;
  dimension_scores: DimensionScores;
  created_at: string;
}

function calculateDimensions(prompts: AnalyzedPrompt[]): Record<string, { score: number; trend: "up" | "down" | "stable"; change?: number }> {
  const dimensionNames = ["clarity", "context", "specificity", "actionability", "efficiency"];
  const result: Record<string, { score: number; trend: "up" | "down" | "stable"; change?: number }> = {};

  for (const dim of dimensionNames) {
    if (prompts.length === 0) {
      result[dim] = { score: 0, trend: "stable" };
      continue;
    }

    // Extract scores for this dimension (convert 1-10 to 0-100)
    const scores = prompts
      .map(p => {
        const dimScore = p.dimension_scores?.[dim];
        if (typeof dimScore === "object" && dimScore?.score) {
          return dimScore.score * 10;
        }
        return null;
      })
      .filter((s): s is number => s !== null);

    if (scores.length === 0) {
      result[dim] = { score: 0, trend: "stable" };
      continue;
    }

    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // Calculate trend
    let trend: "up" | "down" | "stable" = "stable";
    let change: number | undefined;

    if (scores.length >= 4) {
      const mid = Math.floor(scores.length / 2);
      const recentAvg = scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const olderAvg = scores.slice(mid).reduce((a, b) => a + b, 0) / (scores.length - mid);
      change = Math.round(recentAvg - olderAvg);

      if (change > 5) trend = "up";
      else if (change < -5) trend = "down";
    }

    result[dim] = { score: avgScore, trend, change };
  }

  return result;
}
