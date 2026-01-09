import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/coaching/heuristics
 * Returns personalized coaching tips based on user's prompt patterns.
 * Stub implementation - returns default tips until full implementation.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return default coaching tips
    // Full implementation will analyze user's prompts and return personalized tips
    const defaultTips = [
      {
        id: "tip-1",
        dimension: "specificity",
        title: "Be More Specific",
        description:
          "Include specific file paths, function names, or error messages to get more accurate responses.",
        example: {
          before: "Fix the bug",
          after:
            "Fix the TypeError in src/utils/parser.ts line 42 where null is being passed to formatDate()",
        },
        priority: "high",
        source: "default",
        created_at: new Date().toISOString(),
      },
      {
        id: "tip-2",
        dimension: "context",
        title: "Provide Context",
        description:
          "Explain what you're trying to achieve and why, not just what to do.",
        example: {
          before: "Add a button",
          after:
            "Add a 'Save Draft' button to the blog post editor that stores the current content in localStorage",
        },
        priority: "medium",
        source: "default",
        created_at: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      tips: defaultTips,
      weakDimensions: [],
    });
  } catch (error) {
    console.error("[COACHING_HEURISTICS] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch coaching tips" },
      { status: 500 }
    );
  }
}
