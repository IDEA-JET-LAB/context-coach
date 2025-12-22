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

test.describe("Input Validation - Prompt Length", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: {
    id: string;
    team_id: string;
    api_key: string;
    api_key_hash: string;
  };

  test.beforeAll(async () => {
    const email = `validation-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);
  });

  test.afterAll(async () => {
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test("returns 400 PROMPT_TOO_SHORT for 9-character prompt (boundary -1)", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "123456789", // 9 characters - below minimum
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("PROMPT_TOO_SHORT");
    expect(body.error.message).toContain("10");
  });

  test("returns 201 for 10-character prompt (minimum boundary)", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "1234567890", // 10 characters - exactly minimum
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe("pending");
  });

  test("returns 201 for 100,000-character prompt (maximum boundary)", async ({
    request,
  }) => {
    const largePrompt = "x".repeat(100_000);

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: largePrompt,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe("pending");
  });

  test("returns 400 PROMPT_TOO_LONG for 100,001-character prompt (boundary +1)", async ({
    request,
  }) => {
    const tooLargePrompt = "x".repeat(100_001);

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: tooLargePrompt,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("PROMPT_TOO_LONG");
    expect(body.error.message).toContain("100,000");
  });

  test("returns 400 PROMPT_TOO_SHORT for empty string", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "",
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("PROMPT_TOO_SHORT");
  });

  test("returns 201 for whitespace-only prompt with 10+ characters", async ({
    request,
  }) => {
    // 10 spaces should be valid (whitespace is preserved, not trimmed)
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "          ", // 10 spaces
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBeDefined();
  });
});

test.describe("Input Validation - Invalid Characters", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: {
    id: string;
    team_id: string;
    api_key: string;
    api_key_hash: string;
  };

  test.beforeAll(async () => {
    const email = `validation-null-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);
  });

  test.afterAll(async () => {
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test("returns 400 INVALID_PROMPT for prompt containing null byte", async ({
    request,
  }) => {
    const promptWithNullByte = "Valid text\0with null byte";

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: promptWithNullByte,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_PROMPT");
    expect(body.error.message).toContain("invalid");
  });

  test("returns 400 INVALID_PROMPT for prompt with null byte at start", async ({
    request,
  }) => {
    const promptWithNullByte = "\0Some text after null";

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: promptWithNullByte,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_PROMPT");
  });

  test("returns 400 INVALID_PROMPT for prompt with null byte at end", async ({
    request,
  }) => {
    const promptWithNullByte = "Some text before null\0";

    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: promptWithNullByte,
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_PROMPT");
  });
});

test.describe("Input Validation - Invalid Request", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: {
    id: string;
    team_id: string;
    api_key: string;
    api_key_hash: string;
  };

  test.beforeAll(async () => {
    const email = `validation-json-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);
  });

  test.afterAll(async () => {
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test("returns 400 INVALID_REQUEST for invalid JSON body", async () => {
    // Use native fetch to send malformed JSON (Playwright's request API parses data)
    const response = await fetch(`${BASE_URL}/api/prompts/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
        "Content-Type": "application/json",
      },
      body: "not valid json {",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.message).toContain("JSON");
  });

  test("returns 400 when prompt is not a string", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: 12345, // number instead of string
        user_id: testUser.id,
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    // Could be VALIDATION_ERROR or INVALID_PROMPT depending on implementation
    expect(body.error.code).toBeDefined();
  });

  test("returns 400 USER_ID_REQUIRED when user_id is empty", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Valid prompt text here",
        user_id: "",
        timestamp: new Date().toISOString(),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("USER_ID_REQUIRED");
  });

  test("returns 400 INVALID_TIMESTAMP when timestamp format is invalid", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
      headers: {
        Authorization: `Bearer ${testProject.api_key}`,
      },
      data: {
        prompt: "Valid prompt text here",
        user_id: testUser.id,
        timestamp: "not-a-timestamp",
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_TIMESTAMP");
  });
});
