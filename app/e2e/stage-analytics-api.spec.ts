import { test, expect } from "@playwright/test";
import {
  createTestUserDirect,
  createTestTeam,
  createTestProject,
  deleteTestProject,
  deleteTestTeam,
  deleteTestUser,
} from "./helpers/api";
import { loginUser } from "./helpers/auth";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3050";
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

/**
 * Story 31-5: Project Stage Analytics API
 *
 * Tests for stage analytics API endpoints.
 */
test.describe("Stage Analytics API", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: {
    id: string;
    team_id: string;
    api_key: string;
    api_key_hash: string;
  };
  let testSessionWithData: { id: string };
  let testSessionPending: { id: string };

  test.beforeAll(async () => {
    // Create test user, team, and project
    const email = `stage-analytics-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);

    // Create a session with stage analysis data
    testSessionWithData = await createTestSession(testProject.id, testUser.id, {
      session_id: `stage_analytics_test_1_${Date.now()}`,
      stage_analysis_status: "complete",
      stage_breakdown: {
        stages: {
          development: { activeMinutes: 30, promptCount: 15, percentage: 60 },
          debugging: { activeMinutes: 15, promptCount: 8, percentage: 30 },
          planning: { activeMinutes: 5, promptCount: 3, percentage: 10 },
        },
        totalActiveMinutes: 50,
        totalPrompts: 26,
        transitionCount: 3,
        gapsExcluded: 1,
        analyzedAt: new Date().toISOString(),
      },
      primary_stage: "development",
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });

    // Create a session pending analysis
    testSessionPending = await createTestSession(testProject.id, testUser.id, {
      session_id: `stage_analytics_test_2_${Date.now()}`,
      stage_analysis_status: null, // pending
      started_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    });
  });

  test.afterAll(async () => {
    // Clean up test data
    if (testSessionPending?.id) await deleteTestSession(testSessionPending.id);
    if (testSessionWithData?.id) await deleteTestSession(testSessionWithData.id);
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test.describe("GET /api/projects/{id}/stage-analytics", () => {
    test("returns 401 when unauthenticated", async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/projects/${testProject.id}/stage-analytics`
      );

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    test("returns 400 for invalid project ID format", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      const response = await page.request.get(
        `${BASE_URL}/api/projects/invalid-uuid/stage-analytics`
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("INVALID_ID");
    });

    test("returns 404 for non-existent project", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      const response = await page.request.get(
        `${BASE_URL}/api/projects/00000000-0000-0000-0000-000000000000/stage-analytics`
      );

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    test("returns aggregated stage data", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      const response = await page.request.get(
        `${BASE_URL}/api/projects/${testProject.id}/stage-analytics`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();

      // Verify response structure
      expect(body.data).toHaveProperty("projectId", testProject.id);
      expect(body.data).toHaveProperty("projectName");
      expect(body.data).toHaveProperty("analysisStatus");
      expect(body.data).toHaveProperty("summary");
      expect(body.data).toHaveProperty("primaryStage");
      expect(body.data).toHaveProperty("averageSessionMinutes");

      // Verify analysis status
      expect(body.data.analysisStatus.totalSessions).toBeGreaterThanOrEqual(2);
      expect(body.data.analysisStatus.analyzedSessions).toBeGreaterThanOrEqual(1);
      expect(body.data.analysisStatus.pendingSessions).toBeGreaterThanOrEqual(1);

      // Verify summary
      expect(body.data.summary.totalActiveMinutes).toBeGreaterThan(0);
      expect(body.data.summary.totalPrompts).toBeGreaterThan(0);
      expect(body.data.summary.stageBreakdown).toBeInstanceOf(Array);
      expect(body.data.summary.stageBreakdown.length).toBeGreaterThan(0);

      // Verify stage breakdown structure
      const firstStage = body.data.summary.stageBreakdown[0];
      expect(firstStage).toHaveProperty("stage");
      expect(firstStage).toHaveProperty("activeMinutes");
      expect(firstStage).toHaveProperty("promptCount");
      expect(firstStage).toHaveProperty("percentage");
      expect(firstStage).toHaveProperty("sessionCount");
    });

    test("filters by time range (7d)", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      const response = await page.request.get(
        `${BASE_URL}/api/projects/${testProject.id}/stage-analytics?range=7d`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveProperty("projectId");
      // Sessions created within last 7 days should be included
    });

    test("filters by time range (30d)", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      const response = await page.request.get(
        `${BASE_URL}/api/projects/${testProject.id}/stage-analytics?range=30d`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveProperty("projectId");
    });

    test("handles project with no analyzed sessions", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      // Create a project with no sessions
      const emptyProject = await createTestProject(testTeam.id, testUser.id);

      const response = await page.request.get(
        `${BASE_URL}/api/projects/${emptyProject.id}/stage-analytics`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();

      expect(body.data.analysisStatus.totalSessions).toBe(0);
      expect(body.data.analysisStatus.analyzedSessions).toBe(0);
      expect(body.data.summary.totalActiveMinutes).toBe(0);
      expect(body.data.summary.stageBreakdown).toHaveLength(0);
      expect(body.data.primaryStage).toBe("unknown");

      // Cleanup
      await deleteTestProject(emptyProject.id);
    });
  });

  test.describe("GET /api/projects/{id}/stage-analytics/timeline", () => {
    test("returns 401 when unauthenticated", async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/projects/${testProject.id}/stage-analytics/timeline`
      );

      expect(response.status()).toBe(401);
    });

    test("returns daily data points", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      const response = await page.request.get(
        `${BASE_URL}/api/projects/${testProject.id}/stage-analytics/timeline?granularity=day`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();

      expect(body.data).toHaveProperty("projectId", testProject.id);
      expect(body.data).toHaveProperty("granularity", "day");
      expect(body.data).toHaveProperty("dataPoints");
      expect(body.data.dataPoints).toBeInstanceOf(Array);

      // If we have data points, verify structure
      if (body.data.dataPoints.length > 0) {
        const dataPoint = body.data.dataPoints[0];
        expect(dataPoint).toHaveProperty("date");
        expect(dataPoint).toHaveProperty("stages");
        expect(dataPoint).toHaveProperty("totalMinutes");
      }
    });

    test("supports weekly granularity", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      const response = await page.request.get(
        `${BASE_URL}/api/projects/${testProject.id}/stage-analytics/timeline?granularity=week`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();

      expect(body.data.granularity).toBe("week");
    });

    test("filters by date range", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      const response = await page.request.get(
        `${BASE_URL}/api/projects/${testProject.id}/stage-analytics/timeline?range=7d`
      );

      expect(response.status()).toBe(200);
      const body = await response.json();

      // All data points should be within last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      for (const dataPoint of body.data.dataPoints) {
        const pointDate = new Date(dataPoint.date);
        expect(pointDate.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime());
      }
    });
  });
});

/**
 * Helper to create a test session with stage data.
 */
async function createTestSession(
  projectId: string,
  userId: string,
  data: {
    session_id: string;
    stage_analysis_status?: string | null;
    stage_breakdown?: object;
    primary_stage?: string;
    started_at?: string;
  }
): Promise<{ id: string }> {
  const response = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: LOCAL_SERVICE_KEY,
      Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      project_id: projectId,
      user_id: userId,
      session_id: data.session_id,
      slug: data.session_id,
      stage_analysis_status: data.stage_analysis_status,
      stage_breakdown: data.stage_breakdown,
      primary_stage: data.primary_stage,
      started_at: data.started_at || new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create test session: ${error}`);
  }

  const [session] = await response.json();
  return { id: session.id };
}

/**
 * Helper to delete a test session.
 */
async function deleteTestSession(sessionId: string): Promise<void> {
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/sessions?id=eq.${sessionId}`, {
    method: "DELETE",
    headers: {
      apikey: LOCAL_SERVICE_KEY,
      Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
    },
  });
}
