import { test, expect, Page } from '@playwright/test';
import {
  createTestUser,
  loginUser,
  generateTestEmail,
  deleteMailpitMessages,
  getVerificationLink,
} from './helpers/auth';

const testPassword = 'TestPassword123!';

// Helper to navigate to invitations tab and wait for it to be ready
async function navigateToInvitationsTab(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Team Settings' }).click();
  // Wait for tabs to be visible
  await expect(page.getByRole('tab', { name: 'Invitations' })).toBeVisible({ timeout: 10000 });
  // Wait a moment for hydration to complete
  await page.waitForTimeout(1000);
  // Focus and click the tab
  const invitationsTab = page.getByRole('tab', { name: 'Invitations' });
  await invitationsTab.focus();
  await invitationsTab.click();
  // Small wait for tab panel to render
  await page.waitForTimeout(500);
  // Wait for the tab panel content to be visible
  await expect(page.getByText('Invite Team Members')).toBeVisible({ timeout: 10000 });
}

// Supabase API for direct database access in tests
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

// Helper to get invitation link by querying the database directly
// This is necessary because the email service uses Resend which isn't available in local dev
async function getInvitationLink(email: string): Promise<string | null> {
  // Wait a moment for the invitation to be created
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    // Query the team_invitations table directly using the service role key
    const response = await fetch(`${SUPABASE_URL}/rest/v1/team_invitations?email=eq.${encodeURIComponent(email.toLowerCase())}&status=eq.pending&select=token`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch invitation:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    if (data && data.length > 0 && data[0].token) {
      return `http://127.0.0.1:3050/invite/${data[0].token}`;
    }
  } catch (error) {
    console.error('Error fetching invitation link from database:', error);
  }

  return null;
}

