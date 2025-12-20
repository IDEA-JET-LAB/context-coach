const isProduction = process.env.NODE_ENV === "production";

const baseHeaders: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
  ].join("; "),
};

const productionHeaders: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export function getSecurityHeaders(): Record<string, string> {
  if (isProduction) {
    return { ...baseHeaders, ...productionHeaders };
  }
  return baseHeaders;
}

export const securityHeaders = { ...baseHeaders, ...productionHeaders };
