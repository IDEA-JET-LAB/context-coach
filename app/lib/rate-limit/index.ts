import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Creates a Redis client for rate limiting.
 * Returns null if environment variables are not configured.
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    console.warn(
      "[Rate Limit] UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN not configured. Rate limiting disabled."
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
 * Returns { success: true } if rate limiting is disabled or limit not exceeded.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!limiter) {
    // Rate limiting disabled - allow request
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
 * Extracts client IP from request headers.
 * Falls back to 'unknown' if IP cannot be determined.
 */
export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs; take the first one
    const firstIp = xForwardedFor.split(",")[0];
    if (firstIp) {
      return firstIp.trim();
    }
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp.trim();
  }

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
