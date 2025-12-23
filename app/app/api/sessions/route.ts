/**
 * Sessions API - Story 16-5: Multi-Terminal Awareness
 *
 * GET /api/sessions
 *
 * Returns the authenticated user's sessions with filtering and pagination.
 * Includes overlap detection for multi-terminal awareness.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isValidUuid } from "@/lib/utils/uuid";
import {
  getUserSessions,
  type GetUserSessionsOptions,
} from "@/lib/sessions/active-sessions";
import {
  detectOverlappingSessions,
  findConcurrentSessionIds,
  type SessionTimeRange,
} from "@/lib/sessions/session-overlap";
import {
  generateSessionDisplayName,
  calculateDurationMinutes,
  type MultiTerminalSessionSummary,
  type SessionDisplayNameInput,
} from "@/lib/sessions/types";
import { createScopedLogger } from "@/lib/utils/logger";

const logger = createScopedLogger("API_SESSIONS");

/**
 * GET /api/sessions
 *
 * Returns the authenticated user's sessions with filtering and pagination.
 *
 * Query Parameters:
 * - projectId?: string - Filter by project
 * - active?: 'true' | 'false' - Filter by active status
 * - startDate?: string - Filter by start date (ISO format)
 * - endDate?: string - Filter by end date (ISO format)
 * - limit?: number - Number of sessions to return (default: 50, max: 100)
 * - offset?: number - Pagination offset (default: 0)
 * - includeOverlaps?: 'true' | 'false' - Include overlap detection (default: true)
 *
 * Response:
 * - 200: { data: { sessions: MultiTerminalSessionSummary[], total: number, overlaps?: OverlapInfo[] } }
 * - 400: { error: { code: 'INVALID_PARAMS', message } }
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
    const projectId = url.searchParams.get("projectId");
    const activeParam = url.searchParams.get("active");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const includeOverlapsParam = url.searchParams.get("includeOverlaps");

    // Validate parameters
    if (projectId && !isValidUuid(projectId)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: "Invalid projectId format",
          },
        },
        { status: 400 }
      );
    }

    // Parse and validate dates
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam) {
      startDate = new Date(startDateParam);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_PARAMS",
              message: "Invalid startDate format. Use ISO format.",
            },
          },
          { status: 400 }
        );
      }
    }

    if (endDateParam) {
      endDate = new Date(endDateParam);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_PARAMS",
              message: "Invalid endDate format. Use ISO format.",
            },
          },
          { status: 400 }
        );
      }
    }

    // Parse pagination
    const limit = Math.min(
      Math.max(1, parseInt(limitParam ?? "50", 10) || 50),
      100
    );
    const offset = Math.max(0, parseInt(offsetParam ?? "0", 10) || 0);

    // Parse active filter
    const activeOnly = activeParam === "true";

    // Parse overlap flag
    const includeOverlaps = includeOverlapsParam !== "false";

    // Build options
    const options: GetUserSessionsOptions = {
      startDate,
      endDate,
      projectId: projectId ?? undefined,
      activeOnly,
      limit,
      offset,
    };

    // Fetch sessions
    const { sessions: rawSessions, total } = await getUserSessions(
      user.id,
      options
    );

    // Convert to SessionDisplayNameInput format
    const displayNameInputs: SessionDisplayNameInput[] = rawSessions.map(
      (s) => ({
        id: s.id,
        started_at: s.started_at,
        cwd: s.cwd,
        git_branch: s.git_branch,
        slug: s.slug,
        project_name: s.project_name,
      })
    );

    // Convert to session time ranges for overlap detection
    const timeRanges: SessionTimeRange[] = rawSessions.map((s) => ({
      id: s.id,
      startedAt: new Date(s.started_at),
      endedAt: s.last_activity ? new Date(s.last_activity) : null,
      context: {
        cwd: s.cwd,
        git_branch: s.git_branch,
        project_id: s.project_id,
      },
    }));

    // Detect overlaps if requested
    const overlaps = includeOverlaps
      ? detectOverlappingSessions(timeRanges)
      : [];

    // Transform to response format with display names and concurrent IDs
    const sessions: MultiTerminalSessionSummary[] = rawSessions.map((s) => {
      const concurrentIds = includeOverlaps
        ? findConcurrentSessionIds(s.id, timeRanges)
        : [];

      return {
        id: s.id,
        session_id: s.session_id,
        displayName: generateSessionDisplayName(
          {
            id: s.id,
            started_at: s.started_at,
            cwd: s.cwd,
            git_branch: s.git_branch,
            slug: s.slug,
            project_name: s.project_name,
          },
          displayNameInputs
        ),
        started_at: s.started_at,
        ended_at: s.last_activity !== s.started_at ? s.last_activity : null,
        duration_minutes: calculateDurationMinutes(s.started_at, s.last_activity),
        isActive: !s.last_activity || new Date(s.last_activity) > new Date(Date.now() - 2 * 60 * 60 * 1000),
        context: {
          cwd: s.cwd,
          git_branch: s.git_branch,
          project_name: s.project_name,
        },
        stats: {
          total_prompts: s.total_prompts,
          avg_prompt_score: null, // Would require additional query
        },
        concurrentWith: concurrentIds,
      };
    });

    logger.log("Sessions fetched", {
      userId: user.id,
      count: sessions.length,
      total,
      activeOnly,
      hasOverlaps: overlaps.length > 0,
    });

    // Build response
    const response: {
      data: {
        sessions: MultiTerminalSessionSummary[];
        total: number;
        overlaps?: typeof overlaps;
      };
    } = {
      data: {
        sessions,
        total,
      },
    };

    if (includeOverlaps && overlaps.length > 0) {
      response.data.overlaps = overlaps;
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Unexpected error in sessions API", error);

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
