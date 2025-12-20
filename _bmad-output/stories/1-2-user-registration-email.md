# Story 1.2: User Registration with Email

Status: ready-for-dev

## Story

**As a** new user,
**I want** to register for Contextor using my email and password,
**So that** I can create an account and access the platform.

## Prerequisites (Verify Before Starting)

- [ ] Story 1.1 completed: Project initialized with `npx create-next-app@latest contextor -e with-supabase`
- [ ] `lib/supabase/client.ts` exists and exports `createClient()`
- [ ] `lib/supabase/server.ts` exists and exports server-side client
- [ ] Database trigger `on_auth_user_created` exists (creates `users` row)
- [ ] Basic RLS policies in place on `users` table

## Acceptance Criteria

1. **Given** I am on the registration page (`/signup`)
   **When** I enter a valid email and password (min 8 chars)
   **Then** a new account is created in Supabase Auth
   **And** a corresponding row is created in the `users` table
   **And** I receive a confirmation email
   **And** I am redirected to the email verification pending page

2. **Given** I enter an email that may already exist
   **When** I submit the registration form
   **Then** I see a generic message "If this email is available, we've sent a confirmation email"
   **And** Supabase handles the security (sends email to existing accounts to prevent enumeration)

3. **Given** I enter an invalid email format
   **When** I submit the form
   **Then** I see inline validation "Please enter a valid email address"

4. **Given** I enter a password shorter than 8 characters
   **When** I submit the form
   **Then** I see inline validation "Password must be at least 8 characters"

## Tasks / Subtasks

