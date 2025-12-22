import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getOriginFromRequest } from "@/lib/utils/get-origin";

const isDev = process.env.NODE_ENV === "development";

// Validate invite token format (UUID)
function isValidUUID(token: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;

  // Get the correct origin, handling reverse proxy scenarios (Cloud Run)
  // This prevents redirecting to internal container addresses like 0.0.0.0:3000
  const normalizedOrigin = getOriginFromRequest(request);

  // Handle OAuth and email verification via code exchange
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/home";
  const inviteToken = searchParams.get("invite_token");

  // Handle OAuth error (user cancelled)
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  if (error) {
    // Only log details in development to avoid leaking info in production logs
    if (isDev) {
      console.error("[AUTH] OAuth error:", error, error_description);
    }
    // Use error codes instead of raw messages - the login page will translate to user-friendly messages
    const errorCode = error === "access_denied" ? "oauth-cancelled" : "oauth-failed";
    return NextResponse.redirect(
      `${normalizedOrigin}/login?error=${errorCode}`
    );
  }

  // Handle code exchange (OAuth and email confirmation)
  if (code) {
    // Create a response that we can attach cookies to
    let response = NextResponse.next({ request });

    // Create supabase client that can write cookies to the response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      // Only log details in development to avoid leaking info in production logs
      if (isDev) {
        console.error("[AUTH] Code exchange error:", exchangeError.message, exchangeError.code);
      }

      // Handle recovery type - redirect to password update page
      if (type === "recovery") {
        return NextResponse.redirect(
          `${normalizedOrigin}/reset-password?error=expired`
        );
      }

      return NextResponse.redirect(
        `${normalizedOrigin}/login?error=authentication-failed`
      );
    }

    // Check if this is a password recovery session by looking at AMR claims
    // Password recovery sessions have "recovery" in the authentication method reference
    const amr = (data.session?.user as { amr?: Array<{ method: string }> })?.amr;
    const isRecovery = type === "recovery" ||
      amr?.some((method) => method.method === "recovery");

    // Create redirect response with cookies from the code exchange
    let redirectUrl: string;
    if (isRecovery) {
      redirectUrl = `${normalizedOrigin}/reset-password/update`;
    } else if (inviteToken) {
      // Validate invite token format before using
      if (!isValidUUID(inviteToken)) {
        // Invalid token format - redirect to home without exposing details
        redirectUrl = `${normalizedOrigin}${next}`;
      } else {
        // Handle invitation token - try to accept the invitation
        try {
          const acceptResponse = await supabase.rpc('accept_team_invitation', {
            p_token: inviteToken,
            p_user_id: data.user?.id,
          });

          if (acceptResponse.data) {
            // Set team claim and redirect to dashboard
            await supabase.rpc('set_team_claim', { team_id: acceptResponse.data.id });
            if (isDev) {
              console.log("[AUTH] Successfully accepted invitation for team:", acceptResponse.data.name);
            }
            redirectUrl = `${normalizedOrigin}/prompts`;
          } else if (acceptResponse.error) {
            if (isDev) {
              console.error("[AUTH] Failed to accept invitation:", acceptResponse.error.message);
            }
            // Redirect to invitation page to show error
            redirectUrl = `${normalizedOrigin}/invite/${inviteToken}`;
          } else {
            redirectUrl = `${normalizedOrigin}${next}`;
          }
        } catch (err) {
          if (isDev) {
            console.error("[AUTH] Error accepting invitation:", err);
          }
          redirectUrl = `${normalizedOrigin}/invite/${inviteToken}`;
        }
      }
    } else {
      redirectUrl = `${normalizedOrigin}${next}`;
    }

    // Create redirect response and copy cookies to it
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => {
      // Preserve the original cookie options - don't force httpOnly
      // The Supabase browser client needs to read these via JavaScript
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    });

    return redirectResponse;
  }

  // Handle OTP verification (email magic links)
  const token_hash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && otpType) {
    // Create a response for OTP verification that can handle cookies
    let otpResponse = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              otpResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error: otpError } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash,
    });

    if (!otpError) {
      const redirectResponse = NextResponse.redirect(`${normalizedOrigin}${next}`);
      otpResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, {
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      });
      return redirectResponse;
    } else {
      // Only log details in development to avoid leaking info in production logs
      if (isDev) {
        console.error("[AUTH] OTP verification error:", otpError.message);
      }
      // Use generic error code - don't reveal whether token was expired vs invalid
      // This prevents attackers from learning about token timing
      return NextResponse.redirect(
        `${normalizedOrigin}/error?error=verification-failed`
      );
    }
  }

  // No valid auth parameters
  return NextResponse.redirect(
    `${normalizedOrigin}/error?error=invalid-request`
  );
}
