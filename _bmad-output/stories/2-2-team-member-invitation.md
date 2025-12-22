# Story 2.2: Team Member Invitation

Status: ✅ Done

## Story

**As a** team admin,
**I want** to invite new members to my team via email,
**So that** my colleagues can access our shared projects.

## Acceptance Criteria

1. **Given** I am a team admin on the team settings page
   **When** I enter an email address and click "Invite"
   **Then** an invitation email is sent to that address
   **And** a pending invitation record is created
   **And** I see the pending invitation in the members list

2. **Given** the invitee clicks the invitation link
   **When** they are already a Contextor user
   **Then** they are added to the team as a `member`
   **And** they see the team in their team switcher

3. **Given** the invitee clicks the invitation link
   **When** they are NOT a Contextor user
   **Then** they are directed to register
   **And** after registration, they are added to the team

4. **Given** I try to invite an email already in the team
   **When** I submit the form
   **Then** I see "This user is already a team member"

5. **Given** an invitation is pending
   **When** the admin clicks "Revoke"
   **Then** the invitation is cancelled
   **And** the link no longer works

## Tasks / Subtasks

- [ ] **Task 1: Create team invitations database schema** (AC: #1, #4, #5)
  - [ ] Create SQL migration file `supabase/migrations/YYYYMMDDHHMMSS_create_team_invitations.sql`
  - [ ] Create `team_invitations` table with columns:
    - `id` (UUID, primary key, default gen_random_uuid())
    - `team_id` (UUID, references teams(id) ON DELETE CASCADE)
    - `email` (VARCHAR(255), NOT NULL, stored lowercase via trigger)
    - `invited_by` (UUID, references auth.users(id))
    - `status` (VARCHAR(20), default 'pending' - values: 'pending', 'accepted', 'revoked')
    - `token` (VARCHAR(255), unique, NOT NULL)
    - `created_at` (TIMESTAMPTZ, default now())
    - `expires_at` (TIMESTAMPTZ, default now() + interval '7 days')
    - `accepted_at` (TIMESTAMPTZ, nullable)
  - [ ] Add unique constraint on (team_id, LOWER(email)) where status != 'revoked'
  - [ ] Create trigger to normalize email to lowercase on INSERT/UPDATE
  - [ ] Create indexes: team_invitations(token), team_invitations(team_id), team_invitations(LOWER(email))
  - [ ] Enable RLS on `team_invitations` table

- [ ] **Task 2: Implement RLS policies for team_invitations** (AC: #1, #4, #5)
  - [ ] Policy: Team admins can SELECT invitations for their team
  - [ ] Policy: Team admins can INSERT new invitations
  - [ ] Policy: Team admins can UPDATE invitations (revoke)
  - [ ] Policy: Allow SELECT by invitation token (must match exact token, status='pending', not expired)

- [ ] **Task 3: Create invitation creation function** (AC: #1, #4)
  - [ ] Create function `invite_team_member(team_id UUID, email VARCHAR, inviter_id UUID)`
  - [ ] Validate that inviter is team admin
  - [ ] Normalize email to lowercase for comparison
  - [ ] Check if LOWER(email) already exists in team (status != 'revoked') - throw error if true
  - [ ] Check if user with this email is already a team member - throw error if true
  - [ ] Generate unique token using `encode(gen_random_bytes(32), 'hex')`
  - [ ] Create new team_invitations record
  - [ ] Return invitation object with token
  - [ ] Use SECURITY DEFINER

- [ ] **Task 4: Create invitation revocation function** (AC: #5)
  - [ ] Create function `revoke_team_invitation(invitation_id UUID)`
  - [ ] Validate inviter is team admin
  - [ ] Update status to 'revoked'
  - [ ] Return updated invitation object

- [ ] **Task 5: Create API endpoint for team invitations** (AC: #1, #4, #5)
  - [ ] Create `app/api/teams/[teamId]/invitations/route.ts`
  - [ ] POST handler to create invitation
    - Validate team_id matches authenticated user's team
    - Call `invite_team_member` function
    - Trigger email sending via email service
    - Return `{ data: { invitation } }` on success
    - Return `{ error: { code: 'EMAIL_ALREADY_MEMBER', message: '...' } }` if email exists
  - [ ] GET handler to list invitations for team (admin only)
    - Query team_invitations where team_id = params.teamId and status = 'pending'
    - Return `{ data: { invitations: [...] } }`
  - [ ] PATCH handler to revoke invitation
    - Call `revoke_team_invitation` function
    - Return `{ data: { invitation } }`
  - [ ] Wrap all handlers in try/catch, log errors as `[API] teams/invitations: error`

- [ ] **Task 6: Create email service for invitations** (AC: #1)
  - [ ] Create `lib/services/email.ts` with invitation email template
  - [ ] Function `sendInvitationEmail(email: string, inviteLink: string, teamName: string, inviterName: string)`
  - [ ] Use Resend (per architecture) with `RESEND_API_KEY`
  - [ ] Template includes: personalized greeting, team name, inviter name, "Join Team" CTA button, 7-day expiration note
  - [ ] Add error handling with retry logic (max 3 attempts, exponential backoff)
  - [ ] Log email send attempts and failures

- [ ] **Task 7: Create invitation public route handler** (AC: #2, #3)
  - [ ] Create `app/(public)/invite/[token]/page.tsx`
  - [ ] Route is PUBLIC (no auth required initially)
  - [ ] On page load:
    - Query team_invitations by token using service role client
    - Validate status = 'pending' and expires_at > now()
    - If invalid: show error "This invitation link is invalid"
    - If expired: show error "This invitation has expired. Please request a new one."
    - If revoked: show error "This invitation was revoked by the team admin"
    - If valid: proceed to authentication check
  - [ ] If user is NOT authenticated:
    - Show signup form pre-filled with invitation email (readonly)
    - Store token in URL query param through signup flow
    - On signup completion, accept invitation and redirect to team dashboard
  - [ ] If user IS authenticated:
    - If LOWER(user.email) matches LOWER(invitation.email): auto-accept and redirect to team dashboard
    - If email DOES NOT match: show warning "You're signed in as {email}. This invitation was sent to {invitation.email}. Sign out to use a different account."
  - [ ] Add loading state while validating token
  - [ ] Add keyboard navigation support (Tab order, Enter to submit)

- [ ] **Task 8: Create invitation acceptance function** (AC: #2, #3)
  - [ ] Create function `accept_team_invitation(token VARCHAR, user_id UUID)`
  - [ ] Validate token exists, status = 'pending', and not expired
  - [ ] Verify LOWER(user.email) matches LOWER(invitation.email) for security
  - [ ] Check user not already in team
  - [ ] Create team_members row with role = 'member'
  - [ ] Update team_invitations status = 'accepted', accepted_at = now()
  - [ ] Return team object for redirect
  - [ ] Use SECURITY DEFINER

- [ ] **Task 9: Create invitation acceptance API endpoint** (AC: #2, #3)
  - [ ] Create `app/api/invitations/[token]/accept/route.ts`
  - [ ] POST handler to accept invitation
    - Get current user ID from session
    - Call `accept_team_invitation(token, userId)`
    - Return `{ data: { team } }` on success
    - Handle errors: 'ALREADY_MEMBER', 'INVALID_TOKEN', 'EXPIRED_TOKEN', 'EMAIL_MISMATCH'
  - [ ] Wrap in try/catch, log errors as `[API] invitations/accept: error`

- [ ] **Task 10: Create team settings invitation UI** (AC: #1, #4, #5)
  - [ ] Create `components/team-settings/invite-member-form.tsx`
    - Email input field with HTML5 email validation
    - Submit button with `isPending` state (disabled during submission)
    - Loading spinner during submission
    - Success toast on successful invite
    - Error toast on failure with specific message
    - Keyboard accessible (Enter to submit)
    - ARIA labels for screen readers
  - [ ] Create `components/team-settings/pending-invitations-list.tsx`
    - Table showing pending invitations (email, invited by, date, expires)
    - Revoke button per invitation with `isPending` state
    - Confirmation dialog before revoke (shadcn AlertDialog)
    - Loading skeleton while fetching invitations
    - Empty state: "No pending invitations"
    - Refresh list after revocation via React Query invalidation
  - [ ] Update `app/(dashboard)/teams/[teamId]/settings/page.tsx` to include both components
  - [ ] Use shadcn/ui components: Input, Button, Table, AlertDialog, Toast
  - [ ] Use TanStack Query hooks with `isPending` (not `isLoading`)
  - [ ] Add aria-live region for dynamic updates

- [ ] **Task 11: Handle invitation acceptance on signup** (AC: #3)
  - [ ] After signup completion in `app/auth/callback/route.ts`:
    - Check for `invite_token` query parameter
    - If present: call `accept_team_invitation(token, new_user_id)`
    - Add team_id to JWT claims
    - Redirect to team dashboard
  - [ ] Update signup form to preserve `invite_token` from URL through OAuth flow

- [ ] **Task 12: Create invitation link utilities** (AC: #1)
  - [ ] Create `lib/utils/invitation.ts` with:
    - `generateInviteUrl(token: string): string` - Format: `{NEXT_PUBLIC_APP_URL}/invite/{token}`
  - [ ] Create copy-to-clipboard component with success feedback

- [ ] **Task 13: Create integration tests** (AC: #1, #2, #3, #4, #5)
  - [ ] Test: Admin can invite user by email
  - [ ] Test: Duplicate email shows error
  - [ ] Test: Existing user accepts invitation and joins team
  - [ ] Test: New user registers via invitation link and joins team
  - [ ] Test: Admin can revoke pending invitation
  - [ ] Test: Revoked invitation link returns error
  - [ ] Test: Expired invitation link returns error
  - [ ] Test: Invited email is pre-filled in signup form
  - [ ] Test: Case-insensitive email matching works correctly
  - [ ] Test: Non-admin cannot invite members
  - [ ] Test: Email mismatch shows appropriate warning

## Dev Notes

### Technology Stack
- Next.js 15 with App Router
- TypeScript in strict mode
- Supabase with mandatory RLS
- TanStack Query 5.x (`isPending` not `isLoading`)
- Resend for email delivery
- shadcn/ui components (Input, Button, Table, AlertDialog, Toast)

### Multi-Tenancy
- Every invitation MUST be scoped to team_id
- RLS policies enforce team-level access control
- Public invitation route does NOT require auth initially

### Email Flow
1. Admin invites -> Invitation record created -> Email sent
2. Invitee clicks link -> Route validates token -> Auto-accept if authenticated and email matches
3. New user -> Route redirects to signup with token -> Auto-accept after registration

### Security Requirements
- Invitation tokens: 256-bit cryptographically secure (gen_random_bytes(32))
- Tokens URL-safe (hex encoded)
- Expired invitations rejected (check expires_at > now())
- Revoked invitations rejected (check status != 'revoked')
- Email comparison MUST be case-insensitive (use LOWER())
- Never expose tokens in logs or error messages

### Database Schema

```sql
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ
);

-- Normalize email to lowercase
CREATE OR REPLACE FUNCTION normalize_invitation_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := LOWER(NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invitation_email_normalize
  BEFORE INSERT OR UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION normalize_invitation_email();

-- Unique constraint (case-insensitive)
CREATE UNIQUE INDEX idx_team_invitations_unique_email
  ON team_invitations(team_id, LOWER(email))
  WHERE status != 'revoked';

CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(LOWER(email));

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Team admins can view invitations" ON team_invitations
FOR SELECT USING (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Team admins can create invitations" ON team_invitations
FOR INSERT WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Team admins can revoke invitations" ON team_invitations
FOR UPDATE USING (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Token lookup policy (public access for invitation redemption)
CREATE POLICY "Token lookup for redemption" ON team_invitations
FOR SELECT USING (
  token = current_setting('app.current_token', true)
  AND status = 'pending'
  AND expires_at > now()
);
```

### SQL Functions

```sql
CREATE OR REPLACE FUNCTION invite_team_member(
  p_team_id UUID,
  p_email VARCHAR,
  p_inviter_id UUID
)
RETURNS team_invitations AS $$
DECLARE
  v_invitation team_invitations;
  v_normalized_email VARCHAR;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));

  -- Validate inviter is admin
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = p_inviter_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Only team admins can invite members';
  END IF;

  -- Check if email already invited (not revoked)
  IF EXISTS (
    SELECT 1 FROM team_invitations
    WHERE team_id = p_team_id AND LOWER(email) = v_normalized_email AND status != 'revoked'
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_INVITED: This email has a pending invitation';
  END IF;

  -- Check if user already a team member
  IF EXISTS (
    SELECT 1 FROM team_members tm
    JOIN auth.users u ON tm.user_id = u.id
    WHERE tm.team_id = p_team_id AND LOWER(u.email) = v_normalized_email
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_MEMBER: This user is already a team member';
  END IF;

  INSERT INTO team_invitations (team_id, email, invited_by, token, expires_at)
  VALUES (p_team_id, v_normalized_email, p_inviter_id, encode(gen_random_bytes(32), 'hex'), now() + interval '7 days')
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION accept_team_invitation(p_token VARCHAR, p_user_id UUID)
RETURNS teams AS $$
DECLARE
  v_invitation team_invitations;
  v_user_email VARCHAR;
  v_team teams;
BEGIN
  SELECT * INTO v_invitation FROM team_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TOKEN: Invalid or expired invitation';
  END IF;

  SELECT LOWER(email) INTO v_user_email FROM auth.users WHERE id = p_user_id;

  IF v_user_email != LOWER(v_invitation.email) THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH: Invitation email does not match your account';
  END IF;

  IF EXISTS (
    SELECT 1 FROM team_members WHERE team_id = v_invitation.team_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER: You are already a member of this team';
  END IF;

  INSERT INTO team_members (team_id, user_id, role) VALUES (v_invitation.team_id, p_user_id, 'member');

  UPDATE team_invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invitation.id;

  SELECT * INTO v_team FROM teams WHERE id = v_invitation.team_id;
  RETURN v_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Component Patterns

```typescript
// TanStack Query hook example
function useInviteMember(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => inviteTeamMember(teamId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', teamId] });
      toast.success('Invitation sent successfully');
    },
    onError: (error: ApiError) => {
      toast.error(error.message);
    }
  });
}

// Component with accessibility
function InviteMemberForm({ teamId }: { teamId: string }) {
  const { mutate, isPending } = useInviteMember(teamId);

  return (
    <form onSubmit={handleSubmit} aria-label="Invite team member">
      <Input
        type="email"
        placeholder="colleague@company.com"
        aria-label="Email address"
        disabled={isPending}
        required
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : 'Invite'}
      </Button>
    </form>
  );
}
```

### File Locations

| Component | Path |
|-----------|------|
| Invite Form | `components/team-settings/invite-member-form.tsx` |
| Pending List | `components/team-settings/pending-invitations-list.tsx` |
| Invitation Page | `app/(public)/invite/[token]/page.tsx` |
| Team Invitations API | `app/api/teams/[teamId]/invitations/route.ts` |
| Accept Invitation API | `app/api/invitations/[token]/accept/route.ts` |
| Invitation Utils | `lib/utils/invitation.ts` |
| Email Service | `lib/services/email.ts` |

### API Response Patterns

```typescript
// Success
{ data: { invitation: {...} } }

// Errors
{ error: { code: 'EMAIL_ALREADY_MEMBER', message: 'This user is already a team member' } }
{ error: { code: 'EMAIL_ALREADY_INVITED', message: 'This email has a pending invitation' } }
{ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired invitation' } }
{ error: { code: 'FORBIDDEN', message: 'Only team admins can invite members' } }
```

### Common Pitfalls

1. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
2. **DO NOT** compare emails without normalizing to lowercase
3. **DO NOT** allow non-admins to invite members
4. **DO NOT** forget to validate token expiration before accepting
5. **DO NOT** expose invitation tokens in logs or error messages
6. **DO NOT** skip confirmation dialog for revoke action
7. **DO NOT** make invitation routes require auth before signup flow can complete

### Verification Checklist

After completing this story, verify:
- [ ] `team_invitations` table exists with correct schema
- [ ] Email normalization trigger works correctly
- [ ] RLS policies prevent cross-team access
- [ ] Admin can invite user by email (case-insensitive)
- [ ] Duplicate email shows appropriate error
- [ ] Invitation email is sent successfully via Resend
- [ ] Existing user can accept invitation and joins team
- [ ] New user can register via invitation link and auto-joins team
- [ ] Admin can revoke pending invitation with confirmation dialog
- [ ] Revoked invitations cannot be accepted
- [ ] Expired invitations show clear error message
- [ ] Invited email is pre-filled in signup form
- [ ] All forms have loading states and keyboard navigation
- [ ] All errors display user-friendly toast notifications
- [ ] Tests pass for all acceptance criteria

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
