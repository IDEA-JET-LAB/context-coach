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

// Local Supabase configuration for E2E tests
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

const isLocalDev = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("127.0.0.1") ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("localhost");

const SUPABASE_URL = isLocalDev ? LOCAL_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;

function getServiceRoleKey(): string {
  if (isLocalDev) {
    return LOCAL_SERVICE_KEY;
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set for non-local environment");
  }
  return key;
}

/**
 * Creates a historical import record for testing.
 */
async function createTestImport(
  userId: string,
  options: {
    status?: string;
    promptsImported?: number;
    promptsSkipped?: number;
    promptsFailed?: number;
    metadata?: object;
  } = {}
): Promise<{ id: string }> {
  const serviceRoleKey = getServiceRoleKey();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/historical_imports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      status: options.status || "complete",
      prompts_imported: options.promptsImported || 0,
      prompts_skipped: options.promptsSkipped || 0,
      prompts_failed: options.promptsFailed || 0,
      metadata: options.metadata || { projects: [], totalDurationMs: 1000, version: "1.0" },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create test import: ${error}`);
  }

  const [importRecord] = await response.json();
  return { id: importRecord.id };
}

/**
 * Creates a test prompt linked to an import.
 */
async function createTestPromptWithImport(
  teamId: string,
  projectId: string,
  userId: string,
  importId: string,
  text: string = "Test prompt for import rollback"
): Promise<{ id: string }> {
  const serviceRoleKey = getServiceRoleKey();

  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
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
      text,
      char_count: charCount,
      word_count: wordCount,
      analysis_status: "pending",
      import_id: importId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create test prompt: ${error}`);
  }

  const [prompt] = await response.json();
  return { id: prompt.id };
}

/**
 * Deletes a historical import record.
 */
async function deleteTestImport(importId: string): Promise<void> {
  const serviceRoleKey = getServiceRoleKey();

  await fetch(`${SUPABASE_URL}/rest/v1/historical_imports?id=eq.${importId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

/**
 * Gets the import record status.
 */
async function getImportStatus(importId: string): Promise<string | null> {
  const serviceRoleKey = getServiceRoleKey();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/historical_imports?id=eq.${importId}&select=status`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const [record] = await response.json();
  return record?.status || null;
}

/**
 * Counts prompts for an import.
 */
async function countPromptsForImport(importId: string): Promise<number> {
  const serviceRoleKey = getServiceRoleKey();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prompts?import_id=eq.${importId}&select=id`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "count=exact",
      },
    }
  );

  const count = response.headers.get("content-range");
  if (!count) return 0;

  const match = count.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

test.describe("Import Rollback API", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: { id: string; team_id: string; api_key: string; api_key_hash: string };

  test.beforeAll(async () => {
    const email = `rollback-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);
  });

  test.afterAll(async () => {
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const importId = globalThis.crypto.randomUUID();

    const response = await request.post(`${BASE_URL}/api/import/${importId}/rollback`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("returns 400 for invalid import ID format", async ({ request, page }) => {
    // First login to get session cookies
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', "TestPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

    // Get cookies from page context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const response = await request.post(`${BASE_URL}/api/import/invalid-uuid/rollback`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid import ID");
  });

  test("returns 404 when import does not exist", async ({ request, page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', "TestPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const nonExistentId = globalThis.crypto.randomUUID();
    const response = await request.post(`${BASE_URL}/api/import/${nonExistentId}/rollback`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Import not found");
  });

  test("returns 400 when import is already rolled back", async ({ request, page }) => {
    // Create an already rolled back import
    const testImport = await createTestImport(testUser.id, { status: "rolled_back" });

    try {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', "TestPassword123!");
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

      const response = await request.post(`${BASE_URL}/api/import/${testImport.id}/rollback`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Import has already been rolled back");
    } finally {
      await deleteTestImport(testImport.id);
    }
  });

  test("returns 400 when import status is not complete", async ({ request, page }) => {
    // Create a processing import
    const testImport = await createTestImport(testUser.id, { status: "processing" });

    try {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', "TestPassword123!");
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

      const response = await request.post(`${BASE_URL}/api/import/${testImport.id}/rollback`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Cannot rollback import with status");
    } finally {
      await deleteTestImport(testImport.id);
    }
  });

  test("successfully rolls back an import with prompts", async ({ request, page }) => {
    // Create a complete import with prompts
    const testImport = await createTestImport(testUser.id, {
      status: "complete",
      promptsImported: 3,
    });

    // Create prompts linked to this import
    const prompt1 = await createTestPromptWithImport(
      testTeam.id,
      testProject.id,
      testUser.id,
      testImport.id,
      "First test prompt for rollback"
    );
    const prompt2 = await createTestPromptWithImport(
      testTeam.id,
      testProject.id,
      testUser.id,
      testImport.id,
      "Second test prompt for rollback"
    );
    const prompt3 = await createTestPromptWithImport(
      testTeam.id,
      testProject.id,
      testUser.id,
      testImport.id,
      "Third test prompt for rollback"
    );

    try {
      // Verify prompts exist
      const initialCount = await countPromptsForImport(testImport.id);
      expect(initialCount).toBe(3);

      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', "TestPassword123!");
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

      const response = await request.post(`${BASE_URL}/api/import/${testImport.id}/rollback`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.deletedCount).toBe(3);

      // Verify prompts are deleted
      const finalCount = await countPromptsForImport(testImport.id);
      expect(finalCount).toBe(0);

      // Verify import status changed
      const status = await getImportStatus(testImport.id);
      expect(status).toBe("rolled_back");
    } finally {
      await deleteTestImport(testImport.id);
    }
  });

  test("successfully handles import with no prompts", async ({ request, page }) => {
    // Create a complete import with no prompts
    const testImport = await createTestImport(testUser.id, {
      status: "complete",
      promptsImported: 0,
    });

    try {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', "TestPassword123!");
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

      const response = await request.post(`${BASE_URL}/api/import/${testImport.id}/rollback`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.deletedCount).toBe(0);

      // Verify import status changed
      const status = await getImportStatus(testImport.id);
      expect(status).toBe("rolled_back");
    } finally {
      await deleteTestImport(testImport.id);
    }
  });
});
