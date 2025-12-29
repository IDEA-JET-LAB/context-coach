/**
 * Conversation Thread API E2E Tests - Story 25-3
 *
 * Tests the GET /api/conversations/[sessionId] endpoint.
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
    conversationScore?: number;
    stageBreakdown?: Record<string, number>;
    gitBranch?: string;
    cwd?: string;
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
    options.sessionId || `test-session-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

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
      conversation_score: options.conversationScore || null,
      stage_breakdown: options.stageBreakdown || null,
      git_branch: options.gitBranch || null,
      cwd: options.cwd || null,
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
    detectedStage?: string;
    isInDebuggingLoop?: boolean;
    includeAnalysis?: boolean;
    includeResponse?: boolean;
    responseTools?: string[];
    responseThinkingSummary?: string;
    responseModel?: string;
    responseTokensIn?: number;
    responseTokensOut?: number;
  } = {}
): Promise<{
  prompt: { id: string };
  analysis?: { id: string };
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
      detected_stage: options.detectedStage || null,
      is_in_debugging_loop: options.isInDebuggingLoop || false,
      analysis_status: options.includeAnalysis ? "complete" : "pending",
    }),
  });

  if (!promptResponse.ok) {
    const error = await promptResponse.text();
    throw new Error(`Failed to create test prompt: ${error}`);
  }

  const [prompt] = await promptResponse.json();
  const result: {
    prompt: { id: string };
    analysis?: { id: string };
    response?: { id: string };
  } = { prompt };

  // Create analysis if requested
  if (options.includeAnalysis) {
    const analysisResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/prompt_analyses`,
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
          config_id: "a0000000-0000-0000-0000-000000000001", // Default config ID from seed
          overall_score: 7.5, // Score must be 1-10 range
          dimension_scores: {
            Clarity: { score: 8, reasoning: "Clear and well-structured" },
            Context: { score: 7, reasoning: "Good background provided" },
            Specificity: { score: 7.5, reasoning: "Reasonably specific" },
            Goal: { score: 7.2, reasoning: "Clear goal stated" },
            Constraints: { score: 7.8, reasoning: "Good constraints defined" },
          },
          suggestions: {
            byDimension: {},
            prioritized: [],
            generatedAt: new Date().toISOString(),
          },
        }),
      }
    );

    if (analysisResponse.ok) {
      const [analysis] = await analysisResponse.json();
      result.analysis = analysis;
    }
  }

  // Create response if requested
  if (options.includeResponse) {
    const responseData = await fetch(`${SUPABASE_URL}/rest/v1/prompt_responses`, {
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
        model: options.responseModel || "claude-3-opus",
        tokens_in: options.responseTokensIn || 1000,
        tokens_out: options.responseTokensOut || 500,
        has_thinking: !!options.responseThinkingSummary,
        stop_reason: "end_turn",
      }),
    });

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

/**
 * Logs in a test user and returns a session cookie.
 */
