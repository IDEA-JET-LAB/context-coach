import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 3,
  reporter: "html",
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3050",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Grant clipboard permissions for copy tests
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- -p 3050",
    url: "http://127.0.0.1:3050",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
