import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

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
  const { data, error } = await supabase.auth.getClaims();
  const user = data?.claims;

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

  // Admin route protection
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  if (isAdminRoute && user) {
    // Check cached admin status first
    const cachedAdminStatus = request.cookies.get("ctx_admin_status")?.value;
    let isAdmin = cachedAdminStatus === "true";

    if (cachedAdminStatus === undefined) {
      // Query database for admin status (using service role would be better but needs env var)
      // For now, use the regular client - RLS allows users to read their own profile
      const userId = user.sub as string;
      const { data: profile } = await supabase
        .from("users")
        .select("is_super_admin")
        .eq("id", userId)
        .single();

      isAdmin = profile?.is_super_admin ?? false;

      // Cache the result in the response
      supabaseResponse.cookies.set("ctx_admin_status", String(isAdmin), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
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
