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
 * Story 25-2: Conversations List Endpoint
 *
 * Tests for GET /api/conversations endpoint.
 * Verifies authentication, filtering, pagination, and Phase 3 field inclusion.
 */
test.describe("Conversations API Endpoint", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: {
    id: string;
    team_id: string;
    api_key: string;
    api_key_hash: string;
  };
  let testSession1: { id: string; session_id: string };
  let testSession2: { id: string; session_id: string };

  test.beforeAll(async () => {
    // Create test user, team, and project
    const email = `conversations-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);

    // Create test sessions directly in the database
    testSession1 = await createTestSession(
      testTeam.id,
      testUser.id,
      testProject.id,
      {
        session_id: `session_conv_test_1_${Date.now()}`,
        slug: "Test Session 1",
        primary_stage: "development",
        has_debugging_loop: false,
        conversation_score: 85,
        user_message_count: 10,
        total_prompts: 15,
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      }
    );

    testSession2 = await createTestSession(
      testTeam.id,
      testUser.id,
      testProject.id,
      {
        session_id: `session_conv_test_2_${Date.now()}`,
        slug: "Debug Session",
        primary_stage: "debugging",
        has_debugging_loop: true,
        conversation_score: 65,
        user_message_count: 25,
        total_prompts: 40,
        started_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      }
    );
  });

  test.afterAll(async () => {
    // Clean up test data
    if (testSession2?.id) await deleteTestSession(testSession2.id);
    if (testSession1?.id) await deleteTestSession(testSession1.id);
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test("returns 401 when unauthenticated", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/conversations`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toEqual({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  });

  test("returns conversations sorted by date (newest first)", async ({ page }) => {
    // Login first
    await loginUser(page, testUser.email, "TestPassword123!");

    // Make API request with session cookies
    const response = await page.request.get(`${BASE_URL}/api/conversations`);

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.data).toBeDefined();
    expect(body.data.conversations).toBeInstanceOf(Array);
    expect(body.data.pagination).toBeDefined();

    // Should have at least our test sessions
    expect(body.data.conversations.length).toBeGreaterThanOrEqual(2);

    // Verify sorted by date (newest first)
    const conversations = body.data.conversations;
    for (let i = 1; i < conversations.length; i++) {
      const prev = new Date(conversations[i - 1].startedAt).getTime();
      const curr = new Date(conversations[i].startedAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test("includes Phase 3 fields in response", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(`${BASE_URL}/api/conversations`);

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    const session = body.data.conversations.find(
      (c: { sessionId: string }) => c.sessionId === testSession1.session_id
    );

    expect(session).toBeDefined();
    expect(session.primaryStage).toBe("development");
    expect(session.hasDebuggingLoop).toBe(false);
    expect(session.conversationScore).toBe(85);
    expect(session.userMessageCount).toBe(10);
    expect(session.totalMessages).toBe(15);
  });

  test("filters by project_id", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?project_id=${testProject.id}`
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // All returned conversations should have the specified project
    for (const conv of body.data.conversations) {
      expect(conv.projectId).toBe(testProject.id);
    }
  });

  test("filters by project_id=unlinked for null project sessions", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    // Create a session without a project
    const unlinkedSession = await createTestSession(
      testTeam.id,
      testUser.id,
      null,
      {
        session_id: `session_unlinked_${Date.now()}`,
        slug: "Unlinked Session",
      }
    );

    try {
      const response = await page.request.get(
        `${BASE_URL}/api/conversations?project_id=unlinked`
      );

      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      // All returned conversations should have null projectId
      for (const conv of body.data.conversations) {
        expect(conv.projectId).toBeNull();
      }

      // Should include our unlinked session
      const found = body.data.conversations.some(
        (c: { sessionId: string }) => c.sessionId === unlinkedSession.session_id
      );
      expect(found).toBe(true);
    } finally {
      await deleteTestSession(unlinkedSession.id);
    }
  });

  test("filters by stage", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?stage=debugging`
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // All returned conversations should have debugging stage
    for (const conv of body.data.conversations) {
      expect(conv.primaryStage).toBe("debugging");
    }

    // Should include our debugging session
    const found = body.data.conversations.some(
      (c: { sessionId: string }) => c.sessionId === testSession2.session_id
    );
    expect(found).toBe(true);
  });

  test("filters by has_loop=true", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?has_loop=true`
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // All returned conversations should have debugging loop
    for (const conv of body.data.conversations) {
      expect(conv.hasDebuggingLoop).toBe(true);
    }
  });

  test("filters by has_loop=false", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?has_loop=false`
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // All returned conversations should NOT have debugging loop
    for (const conv of body.data.conversations) {
      expect(conv.hasDebuggingLoop).toBe(false);
    }
  });

  test("filters by date range", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    // Filter to sessions from the last hour
    const dateFrom = new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString();
    const dateTo = new Date().toISOString();

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // Should include session2 (1 hour ago) but not session1 (2 hours ago)
    const hasSession2 = body.data.conversations.some(
      (c: { sessionId: string }) => c.sessionId === testSession2.session_id
    );
    const hasSession1 = body.data.conversations.some(
      (c: { sessionId: string }) => c.sessionId === testSession1.session_id
    );

    expect(hasSession2).toBe(true);
    expect(hasSession1).toBe(false);
  });

  test("pagination works correctly", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    // Get first page with limit 1
    const response1 = await page.request.get(
      `${BASE_URL}/api/conversations?limit=1&offset=0`
    );

    expect(response1.ok()).toBeTruthy();
    const body1 = await response1.json();

    expect(body1.data.conversations.length).toBe(1);
    expect(body1.data.pagination.limit).toBe(1);
    expect(body1.data.pagination.offset).toBe(0);
    expect(body1.data.pagination.hasMore).toBe(true);

    // Get second page
    const response2 = await page.request.get(
      `${BASE_URL}/api/conversations?limit=1&offset=1`
    );

    expect(response2.ok()).toBeTruthy();
    const body2 = await response2.json();

    expect(body2.data.conversations.length).toBe(1);
    expect(body2.data.pagination.offset).toBe(1);

    // First and second page should have different conversations
    expect(body1.data.conversations[0].id).not.toBe(body2.data.conversations[0].id);
  });

  test("sorts by messages (user_message_count)", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?sort_by=messages`
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // Verify sorted by user_message_count descending
    const conversations = body.data.conversations;
    for (let i = 1; i < conversations.length; i++) {
      const prev = conversations[i - 1].userMessageCount ?? 0;
      const curr = conversations[i].userMessageCount ?? 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test("sorts by score (conversation_score)", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?sort_by=score`
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    // Verify sorted by conversation_score descending (nulls last)
    const conversations = body.data.conversations;
    for (let i = 1; i < conversations.length; i++) {
      const prev = conversations[i - 1].conversationScore;
      const curr = conversations[i].conversationScore;
      // null values should come after non-null values
      if (prev !== null && curr !== null) {
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    }
  });

  test("returns 400 for invalid project_id format", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?project_id=not-a-uuid`
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("project_id");
  });

  test("returns 400 for invalid stage value", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?stage=invalid_stage`
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("stage");
  });

  test("returns 400 for invalid has_loop value", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?has_loop=maybe`
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("has_loop");
  });

  test("limit is capped at 100", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?limit=500`
    );

    // Should either cap to 100 or return validation error
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.data.pagination.limit).toBeLessThanOrEqual(100);
    } else {
      expect(response.status()).toBe(400);
    }
  });

  test("combined filters work together", async ({ page }) => {
    await loginUser(page, testUser.email, "TestPassword123!");

    const response = await page.request.get(
      `${BASE_URL}/api/conversations?project_id=${testProject.id}&stage=development&has_loop=false&sort_by=score`
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    for (const conv of body.data.conversations) {
      expect(conv.projectId).toBe(testProject.id);
      expect(conv.primaryStage).toBe("development");
      expect(conv.hasDebuggingLoop).toBe(false);
    }
  });
});

/**
 * Helper function to create a test session in the database.
 */
async function createTestSession(
  teamId: string,
  userId: string,
  projectId: string | null,
  options: {
    session_id: string;
    slug?: string;
    primary_stage?: string;
    has_debugging_loop?: boolean;
    conversation_score?: number;
    user_message_count?: number;
    total_prompts?: number;
    started_at?: string;
  }
): Promise<{ id: string; session_id: string }> {
  const response = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: LOCAL_SERVICE_KEY,
      Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      team_id: teamId,
      user_id: userId,
      project_id: projectId,
      session_id: options.session_id,
      slug: options.slug ?? "Test Session",
      primary_stage: options.primary_stage ?? null,
      has_debugging_loop: options.has_debugging_loop ?? false,
      conversation_score: options.conversation_score ?? null,
      user_message_count: options.user_message_count ?? 0,
      total_prompts: options.total_prompts ?? 0,
      started_at: options.started_at ?? new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create test session: ${error}`);
  }

  const [session] = await response.json();
  return { id: session.id, session_id: session.session_id };
}

/**
 * Helper function to delete a test session.
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
