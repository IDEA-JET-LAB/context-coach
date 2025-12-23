# Story 13.3: Password Change (In-App)

Status: ✅ COMPLETED (2025-12-23)
Priority: P2

## Story

**As a** user,
**I want** to change my password from settings,
**So that** I don't have to go through the reset flow to update my password.

## Acceptance Criteria

1. **Given** I am on the Settings page
   **When** I view the Security section
   **Then** I see a "Change Password" option

2. **Given** I click "Change Password"
   **When** the password change form appears
   **Then** I enter my current password
   **And** I enter my new password (twice for confirmation)

3. **Given** I submit with correct current password
   **When** the new password meets requirements (12+ chars, mixed case, number)
   **Then** my password is updated
   **And** I see "Password updated successfully"
   **And** I remain logged in

4. **Given** I enter incorrect current password
   **When** I submit the form
   **Then** I see "Current password is incorrect"
   **And** the password is not changed

5. **Given** my new password doesn't meet requirements
   **When** I submit the form
   **Then** I see specific validation errors
   **And** the password is not changed

6. **Given** I registered via Google OAuth only
   **When** I view the Security section
   **Then** I see "Set Password" instead of "Change Password"
   **And** I can set an initial password to enable email login

## Tasks / Subtasks

- [ ] **Task 1: Add Security section to Settings page**
  - [ ] Open `app/(dashboard)/settings/page.tsx`
  - [ ] Add "Security" section below profile
  - [ ] Add password change/set option

- [ ] **Task 2: Create password change form component**
  - [ ] Create `components/settings/password-change-form.tsx`
  - [ ] Current password input (if not OAuth-only)
  - [ ] New password input
  - [ ] Confirm new password input
  - [ ] Real-time password strength indicator
  - [ ] Submit button

- [ ] **Task 3: Extract password validation to dedicated file**
  - [ ] Create `lib/validations/password.ts` with reusable password schema
  - [ ] Extract password rules from `lib/validations/auth.ts`
  - [ ] Re-export from auth.ts for backward compatibility
  - [ ] Add `validatePassword()` helper for UI checklist
  - [ ] Show requirements checklist in form

- [ ] **Task 4: Implement password change logic**
  - [ ] Verify current password (re-authenticate)
  - [ ] Use `supabase.auth.updateUser({ password })`
  - [ ] Handle errors appropriately
  - [ ] Show success toast

- [ ] **Task 5: Handle OAuth-only users**
  - [ ] Detect if user has password (check provider)
  - [ ] Show "Set Password" UI instead
  - [ ] Skip current password verification
  - [ ] Allow setting initial password

- [ ] **Task 6: Add E2E tests**
  - [ ] Test password change flow
  - [ ] Test validation errors
  - [ ] Test wrong current password
  - [ ] Test OAuth user setting password

## Dev Notes

### Password Validation (Extract to Dedicated File)

Currently, password validation rules exist in `lib/validations/auth.ts` but are duplicated in `signupSchema` and `resetPasswordSchema`. Extract to a dedicated file for reuse:

```typescript
// lib/validations/password.ts (NEW FILE)
import { z } from 'zod';

// Zod schema for password (use in forms)
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Requirements config for UI display
export const passwordRequirements = {
  minLength: 12,
  requireLowercase: true,
  requireUppercase: true,
  requireNumber: true,
};

// Helper for real-time UI validation checklist
export function validatePassword(password: string): {
  valid: boolean;
  checks: {
    minLength: boolean;
    hasLowercase: boolean;
    hasUppercase: boolean;
    hasNumber: boolean;
  };
} {
  const checks = {
    minLength: password.length >= 12,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  return {
    valid: Object.values(checks).every(Boolean),
    checks,
  };
}
```

Then update `lib/validations/auth.ts` to import and use `passwordSchema`:

```typescript
// lib/validations/auth.ts
import { passwordSchema } from './password';

export const signupSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ... same pattern for resetPasswordSchema
```

### Password Change Form Component

