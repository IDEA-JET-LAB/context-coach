import { test, expect } from "@playwright/test";

/**
 * Production Smoke Tests
 *
 * These tests verify core functionality of the production deployment at contextor.co.
 * They do NOT require database access or email verification.
 *
 * Run with: npx playwright test --config=playwright.production.config.ts
 */

const PRODUCTION_URL = process.env.PRODUCTION_URL || "https://contextor.co";

test.describe("Production Smoke Tests", () => {
  test.describe("Health & Infrastructure", () => {
    test("health endpoint returns healthy status", async ({ request }) => {
      const response = await request.get(`${PRODUCTION_URL}/api/health`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("ok");
      expect(body.checks.database).toBe(true);
    });

    test("production URL loads with valid SSL", async ({ page }) => {
      const response = await page.goto("/");

      expect(response?.status()).toBe(200);
      expect(page.url()).toMatch(/^https:\/\//);
    });
  });

  test.describe("Landing Page", () => {
    test("displays landing page content", async ({ page }) => {
      await page.goto("/");

      // Verify key landing page elements
      await expect(page.getByRole("heading", { name: /Your Context Tutor/i })).toBeVisible();
      await expect(page.getByText(/Help your team master AI prompting/i)).toBeVisible();
    });

    test("displays navigation with logo and links", async ({ page }) => {
      await page.goto("/");

      // Logo
      await expect(page.getByText("Contextor").first()).toBeVisible();

      // Navigation links
      await expect(page.getByRole("link", { name: /Features/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Log In/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Sign Up/i })).toBeVisible();
    });

    test("displays features section", async ({ page }) => {
      await page.goto("/");

      await expect(page.getByText("Automatic Capture")).toBeVisible();
      await expect(page.getByText("AI-Powered Analysis")).toBeVisible();
      await expect(page.getByText("Team Insights")).toBeVisible();
    });

    test("displays footer with copyright", async ({ page }) => {
      await page.goto("/");

      await expect(page.getByText(/© 2025 Contextor/i)).toBeVisible();
    });

    test("Get Started CTA links to signup", async ({ page }) => {
      await page.goto("/");

      await page.getByRole("link", { name: /Get Started Free/i }).click();

      await expect(page).toHaveURL(/\/signup/);
    });
  });

  test.describe("Authentication Pages", () => {
    test("login page displays form correctly", async ({ page }) => {
      await page.goto("/login");

      await expect(page.getByText("Login").first()).toBeVisible();
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    });

    test("login page shows validation errors for empty form", async ({ page }) => {
      await page.goto("/login");

      await page.getByRole("button", { name: "Login", exact: true }).click();

      await expect(page.getByText("Email is required")).toBeVisible();
    });

    test("login page shows error for invalid credentials", async ({ page }) => {
      await page.goto("/login");

      await page.getByLabel("Email").fill("nonexistent@example.com");
      await page.locator('input[autocomplete="current-password"]').fill("WrongPassword123!");
      await page.getByRole("button", { name: "Login", exact: true }).click();

      await expect(page.getByText("Invalid email or password")).toBeVisible({ timeout: 15000 });
    });

    test("login page navigates to signup", async ({ page }) => {
      await page.goto("/login");

      await page.getByRole("link", { name: "Sign up" }).click();

      await expect(page).toHaveURL("/signup");
    });

    test("login page navigates to forgot password", async ({ page }) => {
      await page.goto("/login");

      await page.getByRole("link", { name: "Forgot your password?" }).click();

      await expect(page).toHaveURL("/reset-password");
    });

    test("signup page displays form correctly", async ({ page }) => {
      await page.goto("/signup");

      await expect(page.getByText("Sign up").first()).toBeVisible();
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Confirm Password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    });

    test("signup page shows validation errors for empty form", async ({ page }) => {
      await page.goto("/signup");

      await page.getByRole("button", { name: "Create account" }).click();

      await expect(page.getByText("Email is required")).toBeVisible();
    });

    test("signup page shows password mismatch error", async ({ page }) => {
      await page.goto("/signup");

      await page.getByLabel("Email").fill("test@example.com");
      await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
      await page.getByLabel("Confirm Password").fill("DifferentPassword!");
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(page.getByText("Passwords do not match")).toBeVisible();
    });

    test("signup page shows short password error", async ({ page }) => {
      await page.goto("/signup");

      await page.getByLabel("Email").fill("test@example.com");
      await page.getByLabel("Password", { exact: true }).fill("short");
      await page.getByLabel("Confirm Password").fill("short");
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
    });

    test("signup page navigates to login", async ({ page }) => {
      await page.goto("/signup");

      await page.getByRole("link", { name: "Login" }).click();

      await expect(page).toHaveURL("/login");
    });

    test("password reset page displays form correctly", async ({ page }) => {
      await page.goto("/reset-password");

      await expect(page.getByText("Reset your password", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
    });

    test("password reset shows validation error for empty email", async ({ page }) => {
      await page.goto("/reset-password");

      await page.getByRole("button", { name: "Send reset link" }).click();

      await expect(page.getByText("Email is required")).toBeVisible();
    });
  });

  test.describe("Capture API", () => {
    test("returns 401 for missing authorization", async ({ request }) => {
      const response = await request.post(`${PRODUCTION_URL}/api/prompts/capture`, {
        data: {
          prompt: "Test prompt",
          user_id: "test-user",
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe("INVALID_API_KEY");
    });

    test("returns 401 for invalid API key", async ({ request }) => {
      const response = await request.post(`${PRODUCTION_URL}/api/prompts/capture`, {
        headers: {
          Authorization: "Bearer ctx_invalid_key_123456789",
        },
        data: {
          prompt: "Test prompt",
          user_id: "test-user",
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe("INVALID_API_KEY");
    });
  });

  test.describe("Protected Routes", () => {
    test("dashboard redirects to login when not authenticated", async ({ page }) => {
      await page.goto("/prompts");

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("team page redirects to login when not authenticated", async ({ page }) => {
      await page.goto("/team");

      await expect(page).toHaveURL(/\/login/);
    });

    test("projects page redirects to login when not authenticated", async ({ page }) => {
      await page.goto("/projects");

      await expect(page).toHaveURL(/\/login/);
    });

    test("analytics page redirects to login when not authenticated", async ({ page }) => {
      await page.goto("/analytics");

      await expect(page).toHaveURL(/\/login/);
    });

    test("admin page redirects to login when not authenticated", async ({ page }) => {
      await page.goto("/admin");

      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Responsive Design", () => {
    test("landing page works on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");

      // Core content should still be visible
      await expect(page.getByRole("heading", { name: /Your Context Tutor/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Get Started Free/i })).toBeVisible();
    });

    test("login page works on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/login");

      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
    });
  });

  test.describe("Performance", () => {
    test("landing page loads within acceptable time", async ({ page }) => {
      const startTime = Date.now();

      await page.goto("/");
      await expect(page.getByRole("heading", { name: /Your Context Tutor/i })).toBeVisible();

      const loadTime = Date.now() - startTime;

      // Should load within 10 seconds (generous for cold start)
      expect(loadTime).toBeLessThan(10000);
    });

    test("login page loads within acceptable time", async ({ page }) => {
      const startTime = Date.now();

      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();

      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000);
    });
  });
});
