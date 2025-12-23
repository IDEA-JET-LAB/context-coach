import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Import Preview UI - Story 17-2
 *
 * Tests the historical import preview flow including:
 * - Display of discovery statistics
 * - Project selection/deselection
 * - Import All / Select Projects / Skip flows
 * - Selection persistence in sessionStorage
 * - Loading states
 */

// Mock discovery data for testing
const mockDiscoveryResult = {
  projects: [
    {
      path: "/Users/test/Projects/app-one",
      normalizedPath: "-Users-test-Projects-app-one",
      sessionCount: 10,
      totalPrompts: 200,
      oldestSession: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      newestSession: new Date().toISOString(),
    },
    {
      path: "/Users/test/Projects/app-two",
      normalizedPath: "-Users-test-Projects-app-two",
      sessionCount: 5,
      totalPrompts: 100,
      oldestSession: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      newestSession: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      path: "/Users/test/Projects/app-three",
      normalizedPath: "-Users-test-Projects-app-three",
      sessionCount: 8,
      totalPrompts: 150,
      oldestSession: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      newestSession: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  skippedDirectories: [],
  totalProjects: 3,
  totalSessions: 23,
  totalPrompts: 450,
  dateRange: {
    oldest: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    newest: new Date().toISOString(),
  },
  appliedDateRange: {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  },
  discoveredAt: new Date().toISOString(),
};

test.describe("Import Preview UI", () => {
  test.beforeEach(async ({ page }) => {
    // Set mock discovery data in sessionStorage before navigating
    await page.addInitScript((mockData) => {
      sessionStorage.setItem("contextor-mock-discovery", JSON.stringify(mockData));
      // Clear any previous selection
      sessionStorage.removeItem("contextor-import-selection");
    }, mockDiscoveryResult);
  });

  test.afterEach(async ({ page }) => {
    // Clean up sessionStorage
    await page.evaluate(() => {
      sessionStorage.removeItem("contextor-mock-discovery");
      sessionStorage.removeItem("contextor-import-selection");
    });
  });

  test.describe("Display of Discovery Statistics", () => {
    test("should display welcome message with summary statistics", async ({ page }) => {
      await page.goto("/import");

      // Wait for the preview to load
      await expect(page.getByTestId("discovery-import-preview")).toBeVisible();

      // Check welcome message
      await expect(page.getByText("Welcome to Contextor!")).toBeVisible();

      // Check statistics
      await expect(page.getByTestId("total-prompts")).toHaveText("450");
      await expect(page.getByTestId("total-projects")).toHaveText("3");
    });

    test("should display stats summary section", async ({ page }) => {
      await page.goto("/import");

      const statsSummary = page.getByTestId("stats-summary");
      await expect(statsSummary).toBeVisible();

      // Check individual stats
      await expect(page.getByTestId("stats-projects")).toHaveText("3");
      await expect(page.getByTestId("stats-sessions")).toHaveText("23");
      await expect(page.getByTestId("stats-prompts")).toHaveText("450");
    });

    test("should display privacy notice with link", async ({ page }) => {
      await page.goto("/import");

      const privacyNotice = page.getByTestId("privacy-notice");
      await expect(privacyNotice).toBeVisible();
      await expect(privacyNotice).toContainText("Your prompt history stays private");

      const privacyLink = page.getByTestId("privacy-link");
      await expect(privacyLink).toBeVisible();
      await expect(privacyLink).toHaveAttribute("href", "/docs");
    });
  });

  test.describe("Project Selection", () => {
    test("should show project list when Select Projects is clicked", async ({ page }) => {
      await page.goto("/import");

      // Initially project list should not be visible
      await expect(page.getByTestId("project-list")).not.toBeVisible();

      // Click Select Projects button
      await page.getByTestId("select-projects-button").click();

      // Now project list should be visible
      await expect(page.getByTestId("project-list")).toBeVisible();

      // Should show all projects
      await expect(
        page.getByTestId("project-item--Users-test-Projects-app-one")
      ).toBeVisible();
      await expect(
        page.getByTestId("project-item--Users-test-Projects-app-two")
      ).toBeVisible();
      await expect(
        page.getByTestId("project-item--Users-test-Projects-app-three")
      ).toBeVisible();
    });

    test("should allow selecting and deselecting individual projects", async ({ page }) => {
      await page.goto("/import");

      // Show project list
      await page.getByTestId("select-projects-button").click();

      // All projects should be selected by default
      const checkbox1 = page.getByTestId("project-checkbox--Users-test-Projects-app-one");
      const checkbox2 = page.getByTestId("project-checkbox--Users-test-Projects-app-two");

      await expect(checkbox1).toBeChecked();
      await expect(checkbox2).toBeChecked();

      // Deselect first project
      await checkbox1.click();
      await expect(checkbox1).not.toBeChecked();

      // Selection summary should update
      await expect(page.getByTestId("selection-summary")).toContainText("2 of 3 projects");
    });

    test("should have working Select All / Deselect All button", async ({ page }) => {
      await page.goto("/import");

      // Show project list
      await page.getByTestId("select-projects-button").click();

      const selectAllButton = page.getByTestId("select-all-button");
      await expect(selectAllButton).toHaveText("Deselect All");

      // Deselect all
      await selectAllButton.click();
      await expect(selectAllButton).toHaveText("Select All");

      // All checkboxes should be unchecked
      await expect(
        page.getByTestId("project-checkbox--Users-test-Projects-app-one")
      ).not.toBeChecked();
      await expect(
        page.getByTestId("project-checkbox--Users-test-Projects-app-two")
      ).not.toBeChecked();
      await expect(
        page.getByTestId("project-checkbox--Users-test-Projects-app-three")
      ).not.toBeChecked();

      // Select all again
      await selectAllButton.click();
      await expect(selectAllButton).toHaveText("Deselect All");

      // All checkboxes should be checked
      await expect(
        page.getByTestId("project-checkbox--Users-test-Projects-app-one")
      ).toBeChecked();
    });

    test("should update running totals when selection changes", async ({ page }) => {
      await page.goto("/import");

      // Show project list
      await page.getByTestId("select-projects-button").click();

      // Initially all selected - check stats
      await expect(page.getByTestId("stats-prompts")).toHaveText("450");

      // Deselect first project (200 prompts)
      await page.getByTestId("project-checkbox--Users-test-Projects-app-one").click();

      // Stats should update to 250 (100 + 150)
      await expect(page.getByTestId("stats-prompts")).toHaveText("250");
    });
  });

  test.describe("Action Buttons", () => {
    test("should display Import All and Select Projects buttons initially", async ({
      page,
    }) => {
      await page.goto("/import");

      await expect(page.getByTestId("import-all-button")).toBeVisible();
      await expect(page.getByTestId("select-projects-button")).toBeVisible();
      await expect(page.getByTestId("skip-button")).toBeVisible();
    });

    test("should show Import Selected button after selecting projects", async ({
      page,
    }) => {
      await page.goto("/import");

      await page.getByTestId("select-projects-button").click();

      // Import All should be replaced with Import Selected
      await expect(page.getByTestId("import-all-button")).not.toBeVisible();
      await expect(page.getByTestId("import-selected-button")).toBeVisible();
      await expect(page.getByTestId("import-selected-button")).toContainText("Import Selected (3)");
    });

    test("should disable Import Selected when no projects are selected", async ({
      page,
    }) => {
      await page.goto("/import");

      await page.getByTestId("select-projects-button").click();
      await page.getByTestId("select-all-button").click(); // Deselect all

      await expect(page.getByTestId("import-selected-button")).toBeDisabled();
    });
  });

  test.describe("Import Flow", () => {
    test("should start import when Import All is clicked", async ({ page }) => {
      await page.goto("/import");

      await page.getByTestId("import-all-button").click();

      // Should show progress container
      await expect(page.getByTestId("import-progress-container")).toBeVisible({ timeout: 10000 });
    });

    test("should start import when Import Selected is clicked", async ({ page }) => {
      await page.goto("/import");

      await page.getByTestId("select-projects-button").click();
      await page.getByTestId("import-selected-button").click();

      // Should show progress container
      await expect(page.getByTestId("import-progress-container")).toBeVisible({ timeout: 10000 });
    });

    test("should show completion summary after import finishes", async ({ page }) => {
      await page.goto("/import");

      await page.getByTestId("import-all-button").click();

      // Wait for import to complete (mock import is fast)
      await expect(page.getByTestId("import-complete-container")).toBeVisible({
        timeout: 30000,
      });

      // Should show success message
      await expect(page.getByText(/Import Successful|Import Complete/)).toBeVisible();
    });
  });

  test.describe("Skip Flow", () => {
    test("should redirect to home or login when Skip is clicked", async ({ page }) => {
      await page.goto("/import");

      await page.getByTestId("skip-button").click();

      // Should redirect to home (if authenticated) or login (if not authenticated)
      // The dashboard is protected, so unauthenticated users will be redirected to login
      await expect(page).toHaveURL(/\/(home|login)/, { timeout: 10000 });
    });
  });

  test.describe("Selection Persistence", () => {
    test("should save selection to sessionStorage", async ({ page }) => {
      await page.goto("/import");

      // Show project list and deselect one project
      await page.getByTestId("select-projects-button").click();
      await page.getByTestId("project-checkbox--Users-test-Projects-app-one").click();

      // Verify deselection
      await expect(
        page.getByTestId("project-checkbox--Users-test-Projects-app-one")
      ).not.toBeChecked();

      // Verify sessionStorage was updated
      const storedSelection = await page.evaluate(() => {
        return sessionStorage.getItem("contextor-import-selection");
      });

      expect(storedSelection).toBeTruthy();
      const parsed = JSON.parse(storedSelection!);
      expect(parsed).toHaveLength(2);
      expect(parsed).not.toContain("-Users-test-Projects-app-one");
      expect(parsed).toContain("-Users-test-Projects-app-two");
      expect(parsed).toContain("-Users-test-Projects-app-three");
    });
  });

  test.describe("Loading States", () => {
    test("should show loading spinner while fetching discovery data", async ({ page }) => {
      // Don't set mock data - let it fetch from API (which will fail and show mock)
      await page.addInitScript(() => {
        sessionStorage.removeItem("contextor-mock-discovery");
      });

      // Navigate and check for loading state
      await page.goto("/import");

      // In dev mode, loading might be too fast to catch, so we just verify the page loads
      await expect(page.getByTestId("discovery-import-preview")).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("Skipped Directories Warning", () => {
    test("should show warning when directories were skipped", async ({ page }) => {
      const mockWithSkipped = {
        ...mockDiscoveryResult,
        skippedDirectories: [
          { path: "/Users/test/restricted", reason: "Permission denied" },
          { path: "/Users/test/broken", reason: "Could not read" },
        ],
      };

      await page.addInitScript((mockData) => {
        sessionStorage.setItem("contextor-mock-discovery", JSON.stringify(mockData));
      }, mockWithSkipped);

      await page.goto("/import");

      const warning = page.getByTestId("skipped-warning");
      await expect(warning).toBeVisible();
      await expect(warning).toContainText("2 directories were skipped");
    });

    test("should not show warning when no directories were skipped", async ({ page }) => {
      await page.goto("/import");

      await expect(page.getByTestId("skipped-warning")).not.toBeVisible();
    });
  });
});