```tsx
// components/settings/password-change-form.tsx
'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { validatePassword } from '@/lib/validations/password'; // NEW FILE
import { Check, X } from 'lucide-react';

interface Props {
  userEmail: string;
  hasPassword: boolean; // false for OAuth-only users
  onSuccess: () => void;
}

export function PasswordChangeForm({ userEmail, hasPassword, onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient();
  const validation = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validation.valid) {
      setError('Please fix password requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setIsPending(true);

    try {
      // Verify current password if user has one
      if (hasPassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: currentPassword,
        });

        if (signInError) {
          setError('Current password is incorrect');
          return;
        }
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      toast.success('Password updated successfully');
      onSuccess();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasPassword && (
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="newPassword">
          {hasPassword ? 'New Password' : 'Set Password'}
        </Label>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />

        {/* Password requirements checklist - uses validatePassword().checks */}
        <div className="text-xs space-y-1 mt-2">
          <RequirementItem met={validation.checks.minLength} text="At least 12 characters" />
          <RequirementItem met={validation.checks.hasLowercase} text="One lowercase letter" />
          <RequirementItem met={validation.checks.hasUppercase} text="One uppercase letter" />
          <RequirementItem met={validation.checks.hasNumber} text="One number" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {confirmPassword && !passwordsMatch && (
          <p className="text-xs text-destructive">Passwords do not match</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button
        type="submit"
        disabled={isPending || !validation.valid || !passwordsMatch}
      >
        {isPending ? 'Updating...' : hasPassword ? 'Change Password' : 'Set Password'}
      </Button>
    </form>
  );
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1 ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{text}</span>
    </div>
  );
}
```

### Detecting OAuth-Only Users

The most reliable method is checking `user.identities` for an email provider identity:

```typescript
// Check if user has password-based login
const { data: { user } } = await supabase.auth.getUser();

// RECOMMENDED: Check identities array (most reliable)
// Users with email/password auth have an identity with provider === 'email'
const hasPassword = user?.identities?.some(
  (identity) => identity.provider === 'email'
) ?? false;

// Alternative: Check app_metadata.providers (less reliable, may not be set)
// const hasPassword = user?.app_metadata?.providers?.includes('email') ?? false;
```

**Why `identities` is more reliable:**
- `identities` array is always populated by Supabase Auth
- Each auth method (email, google, github, etc.) creates a separate identity
- `app_metadata.providers` may not always be set depending on auth flow

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `app/(dashboard)/settings/page.tsx` | Modify | Add Security section |
| `components/settings/password-change-form.tsx` | Create | Password form |
| `lib/validations/password.ts` | Modify/Create | Password validation |
| `e2e/password-change.spec.ts` | Create | E2E tests |

### Settings Page Security Section

```tsx
// In settings/page.tsx
<Card>
  <CardHeader>
    <CardTitle>Security</CardTitle>
    <CardDescription>Manage your password and security settings</CardDescription>
  </CardHeader>
  <CardContent>
    {showPasswordForm ? (
      <PasswordChangeForm
        userEmail={user.email}
        hasPassword={hasPassword}
        onSuccess={() => setShowPasswordForm(false)}
      />
    ) : (
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Password</p>
          <p className="text-sm text-muted-foreground">
            {hasPassword ? 'Last changed: Unknown' : 'No password set (using OAuth)'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowPasswordForm(true)}>
          {hasPassword ? 'Change Password' : 'Set Password'}
        </Button>
      </div>
    )}
  </CardContent>
</Card>
```

### References

- [Supabase Auth updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser)
- [Source: _bmad-output/epics.md#Story-13.3]
- [Source: CLAUDE.md#Password-Requirements]

## Verification Checklist

- [ ] Security section visible on settings page
- [ ] "Change Password" shown for email users
- [ ] "Set Password" shown for OAuth-only users
- [ ] Password requirements displayed
- [ ] Real-time validation feedback
- [ ] Current password verified (for email users)
- [ ] Success message shown
- [ ] User remains logged in after change
- [ ] E2E tests pass

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

*To be filled by dev agent - list all files created/modified*
