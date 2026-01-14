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
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3050";

/**
 * Epic 30: Conversation Analysis E2E Tests
 *
 * Tests the conversation stats panel and analysis chat interface.
 */
test.describe("Conversation Analysis", () => {
  let testUser: { id: string; email: string };
  let testTeam: { id: string; name: string };
  let testProject: {
    id: string;
    team_id: string;
    api_key: string;
    api_key_hash: string;
  };
  let testSession: { id: string; session_id: string };
  let supabase: ReturnType<typeof createClient>;

  test.beforeAll(async () => {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ddskanjiobrjphscskog.supabase.co";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabase = createClient(supabaseUrl, serviceKey);

    // Create test user, team, and project
    const email = `analysis-test-${Date.now()}@example.com`;
    testUser = await createTestUserDirect(email);
    testTeam = await createTestTeam(testUser.id);
    testProject = await createTestProject(testTeam.id, testUser.id);

    // Create test session with prompts and responses
    const sessionId = `analysis_test_${Date.now()}`;
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        session_id: sessionId,
        user_id: testUser.id,
        team_id: testTeam.id,
        project_id: testProject.id,
        slug: "Test Analysis Session",
        started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        total_prompts: 3,
        total_tokens: 5000,
        primary_stage: "development",
      })
      .select()
      .single();

    if (sessionError) throw sessionError;
    testSession = { id: session.id, session_id: sessionId };

    // Create test prompts
    const prompts = [
      { text: "Implement a login form with email validation", sequence: 1 },
      { text: "Add password strength indicator", sequence: 2 },
      { text: "Yes, that looks good. Please proceed.", sequence: 3 },
    ];

    for (const p of prompts) {
      const { data: prompt, error: promptError } = await supabase
        .from("prompts")
        .insert({
          team_id: testTeam.id,
          user_id: testUser.id,
          project_id: testProject.id,
          session_uuid: testSession.id,
          text: p.text,
          char_count: p.text.length,
          word_count: p.text.split(/\s+/).length,
          sequence_number: p.sequence,
          input_tokens: 100,
          output_tokens: 500,
          analysis_status: "complete",
        })
        .select()
        .single();

      if (promptError) throw promptError;

      // Create response for each prompt
      await supabase.rpc("insert_encrypted_response", {
        p_prompt_id: prompt.id,
        p_response_text: `Response to: ${p.text}. This is a test response with some content.`,
        p_tool_count: 2,
        p_tools_used: ["Read", "Edit"],
        p_model: "claude-sonnet-4-20250514",
        p_tokens_in: 100,
        p_tokens_out: 500,
        p_has_thinking: false,
      });
    }
  });

  test.afterAll(async () => {
    // Clean up test data
    if (testSession?.id) {
      // Delete responses first (via prompts cascade)
      await supabase.from("prompts").delete().eq("session_uuid", testSession.id);
      await supabase.from("sessions").delete().eq("id", testSession.id);
    }
    if (testProject?.id) await deleteTestProject(testProject.id);
    if (testTeam?.id) await deleteTestTeam(testTeam.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  test.describe("Conversation Stats Panel", () => {
    test("displays stats panel without errors (string session_id)", async ({ page }) => {
      // Test with string session_id format (e.g., "analysis_test_1234")
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      // Wait for page to load
      await expect(page.locator("text=Test Analysis Session").first()).toBeVisible({ timeout: 10000 });

      // CRITICAL: Check stats panel renders WITHOUT error message
      await expect(page.locator("text=Session Stats")).toBeVisible();

      // Verify NO error state is shown
      await expect(page.locator("text=Failed to load stats")).not.toBeVisible();
      await expect(page.locator("text=Session not found")).not.toBeVisible();

      // Take screenshot
      await page.screenshot({ path: "playwright-report/conversation-stats-panel.png", fullPage: true });
    });

    test("displays stats panel without errors (UUID session_id)", async ({ page }) => {
      // CRITICAL TEST: Claude Code generates UUID-format session_ids
      // The URL uses session_id column (not database id), which can be a UUID
      // This test ensures the stats API handles UUID session_ids correctly
      await loginUser(page, testUser.email, "TestPassword123!");

      // Use the database UUID directly - simulates real production URLs
      await page.goto(`${BASE_URL}/conversations/${testSession.id}`);

      // Wait for page to load
      await expect(page.locator("text=Test Analysis Session").first()).toBeVisible({ timeout: 10000 });

      // CRITICAL: Check stats panel renders WITHOUT error message
      await expect(page.locator("text=Session Stats")).toBeVisible();

      // Verify NO error state is shown - THIS WAS THE BUG
      await expect(page.locator("text=Failed to load stats")).not.toBeVisible();
      await expect(page.locator("text=Session not found")).not.toBeVisible();

      // Verify actual data loaded
      await expect(page.locator("text=Turns")).toBeVisible();
      await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
    });

    test("shows actual turn count from data", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Session Stats")).toBeVisible({ timeout: 10000 });

      // Verify NO error state
      await expect(page.locator("text=Failed to load stats")).not.toBeVisible();

      // Check for turn count display - should show "3" from our test data
      await expect(page.locator("text=Turns")).toBeVisible();

      // The turn count "3" is shown after "Turns" label - verify it exists
      // Use a more flexible selector since the exact structure may vary
      await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

      // Check for duration display - should show "30 min" from test data
      await expect(page.locator("text=Duration")).toBeVisible();
      await expect(page.getByText("30 min")).toBeVisible();
    });

    test("shows token usage breakdown", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Session Stats")).toBeVisible({ timeout: 10000 });

      // Verify NO error state
      await expect(page.locator("text=Failed to load stats")).not.toBeVisible();

      // Check token usage section - use exact matches to avoid ambiguity
      await expect(page.locator("text=Token Usage")).toBeVisible();
      await expect(page.getByText("In", { exact: true })).toBeVisible();
      await expect(page.getByText("Out", { exact: true })).toBeVisible();
      await expect(page.getByText("Total", { exact: true })).toBeVisible();

      // Verify actual token values are shown from test data
      // Test data has: 3 prompts x (100 input + 500 output) = 300 in, 1500 out
      await expect(page.getByText("300", { exact: true })).toBeVisible(); // Input tokens
      await expect(page.getByText("1.5k")).toBeVisible(); // Output tokens (formatted)
      await expect(page.getByText("1.8k")).toBeVisible(); // Total tokens (formatted)
    });

    test("shows context window gauge", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Session Stats")).toBeVisible({ timeout: 10000 });

      // Verify NO error state
      await expect(page.locator("text=Failed to load stats")).not.toBeVisible();

      // Check context window section - component uses "Context Window" as the header
      await expect(page.getByText("Context Window", { exact: true })).toBeVisible();
    });

    test("shows outcome status", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Session Stats")).toBeVisible({ timeout: 10000 });

      // Verify NO error state - this is the critical check
      await expect(page.locator("text=Failed to load stats")).not.toBeVisible();

      // Verify outcome section is present
      await expect(page.getByText("Outcome")).toBeVisible();
      await expect(page.getByText("Completed")).toBeVisible();
    });
  });

  test.describe("Analysis Chat Panel", () => {
    test("displays analysis chat panel", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      // Wait for page to load
      await expect(page.locator("text=Test Analysis Session").first()).toBeVisible({ timeout: 10000 });

      // Check analysis panel renders
      await expect(page.locator("text=Analyze Conversation")).toBeVisible();

      // Take screenshot
      await page.screenshot({ path: "playwright-report/analysis-chat-panel.png", fullPage: true });
    });

    test("shows quick analysis buttons", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Check quick analysis section
      await expect(page.locator("text=Quick Analysis")).toBeVisible();

      // Check all 4 buttons exist
      await expect(page.locator("text=Summarize")).toBeVisible();
      await expect(page.locator("text=Find Issues")).toBeVisible();
      await expect(page.locator("text=Suggestions")).toBeVisible();
      await expect(page.locator("text=Deep Dive")).toBeVisible();
    });

    test("shows model selector", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Check model selector - use getByText for exact matches within the model selector
      await expect(page.getByText("Haiku", { exact: true })).toBeVisible();
      await expect(page.getByText("Sonnet", { exact: true })).toBeVisible();
      await expect(page.getByText("Opus", { exact: true })).toBeVisible();
    });

    test("shows content selection checkboxes", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Check content checkboxes - these are the labels next to checkboxes
      await expect(page.getByText("User prompts", { exact: true })).toBeVisible();
      await expect(page.getByText("AI responses", { exact: true })).toBeVisible();
      await expect(page.getByText("Thinking blocks", { exact: true })).toBeVisible();
    });

    test("shows question input", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Check question input exists
      const textarea = page.locator('textarea[placeholder*="Ask a question"]');
      await expect(textarea).toBeVisible();
    });

    test("model selector changes on click", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Click on Opus model
      const opusButton = page.locator("button:has-text('Opus')");
      await opusButton.click();

      // Check it's selected (has border-primary class or similar)
      await expect(opusButton).toHaveClass(/border-primary/);
    });

    test("content checkbox toggles work", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Find and click the "Thinking blocks" checkbox (should be unchecked by default)
      const thinkingCheckbox = page.getByRole("checkbox", { name: /Thinking blocks/i });
      await expect(thinkingCheckbox).not.toBeChecked();

      // Toggle it on
      await thinkingCheckbox.click();
      await expect(thinkingCheckbox).toBeChecked();

      // Toggle it off
      await thinkingCheckbox.click();
      await expect(thinkingCheckbox).not.toBeChecked();
    });

    test("can type custom question in textarea", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Find the textarea
      const textarea = page.locator('textarea[placeholder*="Ask a question"]');
      await expect(textarea).toBeVisible();

      // Type a question
      await textarea.fill("What was accomplished in this conversation?");

      // Verify the text was entered
      await expect(textarea).toHaveValue("What was accomplished in this conversation?");
    });
  });

  test.describe("Quick Analysis Execution", () => {
    test("clicking Summarize uses current user selections (not preset)", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // First, change the model to Opus (not the preset's haiku)
      const opusButton = page.locator("button:has-text('Opus')");
      await opusButton.click();

      // Toggle thinking on (default is off)
      const thinkingCheckbox = page.getByRole("checkbox", { name: /Thinking blocks/i });
      await thinkingCheckbox.click();

      // Intercept the API call to verify it uses user's selections
      let apiCallMade = false;
      let requestBody: Record<string, unknown> | null = null;

      await page.route("**/api/conversations/**/analyze", async (route) => {
        apiCallMade = true;
        const request = route.request();
        requestBody = JSON.parse(request.postData() || "{}");

        // Continue with the actual request
        await route.continue();
      });

      // Click the Summarize button
      const summarizeButton = page.locator("button:has-text('Summarize')");
      await summarizeButton.click();

      // Wait for the API call to be made
      await page.waitForTimeout(500);

      // Verify the API was called
      expect(apiCallMade).toBe(true);

      // Verify the request uses USER'S selections, not preset values
      expect(requestBody).toBeTruthy();
      expect(requestBody!.model).toBe("opus"); // User selected opus, NOT haiku
      expect(requestBody!.includePrompts).toBe(true);
      expect(requestBody!.includeResponses).toBe(true);
      expect(requestBody!.includeThinking).toBe(true); // User enabled thinking
      expect(requestBody!.includeTools).toBe(true); // Default is true
      expect(typeof requestBody!.question).toBe("string");

      // Take screenshot showing the loading/response state
      await page.screenshot({
        path: "playwright-report/quick-analysis-summarize.png",
        fullPage: true,
      });
    });

    test("quick analysis buttons respect user's content selection", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Uncheck "AI responses" (default is checked)
      const responsesCheckbox = page.getByRole("checkbox", { name: /AI responses/i });
      await responsesCheckbox.click();
      await expect(responsesCheckbox).not.toBeChecked();

      // Intercept the API call
      let requestBody: Record<string, unknown> | null = null;

      await page.route("**/api/conversations/**/analyze", async (route) => {
        const request = route.request();
        requestBody = JSON.parse(request.postData() || "{}");
        await route.continue();
      });

      // Click the Deep Dive button
      const deepDiveButton = page.locator("button:has-text('Deep Dive')");
      await deepDiveButton.click();

      // Wait for the API call to be made
      await page.waitForTimeout(500);

      // Verify user's content selection is respected
      expect(requestBody).toBeTruthy();
      expect(requestBody!.includeResponses).toBe(false); // User unchecked responses

      // Take screenshot
      await page.screenshot({
        path: "playwright-report/quick-analysis-deep-dive.png",
        fullPage: true,
      });
    });

    test("submitting custom question triggers analysis with current settings", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // First, change the model to Opus
      const opusButton = page.locator("button:has-text('Opus')");
      await opusButton.click();

      // Toggle thinking on
      const thinkingCheckbox = page.getByRole("checkbox", { name: /Thinking blocks/i });
      await thinkingCheckbox.click();

      // Intercept the API call
      let requestBody: Record<string, unknown> | null = null;

      await page.route("**/api/conversations/**/analyze", async (route) => {
        const request = route.request();
        requestBody = JSON.parse(request.postData() || "{}");
        await route.continue();
      });

      // Type a custom question
      const textarea = page.locator('textarea[placeholder*="Ask a question"]');
      await textarea.fill("What patterns did the developer follow?");

      // Submit by clicking the Analyze button (Enter alone doesn't submit, needs Cmd/Ctrl+Enter)
      const analyzeButton = page.locator("button:has-text('Analyze')").last();
      await analyzeButton.click();

      // Wait for the API call
      await page.waitForTimeout(500);

      // Verify the request respects user's model and content selections
      expect(requestBody).toBeTruthy();
      expect(requestBody!.model).toBe("opus"); // User selected opus
      expect(requestBody!.includeThinking).toBe(true); // User enabled thinking
      expect(requestBody!.question).toBe("What patterns did the developer follow?");

      // Take screenshot
      await page.screenshot({
        path: "playwright-report/custom-question-analysis.png",
        fullPage: true,
      });
    });

    test("shows loading state during analysis", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Delay the API response to observe loading state
      await page.route("**/api/conversations/**/analyze", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
      });

      // Click Summarize
      const summarizeButton = page.locator("button:has-text('Summarize')");
      await summarizeButton.click();

      // Verify loading state is shown (buttons should be disabled)
      await expect(summarizeButton).toBeDisabled();

      // Take screenshot of loading state
      await page.screenshot({
        path: "playwright-report/analysis-loading-state.png",
        fullPage: true,
      });
    });

    test("handles API error gracefully", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Mock a failing API response
      await page.route("**/api/conversations/**/analyze", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "INTERNAL_ERROR", message: "API key not configured" },
          }),
        });
      });

      // Click Summarize
      const summarizeButton = page.locator("button:has-text('Summarize')");
      await summarizeButton.click();

      // Wait for error to appear
      await page.waitForTimeout(500);

      // Verify error message is displayed
      await expect(page.locator("text=API key not configured")).toBeVisible();

      // Take screenshot of error state
      await page.screenshot({
        path: "playwright-report/analysis-error-state.png",
        fullPage: true,
      });
    });
  });

  test.describe("Real API Integration", () => {
    test("analysis is saved to database after completion", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      await expect(page.locator("text=Analyze Conversation")).toBeVisible({ timeout: 10000 });

      // Wait for past analyses to load
      await expect(page.locator("text=Past Analyses")).toBeVisible();

      // Get initial count of past analyses
      const initialText = await page.locator("text=Past Analyses").textContent();
      const initialMatch = initialText?.match(/\((\d+)\)/);
      const initialCount = initialMatch ? parseInt(initialMatch[1]) : 0;

      // Click Summarize WITHOUT mocking - this will call the real Anthropic API
      const summarizeButton = page.locator("button:has-text('Summarize')");
      await summarizeButton.click();

      // Wait for the analysis to complete (streaming response)
      // The button should be disabled during analysis and re-enabled after
      await expect(summarizeButton).toBeDisabled();
      await expect(summarizeButton).toBeEnabled({ timeout: 60000 }); // Wait up to 60s for API response

      // Wait a moment for the database save to complete
      await page.waitForTimeout(2000);

      // Refresh to get the latest past analyses
      await page.reload();
      await expect(page.locator("text=Past Analyses")).toBeVisible({ timeout: 10000 });

      // Verify the count increased
      const newText = await page.locator("text=Past Analyses").textContent();
      const newMatch = newText?.match(/\((\d+)\)/);
      const newCount = newMatch ? parseInt(newMatch[1]) : 0;

      expect(newCount).toBeGreaterThan(initialCount);

      // Take screenshot
      await page.screenshot({
        path: "playwright-report/analysis-saved-to-database.png",
        fullPage: true,
      });
    });
  });

  test.describe("Visual Verification", () => {
    test("full page screenshot of conversation with analysis panels", async ({ page }) => {
      await loginUser(page, testUser.email, "TestPassword123!");
      await page.goto(`${BASE_URL}/conversations/${testSession.session_id}`);

      // Wait for everything to load
      await expect(page.locator("text=Test Analysis Session").first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Session Stats")).toBeVisible();
      await expect(page.locator("text=Analyze Conversation")).toBeVisible();

      // Wait for any loading states to finish
      await page.waitForTimeout(1000);

      // Take full page screenshot
      await page.screenshot({
        path: "playwright-report/epic30-full-conversation-analysis.png",
        fullPage: true,
      });

      // Take screenshot of just the sidebar
      const sidebar = page.locator("aside").first();
      if (await sidebar.isVisible()) {
        await sidebar.screenshot({
          path: "playwright-report/epic30-analysis-sidebar.png",
        });
      }
    });
  });
});
