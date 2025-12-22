import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface HealthChecks {
  database: boolean;
  timestamp: string;
}

interface HealthResponse {
  status: "ok" | "unhealthy" | "error";
  checks: HealthChecks;
  message?: string;
}

/**
 * GET /api/health
 *
 * Health check endpoint for Cloud Run and monitoring services.
 * Verifies database connectivity and returns appropriate status codes.
 *
 * Response:
 * - 200: { status: 'ok', checks: { database: true, timestamp: '...' } }
 * - 503: { status: 'unhealthy' | 'error', checks: {...}, message: '...' }
 */
export async function GET(): Promise<Response> {
  const checks: HealthChecks = {
    database: false,
    timestamp: new Date().toISOString(),
  };

  try {
    // Check database connectivity with a simple query
    // Use admin client to bypass RLS for health checks
    const supabase = createAdminClient();

    // Use a lightweight query - just check if we can connect
    // Query the prompts table (always exists in Contextor)
    const { error } = await supabase.from("prompts").select("id").limit(1);

    checks.database = !error;

    if (!checks.database) {
      const response: HealthResponse = {
        status: "unhealthy",
        checks,
        message: "Database connectivity check failed",
      };
      return Response.json(response, { status: 503 });
    }

    const response: HealthResponse = {
      status: "ok",
      checks,
    };

    return Response.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    const response: HealthResponse = {
      status: "error",
      message: "Health check failed unexpectedly",
      checks,
    };

    // Log error for debugging but don't expose details
    console.error("[HEALTH] Health check error:", error);

    return Response.json(response, { status: 503 });
  }
}