test.describe('Team Member Invitation', () => {
  // Run tests serially to avoid mailpit message conflicts
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    await deleteMailpitMessages();
  });

  test.describe('Invitation Creation', () => {
    test('admin can access team settings and see invite form', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `Test Team ${Date.now()}`;

      // Create user and team
      await createTestUser(page, email, testPassword);

      // Create team
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();

      // Wait for team to be created and dashboard to show Team Settings link
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      // Navigate to team settings and invitations tab
      await navigateToInvitationsTab(page);

      // Verify invitations tab content
      await expect(page.getByLabel('Invite by Email')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Invite', exact: true })).toBeVisible();
    });

    test('admin can invite a user by email', async ({ page }) => {
      const adminEmail = generateTestEmail();
      const inviteeEmail = generateTestEmail();
      const teamName = `Admin Team ${Date.now()}`;

      // Create admin user and team
      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      // Navigate to team settings and invitations tab
      await navigateToInvitationsTab(page);

      // Clear mailpit before sending invite
      await deleteMailpitMessages();

      // Send invitation
      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.getByRole('button', { name: 'Invite', exact: true }).click();

      // Wait for invitation to appear in the table
      await expect(page.getByRole('cell', { name: inviteeEmail })).toBeVisible({ timeout: 15000 });
    });

    test('shows error for duplicate email invitation', async ({ page }) => {
      const adminEmail = generateTestEmail();
      const inviteeEmail = generateTestEmail();
      const teamName = `Duplicate Test ${Date.now()}`;

      // Create admin user and team
      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      // Navigate to settings and invitations tab
      await navigateToInvitationsTab(page);
      await deleteMailpitMessages();

      // First invitation
      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.getByRole('button', { name: 'Invite', exact: true }).click();
      await expect(page.getByText(/Invitation (sent|created)/i)).toBeVisible({ timeout: 10000 });

      // Try to invite same email again
      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.getByRole('button', { name: 'Invite', exact: true }).click();

      // Should show error - looking for specific error message about already having a pending invitation
      await expect(page.getByText(/This email (already has|has) a pending invitation/i)).toBeVisible({ timeout: 10000 });
    });

    test('shows email validation error for invalid email', async ({ page }) => {
      const adminEmail = generateTestEmail();
      const teamName = `Validation Test ${Date.now()}`;

      // Create admin user and team
      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      // Navigate to settings and invitations tab
      await navigateToInvitationsTab(page);

      // Try to submit without entering email
      await page.getByRole('button', { name: 'Invite', exact: true }).click();

      // Should show validation error - email is required
      await expect(page.getByText(/Email is required/i)).toBeVisible();
    });
  });

  test.describe('Invitation Revocation', () => {
    test('admin can revoke pending invitation', async ({ page }) => {
      const adminEmail = generateTestEmail();
      const inviteeEmail = generateTestEmail();
      const teamName = `Revoke Test ${Date.now()}`;

      // Create admin user and team
      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      // Navigate to settings and invitations tab
      await navigateToInvitationsTab(page);
      await deleteMailpitMessages();

      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.getByRole('button', { name: 'Invite', exact: true }).click();

      // Wait for invitation to appear in the pending list (table)
      await expect(page.getByRole('cell', { name: inviteeEmail })).toBeVisible({ timeout: 10000 });

      // Click revoke button
      await page.getByRole('button', { name: 'Revoke', exact: true }).click();

      // Confirm revocation in dialog
      await expect(page.getByRole('heading', { name: 'Revoke Invitation' })).toBeVisible();
      await page.getByRole('button', { name: 'Revoke Invitation' }).click();

      // Verify success and invitation removed
      await expect(page.getByText(/Invitation revoked/i)).toBeVisible({ timeout: 10000 });

      // Wait for dialog to close
      await expect(page.getByRole('heading', { name: 'Revoke Invitation' })).not.toBeVisible({ timeout: 5000 });

      // Verify invitation removed from list (check the table cell specifically)
      await expect(page.getByRole('cell', { name: inviteeEmail })).not.toBeVisible();
    });
  });

  test.describe('Invitation Acceptance - Existing User', () => {
    test('existing user can accept invitation and join team', async ({ page, context }) => {
      const adminEmail = generateTestEmail();
      const inviteeEmail = generateTestEmail();
      const teamName = `Join Team ${Date.now()}`;

      // Create admin user and team
      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      // Navigate to settings and invitations tab
      await navigateToInvitationsTab(page);
      await deleteMailpitMessages();

      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.getByRole('button', { name: 'Invite', exact: true }).click();

      // Wait for invitation to appear in the table
      await expect(page.getByRole('cell', { name: inviteeEmail })).toBeVisible({ timeout: 10000 });

      // Get invitation link
      const inviteLink = await getInvitationLink(inviteeEmail);
      expect(inviteLink).toBeTruthy();

      // Log out admin
      await page.getByRole('button', { name: /logout/i }).click();

      // Create invitee account in a new page
      await deleteMailpitMessages();
      const page2 = await context.newPage();
      await createTestUser(page2, inviteeEmail, testPassword);

      // Create initial team for invitee
      await page2.getByLabel('Team Name').fill('Invitee Personal Team');
      await page2.getByRole('button', { name: 'Create Team' }).click();
      await expect(page2.getByRole('heading', { name: 'Invitee Personal Team' })).toBeVisible({ timeout: 15000 });

      // Navigate to invitation link
      await page2.goto(inviteLink!);

      // Should see invitation page
      await expect(page2.getByText("You're Invited!")).toBeVisible({ timeout: 10000 });
      await expect(page2.getByText(teamName)).toBeVisible();

      // Accept invitation - wait for button to be ready
      const joinButton = page2.getByRole('button', { name: 'Join Team' });
      await expect(joinButton).toBeVisible({ timeout: 10000 });
      await expect(joinButton).toBeEnabled({ timeout: 5000 });
      await joinButton.click();

      // Should be redirected to dashboard with new team
      await expect(page2.getByText(/Welcome to/i)).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Invitation Acceptance - New User', () => {
    test('new user sees signup option on invitation page', async ({ page }) => {
      const adminEmail = generateTestEmail();
      const inviteeEmail = generateTestEmail();
      const teamName = `New User Team ${Date.now()}`;

      // Create admin user and team
      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      // Navigate to settings and send invitation
      await navigateToInvitationsTab(page);
      await deleteMailpitMessages();

      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.getByRole('button', { name: 'Invite', exact: true }).click();
      await expect(page.getByText(/Invitation (sent|created)/i)).toBeVisible({ timeout: 10000 });

      // Get invitation link
      const inviteLink = await getInvitationLink(inviteeEmail);
      expect(inviteLink).toBeTruthy();

      // Log out admin
      await page.getByRole('button', { name: /sign out|logout/i }).click();

      // Go to invitation link as new user (not logged in)
      await page.goto(inviteLink!);

      // Should see invitation page with signup option
      await expect(page.getByText("You're Invited!")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(teamName)).toBeVisible();
      await expect(page.getByRole('link', { name: /Create Account/i })).toBeVisible();
    });

    test('signup link preserves invite token and email', async ({ page }) => {
      const adminEmail = generateTestEmail();
      const inviteeEmail = generateTestEmail();
      const teamName = `Signup Flow Team ${Date.now()}`;

      // Create admin user and team
      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      // Navigate to settings and send invitation
      await navigateToInvitationsTab(page);
      await deleteMailpitMessages();

      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.getByRole('button', { name: 'Invite', exact: true }).click();
      await expect(page.getByText(/Invitation (sent|created)/i)).toBeVisible({ timeout: 10000 });

      // Get invitation link
      const inviteLink = await getInvitationLink(inviteeEmail);
      expect(inviteLink).toBeTruthy();

      // Log out admin
      await page.getByRole('button', { name: /sign out|logout/i }).click();

      // Go to invitation link
      await page.goto(inviteLink!);

      // Click create account
      await page.getByRole('link', { name: /Create Account/i }).click();

      // Should be on signup page with email prefilled
      await expect(page.getByLabel('Email')).toHaveValue(inviteeEmail.toLowerCase());

      // Email should be readonly (set by invitation)
      await expect(page.getByText(/Email is set by the invitation/i)).toBeVisible();
    });
  });

  test.describe('Invalid Invitations', () => {
    test('shows error for invalid invitation token', async ({ page }) => {
      await page.goto('/invite/invalid-token-12345');

      await expect(page.getByText('Invalid Invitation')).toBeVisible({ timeout: 10000 });
    });

    test('email mismatch shows warning', async ({ page, context }) => {
      const adminEmail = generateTestEmail();
      const inviteeEmail = generateTestEmail();
      const otherUserEmail = generateTestEmail();
      const teamName = `Mismatch Team ${Date.now()}`;

      // Create admin user and team
      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      // Send invitation to inviteeEmail
      await navigateToInvitationsTab(page);
      await deleteMailpitMessages();

      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.getByRole('button', { name: 'Invite', exact: true }).click();
      await expect(page.getByText(/Invitation (sent|created)/i)).toBeVisible({ timeout: 10000 });

      const inviteLink = await getInvitationLink(inviteeEmail);
      expect(inviteLink).toBeTruthy();

      // Log out admin
      await page.getByRole('button', { name: /sign out|logout/i }).click();

      // Create a different user
      await deleteMailpitMessages();
      const page2 = await context.newPage();
      await createTestUser(page2, otherUserEmail, testPassword);
      await page2.getByLabel('Team Name').fill('Other User Team');
      await page2.getByRole('button', { name: 'Create Team' }).click();
      await expect(page2.getByRole('heading', { name: 'Other User Team' })).toBeVisible({ timeout: 15000 });

      // Try to use invitation intended for inviteeEmail
      await page2.goto(inviteLink!);

      // Should see email mismatch warning
      await expect(page2.getByText(/Wrong Account/i)).toBeVisible({ timeout: 10000 });
      await expect(page2.getByText(otherUserEmail)).toBeVisible();
      await expect(page2.getByText(inviteeEmail)).toBeVisible();
    });
  });

  test.describe('Pending Invitations List', () => {
    test('shows empty state when no pending invitations', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `Empty List Team ${Date.now()}`;

      await createTestUser(page, email, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      await navigateToInvitationsTab(page);

      await expect(page.getByText('No pending invitations')).toBeVisible();
    });

    test('shows invitation expiration info', async ({ page }) => {
      const adminEmail = generateTestEmail();
      const inviteeEmail = generateTestEmail();
      const teamName = `Expiry Info Team ${Date.now()}`;

      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      await navigateToInvitationsTab(page);
      await deleteMailpitMessages();

      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.getByRole('button', { name: 'Invite', exact: true }).click();
      await expect(page.getByText(/Invitation (sent|created)/i)).toBeVisible({ timeout: 10000 });

      // Check that expiration info is shown
      await expect(page.getByText(/Expires in \d+ days/i)).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('invite form submits with Enter key', async ({ page }) => {
      const adminEmail = generateTestEmail();
      const inviteeEmail = generateTestEmail();
      const teamName = `Keyboard Team ${Date.now()}`;

      await createTestUser(page, adminEmail, testPassword);
      await page.getByLabel('Team Name').fill(teamName);
      await page.getByRole('button', { name: 'Create Team' }).click();
      await expect(page.getByRole('link', { name: 'Team Settings' })).toBeVisible({ timeout: 15000 });

      await navigateToInvitationsTab(page);
      await deleteMailpitMessages();

      // Fill email and press Enter
      await page.getByLabel('Invite by Email').fill(inviteeEmail);
      await page.keyboard.press('Enter');

      // Should send invitation
      await expect(page.getByText(/Invitation (sent|created)/i)).toBeVisible({ timeout: 10000 });
    });
  });
});
