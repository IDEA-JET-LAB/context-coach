# Story 1.4: OAuth Registration/Login with Gmail

Status: ready-for-dev

## Story

**As a** user,
**I want** to register or log in using my Google account,
**So that** I can access Contextor without creating a separate password.

## Acceptance Criteria

1. **Given** I am on the login or signup page
   **When** I click "Continue with Google"
   **Then** I am redirected to Google's OAuth consent screen
   **And** after approval, I am redirected back to `/auth/callback`

2. **Given** I complete Google OAuth for the first time
   **When** the callback processes
   **Then** a new account is created in Supabase Auth with my Google email
   **And** a corresponding `users` row is created with name from Google profile
   **And** I am redirected to the dashboard

3. **Given** I have an existing account with my Google email
   **When** I complete Google OAuth
   **Then** I am logged into my existing account
   **And** no duplicate account is created

4. **Given** I deny the Google OAuth consent
   **When** the callback processes
   **Then** I am redirected to `/login` with message "Google sign-in was cancelled"

## Tasks / Subtasks

- [ ] **Task 1: Configure Google OAuth in Supabase Dashboard** (AC: #1, #2)
  - [ ] Create Google Cloud Project (or use existing)
  - [ ] Enable Google+ API in Google Cloud Console
  - [ ] Create OAuth 2.0 Client ID (Web application type)
  - [ ] Add authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
  - [ ] Copy Client ID and Client Secret
  - [ ] Configure Google provider in Supabase Auth dashboard
  - [ ] Enable Google provider in Supabase project settings

- [ ] **Task 2: Add "Continue with Google" button to login page** (AC: #1)
  - [ ] Create `components/auth/google-auth-button.tsx` component
  - [ ] Style button according to Google branding guidelines
  - [ ] Add button to `app/(auth)/login/page.tsx`
  - [ ] Add button to `app/(auth)/signup/page.tsx`
  - [ ] Implement `signInWithOAuth` call to Supabase Auth

- [ ] **Task 3: Implement OAuth sign-in handler** (AC: #1, #2, #3)
  - [ ] Create client-side OAuth initiation function in `lib/auth/oauth.ts`
  - [ ] Configure OAuth options (provider: 'google', redirectTo)
  - [ ] Handle OAuth redirect with proper scopes (email, profile)
  - [ ] Ensure redirect URL matches callback route

- [ ] **Task 4: Enhance OAuth callback handler** (AC: #2, #3, #4)
  - [ ] Update `app/(auth)/callback/route.ts` to handle OAuth callbacks
  - [ ] Exchange auth code for session using `exchangeCodeForSession`
  - [ ] Handle error scenarios (denied consent, invalid code)
  - [ ] Redirect to `/login` with error message on failure
  - [ ] Redirect to dashboard on success

- [ ] **Task 5: Handle user profile creation for OAuth users** (AC: #2)
  - [ ] Verify `handle_new_user` trigger exists from Story 1.1 (run verification query below)
  - [ ] If trigger missing, create it using the SQL in Dev Notes section
  - [ ] Ensure `name` is populated from Google profile (`full_name` or `name`)
  - [ ] Ensure `avatar_url` is populated from Google profile picture
  - [ ] Test that existing email accounts link properly

- [ ] **Task 6: Handle error states and user feedback** (AC: #4)
  - [ ] Create error handling for OAuth cancellation
  - [ ] Display user-friendly error messages on login page
  - [ ] Handle edge cases (popup blocked, network errors)
  - [ ] Add loading state during OAuth redirect

- [ ] **Task 7: Add local development OAuth configuration** (AC: #1)
  - [ ] Configure localhost redirect URI in Google Cloud Console
  - [ ] Update `.env.local` with Google OAuth test credentials
  - [ ] Document local testing setup in `.env.example`

## Dev Notes

### Critical Architecture Constraints

**Technology Stack (From Architecture Document):**
- Supabase Auth with supabase-ssr (cookie-based sessions)
- Next.js 15 App Router
- OAuth provider: Google (gmail)
- JWT tokens with 24-hour expiry

**Authentication Flow (From Architecture):**
```
Browser → Supabase Auth → Google OAuth → Callback → Session Created → Dashboard
```

### Google Cloud Console Setup

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create OAuth 2.0 Client ID (Web application type)
3. Add authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
4. For local dev, add: `http://localhost:54321/auth/v1/callback`
5. Copy Client ID and Secret to Supabase Dashboard > Auth > Providers > Google

### OAuth Implementation Code

**Google Auth Button Component:**
```tsx
// components/auth/google-auth-button.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function GoogleAuthButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // IMPORTANT: Use window.location.origin, never hardcode URLs
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',  // Enables refresh tokens
          prompt: 'consent',       // Forces consent screen (ensures refresh token on re-auth)
        },
      },
    });

    if (error) {
      setIsLoading(false);
      console.error('[AUTH] Google OAuth error:', error.message);
    }
    // No need to setIsLoading(false) on success - user is redirected
  };

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
      {isLoading ? 'Redirecting...' : 'Continue with Google'}
    </Button>
  );
}
```

**OAuth Callback Handler:**
```typescript
// app/(auth)/callback/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Note: This endpoint inherits Supabase's built-in rate limiting.
// No additional rate limiting needed as it only processes legitimate OAuth redirects.

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');
  const origin = requestUrl.origin;

  // Handle OAuth cancellation or errors - users may click "Deny"
  if (error) {
    console.error('[AUTH] OAuth error:', error, error_description);
    const message = error === 'access_denied'
      ? 'Google sign-in was cancelled'
      : 'Authentication failed';
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[AUTH] Code exchange error:', exchangeError.message);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Authentication failed')}`
      );
    }
  }

  // Successful authentication - redirect to dashboard
  return NextResponse.redirect(`${origin}/prompts`);
}
```

**Login Page with Google Button and Toast Notifications:**
```tsx
// app/(auth)/login/page.tsx
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { AuthErrorToast } from '@/components/auth/auth-error-toast';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="...">
      {/* Toast notification for immediate error feedback */}
      <AuthErrorToast error={params.error} />

      {/* Inline error display as fallback */}
      {params.error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
          {params.error}
        </div>
      )}

      {/* Email/password form */}

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <GoogleAuthButton />
    </div>
  );
}
```

**Auth Error Toast Component:**
```tsx
// components/auth/auth-error-toast.tsx
'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function AuthErrorToast({ error }: { error?: string }) {
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return null;
}
```

### User Profile Auto-Creation

The database trigger created in Story 1.1 handles profile creation for OAuth users. Before implementing OAuth, verify the trigger exists:

```sql
-- Verify trigger exists (run this first)
SELECT EXISTS (
  SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user'
) as trigger_exists;

