/**
 * Next.js Middleware - Session Management and Auth Redirects
 *
 * This file serves as the Next.js middleware (using the `proxy` function name
 * for consistency with Supabase documentation). It handles:
 *
 * 1. Supabase session refresh on every request
 * 2. Protected route authentication checks
 * 3. Admin route authorization
 * 4. Auth page redirects for logged-in users
 * 5. OAuth callback parameter routing
 *
 * The actual session logic is in lib/supabase/proxy.ts (updateSession function).
 *
 * @see lib/supabase/proxy.ts for session management implementation
 */

import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // If there's a code parameter at root, redirect to callback for processing
  // This handles Supabase auth redirects (password recovery, OAuth, etc.)
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/callback";
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