async function loginTestUser(
  request: import("@playwright/test").APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const response = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${await response.text()}`);
  }

  // Extract session cookie
  const cookies = response.headers()["set-cookie"];
  return cookies || "";
}

test.describe("Conversation Thread API", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: { id: string; team_id: string; api_key: string };
  let testSession: { id: string; session_id: string };
  const testPassword = "TestPassword123!";

  test.beforeAll(async () => {
    // Create test user, team, project, and session
    const email = `conv-thread-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email, testPassword);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);
    testSession = await createTestSession(
      testTeam.id,
      testProject.id,
      testUser.id,
      {
        slug: "test-conversation",
        primaryStage: "development",
        hasDebuggingLoop: false,
        conversationScore: 8, // Will be recalculated by trigger based on analysis scores (1-10 scale)
        stageBreakdown: { development: 5, debugging: 2 },
        gitBranch: "main",
        cwd: "/home/user/project",
      }
    );

    // Create test prompts with responses
    await createTestPromptWithResponse(
      testTeam.id,
      testProject.id,
      testUser.id,
      testSession.id,
      {
        text: "Help me implement a new feature",
        sequenceNumber: 1,
        promptClassification: "initiating",
        detectedStage: "development",
        includeAnalysis: true,
        includeResponse: true,
        responseTools: ["Read", "Edit"],
        responseThinkingSummary: "Analyzing the codebase structure...",
        responseModel: "claude-3-opus",
        responseTokensIn: 2000,
        responseTokensOut: 1500,
      }
    );

    await createTestPromptWithResponse(
      testTeam.id,
      testProject.id,
      testUser.id,
      testSession.id,
      {
        text: "Can you also add tests?",
        sequenceNumber: 2,
        promptClassification: "continuation",
        detectedStage: "development",
        includeAnalysis: true,
        includeResponse: true,
        responseTools: ["Read", "Write", "Bash"],
        responseModel: "claude-3-opus",
        responseTokensIn: 1500,
        responseTokensOut: 2000,
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
      `${BASE_URL}/api/conversations/${testSession.id}`
    );

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Authentication required");
  });

  test("returns 404 for non-existent session", async ({ page, request }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    // Get cookies from page context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Make API request with session cookies
    const nonExistentUuid = "00000000-0000-0000-0000-000000000000";
    const response = await request.get(
      `${BASE_URL}/api/conversations/${nonExistentUuid}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Conversation not found");
  });

  test("returns 404 for session with invalid format (SQL injection prevention)", async ({
    page,
    request,
  }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Test with malicious sessionId patterns
    const maliciousInputs = [
      "'; DROP TABLE sessions; --",
      "<script>alert('xss')</script>",
      "../../etc/passwd",
      "session_id=1 OR 1=1",
    ];

    for (const maliciousInput of maliciousInputs) {
      const response = await request.get(
        `${BASE_URL}/api/conversations/${encodeURIComponent(maliciousInput)}`,
        {
          headers: { Cookie: cookieHeader },
        }
      );

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe("NOT_FOUND");
    }
  });

  test("returns conversation thread by session UUID", async ({
    page,
    request,
  }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Fetch by UUID
    const response = await request.get(
      `${BASE_URL}/api/conversations/${testSession.id}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Verify conversation metadata
    expect(body.data.conversation).toBeDefined();
    expect(body.data.conversation.id).toBe(testSession.id);
    expect(body.data.conversation.sessionId).toBe(testSession.session_id);
    expect(body.data.conversation.slug).toBe("test-conversation");
    expect(body.data.conversation.primaryStage).toBe("development");
    expect(body.data.conversation.hasDebuggingLoop).toBe(false);
    expect(body.data.conversation.conversationScore).toBe(8);
    expect(body.data.conversation.stageBreakdown).toEqual({
      development: 5,
      debugging: 2,
    });
    expect(body.data.conversation.gitBranch).toBe("main");

    // Verify messages array
    expect(body.data.messages).toBeDefined();
    expect(Array.isArray(body.data.messages)).toBe(true);
    // Should have at least 4 messages (2 user + 2 assistant)
    expect(body.data.messages.length).toBeGreaterThanOrEqual(4);
  });

  test("returns conversation thread by Claude Code session_id", async ({
    page,
    request,
  }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Fetch by Claude Code session_id
    const response = await request.get(
      `${BASE_URL}/api/conversations/${testSession.session_id}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.data.conversation.id).toBe(testSession.id);
    expect(body.data.conversation.sessionId).toBe(testSession.session_id);
  });

  test("user messages include prompt type and analysis", async ({
    page,
    request,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await request.get(
      `${BASE_URL}/api/conversations/${testSession.id}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Find user messages
    const userMessages = body.data.messages.filter(
      (m: { role: string }) => m.role === "user"
    );
    expect(userMessages.length).toBeGreaterThanOrEqual(2);

    // Check first user message
    const firstUserMsg = userMessages[0];
    expect(firstUserMsg.content).toContain("Help me implement");
    expect(firstUserMsg.promptType).toBe("initiating");
    expect(firstUserMsg.detectedStage).toBe("development");
    expect(firstUserMsg.score).toBe(7.5);
    expect(firstUserMsg.analysis).toBeDefined();
    expect(firstUserMsg.analysis.overallScore).toBe(7.5);
    expect(firstUserMsg.analysis.dimensions).toBeDefined();
  });

  test("assistant messages include tools and metadata", async ({
    page,
    request,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await request.get(
      `${BASE_URL}/api/conversations/${testSession.id}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Find assistant messages
    const assistantMessages = body.data.messages.filter(
      (m: { role: string }) => m.role === "assistant"
    );
    expect(assistantMessages.length).toBeGreaterThanOrEqual(2);

    // Check first assistant message
    const firstAssistant = assistantMessages[0];
    expect(firstAssistant.toolsUsed).toEqual(["Read", "Edit"]);
    expect(firstAssistant.toolCount).toBe(2);
    expect(firstAssistant.thinkingSummary).toBe(
      "Analyzing the codebase structure..."
    );
    expect(firstAssistant.model).toBe("claude-3-opus");
    expect(firstAssistant.tokensIn).toBe(2000);
    expect(firstAssistant.tokensOut).toBe(1500);
    expect(firstAssistant.stopReason).toBe("end_turn");
  });

  test("include_responses=false excludes assistant messages", async ({
    page,
    request,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await request.get(
      `${BASE_URL}/api/conversations/${testSession.id}?include_responses=false`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should only have user messages
    const assistantMessages = body.data.messages.filter(
      (m: { role: string }) => m.role === "assistant"
    );
    expect(assistantMessages.length).toBe(0);

    const userMessages = body.data.messages.filter(
      (m: { role: string }) => m.role === "user"
    );
    expect(userMessages.length).toBeGreaterThanOrEqual(2);
  });

  test("include_tools=false excludes tool executions", async ({
    page,
    request,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await request.get(
      `${BASE_URL}/api/conversations/${testSession.id}?include_tools=false`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Assistant messages should not have toolExecutions array
    const assistantMessages = body.data.messages.filter(
      (m: { role: string }) => m.role === "assistant"
    );

    for (const msg of assistantMessages) {
      expect(msg.toolExecutions).toBeUndefined();
      // But should still have toolsUsed (just not detailed executions)
      expect(msg.toolsUsed).toBeDefined();
    }
  });

  test("messages are ordered by sequence number", async ({ page, request }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await request.get(
      `${BASE_URL}/api/conversations/${testSession.id}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Verify messages are in order
    const messages = body.data.messages;
    for (let i = 1; i < messages.length; i++) {
      expect(messages[i].sequenceNumber).toBeGreaterThanOrEqual(
        messages[i - 1].sequenceNumber
      );
    }
  });

  test("duration is calculated correctly", async ({ page, request }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await request.get(
      `${BASE_URL}/api/conversations/${testSession.id}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Duration should be a number (minutes)
    expect(typeof body.data.conversation.duration).toBe("number");
    expect(body.data.conversation.duration).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Conversation Thread API - Access Control", () => {
  let user1: { id: string; email: string };
  let user2: { id: string; email: string };
  let team1: { id: string; name: string };
  let team2: { id: string; name: string };
  let project1: { id: string; team_id: string };
  let session1: { id: string; session_id: string };
  const testPassword = "TestPassword123!";

  test.beforeAll(async () => {
    // Create two separate users with separate teams
    const email1 = `access-test-1-${Date.now()}@example.com`;
    const email2 = `access-test-2-${Date.now()}@example.com`;

    user1 = await createTestUserDirect(email1, testPassword);
    user2 = await createTestUserDirect(email2, testPassword);

    team1 = await createTestTeam(user1.id, "Team 1");
    team2 = await createTestTeam(user2.id, "Team 2");

    project1 = await createTestProject(team1.id, user1.id);
    session1 = await createTestSession(team1.id, project1.id, user1.id, {
      slug: "private-session",
    });
  });

  test.afterAll(async () => {
    if (session1?.id) await deleteTestSession(session1.id);
    if (project1?.id) await deleteTestProject(project1.id);
    if (team1?.id) await deleteTestTeam(team1.id);
    if (team2?.id) await deleteTestTeam(team2.id);
    if (user1?.id) await deleteTestUser(user1.id);
    if (user2?.id) await deleteTestUser(user2.id);
  });

  test("returns 404 for other team's session (no info leak)", async ({
    page,
    request,
  }) => {
    // Login as user2 (who is NOT in team1)
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', user2.email);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Try to access team1's session - should get 404 (not 403)
    const response = await request.get(
      `${BASE_URL}/api/conversations/${session1.id}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    // SECURITY: Must return 404 to prevent information leakage
    // (User should not know if the session exists)
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Conversation not found");
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
    await page.waitForURL(/\/(dashboard|settings|feed|prompts)/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await request.get(
      `${BASE_URL}/api/conversations/${session1.id}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.conversation.id).toBe(session1.id);
  });
});
