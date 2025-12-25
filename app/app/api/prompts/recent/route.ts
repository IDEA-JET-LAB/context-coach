import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/prompts/recent
 *
 * Returns recent prompts for VS Code extension.
 * Requires VS Code token authentication.
 *
 * Query Parameters:
 * - limit: number (default: 5, max: 20)
 * - project_id: string (optional) - Filter by project UUID
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
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "5", 10), 1), 20);
    const projectId = request.nextUrl.searchParams.get("project_id");

    // Validate project_id is a valid UUID if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (projectId && !uuidRegex.test(projectId)) {
      return NextResponse.json(
        { error: { code: "INVALID_PROJECT_ID", message: "Invalid project ID format" } },
        { status: 400 }
      );
    }

    // Build query - filter by user and optionally by project
    let query = adminClient
      .from("prompts")
      .select(`
        id,
        text,
        created_at,
        prompt_analyses (
          overall_score,
          dimension_scores
        )
      `)
      .eq("user_id", userId);

    // Add project filter if provided
    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    // Fetch recent prompts with analyses
    const { data: prompts, error: promptsError } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (promptsError) {
      console.error("[Prompts] Error fetching recent:", promptsError);
      return NextResponse.json(
        { error: { code: "FETCH_ERROR", message: "Failed to fetch prompts" } },
        { status: 500 }
      );
    }

    // Transform to expected format
    // Note: prompt_analyses can be an array or object depending on Supabase response
    const recentPrompts = (prompts || []).map((p) => {
      // Handle both array and object response from Supabase
      const analysis = Array.isArray(p.prompt_analyses)
        ? p.prompt_analyses[0]
        : p.prompt_analyses;
      const dimensionScores = analysis?.dimension_scores || {};

      return {
        id: p.id,
        text: p.text,
        overall_score: analysis?.overall_score ? analysis.overall_score * 10 : 0, // Convert 1-10 to 0-100
        clarity_score: extractDimensionScore(dimensionScores, "clarity"),
        context_score: extractDimensionScore(dimensionScores, "context"),
        specificity_score: extractDimensionScore(dimensionScores, "specificity"),
        // Try both new and legacy dimension names
        actionability_score: extractDimensionScore(dimensionScores, "actionability") || extractDimensionScore(dimensionScores, "goal"),
        efficiency_score: extractDimensionScore(dimensionScores, "efficiency") || extractDimensionScore(dimensionScores, "constraints"),
        created_at: p.created_at,
      };
    });

    return NextResponse.json({
      prompts: recentPrompts,
      total: recentPrompts.length,
    });
  } catch (error) {
    console.error("[Prompts] Recent error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

function extractDimensionScore(dimensionScores: Record<string, unknown>, dimension: string): number {
  // Handle case-insensitive lookup (DB stores "Clarity", we look for "clarity")
  const normalizedKey = Object.keys(dimensionScores).find(
    (key) => key.toLowerCase() === dimension.toLowerCase()
  );

  if (!normalizedKey) return 0;

  const dimData = dimensionScores[normalizedKey];
  if (typeof dimData === "object" && dimData !== null && "score" in dimData) {
    return ((dimData as { score: number }).score || 0) * 10; // Convert 1-10 to 0-100
  }
  return 0;
}

// Map legacy dimension names to new names
function mapDimensionName(legacyName: string): string {
  const mapping: Record<string, string> = {
    goal: "actionability",
    constraints: "efficiency",
  };
  return mapping[legacyName.toLowerCase()] || legacyName.toLowerCase();
}
