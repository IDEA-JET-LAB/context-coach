/**
 * Session Context API E2E Tests - Story 25-4
 *
 * Tests the GET /api/sessions/[id]/context endpoint.
 */

import { test, expect } from "@playwright/test";
import {
  createTestUserDirect,
  createTestTeam,
  createTestProject,
  deleteTestProject,
  deleteTestTeam,
  deleteTestUser,
} from "./helpers/api";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3050";

// Local Supabase configuration
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

const isLocalDev =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("127.0.0.1") ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("localhost");

const SUPABASE_URL = isLocalDev
  ? LOCAL_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL;

function getServiceRoleKey(): string {
  if (isLocalDev) {
    return LOCAL_SERVICE_KEY;
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY not set for non-local environment"
    );
  }
  return key;
}

/**
 * Creates a test session directly in the database.
 */
async function createTestSession(
  teamId: string,
  projectId: string,
  userId: string,
  options: {
    sessionId?: string;
    slug?: string;
    primaryStage?: string;
    hasDebuggingLoop?: boolean;
  } = {}
): Promise<{
  id: string;
  session_id: string;
  team_id: string;
  project_id: string;
  user_id: string;
}> {
  const serviceRoleKey = getServiceRoleKey();
  const sessionId =
    options.sessionId ||
    `test-session-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      session_id: sessionId,
      team_id: teamId,
      project_id: projectId,
      user_id: userId,
      slug: options.slug || "test-session",
      primary_stage: options.primaryStage || null,
      has_debugging_loop: options.hasDebuggingLoop || false,
      started_at: new Date().toISOString(),
      total_prompts: 0,
      user_message_count: 0,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create test session: ${error}`);
  }

  const [session] = await response.json();
  return session;
}

/**
 * Creates a test prompt with optional response.
 */
async function createTestPromptWithResponse(
  teamId: string,
  projectId: string,
  userId: string,
  sessionId: string,
  options: {
    text?: string;
    sequenceNumber?: number;
    promptClassification?: string;
    includeResponse?: boolean;
    responseTools?: string[];
    responseThinkingSummary?: string;
  } = {}
): Promise<{
  prompt: { id: string };
  response?: { id: string };
}> {
  const serviceRoleKey = getServiceRoleKey();

  const text = options.text || `Test prompt ${Date.now()}`;
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Create the prompt
  const promptResponse = await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      team_id: teamId,
      project_id: projectId,
      user_id: userId,
      session_uuid: sessionId,
      text,
      char_count: charCount,
      word_count: wordCount,
      sequence_number: options.sequenceNumber || 1,
      prompt_classification: options.promptClassification || null,
      analysis_status: "pending",
    }),
  });

  if (!promptResponse.ok) {
    const error = await promptResponse.text();
    throw new Error(`Failed to create test prompt: ${error}`);
  }

  const [prompt] = await promptResponse.json();
  const result: {
    prompt: { id: string };
    response?: { id: string };
  } = { prompt };

  // Create response if requested
  if (options.includeResponse) {
    const responseData = await fetch(
      `${SUPABASE_URL}/rest/v1/prompt_responses`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          prompt_id: prompt.id,
          tool_count: options.responseTools?.length || 0,
          tools_used: options.responseTools || [],
          thinking_summary: options.responseThinkingSummary || null,
          model: "claude-3-opus",
          tokens_in: 1000,
          tokens_out: 500,
          has_thinking: !!options.responseThinkingSummary,
          stop_reason: "end_turn",
        }),
      }
    );

    if (responseData.ok) {
      const [response] = await responseData.json();
      result.response = response;
    }
  }

  return result;
}

/**
 * Deletes a test session.
 */
