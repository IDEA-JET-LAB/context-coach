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

test.describe("Capture API Endpoint", () => {
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
    const email = `capture-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);
  });

  test.afterAll(async () => {
    // Clean up test data
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test("returns 401 when Authorization header is missing", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      data: {
        prompt: "Test prompt with valid length",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toEqual({
      code: "INVALID_API_KEY",
      message: "Invalid or missing API key",
    });
  });

  test("returns 401 when Authorization header is not Bearer format", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: "Basic some-credentials",
      },
      data: {
        prompt: "Test prompt with valid length",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_API_KEY");
  });

  test("returns 401 when API key is invalid", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: "Bearer ctx_invalid_key_123456789",
      },
      data: {
        prompt: "Test prompt with valid length",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_API_KEY");
  });

  test("returns 400 when request body has empty object", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    // Missing prompt returns PROMPT_TOO_SHORT when undefined is coerced
    // or another validation error code
    expect(body.error.code).toBeDefined();
  });

  test("returns 400 when prompt field is missing", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    // Missing prompt field returns a Zod type error
    expect(body.error.code).toBeDefined();
    expect(body.error.message).toBeDefined();
  });

  test("returns 400 when user_id field is missing", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Test prompt with enough characters",
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    // Missing user_id returns a Zod type error
    expect(body.error.code).toBeDefined();
    expect(body.error.message).toBeDefined();
  });

  test("returns 400 when timestamp format is invalid", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Test prompt with enough characters",
        user_id: testUser.id,
        timestamp: "not-a-valid-timestamp",
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_TIMESTAMP");
    expect(body.error.message).toContain("timestamp");
  });

  test("returns 201 with valid request", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Test prompt for capture API with valid length",
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
  });

  test("returns 201 with optional metadata", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Test prompt with metadata and sufficient length",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
        metadata: {
          source: "test",
          version: "1.0",
          nested: { key: "value" },
        },
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe("pending");
  });

  test("generates unique IDs for each request", async ({ request }) => {
    const makeRequest = () =>
      request.post(`${BASE_URL}/api/prompts/capture`, {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
        data: {
          prompt: "Test prompt for unique ID check with valid length",
          user_id: testUser.id,
          timestamp: new Date().toISOString(),
        },
      });

    const [response1, response2] = await Promise.all([
      makeRequest(),
      makeRequest(),
    ]);

    expect(response1.status()).toBe(201);
    expect(response2.status()).toBe(201);

    const body1 = await response1.json();
    const body2 = await response2.json();

    expect(body1.data.id).not.toBe(body2.data.id);
  });
});
