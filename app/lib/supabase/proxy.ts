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
