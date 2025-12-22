import { defineConfig, devices } from "@playwright/test";

/**
 * Production smoke test configuration.
 * Runs against https://contextor.co without starting a local server.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "production-smoke.spec.ts",
  fullyParallel: true,
  forbidOnly: true,
  retries: 2,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report-production" }], ["list"]],
  timeout: 60000,
  use: {
    baseURL: process.env.PRODUCTION_URL || "https://contextor.co",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No webServer - testing against production
});