- [ ] **Task 1: Create signup page UI** (AC: #1, #3, #4)
  - [ ] Verify Story 1.1 prerequisite files exist before proceeding
  - [ ] Create `app/(auth)/signup/page.tsx` with registration form
  - [ ] Add email input field with proper HTML validation attributes
  - [ ] Add password input field with visibility toggle
  - [ ] Add confirm password field (optional, for UX)
  - [ ] Style form using shadcn/ui components (Input, Button, Label, Form)
  - [ ] Add "Already have an account? Sign in" link to `/login`

- [ ] **Task 2: Implement client-side validation with react-hook-form** (AC: #3, #4)
  - [ ] Install react-hook-form and @hookform/resolvers if not present
  - [ ] Create form validation schema using Zod
  - [ ] Integrate Zod schema with react-hook-form using zodResolver
  - [ ] Validate email format with regex pattern
  - [ ] Validate password minimum length (8 characters)
  - [ ] Display inline validation errors below each field
  - [ ] Disable submit button until form is valid

- [ ] **Task 3: Implement Supabase Auth signup** (AC: #1, #2)
  - [ ] Import Supabase browser client from `lib/supabase/client.ts`
  - [ ] Call `supabase.auth.signUp()` with email and password
  - [ ] Handle successful signup response
  - [ ] Handle error responses (weak password, rate limiting)
  - [ ] Add loading state during API call

- [ ] **Task 4: Create email verification pending page** (AC: #1)
  - [ ] Create `app/(auth)/verify-email/page.tsx`
  - [ ] Display message: "Check your email to verify your account"
  - [ ] Show the email address that was used
  - [ ] Add "Resend verification email" button with resend logic
  - [ ] Add "Back to login" link

- [ ] **Task 5: Handle signup responses securely** (AC: #2)
  - [ ] Supabase by default sends "confirm" email to existing accounts (prevents enumeration)
  - [ ] Display generic message for all signup attempts: "If this email is available, we've sent a confirmation email"
  - [ ] Redirect to verify-email page regardless of whether account existed
  - [ ] Do not differentiate between new and existing accounts in UI

- [ ] **Task 6: Configure Supabase email templates** (DASHBOARD - not code) (AC: #1)
  - [ ] [Dashboard] Customize confirmation email template in Supabase Dashboard
  - [ ] [Dashboard] Set redirect URL for email confirmation (see Supabase Dashboard Configuration below)
  - [ ] [Code] Verify `app/(auth)/callback/route.ts` handles email confirmation

- [ ] **Task 7: Verify user profile creation** (AC: #1)
  - [ ] Confirm trigger `on_auth_user_created` creates `users` row
  - [ ] Test that `name` field is populated from metadata if provided
  - [ ] Verify RLS policies allow new user to read their profile

## Dev Notes

### Implementation Constraints

- Use `supabase.auth.signUp()` (not custom auth)
- Cookie-based sessions via supabase-ssr
- Database trigger handles `users` table creation
- Client-side Supabase calls (not Server Actions)
- Next.js 15 with App Router, TypeScript in strict mode
- Tailwind CSS + shadcn/ui for styling

### Required Dependencies

Ensure these are installed before starting:

```bash
# Form handling
npm install react-hook-form @hookform/resolvers

# shadcn/ui components (if not from Story 1.1)
npx shadcn@latest add button input label card form alert
```

### Environment Variables Required

Verify these are set from Story 1.1:

```
NEXT_PUBLIC_SUPABASE_URL=<from Story 1.1>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Story 1.1>
```

### Supabase Dashboard Configuration

1. Go to Authentication > URL Configuration
2. Add Site URL: `http://localhost:3000` (dev) / `https://app.contextor.co` (prod)
3. Add Redirect URLs: `http://localhost:3000/auth/callback`, `https://app.contextor.co/auth/callback`
4. Customize email templates in Authentication > Email Templates

### Visual Layout Reference

- Form centered on page (max-w-md)
- Card wrapper with padding
- Logo/brand at top (optional for MVP)
- Email field, password field, submit button vertically stacked
- "Already have an account?" link below form

### Accessibility Requirements (WCAG AA)

- All form fields must have associated `<label>` elements
- Error messages must be announced (aria-live="polite")
- Form must be navigable via keyboard (Tab order logical)
- Color contrast must meet WCAG AA (4.5:1 for text)
- Use shadcn/ui Form component which handles accessibility

### Form Validation Schema

```typescript
// lib/validations/auth.ts
import { z } from 'zod';

export const signupSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});

export type SignupInput = z.infer<typeof signupSchema>;
```

### Supabase Auth Signup Implementation

```typescript
// Example signup handler in signup/page.tsx
'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '@/lib/validations/auth';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '' },
  });

  const { isPending } = form.formState;

  async function handleSignup(data: SignupInput) {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      // Only show generic errors - don't reveal account existence
      if (error.message.includes('rate limit')) {
        form.setError('root', { message: 'Too many attempts. Please try again later.' });
      } else {
        form.setError('root', { message: 'An error occurred. Please try again.' });
      }
      return;
    }

    // Always redirect to verification page (prevents enumeration)
    router.push('/verify-email?email=' + encodeURIComponent(data.email));
  }
}
```

### Loading and Error UI Patterns

```tsx
// Loading button state
<Button disabled={isPending}>
  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
  {isPending ? 'Creating account...' : 'Create account'}
</Button>

// Error display (above form or inline)
{form.formState.errors.root && (
  <Alert variant="destructive">
    <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
  </Alert>
)}
```

### Resend Verification Email

```typescript
// In verify-email/page.tsx
async function handleResendVerification(email: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
  });

  if (!error) {
    toast({ title: 'Verification email sent' });
  } else {
    toast({ title: 'Failed to resend', description: 'Please try again later.', variant: 'destructive' });
  }
}
```

### Auth Callback Route Modifications

The callback route from Story 1.1 may only handle OAuth. Ensure it handles email verification:

```typescript
// app/(auth)/callback/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // This handles BOTH OAuth and email verification

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
```

### Supabase Error Codes Reference

| Error Code | Meaning | User Message |
|------------|---------|--------------|
| `weak_password` | Password doesn't meet requirements | "Password must be at least 8 characters" |
| `invalid_email` | Email format invalid | "Please enter a valid email address" |
| `signup_disabled` | Signups disabled in project | "Registration is currently unavailable" |
| `over_request_rate_limit` | Rate limit exceeded | "Too many attempts. Please try again later." |

### Component File Locations

| Component | Path |
|-----------|------|
| Signup Page | `app/(auth)/signup/page.tsx` |
| Verify Email Page | `app/(auth)/verify-email/page.tsx` |
| Auth Callback | `app/(auth)/callback/route.ts` |
| Validation Schema | `lib/validations/auth.ts` |
| Supabase Client | `lib/supabase/client.ts` |

### Project Structure After This Story

```
contextor/
├── app/
│   ├── (auth)/
│   │   ├── signup/
│   │   │   └── page.tsx           # NEW: Registration form
│   │   ├── verify-email/
│   │   │   └── page.tsx           # NEW: Email verification pending
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── callback/
│   │       └── route.ts           # UPDATED: Handle email confirmation
│   └── (dashboard)/
│       └── ...
│
├── lib/
│   ├── validations/
│   │   └── auth.ts                # NEW: Zod validation schemas
│   └── supabase/
│       ├── client.ts
│       └── server.ts
│
└── components/
    └── ui/
        ├── button.tsx
        ├── input.tsx
        ├── label.tsx
        ├── card.tsx
        ├── form.tsx
        └── alert.tsx
```

### Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Page files | page.tsx | `signup/page.tsx` |
| Route handlers | route.ts | `callback/route.ts` |
| Validation schemas | camelCase | `signupSchema` |
| Component files | kebab-case.tsx | `signup-form.tsx` |
| Utility functions | camelCase | `validateEmail()` |

### Security Considerations

1. **Email Enumeration Prevention**: Supabase by default sends an email to existing accounts during signup. This prevents attackers from determining if an email is registered. The UI should always show the same generic message regardless of whether the account existed.

2. **Rate Limiting**: Supabase has built-in rate limiting for auth endpoints. No additional implementation needed for MVP.

3. **Password Requirements**: Minimum 8 characters enforced both client-side (Zod) and server-side (Supabase Auth settings).

4. **HTTPS Only**: All auth requests must be over HTTPS in production.

### Common Pitfalls to Avoid

1. **DO NOT** create custom auth tables - use Supabase Auth + `users` extension
2. **DO NOT** store passwords - Supabase Auth handles this securely
3. **DO NOT** skip email verification - required for account security
4. **DO NOT** expose detailed error messages - use generic user-friendly messages
5. **DO NOT** forget to handle loading states - prevents double submissions
6. **DO NOT** use server actions for auth - use client-side Supabase calls with supabase-ssr
7. **DO NOT** reveal whether an email is already registered - prevents enumeration attacks

### Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Happy path | Enter valid email/password, submit | Redirect to verify-email page |
| Invalid email | Enter "notanemail", submit | Inline error: "Please enter a valid email address" |
| Short password | Enter 7-char password, submit | Inline error: "Password must be at least 8 characters" |
| Duplicate email | Use existing email, submit | Generic message shown, redirect to verify-email |
| Network error | Disconnect, submit | Error toast, form stays populated |
| Rate limited | Submit many times quickly | "Too many attempts" error |
| Resend verification | Click resend button | Toast: "Verification email sent" |

### Verification Checklist

After completing this story, verify:
- [ ] `/signup` page renders without errors
- [ ] Form shows validation errors for invalid email format
- [ ] Form shows validation errors for short passwords
- [ ] Successful signup sends confirmation email
- [ ] User is redirected to verify-email page after signup
- [ ] `users` table row is created via trigger
- [ ] Signup with existing email shows same generic message (no enumeration)
- [ ] Email confirmation link works and redirects to app
- [ ] Cannot access protected routes until email is verified
- [ ] "Resend verification email" button works
- [ ] Loading state shows during form submission
- [ ] Form is keyboard navigable and accessible

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
