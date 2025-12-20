# Story 1.5: Password Reset Flow

Status: ready-for-dev

## Story

**As a** user who forgot my password,
**I want** to reset my password via email,
**So that** I can regain access to my account.

## Acceptance Criteria

1. **Given** I am on the login page
   **When** I click "Forgot password?"
   **Then** I am taken to the password reset request page (`/reset-password`)

2. **Given** I enter my registered email on the reset page
   **When** I submit the form
   **Then** a password reset email is sent via Supabase Auth
   **And** I see "Check your email for a reset link"

3. **Given** I enter an email that doesn't exist
   **When** I submit the form
   **Then** I see the same success message (to prevent email enumeration)
   **And** no email is sent

4. **Given** I click the reset link in my email
   **When** the link is valid and not expired
   **Then** I am taken to the new password form
   **And** I can enter a new password (min 8 chars)
   **And** upon submission, my password is updated
   **And** I am redirected to login with "Password updated successfully"

5. **Given** I click an expired or invalid reset link
   **When** the page loads
   **Then** I see "This reset link has expired. Please request a new one."
   **And** a "Request new link" button redirects me to the reset request page

## Tasks / Subtasks

- [ ] **Task 1: Create password reset request page** (AC: #1, #2, #3)
  - [ ] Create `app/(auth)/reset-password/page.tsx`
  - [ ] Implement email input form with validation
  - [ ] Add "Forgot password?" link to login page (`app/(auth)/login/page.tsx`)
  - [ ] Call `supabase.auth.resetPasswordForEmail()` on form submit
  - [ ] Display success message regardless of email existence (security)
  - [ ] Style form consistent with login/signup pages
  - [ ] Ensure responsive layout (full-width inputs/button on mobile)

- [ ] **Task 2: Configure Supabase email template** (AC: #2)
  - [ ] Navigate to Supabase Dashboard > Authentication > Email Templates
  - [ ] Customize "Reset Password" email template
  - [ ] Set reset link redirect URL to `/auth/callback?type=recovery`
  - [ ] Include Contextor branding in email template
  - [ ] Test email delivery using Inbucket (local) or Supabase logs (production)

- [ ] **Task 3: Handle password reset callback** (AC: #4, #5)
  - [ ] Update `app/(auth)/callback/route.ts` to handle `type=recovery`
  - [ ] Parse recovery token from URL
  - [ ] Redirect to new password form on valid token
  - [ ] Redirect to reset request page with error on invalid/expired token

- [ ] **Task 4: Create new password form page** (AC: #4)
  - [ ] Create `app/(auth)/reset-password/update/page.tsx`
  - [ ] Implement new password input with confirmation field
  - [ ] Add password validation (min 8 characters)
  - [ ] Call `supabase.auth.updateUser({ password })` on submit
  - [ ] Redirect to login with success toast on completion

- [ ] **Task 5: Error handling and UX polish** (AC: #5, all)
  - [ ] Create error message component for expired/invalid links
  - [ ] Add "Request new link" button on error page
  - [ ] Handle session errors gracefully
  - [ ] Log errors for debugging (not exposed to user)
  - [ ] Add loading states during form submission (spinner + "Sending...")
  - [ ] Disable submit button while processing
  - [ ] Add inline validation for email format
  - [ ] Add inline validation for password requirements
  - [ ] Ensure keyboard navigation works correctly
  - [ ] Add ARIA accessibility attributes (see Accessibility section)

## Dev Notes

### Critical Architecture Constraints

**Technology Stack (MUST USE):**
- Supabase Auth for all password reset functionality
- Next.js 15 App Router (NO Pages Router)
- shadcn/ui components for form elements
- Server Actions or API routes for form handling

**Auth Flow:**
```
Login Page → "Forgot password?" → Reset Request Page
                                        ↓
                              Supabase sends email
                                        ↓
                              User clicks email link
                                        ↓
                              /auth/callback?type=recovery
                                        ↓
                              Update Password Page
                                        ↓
                              Password updated → Login
```

### Local Email Testing

Supabase local development includes Inbucket for email capture:
- **Inbucket URL:** `http://localhost:54324`
- **Access:** Run `supabase start` to launch local services including Inbucket
- **View emails:** Check Inbucket inbox for test emails during development
- **Production:** Use Supabase Dashboard > Logs > Auth logs to verify email delivery

### Supabase Auth Methods

```typescript
// Request password reset (sends email)
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
});

// Update password (after clicking email link)
const { error } = await supabase.auth.updateUser({
  password: newPassword,
});
```

### Email Template Configuration

Navigate to Supabase Dashboard > Authentication > Email Templates > Reset Password.

See [Supabase Email Templates documentation](https://supabase.com/docs/guides/auth/auth-email-templates) for customization options. The template below is a starting point:

```html
<h2>Reset your Contextor password</h2>

<p>Hi,</p>

<p>Click the link below to reset your password. This link will expire in 24 hours.</p>

<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>

<p>If you didn't request a password reset, you can safely ignore this email.</p>

<p>Thanks,<br/>The Contextor Team</p>
```

**Important Settings:**
- Set **Site URL** in Authentication > URL Configuration
- Set **Redirect URLs** to include `/auth/callback`

### File Structure After This Story

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx              # Add "Forgot password?" link
│   ├── reset-password/
│   │   ├── page.tsx              # Password reset request form
│   │   └── update/
│   │       └── page.tsx          # New password form
│   └── callback/
│       └── route.ts              # Handle recovery token
│
components/
├── auth/
│   ├── reset-password-form.tsx   # Email input form
│   ├── update-password-form.tsx  # New password form
│   └── password-input.tsx        # Password field with visibility toggle
```

### Form Validation Approach

Use shadcn/ui Form component with react-hook-form and Zod schema validation:
- `react-hook-form` for form state management
- `@hookform/resolvers/zod` for Zod integration
- `zod` for schema validation

This pattern is consistent with shadcn/ui form patterns and provides type-safe validation.

### Component Specifications

**ResetPasswordForm (`components/auth/reset-password-form.tsx`):**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  onSuccess?: () => void;
}

// Uses:
// - Form, FormField, FormItem, FormLabel, FormMessage from shadcn/ui
// - Input from shadcn/ui for email
// - Button from shadcn/ui for submit with loading state
// - react-hook-form with zodResolver for validation
```

**UpdatePasswordForm (`components/auth/update-password-form.tsx`):**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

interface UpdatePasswordFormProps {
  onSuccess?: () => void;
}

// Uses:
// - Form, FormField, FormItem, FormLabel, FormMessage from shadcn/ui
// - PasswordInput component with visibility toggle
// - react-hook-form with zodResolver for validation
// - Button from shadcn/ui for submit with loading state
```

### Loading States

Use shadcn/ui patterns for consistent loading UX:

```tsx
import { Loader2 } from 'lucide-react';

// Submit button loading state
<Button disabled={isPending} type="submit">
  {isPending ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Sending...
    </>
  ) : (
    'Send Reset Link'
  )}
</Button>
```

### Responsive Design

- Forms stack vertically on mobile (<768px)
- Input fields: full width on mobile
- Submit button: full width on mobile
- Maintain consistent padding with login/signup pages
- Auth pages don't use bottom nav (they're outside dashboard layout)

### Accessibility Requirements

Required ARIA attributes for WCAG AA compliance:
- `aria-label` on form: "Password reset form" or "Update password form"
- `aria-describedby` linking inputs to error messages
- `aria-invalid="true"` on inputs with validation errors
- `aria-live="polite"` on success/error message containers
- Form inputs must have associated `<label>` elements

### Expired Link Recovery Flow

When user lands on `/reset-password?error=expired`:
1. Show error message prominently with clear styling
2. Display "Request new link" button below the error message
3. Button click navigates to reset request form (clears error params)
4. If email is available from previous session, optionally pre-populate the field

### Error Messages

| Scenario | User Message |
|----------|--------------|
| Email submitted (any) | "Check your email for a reset link" |
| Invalid/expired link | "This reset link has expired. Please request a new one." |
| Password too short | "Password must be at least 8 characters" |
| Passwords don't match | "Passwords do not match" |
| Update failed | "Unable to update password. Please try again." |

### Security Considerations

**Email Enumeration Prevention:**
- Always show same success message regardless of email existence
- Never reveal if an email is registered or not

**Token Security:**
- Recovery tokens are single-use (Supabase handles this)
- Tokens expire after 24 hours (configurable in Supabase)
- Never store recovery tokens in localStorage or sessionStorage

**Password Requirements:**
- Minimum 8 characters (enforced client and server side)
- No maximum length restriction

### Password Strength Indicator (Optional Post-MVP)

If implementing password strength feedback:
- Use `zxcvbn` library (lightweight, no dependencies)
- Display as color-coded bar below password input
- Levels: Weak (red), Fair (orange), Good (yellow), Strong (green)
- Show brief text feedback: "Add numbers or symbols"

Note: This is post-MVP. Minimum 8 char validation is sufficient for MVP.

### Callback Route Handler

```typescript
// app/(auth)/callback/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Handle recovery type - redirect to password update page
      if (type === 'recovery') {
        return NextResponse.redirect(
          new URL('/reset-password/update', request.url)
        );
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Handle error - redirect to reset page with error
  if (type === 'recovery') {
    return NextResponse.redirect(
      new URL('/reset-password?error=expired', request.url)
    );
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url));
}
```

### References

- [Source: _bmad-output/architecture.md#Authentication-Security]
- [Source: _bmad-output/architecture.md#Project-Structure-Boundaries]
- [Source: _bmad-output/epics.md#Story-1.5-Password-Reset-Flow]
- [Supabase Docs: Password Reset](https://supabase.com/docs/guides/auth/passwords#resetting-a-password)
- [Supabase Docs: Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)

### Common Pitfalls

**Security Pitfalls:**
- Never reveal if email exists (enumeration attack)
- No client-side token storage (Supabase handles securely)
- Always validate server-side (don't rely on client validation alone)

**Implementation Pitfalls:**
- Don't forget to handle the callback route for recovery type
- Don't expose detailed error messages to users (log them instead)
- Don't skip loading states during async operations

### Verification Checklist

After completing this story, verify:
- [ ] "Forgot password?" link appears on login page
- [ ] Reset password request page loads at `/reset-password`
- [ ] Form accepts email and shows success message
- [ ] Email is received with valid reset link (check Inbucket locally)
- [ ] Clicking reset link redirects to password update page
- [ ] New password form validates minimum 8 characters
- [ ] Password confirmation field matches validation works
- [ ] Successful password update redirects to login
- [ ] Success message displays on login page
- [ ] Expired link shows appropriate error message
- [ ] "Request new link" button works from error state
- [ ] Form is accessible via keyboard navigation
- [ ] Loading states display during form submission
- [ ] Forms are responsive on mobile devices
- [ ] Screen reader announces form labels and errors correctly

## Dev Agent Record

### Agent Model Used

<!-- Dev agent fills this after implementation -->

### Completion Notes List

*To be filled by dev agent after implementation*

### File List

*To be filled by dev agent - list all files created/modified*