-- Also verify the trigger is attached to auth.users
SELECT tgname, tgrelid::regclass, tgtype
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

If the trigger is missing, create it:

```sql
-- Create the trigger function (from Story 1.1)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

For Google OAuth, Supabase populates `raw_user_meta_data` with:
- `full_name`: User's full name from Google
- `email`: User's email address
- `avatar_url`: URL to Google profile picture
- `email_verified`: Boolean indicating verification status

### Environment Variables

```bash
# .env.local (for local development testing)
# Note: OAuth primarily configured in Supabase Dashboard
# These are for reference only

# Supabase (already from Story 1.1)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

```bash
# .env.example (documentation)
# OAuth Configuration
# Google OAuth is configured in Supabase Dashboard > Authentication > Providers
# 1. Create Google Cloud Project
# 2. Enable Google+ API
# 3. Create OAuth 2.0 Client ID
# 4. Add redirect URI: https://<project>.supabase.co/auth/v1/callback
# 5. Enter Client ID and Secret in Supabase Dashboard
```

### File Structure After This Story

```
contextor/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          # Updated with Google button
│   │   ├── signup/
│   │   │   └── page.tsx          # Updated with Google button
│   │   └── callback/
│   │       └── route.ts          # Enhanced OAuth callback handler
│   └── ...
│
├── components/
│   ├── auth/
│   │   ├── google-auth-button.tsx  # NEW: Google OAuth button with loading state
│   │   └── auth-error-toast.tsx    # NEW: Toast notification for auth errors
│   └── ui/
│       └── ...
│
├── lib/
│   ├── auth/
│   │   └── oauth.ts              # NEW: OAuth helper functions (optional)
│   └── supabase/
│       ├── client.ts
│       └── server.ts
│
└── ...
```

### Naming Conventions (From Architecture)

| Context | Convention | Example |
|---------|------------|---------|
| Component files | kebab-case.tsx | `google-auth-button.tsx` |
| React components | PascalCase | `GoogleAuthButton` |
| TypeScript functions | camelCase | `handleGoogleSignIn` |
| Route handlers | route.ts | `callback/route.ts` |

## References

- [Source: _bmad-output/architecture.md#Authentication-Security]
- [Source: _bmad-output/architecture.md#Core-Architectural-Decisions]
- [Source: _bmad-output/epics.md#Story-1.4-OAuth-Registration-Login-with-Gmail]
- [Supabase OAuth Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth Setup Guide](https://developers.google.com/identity/protocols/oauth2)

### Google Branding Guidelines

When implementing the Google sign-in button:
- Use official Google colors and icon
- Text should be "Continue with Google" or "Sign in with Google"
- Button must be clearly visible and not hidden
- See: https://developers.google.com/identity/branding-guidelines

## Verification Checklist

After completing this story, verify:

### Core Functionality
- [ ] Google OAuth credentials are configured in Google Cloud Console
- [ ] Google provider is enabled in Supabase Dashboard
- [ ] "Continue with Google" button appears on `/login` page
- [ ] "Continue with Google" button appears on `/signup` page
- [ ] Clicking button redirects to Google consent screen
- [ ] Approving consent creates new user account
- [ ] New OAuth users have `name` populated from Google profile
- [ ] New OAuth users have `avatar_url` populated from Google profile
- [ ] Existing email users can link Google account
- [ ] Denying consent redirects to `/login` with error message

### UX & Error Handling
- [ ] Loading state displays while redirecting to Google
- [ ] Toast notification appears for authentication errors
- [ ] No console errors during OAuth flow
- [ ] Session is properly created after OAuth success

### Local Development
- [ ] Google Cloud Console has `http://localhost:54321/auth/v1/callback` redirect URI
- [ ] Supabase local (`supabase start`) is running
- [ ] Local OAuth flow completes without errors
- [ ] User appears in local `users` table after OAuth
- [ ] Session cookie is set correctly

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### File List

*To be filled by dev agent - list all files created/modified*
