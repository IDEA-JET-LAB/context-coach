# Story 1.3: User Login with Email

Status: ready-for-dev

## Story

**As a** registered user,
**I want** to log in with my email and password,
**So that** I can access my dashboard and team data.

## Acceptance Criteria

1. **Given** I am on the login page (`/login`)
   **When** I enter valid credentials
   **Then** I am authenticated via Supabase Auth
   **And** a JWT session is created (24-hour expiry)
   **And** I am redirected to the dashboard (`/prompts`)

2. **Given** I enter incorrect credentials
   **When** I submit the login form
   **Then** I see an error "Invalid email or password"
   **And** no session is created

3. **Given** I am already logged in
   **When** I navigate to `/login`
   **Then** I am redirected to the dashboard

4. **Given** my session has expired
   **When** I try to access a protected route
   **Then** I am redirected to `/login`
   **And** I see a message "Your session has expired. Please log in again."

## Tasks / Subtasks

- [ ] **Task 1: Create Login Page UI** (AC: #1, #2)
  - [ ] Create `app/(auth)/login/page.tsx` with login form
  - [ ] Add email input field with inline validation (valid email format)
  - [ ] Add password input field with show/hide toggle
  - [ ] Add submit button with loading state
  - [ ] Add "Forgot password?" and "Sign up" navigation links
  - [ ] Style form using shadcn/ui components (Card, Input, Button, Label)

- [ ] **Task 2: Implement Login Form Submission** (AC: #1, #2)
  - [ ] Create client component for form handling
  - [ ] Handle authentication errors with user-friendly messages (see Error Code Mapping table)
  - [ ] Validate email format before submission

- [ ] **Task 3: Implement Redirect for Authenticated Users** (AC: #3)
  - [ ] Use server-side session check in `page.tsx` for immediate redirect
  - [ ] Prevent flash of login form for authenticated users

- [ ] **Task 4: Handle Session Expiry and Protected Routes** (AC: #4)
  - [ ] Add URL parameter for session expiry message (`?expired=true`)
  - [ ] Display "Session expired" message when redirected with parameter

- [ ] **Task 5: Session Configuration and JWT Settings** (AC: #1)
  - [ ] Verify Supabase Auth settings for 24-hour JWT expiry
  - [ ] Confirm session refresh logic in middleware
  - [ ] Ensure httpOnly cookies for refresh tokens (verify in DevTools Application > Cookies)
  - [ ] Test session persistence across browser refresh

- [ ] **Task 6: Error Handling and User Feedback** (AC: #2)
  - [ ] Handle network errors gracefully (see Network Error Handling pattern)
  - [ ] Handle rate limiting responses from Supabase

## Dev Notes

### Critical Architecture Constraints

**Authentication Pattern (MUST FOLLOW):**
- Use Supabase Auth with supabase-ssr (cookie-based sessions)
- JWT tokens with 24-hour expiry
- Refresh tokens stored as httpOnly cookies
- Session refresh handled in `middleware.ts`

**Supabase Client Usage:**
```typescript
// For client components (browser)
import { createBrowserClient } from '@supabase/ssr';

// For server components
import { createServerClient } from '@supabase/ssr';
```

### Login Implementation Pattern

```typescript
// app/(auth)/login/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { expired?: string; message?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect if already logged in
  if (user) {
    redirect('/prompts');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoginForm
        sessionExpired={searchParams.expired === 'true'}
        message={searchParams.message}
      />
    </div>
  );
}
```

### Login Form Component Pattern

```typescript
// app/(auth)/login/login-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';

interface LoginFormProps {
  sessionExpired?: boolean;
  message?: string;
}

// Email validation helper
const validateEmail = (email: string): string | null => {
  if (!email) {
    return 'Email is required';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export function LoginForm({ sessionExpired, message }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError) {
      setEmailError(null);
    }
  };

  const handleEmailBlur = () => {
    if (email) {
      const validationError = validateEmail(email);
      setEmailError(validationError);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email before submission
    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    setIsLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Map Supabase errors to user-friendly messages (see Error Code Mapping table)
        if (authError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password');
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Please verify your email before logging in');
        } else if (authError.code === 'over_request_rate_limit') {
          setError('Too many attempts. Please wait a moment.');
        } else {
          setError(authError.message);
        }
        return;
      }

      // Redirect to dashboard on success
      // router.refresh() forces server components to re-fetch data with new session
      router.push('/prompts');
      router.refresh();
    } catch (err) {
      // Network error detection
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Unable to connect. Please check your internet.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        {sessionExpired && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-amber-800 dark:text-amber-200 text-sm">
            Your session has expired. Please log in again.
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md text-blue-800 dark:text-blue-200 text-sm">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              required
              disabled={isLoading}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
            {emailError && (
              <p id="email-error" className="text-sm text-red-600 dark:text-red-400" role="alert">
                {emailError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          <a href="/reset-password" className="text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded">
            Forgot password?
          </a>
        </div>
        <div className="mt-2 text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <a href="/signup" className="text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded">
            Sign up
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Middleware Session Expiry Handling

Modify existing `middleware.ts` to add session expiry redirect logic:

**Add protected routes check after session refresh:**
```typescript
// Protected routes check
const protectedRoutes = ['/prompts', '/analytics', '/team', '/projects', '/settings', '/admin'];
const isProtectedRoute = protectedRoutes.some((route) =>
  request.nextUrl.pathname.startsWith(route)
);

if (isProtectedRoute && !user) {
  // Redirect to login with expired flag if session was invalid
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('expired', 'true');
  return NextResponse.redirect(url);
}
```

### Supabase Error Code Mapping

| Supabase Error | User Message |
|----------------|--------------|
| `invalid_grant` / `Invalid login credentials` | "Invalid email or password" |
| `email_not_confirmed` | "Please verify your email before logging in" |
| `over_request_rate_limit` | "Too many attempts. Please wait a moment." |
| Network error (TypeError with 'fetch') | "Unable to connect. Please check your internet." |
| Unknown | "An unexpected error occurred. Please try again." |

### Accessibility Requirements

- All form elements are focusable in logical tab order (email -> password -> show/hide -> submit)
- Error messages linked to inputs via `aria-describedby`
- `aria-invalid="true"` set when validation fails
- `role="alert"` on error messages for screen reader announcements
- Focus-visible styles on all interactive elements via Tailwind's `focus:ring-*` classes

### Dark Mode Integration

The shadcn/ui Card and form components support dark mode via Tailwind's dark variant classes. Key styling notes:
- `bg-background` uses the theme background (`#0a0a0a` in dark mode)
- Alert boxes use `dark:bg-*-950/30` and `dark:border-*-800` variants
- Text colors use `dark:text-*-200` or `dark:text-*-400` variants
- All colors defined in the existing Tailwind config from project setup

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `app/(auth)/login/page.tsx` | Modify | Server component with session check |
| `app/(auth)/login/login-form.tsx` | Create | Client component for login form |
| `middleware.ts` | Modify | Add session expiry redirect logic |
| `lib/supabase/client.ts` | Verify | Ensure browser client is configured |
| `lib/supabase/server.ts` | Verify | Ensure server client is configured |

### Component Dependencies (shadcn/ui)

Ensure these components are installed:
```bash
npx shadcn@latest add card input button label
```

**Note:** The `lucide-react` package (providing Eye/EyeOff icons for password toggle) is included as a dependency of shadcn/ui Button component.

### References

- [Source: _bmad-output/architecture.md#Authentication-Security]
- [Source: _bmad-output/architecture.md#Frontend-Architecture]
- [Source: _bmad-output/architecture.md#Implementation-Patterns-Consistency-Rules]
- [Source: _bmad-output/epics.md#Story-1.3-User-Login-with-Email]
- [Source: _bmad-output/ux-design-specification.md#Visual-Design]

### Common Pitfalls to Avoid

1. **DO NOT** store passwords or tokens in localStorage - use cookies only
2. **DO NOT** expose detailed error messages from Supabase to users
3. **DO NOT** skip the server-side session check in the page component
4. **DO NOT** forget to call `router.refresh()` after successful login
5. **DO NOT** use `signIn()` instead of `signInWithPassword()` for email/password

### Verification Checklist

After completing this story, verify:
- [ ] Login page renders at `/login`
- [ ] Form shows validation errors for invalid email format
- [ ] Submitting valid credentials logs user in
- [ ] After login, user is redirected to `/prompts`
- [ ] Invalid credentials show "Invalid email or password" error
- [ ] Email not confirmed shows appropriate message
- [ ] Network errors show connection message
- [ ] Already logged-in users are redirected away from `/login`
- [ ] Expired session redirects to `/login?expired=true`
- [ ] Session expiry message is displayed when `expired=true`
- [ ] Loading state shows during authentication
- [ ] "Forgot password?" link works
- [ ] "Sign up" link works
- [ ] Form is accessible via keyboard navigation (Tab through all elements)
- [ ] Screen readers announce error messages
- [ ] Session persists after browser refresh
- [ ] Logout from another tab is handled gracefully
- [ ] Dark mode styling works correctly

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

*To be filled by dev agent - list all files created/modified*

### File List

*To be filled by dev agent - list all files created/modified*
