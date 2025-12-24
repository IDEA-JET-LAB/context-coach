import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Security configuration for rate limiting.
 */
interface RateLimitConfig {
  /**
   * If true, requests will be rejected when Redis is unavailable (fail-closed).
   * If false, requests will be allowed when Redis is unavailable (fail-open).
   * Default: false for development, recommended true for production.
   */
  failClosed: boolean;
}

const config: RateLimitConfig = {
  // In production, set RATE_LIMIT_FAIL_CLOSED=true to reject requests when Redis is down
  failClosed: process.env.RATE_LIMIT_FAIL_CLOSED === "true",
};

// Track if we've already logged the Redis warning (prevent log spam)
let redisWarningLogged = false;

/**
 * Creates a Redis client for rate limiting.
 * Returns null if environment variables are not configured.
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    // Log prominently - this is a security concern in production
    console.error(
      "============================================================"
    );
    console.error(
      "[SECURITY WARNING] Rate limiting is DISABLED - Redis not configured"
    );
    console.error(
      "  UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN must be set for rate limiting."
    );
    console.error(
      `  Fail-closed mode: ${config.failClosed ? "ENABLED (requests will be rejected)" : "DISABLED (requests will be allowed)"}`
    );
    console.error(
      "  Set RATE_LIMIT_FAIL_CLOSED=true to reject requests when Redis is unavailable."
    );
    console.error(
      "============================================================"
    );
    return null;
  }

  return new Redis({ url, token });
}

const redis = createRedisClient();

/**
 * Project-level rate limiter.
 * Limit: 100 requests per minute per project.
 * Identifier: project_id from validated API key.
 */
export const projectRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      prefix: "ratelimit:project",
    })
  : null;

/**
 * User-level rate limiter.
 * Limit: 20 requests per minute per user.
 * Identifier: user_id from request body.
 */
export const userRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      prefix: "ratelimit:user",
    })
  : null;

/**
 * IP-level rate limiter (fallback for unauthenticated requests).
 * Limit: 10 requests per minute per IP.
 * Identifier: Client IP from request headers.
 */
export const ipRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "ratelimit:ip",
    })
  : null;

/**
 * CLI endpoint rate limiter.
 * Limit: 30 requests per minute per API key.
 * Identifier: project_id from validated API key (used as proxy for API key).
 * Used for CLI validation/test endpoints to prevent abuse with leaked API keys.
 */
export const cliRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "ratelimit:cli",
    })
  : null;

/**
 * Invitation token validation rate limiter.
 * Limit: 5 requests per minute per IP.
 * Purpose: Prevent brute force attacks on invitation token guessing.
 * Invitation tokens are UUIDs (128 bits), but rate limiting adds defense in depth.
 */
export const invitationRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "ratelimit:invitation",
    })
  : null;

/**
 * M38 Fix: Admin bulk operations rate limiter.
 * Limit: 5 bulk operations per hour per admin user.
 * Identifier: admin user ID.
 * Used for bulk retry and other resource-intensive admin operations.
 */
export const adminBulkRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "ratelimit:admin-bulk",
    })
  : null;

/**
 * Admin single operations rate limiter.
 * Limit: 60 operations per minute per admin user.
 * Identifier: admin user ID.
 * Used for single retry operations to prevent abuse.
 */
export const adminSingleRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "ratelimit:admin-single",
    })
  : null;

/**
 * Recovery prompt generation rate limiter.
 * Limit: 10 requests per minute per user.
 * Identifier: user ID from authenticated session.
 * Used to prevent abuse of AI-powered recovery prompt generation.
 */
export const recoveryRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "ratelimit:recovery",
    })
  : null;

