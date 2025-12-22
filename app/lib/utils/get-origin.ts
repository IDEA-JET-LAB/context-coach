/**
 * Get the correct origin URL for the current request.
 *
 * This handles the case where the app runs behind a reverse proxy (like Cloud Run)
 * where request.url returns the container's internal address (e.g., 0.0.0.0:3000)
 * instead of the actual domain.
 */
export function getOriginFromRequest(request: Request): string {
  // 1. First, check for explicit app URL in environment
  //    This is the most reliable for production deployments
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 2. Check for forwarded headers (behind reverse proxy like Cloud Run)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 3. Check the Host header
  const host = request.headers.get('host');
  if (host && !host.includes('0.0.0.0') && !host.includes('127.0.0.1:')) {
    const proto = host.includes('localhost') ? 'http' : 'https';
    return `${proto}://${host}`;
  }

  // 4. Fall back to request.url origin (works in local development)
  const url = new URL(request.url);
  let origin = url.origin;

  // Normalize localhost to 127.0.0.1 for cookie consistency
  if (origin.includes('localhost')) {
    origin = origin.replace('localhost', '127.0.0.1');
  }

  return origin;
}
