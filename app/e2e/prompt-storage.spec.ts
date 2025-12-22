import { test, expect } from "@playwright/test";
import {
  createTestUserDirect,
  createTestTeam,
  createTestProject,
  deleteTestProject,
  deleteTestTeam,
  deleteTestUser,
  getPromptById,
  deletePromptsForProject,
} from "./helpers/api";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3050";

test.describe("Prompt Storage", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: {
    id: string;
    team_id: string;
    api_key: string;
    api_key_hash: string;
  };

  test.beforeAll(async () => {
    // Create test user, team, and project
    const email = `storage-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);
  });

  test.afterAll(async () => {
    // Clean up test data (prompts will cascade delete with project)
    if (testProject?.id) {
      await deletePromptsForProject(testProject.id);
      await deleteTestProject(testProject.id);
    }
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test("stores prompt and returns correct response", async ({ request }) => {
    const promptText = "How do I create a React component with TypeScript?";

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: promptText,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(typeof body.data.id).toBe("string");
    expect(body.data.status).toBe("pending");

    // Verify prompt was stored in database
    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt).not.toBeNull();
    expect(storedPrompt?.text).toBe(promptText);
    expect(storedPrompt?.team_id).toBe(testTeam.id);
    expect(storedPrompt?.project_id).toBe(testProject.id);
    expect(storedPrompt?.user_id).toBe(testUser.id);
    expect(storedPrompt?.analysis_status).toBe("pending");
  });

  test("calculates char_count correctly", async ({ request }) => {
    const promptText = "This is a test prompt with exactly 47 characters.";

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: promptText,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    // Verify char_count in database
    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt?.char_count).toBe(promptText.length);
  });

  test("calculates word_count correctly", async ({ request }) => {
    const promptText = "one two three four five six seven";
    const expectedWordCount = 7;

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: promptText,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    // Verify word_count in database
    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt?.word_count).toBe(expectedWordCount);
  });

  test("handles word count with multiple whitespace", async ({ request }) => {
    const promptText = "word1   word2\n\nword3\t\tword4";
    const expectedWordCount = 4;

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: promptText,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt?.word_count).toBe(expectedWordCount);
  });

  test("sets analysis_status to pending", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Test prompt for status verification",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    // Verify analysis_status in response
    expect(body.data.status).toBe("pending");

    // Verify analysis_status in database
    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt?.analysis_status).toBe("pending");
  });

  test("stores metadata when provided", async ({ request }) => {
    const metadata = {
      source: "claude-code-hook",
      agent_id: "test-agent",
      file_context: ["src/index.ts", "src/utils.ts"],
    };

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Test prompt with metadata",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
        metadata,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    // Verify metadata in database
    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt?.metadata).toEqual(metadata);
  });

  test("stores prompt without metadata", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Test prompt without metadata field",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    // Verify metadata is null in database
    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt?.metadata).toBeNull();
  });

  test("redacts secrets before storage", async ({ request }) => {
    const secretKey = "sk_live_abc123def456ghi789jkl012mno";
    const promptWithSecret = `Here is my Stripe key: ${secretKey}`;

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: promptWithSecret,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    // Verify secret is NOT in stored text
    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt?.text).not.toContain(secretKey);
    expect(storedPrompt?.text).toContain("[REDACTED]");
  });

  test("sets created_at timestamp", async ({ request }) => {
    const beforeRequest = new Date();

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Test prompt for timestamp verification",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    const afterRequest = new Date();

    expect(response.status()).toBe(201);
    const body = await response.json();

    // Verify created_at in database
    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt?.created_at).toBeDefined();

    const createdAt = new Date(storedPrompt!.created_at);
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000);
    expect(createdAt.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000);
  });

  test("generates unique IDs for each prompt", async ({ request }) => {
    const makeRequest = () =>
      request.post(`${BASE_URL}/api/prompts/capture`, {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
        data: {
          prompt: "Test prompt for unique ID verification",
          user_id: testUser.id,
          timestamp: new Date().toISOString(),
        },
      });

    const [response1, response2, response3] = await Promise.all([
      makeRequest(),
      makeRequest(),
      makeRequest(),
    ]);

    expect(response1.status()).toBe(201);
    expect(response2.status()).toBe(201);
    expect(response3.status()).toBe(201);

    const body1 = await response1.json();
    const body2 = await response2.json();
    const body3 = await response3.json();

    // All IDs should be unique
    const ids = [body1.data.id, body2.data.id, body3.data.id];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);

    // All should be valid UUIDs
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    ids.forEach((id) => {
      expect(id).toMatch(uuidRegex);
    });
  });

  test("associates prompt with correct project and team", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Test prompt for project/team association",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    const storedPrompt = await getPromptById(body.data.id);
    expect(storedPrompt?.project_id).toBe(testProject.id);
    expect(storedPrompt?.team_id).toBe(testTeam.id);
  });
});
