import { headers } from 'next/headers';
import type { RequestContext } from '@/lib/services/admin-users';

/**
 * Checks if the request is coming through a trusted reverse proxy.
 *
 * SECURITY: Only trust forwarded headers when running in a known
 * cloud environment with trusted load balancers.
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
 * Extract IP address and user agent from request headers.
 * For use in server actions to pass request context to audit logging.
 *
 * SECURITY: Only trusts X-Forwarded-For and similar headers when running
 * behind a known trusted reverse proxy (Cloud Run, Vercel, etc.).
 * This prevents IP spoofing in audit logs.
 *
 * H10 Fix: This helper enables populating IP address and user agent
 * in audit logs for forensic value.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') ?? undefined;

  // Only trust forwarded headers when behind a trusted proxy
  if (!isBehindTrustedProxy()) {
    return {
      ipAddress: undefined,
      userAgent,
    };
  }

  // Try multiple headers for IP address (in order of preference)
  // X-Forwarded-For is set by reverse proxies (Cloud Run, nginx, etc.)
  // X-Real-IP is another common header
  // CF-Connecting-IP is set by Cloudflare
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const cfConnectingIp = headersList.get('cf-connecting-ip');

  // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2...)
  // The first one is typically the original client IP
  let ipAddress: string | undefined;
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0];
    if (firstIp) {
      ipAddress = firstIp.trim();
    }
  } else if (realIp) {
    ipAddress = realIp;
  } else if (cfConnectingIp) {
    ipAddress = cfConnectingIp;
  }

  return {
    ipAddress,
    userAgent,
  };
}