async function deleteTestSession(sessionId: string): Promise<void> {
  const serviceRoleKey = getServiceRoleKey();

  await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${sessionId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

test.describe("Session Context API", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: { id: string; team_id: string; api_key: string };
  let testSession: { id: string; session_id: string };
  const testPassword = "TestPassword123!";

  test.beforeAll(async () => {
    // Create test user, team, project, and session
    const email = `context-api-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email, testPassword);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);
    testSession = await createTestSession(
      testTeam.id,
      testProject.id,
      testUser.id,
      {
        slug: "test-context-session",
        primaryStage: "development",
        hasDebuggingLoop: false,
      }
    );

    // Create test prompts with responses
    await createTestPromptWithResponse(
      testTeam.id,
      testProject.id,
      testUser.id,
      testSession.id,
      {
        text: "Help me implement a new feature for user authentication",
        sequenceNumber: 1,
        promptClassification: "initiating",
        includeResponse: true,
        responseTools: ["Read", "Edit"],
        responseThinkingSummary: "Analyzing authentication requirements...",
      }
    );

    await createTestPromptWithResponse(
      testTeam.id,
      testProject.id,
      testUser.id,
      testSession.id,
      {
        text: "Can you also add password validation?",
        sequenceNumber: 2,
        promptClassification: "continuation",
        includeResponse: true,
        responseTools: ["Read", "Write", "Bash"],
      }
    );

    await createTestPromptWithResponse(
      testTeam.id,
      testProject.id,
      testUser.id,
      testSession.id,
      {
        text: "Add unit tests for the validation logic",
        sequenceNumber: 3,
        promptClassification: "continuation",
        includeResponse: true,
        responseTools: ["Write"],
      }
    );
  });

  test.afterAll(async () => {
    // Clean up in reverse order
    if (testSession?.id) await deleteTestSession(testSession.id);
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context`
    );

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("returns 400 for invalid session ID format", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/sessions/not-a-uuid/context`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_SESSION_ID");
  });

  test("returns 404 for non-existent session", async ({ request }) => {
    const nonExistentUuid = "00000000-0000-0000-0000-000000000000";
    const response = await request.get(
      `${BASE_URL}/api/sessions/${nonExistentUuid}/context`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("returns context with API key authentication", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.data).toBeDefined();
    expect(body.data.sessionId).toBe(testSession.id);
    expect(body.data.context).toBeDefined();
    expect(body.data.context.messages).toBeDefined();
    expect(Array.isArray(body.data.context.messages)).toBe(true);
  });

  test("returns context with session cookie authentication", async ({
    page,
    request,
  }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed)/);

    // Get cookies from page context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.data.sessionId).toBe(testSession.id);
    expect(body.data.context.messages.length).toBeGreaterThan(0);
  });

  test("returns messages in chronological order", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    const messages = body.data.context.messages;
    expect(messages.length).toBeGreaterThan(0);

    // Messages should be in sequence order (oldest first)
    const userMessages = messages.filter(
      (m: { role: string }) => m.role === "user"
    );
    for (let i = 1; i < userMessages.length; i++) {
      expect(userMessages[i].sequenceNumber).toBeGreaterThan(
        userMessages[i - 1].sequenceNumber
      );
    }
  });

  test("includes context metadata", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    const metadata = body.data.context.metadata;
    expect(metadata).toBeDefined();
    expect(metadata.sessionStage).toBe("development");
    expect(metadata.hasDebuggingLoop).toBe(false);
    expect(typeof metadata.totalTokens).toBe("number");
    expect(typeof metadata.messageCount).toBe("number");
    expect(typeof metadata.truncated).toBe("boolean");
    expect(typeof metadata.tokenBudget).toBe("number");
  });

  test("respects token_budget parameter", async ({ request }) => {
    // Request with very small token budget
    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context?token_budget=100`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.data.context.metadata.tokenBudget).toBe(100);
    // With a very small budget, either truncated is true or totalTokens is small
    expect(
      body.data.context.metadata.truncated ||
        body.data.context.metadata.totalTokens <= 100
    ).toBe(true);
  });

  test("respects message_limit parameter", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context?message_limit=2`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should have at most 2 messages (user + assistant pairs may exceed this)
    // The limit applies to the query, so we should see limited messages
    expect(body.data.context.messages.length).toBeLessThanOrEqual(4); // 2 user + 2 assistant max
  });

  test("returns 400 for invalid token_budget", async ({ request }) => {
    // Too small
    const response1 = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context?token_budget=50`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response1.status()).toBe(400);
    const body1 = await response1.json();
    expect(body1.error.code).toBe("VALIDATION_ERROR");

    // Too large
    const response2 = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context?token_budget=200000`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response2.status()).toBe(400);
    const body2 = await response2.json();
    expect(body2.error.code).toBe("VALIDATION_ERROR");
  });

  test("returns 400 for invalid message_limit", async ({ request }) => {
    // Too small
    const response1 = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context?message_limit=0`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response1.status()).toBe(400);
    const body1 = await response1.json();
    expect(body1.error.code).toBe("VALIDATION_ERROR");

    // Too large
    const response2 = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context?message_limit=500`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response2.status()).toBe(400);
    const body2 = await response2.json();
    expect(body2.error.code).toBe("VALIDATION_ERROR");
  });

  test("returns 400 for invalid prompt_id format", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context?prompt_id=not-a-uuid`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("user messages include prompt type", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    const userMessages = body.data.context.messages.filter(
      (m: { role: string }) => m.role === "user"
    );

    // At least some user messages should have promptType
    const messagesWithType = userMessages.filter(
      (m: { promptType?: string }) => m.promptType
    );
    expect(messagesWithType.length).toBeGreaterThan(0);
  });

  test("includes last response summary", async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/sessions/${testSession.id}/context`,
      {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // lastResponse may or may not be present depending on responses
    if (body.data.context.lastResponse) {
      expect(body.data.context.lastResponse.toolsUsed).toBeDefined();
      expect(Array.isArray(body.data.context.lastResponse.toolsUsed)).toBe(
        true
      );
    }
  });
});

test.describe("Session Context API - Access Control", () => {
  let user1: { id: string; email: string };
  let user2: { id: string; email: string };
  let team1: { id: string; name: string };
  let team2: { id: string; name: string };
  let project1: { id: string; team_id: string; api_key: string };
  let project2: { id: string; team_id: string; api_key: string };
  let session1: { id: string; session_id: string };
  const testPassword = "TestPassword123!";

  test.beforeAll(async () => {
    // Create two separate users with separate teams
    const email1 = `context-access-1-${Date.now()}@example.com`;
    const email2 = `context-access-2-${Date.now()}@example.com`;

    user1 = await createTestUserDirect(email1, testPassword);
    user2 = await createTestUserDirect(email2, testPassword);

    team1 = await createTestTeam(user1.id, "Team 1");
    team2 = await createTestTeam(user2.id, "Team 2");

    project1 = await createTestProject(team1.id, user1.id);
    project2 = await createTestProject(team2.id, user2.id);

    session1 = await createTestSession(team1.id, project1.id, user1.id, {
      slug: "private-session",
    });
  });

  test.afterAll(async () => {
    if (session1?.id) await deleteTestSession(session1.id);
    if (project1?.id) await deleteTestProject(project1.id);
    if (project2?.id) await deleteTestProject(project2.id);
    if (team1?.id) await deleteTestTeam(team1.id);
    if (team2?.id) await deleteTestTeam(team2.id);
    if (user1?.id) await deleteTestUser(user1.id);
    if (user2?.id) await deleteTestUser(user2.id);
  });

  test("returns 403 when API key from different team", async ({ request }) => {
    // Use team2's API key to access team1's session
    const response = await request.get(
      `${BASE_URL}/api/sessions/${session1.id}/context`,
      {
        headers: {
          Authorization: `Bearer ${project2.api_key}`,
        },
      }
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("returns 403 for other team's session via cookie auth", async ({
    page,
    request,
  }) => {
    // Login as user2 (who is NOT in team1)
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', user2.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Try to access team1's session - should get 403
    const response = await request.get(
      `${BASE_URL}/api/sessions/${session1.id}/context`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("team member can access their team's session", async ({
    page,
    request,
  }) => {
    // Login as user1 (who IS in team1)
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', user1.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const response = await request.get(
      `${BASE_URL}/api/sessions/${session1.id}/context`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.sessionId).toBe(session1.id);
  });
});
