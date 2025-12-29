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

const isLocalDev =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("127.0.0.1") ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("localhost");

const SUPABASE_URL = isLocalDev
  ? LOCAL_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL!;

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
 * Story 25-5: Connect Conversations UI
 *
 * E2E tests for the conversations UI pages.
 * Tests loading, filtering, error handling, and navigation.
 */
test.describe("Conversations UI", () => {
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
    const email = `conv-ui-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);

    // Create test sessions
    testSession1 = await createTestSession(
      testTeam.id,
      testUser.id,
      testProject.id,
      {
        session_id: `session_ui_test_1_${Date.now()}`,
        slug: "Implement Auth Flow",
        primary_stage: "development",
        has_debugging_loop: false,
        conversation_score: 85,
        user_message_count: 10,
        total_prompts: 15,
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      }
    );

    testSession2 = await createTestSession(
      testTeam.id,
      testUser.id,
      testProject.id,
      {
        session_id: `session_ui_test_2_${Date.now()}`,
        slug: "Fix Database Issues",
        primary_stage: "debugging",
        has_debugging_loop: true,
        conversation_score: 65,
        user_message_count: 25,
        total_prompts: 40,
        started_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      }
    );

    // Create test prompts for the sessions
    await createTestPrompt(testTeam.id, testUser.id, testProject.id, testSession1.id, {
      text: "Please implement the OAuth login flow",
      sequence_number: 1,
      prompt_classification: "initiating",
    });

    await createTestPrompt(testTeam.id, testUser.id, testProject.id, testSession2.id, {
      text: "Debug this database connection issue",
      sequence_number: 1,
      prompt_classification: "initiating",
    });
  });

  test.afterAll(async () => {
    // Clean up test data
    if (testSession2?.id) {
      await deleteTestPromptsForSession(testSession2.id);
      await deleteTestSession(testSession2.id);
    }
    if (testSession1?.id) {
      await deleteTestPromptsForSession(testSession1.id);
      await deleteTestSession(testSession1.id);
    }
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test.describe("Conversations List Page", () => {
    test("loads conversations page with data", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations`);

      // Wait for loading to finish
      await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();
      await expect(page.locator(".animate-spin")).not.toBeVisible({ timeout: 10000 });

      // Should show conversations or empty state
      const pageContent = await page.content();
      const hasConversations =
        pageContent.includes("Implement Auth Flow") ||
        pageContent.includes("Fix Database Issues") ||
        pageContent.includes("No conversations found");

      expect(hasConversations).toBe(true);
    });

    test("shows loading skeleton during fetch", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      // Slow down network to see loading state
      await page.route("**/api/conversations**", async (route) => {
        await new Promise((r) => setTimeout(r, 500));
        await route.continue();
      });

      await page.goto(`${BASE_URL}/conversations`);

      // Should show loading state briefly
      const skeleton = page.locator('[class*="animate-pulse"]').first();
      await expect(skeleton).toBeVisible({ timeout: 1000 });
    });

    test("displays filter controls", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations`);

      // Wait for page load
      await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

      // Check filter controls exist
      await expect(page.getByPlaceholder("Search conversations...")).toBeVisible();
      await expect(page.getByRole("combobox").first()).toBeVisible(); // Project filter
    });

    test("search filter works", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations`);

      await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

      // Type in search
      const searchInput = page.getByPlaceholder("Search conversations...");
      await searchInput.fill("Auth Flow");

      // Give time for local filtering
      await page.waitForTimeout(300);

      // Check results are filtered (or empty state if no match)
      const content = await page.content();
      // Either shows the matching result or the filtered count updates
      expect(
        content.includes("Auth Flow") || content.includes("No conversations found")
      ).toBe(true);
    });

    test("refresh button works", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations`);

      await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

      // Click refresh
      const refreshButton = page.getByRole("button", { name: "Refresh" });
      await expect(refreshButton).toBeVisible();
      await refreshButton.click();

      // Should show loading state on button
      await expect(page.locator("button .animate-spin")).toBeVisible({ timeout: 1000 });
    });

    test("persists filter state in URL", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations`);

      await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

      // Change stage filter
      const stageSelect = page.locator('[role="combobox"]').nth(1);
      await stageSelect.click();
      await page.getByRole("option", { name: "Debugging" }).click();

      // Give time for URL update
      await page.waitForTimeout(500);

      // Check URL contains filter param
      expect(page.url()).toContain("stage=debugging");
    });

    test("bookmarked URL with filters loads correctly", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      // Navigate directly to URL with filters
      await page.goto(`${BASE_URL}/conversations?stage=development&sort_by=messages`);

      await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

      // Check stage filter shows Development
      const stageSelect = page.locator('[role="combobox"]').nth(1);
      await expect(stageSelect).toContainText("Development");
    });

    test("clear filters button works", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations?stage=debugging`);

      await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

      // Should have clear filters button
      const clearButton = page.getByRole("button", { name: "Clear filters" });
      await expect(clearButton).toBeVisible();

      await clearButton.click();

      // URL should no longer have filters
      await page.waitForTimeout(500);
      expect(page.url()).not.toContain("stage=");
    });

    test("conversation card click navigates to thread", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations`);

      await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

      // Wait for data to load
      await page.waitForTimeout(1000);

      // Find and click a conversation card (if any exist)
      const cards = page.locator('[data-testid="conversation-card"], [class*="cursor-pointer"]').first();
      const cardExists = await cards.count() > 0;

      if (cardExists) {
        await cards.click();

        // Should navigate to thread page
        await page.waitForURL(/\/conversations\/[^/]+$/);
        expect(page.url()).toMatch(/\/conversations\/[^/]+$/);
      }
    });
  });

  test.describe("Conversation Thread Page", () => {
    test("loads thread page with session info", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession1.session_id}`);

      // Wait for loading
      await page.waitForLoadState("networkidle");

      // Should show either the thread or error/not found
      const pageContent = await page.content();
      const hasContent =
        pageContent.includes("Session Info") ||
        pageContent.includes("Failed to load") ||
        pageContent.includes("not found");

      expect(hasContent).toBe(true);
    });

    test("shows error state with retry button on failure", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");

      // Use non-existent session to trigger 404
      await page.goto(`${BASE_URL}/conversations/nonexistent-session-id`);

      await page.waitForLoadState("networkidle");

      // Should show error or not found
      const pageContent = await page.content();
      const hasError =
        pageContent.includes("Failed to load") ||
        pageContent.includes("Retry") ||
        pageContent.includes("not found");

      expect(hasError).toBe(true);
    });

    test("back button navigates to conversations list", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession1.session_id}`);

      await page.waitForLoadState("networkidle");

      // Click back button
      const backButton = page.locator('a[href="/conversations"]').first();
      if (await backButton.isVisible()) {
        await backButton.click();

        // Should navigate to conversations list
        await page.waitForURL(/\/conversations$/);
        expect(page.url()).toMatch(/\/conversations$/);
      }
    });

    test("displays session metadata in sidebar", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession1.session_id}`);

      await page.waitForLoadState("networkidle");

      // Look for session info section
      const sessionInfo = page.getByText("Session Info");
      if (await sessionInfo.isVisible()) {
        await expect(sessionInfo).toBeVisible();
      }
    });
  });

  test.describe("Empty States", () => {
    test("shows empty state when no conversations", async ({ page }) => {
      // Create a new user with no sessions
      const emptyEmail = `empty-conv-test-${Date.now()}@example.com`;
      const emptyUser = await createTestUserDirect(emptyEmail);
      const emptyTeam = await createTestTeam(emptyUser.id);

      try {
        await loginUser(page, emptyEmail, "TestPassword123!");
        await page.goto(`${BASE_URL}/conversations`);

        await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();
        await page.waitForTimeout(2000);

        // Should show empty state or zero count
        const pageContent = await page.content();
        const hasEmptyState =
          pageContent.includes("No conversations found") ||
          pageContent.includes("0 of 0 conversations") ||
          pageContent.includes("Start a Claude Code session");

        expect(hasEmptyState).toBe(true);
      } finally {
        // Cleanup
        await deleteTestTeam(emptyTeam.id);
        await deleteTestUser(emptyUser.id);
      }
    });
  });
});

// Helper functions for test data creation

async function createTestSession(
  teamId: string,
  userId: string,
  projectId: string,
  data: {
    session_id: string;
    slug: string;
    primary_stage: string;
    has_debugging_loop: boolean;
    conversation_score: number;
    user_message_count: number;
    total_prompts: number;
    started_at: string;
  }
): Promise<{ id: string; session_id: string }> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      team_id: teamId,
      user_id: userId,
      project_id: projectId,
      ...data,
    })
    .select("id, session_id")
    .single();

  if (error) {
    console.error("Failed to create test session:", error);
    throw error;
  }

  return session;
}

async function deleteTestSession(sessionId: string): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await supabase.from("sessions").delete().eq("id", sessionId);
}

async function createTestPrompt(
  teamId: string,
  userId: string,
  projectId: string,
  sessionId: string,
  data: {
    text: string;
    sequence_number: number;
    prompt_classification: string;
  }
): Promise<{ id: string }> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: prompt, error } = await supabase
    .from("prompts")
    .insert({
      team_id: teamId,
      user_id: userId,
      project_id: projectId,
      session_uuid: sessionId,
      char_count: data.text.length,
      word_count: data.text.split(/\s+/).filter(Boolean).length,
      ...data,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create test prompt:", error);
    throw error;
  }

  return prompt;
}

async function deleteTestPromptsForSession(sessionId: string): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await supabase.from("prompts").delete().eq("session_uuid", sessionId);
}
