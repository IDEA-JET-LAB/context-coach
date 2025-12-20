import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;

  // Normalize origin to use 127.0.0.1 for local development (cookie consistency)
  // This ensures cookies set on 127.0.0.1 are accessible after redirects
  let normalizedOrigin = origin;
  if (origin.includes('localhost')) {
    normalizedOrigin = origin.replace('localhost', '127.0.0.1');
  }

  // Handle OAuth and email verification via code exchange
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  // Handle OAuth error (user cancelled)
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  if (error) {
    console.error("[AUTH] OAuth error:", error, error_description);
    const message = error === "access_denied"
      ? "Sign-in was cancelled"
      : "Authentication failed";
    return NextResponse.redirect(
      `${normalizedOrigin}/login?error=${encodeURIComponent(message)}`
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
      console.error("[AUTH] Code exchange error:", exchangeError.message, exchangeError.code);

      // Handle recovery type - redirect to password update page
      if (type === "recovery") {
        return NextResponse.redirect(
          `${normalizedOrigin}/reset-password?error=expired`
        );
      }

      return NextResponse.redirect(
        `${normalizedOrigin}/login?error=${encodeURIComponent("Authentication failed")}`
      );
    }

    // Check if this is a password recovery session by looking at AMR claims
    // Password recovery sessions have "recovery" in the authentication method reference
    const isRecovery = type === "recovery" ||
      data.session?.user?.amr?.some((method) => method.method === "recovery");

    // Create redirect response with cookies from the code exchange
    let redirectUrl: string;
    if (isRecovery) {
      redirectUrl = `${normalizedOrigin}/reset-password/update`;
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
      console.error("[AUTH] OTP verification error:", otpError.message);
      return NextResponse.redirect(
        `${normalizedOrigin}/error?error=${encodeURIComponent(otpError.message)}`
      );
    }
  }

  // No valid auth parameters
  return NextResponse.redirect(
    `${normalizedOrigin}/error?error=${encodeURIComponent("Invalid authentication request")}`
  );
}
