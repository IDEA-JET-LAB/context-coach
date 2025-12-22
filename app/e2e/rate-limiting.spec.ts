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

// Check if Upstash Redis is configured
const UPSTASH_CONFIGURED =
  process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN;

/**
 * Rate Limiting E2E Tests
 *
 * These tests verify that the capture endpoint properly enforces rate limits:
 * - Project: 100 requests/min
 * - User: 20 requests/min
 * - IP: 10 requests/min (fallback)
 *
 * Note: Tests use unique identifiers to avoid interference between test runs.
 *
 * IMPORTANT: These tests require Upstash Redis to be configured.
 * Set UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN in .env.local
 */
test.describe("Rate Limiting", () => {
  // Skip all tests if Upstash Redis is not configured
  test.skip(
    !UPSTASH_CONFIGURED,
    "Skipping rate limiting tests: UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN not configured"
  );
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
    const email = `ratelimit-test-${Date.now()}@example.com`;
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

  test.describe("User-level rate limiting (20 req/min)", () => {
    test("returns 429 after exceeding user rate limit", async ({ request }) => {
      // Use a unique user_id for this test to avoid interference
      const uniqueUserId = `rate-limit-user-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Make 20 requests (should all succeed)
      const successfulRequests: number[] = [];
      for (let i = 0; i < 20; i++) {
        const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
          headers: {
            Authorization: `Bearer ${testProject.api_key}`,
          },
          data: {
            prompt: `Rate limit test prompt ${i}`,
            user_id: uniqueUserId,
            timestamp: new Date().toISOString(),
          },
        });
        successfulRequests.push(response.status());
      }

      // Verify all 20 requests succeeded
      expect(successfulRequests.filter((s) => s === 201).length).toBe(20);

      // The 21st request should be rate limited
      const limitedResponse = await request.post(
        `${BASE_URL}/api/prompts/capture`,
        {
          headers: {
            Authorization: `Bearer ${testProject.api_key}`,
          },
          data: {
            prompt: "This should be rate limited",
            user_id: uniqueUserId,
            timestamp: new Date().toISOString(),
          },
        }
      );

      expect(limitedResponse.status()).toBe(429);

      const body = await limitedResponse.json();
      expect(body.error).toEqual({
        code: "RATE_LIMITED",
        message: "Too many requests",
      });

      // Verify Retry-After header is present and is a positive number
      const retryAfter = limitedResponse.headers()["retry-after"];
      expect(retryAfter).toBeDefined();
      expect(parseInt(retryAfter ?? "0", 10)).toBeGreaterThan(0);
    });
  });

  test.describe("IP-level rate limiting (10 req/min fallback)", () => {
    test("returns 429 after exceeding IP rate limit for invalid auth", async ({
      request,
    }) => {
      // Use an invalid API key to trigger IP-based rate limiting
      // Each request will fail auth but should still count against IP limit
      const uniqueIpSuffix = Date.now().toString();

      // Make 10 requests with invalid API key (should all return 401)
      for (let i = 0; i < 10; i++) {
        const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
          headers: {
            Authorization: `Bearer ctx_invalid_key_${uniqueIpSuffix}`,
            "X-Forwarded-For": `192.168.100.${uniqueIpSuffix.slice(-3)}`,
          },
          data: {
            prompt: `IP rate limit test ${i}`,
            user_id: "test-user",
            timestamp: new Date().toISOString(),
          },
        });
        // These should return 401 (invalid API key)
        expect(response.status()).toBe(401);
      }

      // The 11th request should be rate limited (429) before even checking auth
      const limitedResponse = await request.post(
        `${BASE_URL}/api/prompts/capture`,
        {
          headers: {
            Authorization: `Bearer ctx_invalid_key_${uniqueIpSuffix}`,
            "X-Forwarded-For": `192.168.100.${uniqueIpSuffix.slice(-3)}`,
          },
          data: {
            prompt: "This should be rate limited",
            user_id: "test-user",
            timestamp: new Date().toISOString(),
          },
        }
      );

      expect(limitedResponse.status()).toBe(429);

      const body = await limitedResponse.json();
      expect(body.error).toEqual({
        code: "RATE_LIMITED",
        message: "Too many requests",
      });
    });
  });

  test.describe("Rate limit response format", () => {
    test("includes proper error structure in 429 response", async ({
      request,
    }) => {
      // Create a unique user to hit the rate limit
      const uniqueUserId = `format-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Exhaust the user rate limit (20 requests)
      for (let i = 0; i < 20; i++) {
        await request.post(`${BASE_URL}/api/prompts/capture`, {
          headers: {
            Authorization: `Bearer ${testProject.api_key}`,
          },
          data: {
            prompt: `Format test prompt ${i}`,
            user_id: uniqueUserId,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Make one more request to get rate limited
      const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
        data: {
          prompt: "Should be rate limited",
          user_id: uniqueUserId,
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.status()).toBe(429);

      const body = await response.json();

      // Verify error structure matches specification
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code", "RATE_LIMITED");
      expect(body.error).toHaveProperty("message", "Too many requests");

      // Verify Retry-After header
      const retryAfter = response.headers()["retry-after"];
      expect(retryAfter).toBeDefined();
      const retrySeconds = parseInt(retryAfter ?? "0", 10);
      expect(retrySeconds).toBeGreaterThan(0);
      expect(retrySeconds).toBeLessThanOrEqual(60); // Should be within the 1-minute window
    });
  });

  test.describe("Rate limiting order of checks", () => {
    test("rate limit check happens before validation", async ({ request }) => {
      // Use a unique user_id for this test
      const uniqueUserId = `order-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Exhaust the user rate limit with valid requests
      for (let i = 0; i < 20; i++) {
        await request.post(`${BASE_URL}/api/prompts/capture`, {
          headers: {
            Authorization: `Bearer ${testProject.api_key}`,
          },
          data: {
            prompt: `Order test prompt ${i}`,
            user_id: uniqueUserId,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Now send an INVALID request (missing required fields)
      // Should return 429 (rate limited) NOT 400 (validation error)
      // because rate limiting should be checked BEFORE validation
      const response = await request.post(`${BASE_URL}/api/prompts/capture`, {
        headers: {
          Authorization: `Bearer ${testProject.api_key}`,
        },
        data: {
          // Missing prompt, user_id, timestamp
          invalid_field: "test",
        },
      });

      // Should be rate limited, not validation error
      expect(response.status()).toBe(429);
      const body = await response.json();
      expect(body.error.code).toBe("RATE_LIMITED");
    });
  });
});
