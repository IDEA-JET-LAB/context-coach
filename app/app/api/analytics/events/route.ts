import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/analytics/events
 * Receives analytics events from VS Code extension.
 * Stub implementation - logs events but doesn't persist yet.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const events = body.events || [];

    // Log events for now - can be persisted to database later
    if (events.length > 0) {
      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "[ANALYTICS_EVENTS] Events received",
          timestamp: new Date().toISOString(),
          context: "ANALYTICS_EVENTS",
          userId: user.id,
          eventCount: events.length,
        })
      );
    }

    return NextResponse.json({ success: true, received: events.length });
  } catch (error) {
    console.error("[ANALYTICS_EVENTS] Error:", error);
    return NextResponse.json(
      { error: "Failed to process events" },
      { status: 500 }
    );
  }
}
