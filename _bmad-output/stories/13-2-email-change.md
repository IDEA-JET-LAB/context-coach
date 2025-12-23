# Story 13.2: Email Change

Status: ✅ COMPLETED (2025-12-23)
Priority: P2

## Story

**As a** user,
**I want** to change my email address,
**So that** I can update my account if my email changes.

## Acceptance Criteria

1. **Given** I am on the Settings page
   **When** I view my profile section
   **Then** I see my current email with an "Edit" button

2. **Given** I click edit on my email
   **When** the email change form appears
   **Then** I enter my new email address
   **And** I must enter my current password to confirm

3. **Given** I submit a valid new email
   **When** Supabase processes the request
   **Then** a confirmation email is sent to the new address
   **And** I see "Check your new email to confirm the change"

4. **Given** I click the confirmation link
   **When** the email is verified
   **Then** my email is updated in Supabase Auth
   **And** my `users.email` is synced (if stored separately)
   **And** I can log in with my new email

5. **Given** the new email is already in use
   **When** I try to submit
   **Then** I see "This email is already associated with another account"

6. **Given** I registered via Google OAuth only (no password set)
   **When** I try to change my email
   **Then** I see "Please set a password first" message
   **And** I am prompted to set a password before proceeding with email change

## Tasks / Subtasks

- [ ] **Task 1: Add email edit UI to settings**
  - [ ] Open `app/(dashboard)/settings/page.tsx`
  - [ ] Show current email with "Edit" button
  - [ ] Toggle between display and edit mode

- [ ] **Task 2: Create email change form component**
  - [ ] Create `components/settings/email-change-form.tsx`
  - [ ] Input for new email address
  - [ ] Input for current password (verification)
  - [ ] Submit and Cancel buttons
  - [ ] Loading state during submission

- [ ] **Task 3: Implement email change logic**
  - [ ] Use Supabase `auth.updateUser({ email: newEmail })`
  - [ ] Handle "email already in use" error
  - [ ] Show success message about confirmation email
  - [ ] Revert UI to display mode

- [ ] **Task 4: Handle email confirmation callback**
  - [ ] Verify existing callback route handles email change
  - [ ] Sync new email to `users.email` if stored
  - [ ] Update any cached user data

- [ ] **Task 5: Add validation**
  - [ ] Validate email format
  - [ ] Check password is not empty
  - [ ] Show inline validation errors

- [ ] **Task 6: Add E2E test**
  - [ ] Test email change flow
  - [ ] Test duplicate email error
  - [ ] Use Mailpit to verify confirmation email

## Dev Notes

### Supabase Email Change Flow

Supabase handles email changes securely:
1. User requests email change via `auth.updateUser()`
2. Confirmation email sent to NEW address
3. User clicks link in email
4. Supabase updates email after verification

```typescript
// Update user email (triggers confirmation email)
const { error } = await supabase.auth.updateUser({
  email: newEmail
});

if (error) {
  if (error.message.includes('already registered')) {
    // Email already in use
  }
}
```

### Email Change Form Component

```tsx
// components/settings/email-change-form.tsx
'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Props {
  currentEmail: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export function EmailChangeForm({ currentEmail, onCancel, onSuccess }: Props) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      // First verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      });

      if (signInError) {
        setError('Current password is incorrect');
        return;
      }

      // Request email change
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (updateError) {
        if (updateError.message.includes('already registered')) {
          setError('This email is already associated with another account');
        } else {
          setError(updateError.message);
        }
        return;
      }

      toast.success('Check your new email to confirm the change');
      onSuccess();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="newEmail">New Email Address</Label>
        <Input
          id="newEmail"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Enter new email"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Current Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Verify your identity"
          required
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Updating...' : 'Update Email'}
        </Button>
      </div>
    </form>
  );
}
```

### Settings Page Integration

```tsx
// In settings/page.tsx
const [isEditingEmail, setIsEditingEmail] = useState(false);

// In the profile section:
<div className="space-y-2">
  <Label>Email</Label>
  {isEditingEmail ? (
    <EmailChangeForm
      currentEmail={user.email}
      onCancel={() => setIsEditingEmail(false)}
      onSuccess={() => setIsEditingEmail(false)}
    />
  ) : (
    <div className="flex items-center gap-2">
      <span className="text-sm">{user.email}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditingEmail(true)}
      >
        Edit
      </Button>
    </div>
  )}
</div>
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `app/(dashboard)/settings/page.tsx` | Modify | Add email edit UI |
| `components/settings/email-change-form.tsx` | Create | Email change form |
| `e2e/email-change.spec.ts` | Create | E2E tests |

### Edge Cases

- **OAuth-only users:** Must set a password first before changing email. Check `user.app_metadata.provider` to detect OAuth-only users and show appropriate messaging.
- **Pending email change:** If user requests another email change while one is pending, the new request replaces the old one. Supabase invalidates the previous confirmation link automatically.
- **Email format validation:** Validate before submission

### Rate Limiting

Apply rate limiting to email change requests to prevent abuse:
- Use the same rate limiting approach as password reset (see Story 13-3)
- Recommended: 3 requests per hour per user
- Use `apiRateLimit` from `lib/rate-limit` if implementing via server action

### Email Sync Clarification

The `users.email` field mentioned in AC #4 refers to the Supabase Auth `auth.users` table. Our application `users` table does NOT store email directly - it references `auth.users.id`. Therefore:
- Email is stored only in `auth.users.email` (Supabase Auth)
- No additional sync is required to our `users` table
- The `users.email` mention in AC #4 is for clarity; implementation should verify auth table updates correctly

### Supabase Configuration

Ensure email change is enabled in Supabase Dashboard:
- Authentication → Email Templates → "Change Email Address"
- Verify redirect URL is correct

### References

- [Supabase Auth updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser)
- [Source: _bmad-output/epics.md#Story-13.2]

## Verification Checklist

- [ ] Current email displayed on settings page
- [ ] Edit button shows email change form
- [ ] Password verification required
- [ ] Success message shown after submission
- [ ] Confirmation email received (check Mailpit)
- [ ] Email updates after clicking confirmation link
- [ ] Duplicate email error handled
- [ ] E2E tests pass

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

*To be filled by dev agent - list all files created/modified*
