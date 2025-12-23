import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import { createHash } from "crypto";

// Admin cookie security: Sign the value to prevent tampering
// The signature includes a server-side secret, user ID, admin status, and timestamp
const ADMIN_COOKIE_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32) || "default-dev-secret-change-me";

function signAdminCookie(userId: string, isAdmin: boolean, timestamp: number): string {
  const payload = `${userId}:${isAdmin}:${timestamp}`;
  const signature = createHash("sha256")
    .update(`${payload}:${ADMIN_COOKIE_SECRET}`)
    .digest("hex")
    .slice(0, 16);
  return `${payload}:${signature}`;
}

function verifyAdminCookie(cookieValue: string, userId: string): { isAdmin: boolean; valid: boolean } {
  try {
    const parts = cookieValue.split(":");
    if (parts.length !== 4) return { isAdmin: false, valid: false };

    const cookieUserId = parts[0];
    const adminStr = parts[1];
    const timestampStr = parts[2];
    const signature = parts[3];

    if (!cookieUserId || !adminStr || !timestampStr || !signature) {
      return { isAdmin: false, valid: false };
    }

    const timestamp = parseInt(timestampStr, 10);
    const isAdmin = adminStr === "true";

    // Verify user ID matches (prevents cookie theft between users)
    if (cookieUserId !== userId) return { isAdmin: false, valid: false };

    // Verify timestamp is within valid window (5 minutes)
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes in ms
    if (now - timestamp > maxAge) return { isAdmin: false, valid: false };

    // Verify signature
    const expectedPayload = `${cookieUserId}:${adminStr}:${timestampStr}`;
    const expectedSignature = createHash("sha256")
      .update(`${expectedPayload}:${ADMIN_COOKIE_SECRET}`)
      .digest("hex")
      .slice(0, 16);

    if (signature !== expectedSignature) return { isAdmin: false, valid: false };

    return { isAdmin, valid: true };
  } catch {
    return { isAdmin: false, valid: false };
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session - CRITICAL for security
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error("[AUTH] session-refresh-error:", error.message);
  }

  // Protected routes that require authentication
  const protectedRoutes = ["/prompts", "/analytics", "/team", "/projects", "/settings", "/admin"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isProtectedRoute && !user) {
    console.log("[AUTH] session-expired: redirect=/login");
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("expired", "true");
    return NextResponse.redirect(url);
  }

  // Admin route protection with signed cookie verification
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  if (isAdminRoute && user) {
    const userId = user.id;

    // Check cached admin status with cryptographic verification
    const cachedAdminStatus = request.cookies.get("ctx_admin_status")?.value;
    const verifyResult = cachedAdminStatus
      ? verifyAdminCookie(cachedAdminStatus, userId)
      : { isAdmin: false, valid: false };

    let isAdmin = verifyResult.valid ? verifyResult.isAdmin : false;

    // If cache is missing, expired, tampered, or invalid, query the database
    if (!verifyResult.valid) {
      // Query database for admin status (using service role would be better but needs env var)
      // For now, use the regular client - RLS allows users to read their own profile
      const { data: profile } = await supabase
        .from("users")
        .select("is_super_admin")
        .eq("id", userId)
        .single();

      isAdmin = profile?.is_super_admin ?? false;

      // M46 Security Enhancement: Use signed cookie with timestamp and user binding
      // - Cryptographic signature prevents tampering
      // - Timestamp prevents replay attacks
      // - User ID binding prevents cookie theft between users
      // - 5-minute expiry (H13 fix) limits exposure window
      const signedValue = signAdminCookie(userId, isAdmin, Date.now());
      supabaseResponse.cookies.set("ctx_admin_status", signedValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // Stricter than "lax" for admin cookies
        maxAge: 60 * 5, // 5 minutes (H13 security fix)
        path: "/admin", // Scope cookie to admin routes only
      });
    }

    if (!isAdmin) {
      console.log("[AUTH] non-admin accessing /admin: redirect=/prompts");
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/prompts";
      redirectUrl.searchParams.set("error", "access-denied");
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Redirect authenticated users away from auth pages
  const authRoutes = ["/login", "/signup"];
  const isAuthRoute = authRoutes.some(
    (route) => request.nextUrl.pathname === route
  );

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/prompts";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