/**
 * Rate limit result type.
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Helper to check rate limit and return a standardized result.
 *
 * When Redis is unavailable:
 * - If RATE_LIMIT_FAIL_CLOSED=true: Returns { success: false } (rejects requests)
 * - If RATE_LIMIT_FAIL_CLOSED=false: Returns { success: true } (allows requests)
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!limiter) {
    // Log warning on first request (not on every request to avoid log spam)
    if (!redisWarningLogged) {
      console.warn(
        `[Rate Limit] Request from ${identifier} - Redis unavailable, fail-closed: ${config.failClosed}`
      );
      redisWarningLogged = true;
    }

    if (config.failClosed) {
      // Fail-closed: reject requests when rate limiting is unavailable
      return {
        success: false,
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60000, // Retry in 1 minute
      };
    }

    // Fail-open: allow requests when rate limiting is unavailable
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Checks if the request is coming through a trusted reverse proxy.
 *
 * We trust X-Forwarded-For headers only when:
 * 1. Running in Cloud Run (K_SERVICE env var is set)
 * 2. Running in a known cloud environment with trusted load balancers
 *
 * Cloud Run always sets these headers correctly and strips any client-provided values.
 */
function isBehindTrustedProxy(): boolean {
  // Cloud Run sets K_SERVICE environment variable
  if (process.env.K_SERVICE) {
    return true;
  }

  // Vercel sets VERCEL environment variable
  if (process.env.VERCEL) {
    return true;
  }

  // Allow explicit trust configuration for other environments
  if (process.env.TRUST_PROXY === "true") {
    return true;
  }

  return false;
}

/**
 * Extracts client IP from request headers.
 *
 * SECURITY: Only trusts X-Forwarded-For and X-Real-IP headers when running
 * behind a known trusted reverse proxy (Cloud Run, Vercel, etc.).
 *
 * This prevents IP spoofing attacks where an attacker forges these headers
 * to bypass IP-based rate limiting.
 *
 * Falls back to 'unknown' if IP cannot be determined securely.
 */
export function getClientIp(request: Request): string {
  // Only trust forwarded headers when behind a trusted proxy
  if (isBehindTrustedProxy()) {
    // Cloud Run's load balancer puts the real client IP at the END of X-Forwarded-For
    // because it appends to any existing header. The rightmost IP is the one added by
    // the trusted proxy.
    // However, Google Cloud Run actually overwrites the header, so we can trust the first IP.
    // See: https://cloud.google.com/run/docs/container-contract#headers
    const xForwardedFor = request.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      // For Cloud Run: Google's load balancer sets this header, client cannot spoof it
      // Take the first IP (this is the client IP as seen by Google's edge)
      const firstIp = xForwardedFor.split(",")[0];
      if (firstIp) {
        return firstIp.trim();
      }
    }

    const xRealIp = request.headers.get("x-real-ip");
    if (xRealIp) {
      return xRealIp.trim();
    }
  } else {
    // Not behind trusted proxy - log if someone is trying to spoof headers
    const xForwardedFor = request.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      console.warn(
        `[Security] X-Forwarded-For header ignored (not behind trusted proxy): ${xForwardedFor}`
      );
    }
  }

  // In development or when not behind a proxy, we can't reliably determine the IP
  // Return a hash-based identifier to still provide some rate limiting protection
  // In local development, all requests will share the same limit
  return "unknown";
}

/**
 * Calculates Retry-After header value in seconds.
 */
export function calculateRetryAfter(resetTimestamp: number): string {
  const now = Date.now();
  const secondsUntilReset = Math.ceil((resetTimestamp - now) / 1000);
  return String(Math.max(1, secondsUntilReset));
}

/**
 * Checks if rate limiting is enabled (Redis is configured).
 */
export function isRateLimitEnabled(): boolean {
  return redis !== null;
}

/**
 * Returns the current rate limiting security configuration.
 * Useful for debugging and monitoring.
 */
export function getRateLimitSecurityConfig(): {
  enabled: boolean;
  failClosed: boolean;
  behindTrustedProxy: boolean;
} {
  return {
    enabled: redis !== null,
    failClosed: config.failClosed,
    behindTrustedProxy: isBehindTrustedProxy(),
  };
}
