import { test, expect, Page } from '@playwright/test';
import {
  createTestUserDirect,
  createTestTeam,
  deleteTestUser,
  deleteTestTeam,
} from './helpers/api';

/**
 * Test user credentials - unique per test run to avoid conflicts.
 */
const TEST_PASSWORD = 'TestPassword123!';

/**
 * Helper to login a test user.
 */
async function loginTestUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/(prompts|home|teams\/new)/, { timeout: 15000 });
}

test.describe('Account Deletion', () => {
  test.describe('UI Elements', () => {
    test('should display Danger Zone section on settings page', async ({ page }) => {
      const testEmail = `test-deletion-ui-${Date.now()}@example.com`;
      let testUserId: string | undefined;

      try {
        // Create test user
        const user = await createTestUserDirect(testEmail, TEST_PASSWORD);
        testUserId = user.id;

        // Login
        await loginTestUser(page, testEmail, TEST_PASSWORD);

        // Navigate to settings
        await page.goto('/settings');

        // Verify Danger Zone section exists
        await expect(page.getByText('Danger Zone')).toBeVisible();
        await expect(page.getByText('Irreversible and destructive actions')).toBeVisible();
        await expect(page.getByTestId('delete-account-button')).toBeVisible();
      } finally {
        // Cleanup
        if (testUserId) {
          await deleteTestUser(testUserId);
        }
      }
    });

    test('should open delete confirmation modal when button clicked', async ({ page }) => {
      const testEmail = `test-deletion-modal-${Date.now()}@example.com`;
      let testUserId: string | undefined;

      try {
        // Create test user
        const user = await createTestUserDirect(testEmail, TEST_PASSWORD);
        testUserId = user.id;

        // Login
        await loginTestUser(page, testEmail, TEST_PASSWORD);

        // Navigate to settings
        await page.goto('/settings');

        // Click delete account button
        await page.getByTestId('delete-account-button').click();

        // Verify modal appears
        await expect(page.getByTestId('delete-account-modal')).toBeVisible();
        await expect(page.getByText('Delete Account').first()).toBeVisible();
        await expect(page.getByText('This action cannot be undone')).toBeVisible();
        await expect(page.getByTestId('confirm-email-input')).toBeVisible();
        await expect(page.getByTestId('confirm-delete-button')).toBeVisible();
        await expect(page.getByTestId('confirm-delete-button')).toBeDisabled();
      } finally {
        // Cleanup
        if (testUserId) {
          await deleteTestUser(testUserId);
        }
      }
    });

    test('should enable delete button only when email matches', async ({ page }) => {
      const testEmail = `test-deletion-enable-${Date.now()}@example.com`;
      let testUserId: string | undefined;

      try {
        // Create test user
        const user = await createTestUserDirect(testEmail, TEST_PASSWORD);
        testUserId = user.id;

        // Login
        await loginTestUser(page, testEmail, TEST_PASSWORD);

        // Navigate to settings
        await page.goto('/settings');

        // Open modal
        await page.getByTestId('delete-account-button').click();
        await expect(page.getByTestId('delete-account-modal')).toBeVisible();

        // Button should be disabled initially
        await expect(page.getByTestId('confirm-delete-button')).toBeDisabled();

        // Type wrong email
        await page.getByTestId('confirm-email-input').fill('wrong@email.com');
        await expect(page.getByTestId('confirm-delete-button')).toBeDisabled();

        // Type correct email
        await page.getByTestId('confirm-email-input').clear();
        await page.getByTestId('confirm-email-input').fill(testEmail);
        await expect(page.getByTestId('confirm-delete-button')).toBeEnabled();
      } finally {
        // Cleanup
        if (testUserId) {
          await deleteTestUser(testUserId);
        }
      }
    });
  });

  test.describe('Successful Deletion', () => {
    test('should successfully delete account and redirect to landing page', async ({ page }) => {
      const testEmail = `test-deletion-success-${Date.now()}@example.com`;
      let testUserId: string | undefined;

      try {
        // Create test user without any team ownership (just a bare user)
        const user = await createTestUserDirect(testEmail, TEST_PASSWORD);
        testUserId = user.id;

        // Login
        await loginTestUser(page, testEmail, TEST_PASSWORD);

        // Navigate to settings
        await page.goto('/settings');

        // Open modal
        await page.getByTestId('delete-account-button').click();
        await expect(page.getByTestId('delete-account-modal')).toBeVisible();

        // Type correct email and delete
        await page.getByTestId('confirm-email-input').fill(testEmail);
        await page.getByTestId('confirm-delete-button').click();

        // Wait for navigation to complete - the redirect happens via window.location
        // which causes a full page load. Wait for the settings page to disappear first.
        await page.waitForURL((url) => !url.pathname.includes('/settings'), { timeout: 20000 });

        // Verify we're on the landing page by checking for marketing content
        await expect(page.getByRole('link', { name: 'Contextor' })).toBeVisible({ timeout: 10000 });

        // Verify success toast appears (Sonner uses data-sonner-toast attribute)
        await expect(page.locator('[data-sonner-toast]').getByText('Your account has been successfully deleted')).toBeVisible({ timeout: 10000 });

        // User is now deleted - mark cleanup as done
        testUserId = undefined;
      } finally {
        // Cleanup (if test failed before deletion)
        if (testUserId) {
          await deleteTestUser(testUserId);
        }
      }
    });

    test('should prevent login after account deletion', async ({ page }) => {
      const testEmail = `test-deletion-no-login-${Date.now()}@example.com`;
      let testUserId: string | undefined;

      try {
        // Create test user
        const user = await createTestUserDirect(testEmail, TEST_PASSWORD);
        testUserId = user.id;

        // Login
        await loginTestUser(page, testEmail, TEST_PASSWORD);

        // Navigate to settings and delete
        await page.goto('/settings');
        await page.getByTestId('delete-account-button').click();
        await page.getByTestId('confirm-email-input').fill(testEmail);
        await page.getByTestId('confirm-delete-button').click();

        // Wait for navigation away from settings page
        await page.waitForURL((url) => !url.pathname.includes('/settings'), { timeout: 20000 });

        // Verify toast appears confirming deletion
        await expect(page.locator('[data-sonner-toast]').getByText('Your account has been successfully deleted')).toBeVisible({ timeout: 10000 });

        testUserId = undefined; // Account deleted

        // Try to login again
        await page.goto('/login');
        await page.getByLabel('Email').fill(testEmail);
        await page.locator('input[autocomplete="current-password"]').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: 'Login', exact: true }).click();

        // Should show error
        await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 10000 });
      } finally {
        if (testUserId) {
          await deleteTestUser(testUserId);
        }
      }
    });
  });

  test.describe('Last Admin Blocking', () => {
    test('should block deletion when user is last admin of a team', async ({ page }) => {
      const testEmail = `test-deletion-last-admin-${Date.now()}@example.com`;
      let testUserId: string | undefined;
      let testTeamId: string | undefined;

      try {
        // Create test user with team (user is the only admin)
        const user = await createTestUserDirect(testEmail, TEST_PASSWORD);
        testUserId = user.id;

        const team = await createTestTeam(user.id, `Last Admin Test Team ${Date.now()}`);
        testTeamId = team.id;

        // Login
        await loginTestUser(page, testEmail, TEST_PASSWORD);

        // Navigate to settings
        await page.goto('/settings');

        // Open modal
        await page.getByTestId('delete-account-button').click();
        await expect(page.getByTestId('delete-account-modal')).toBeVisible();

        // Type correct email and try to delete
        await page.getByTestId('confirm-email-input').fill(testEmail);
        await page.getByTestId('confirm-delete-button').click();

        // Should show error about being last admin
        await expect(page.getByText(/only admin/i)).toBeVisible({ timeout: 10000 });

        // Modal should still be open
        await expect(page.getByTestId('delete-account-modal')).toBeVisible();
      } finally {
        // Cleanup
        if (testTeamId) {
          await deleteTestTeam(testTeamId);
        }
        if (testUserId) {
          await deleteTestUser(testUserId);
        }
      }
    });

    test('should allow deletion when user is member but not admin', async ({ page }) => {
      const testEmail1 = `test-deletion-member-${Date.now()}@example.com`;
      const testEmail2 = `test-deletion-admin-${Date.now()}@example.com`;
      let testUserId1: string | undefined;
      let testUserId2: string | undefined;
      let testTeamId: string | undefined;

      try {
        // Create two test users
        const user1 = await createTestUserDirect(testEmail1, TEST_PASSWORD);
        testUserId1 = user1.id;

        const user2 = await createTestUserDirect(testEmail2, TEST_PASSWORD);
        testUserId2 = user2.id;

        // Create team with user2 as admin
        const team = await createTestTeam(user2.id, `Member Deletion Test Team ${Date.now()}`);
        testTeamId = team.id;

        // Add user1 as member (not admin) using service role
        const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
        const LOCAL_SERVICE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

        await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/team_members`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: LOCAL_SERVICE_KEY,
            Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            team_id: team.id,
            user_id: user1.id,
            role: 'member',
          }),
        });

        // Login as user1 (member)
        await loginTestUser(page, testEmail1, TEST_PASSWORD);

        // Navigate to settings
        await page.goto('/settings');

        // Open modal
        await page.getByTestId('delete-account-button').click();
        await expect(page.getByTestId('delete-account-modal')).toBeVisible();

        // Type correct email and delete
        await page.getByTestId('confirm-email-input').fill(testEmail1);
        await page.getByTestId('confirm-delete-button').click();

        // Wait for navigation away from settings page
        await page.waitForURL((url) => !url.pathname.includes('/settings'), { timeout: 20000 });

        // Verify toast appears confirming deletion
        await expect(page.locator('[data-sonner-toast]').getByText('Your account has been successfully deleted')).toBeVisible({ timeout: 10000 });

        testUserId1 = undefined; // Account deleted
      } finally {
        // Cleanup
        if (testTeamId) {
          await deleteTestTeam(testTeamId);
        }
        if (testUserId1) {
          await deleteTestUser(testUserId1);
        }
        if (testUserId2) {
          await deleteTestUser(testUserId2);
        }
      }
    });
  });

  test.describe('Email Validation', () => {
    test('should show error when email does not match', async ({ page }) => {
      const testEmail = `test-deletion-email-mismatch-${Date.now()}@example.com`;
      let testUserId: string | undefined;

      try {
        // Create test user
        const user = await createTestUserDirect(testEmail, TEST_PASSWORD);
        testUserId = user.id;

        // Login
        await loginTestUser(page, testEmail, TEST_PASSWORD);

        // Navigate to settings
        await page.goto('/settings');

        // Open modal
        await page.getByTestId('delete-account-button').click();
        await expect(page.getByTestId('delete-account-modal')).toBeVisible();

        // The button should be disabled when email doesn't match
        // so we need to modify the input after enabling
        await page.getByTestId('confirm-email-input').fill(testEmail);
        await expect(page.getByTestId('confirm-delete-button')).toBeEnabled();

        // Clear and type wrong email - button should disable again
        await page.getByTestId('confirm-email-input').clear();
        await page.getByTestId('confirm-email-input').fill('wrong@example.com');
        await expect(page.getByTestId('confirm-delete-button')).toBeDisabled();
      } finally {
        if (testUserId) {
          await deleteTestUser(testUserId);
        }
      }
    });
  });

  test.describe('Modal Behavior', () => {
    test('should close modal when cancel is clicked', async ({ page }) => {
      const testEmail = `test-deletion-cancel-${Date.now()}@example.com`;
      let testUserId: string | undefined;

      try {
        // Create test user
        const user = await createTestUserDirect(testEmail, TEST_PASSWORD);
        testUserId = user.id;

        // Login
        await loginTestUser(page, testEmail, TEST_PASSWORD);

        // Navigate to settings
        await page.goto('/settings');

        // Open modal
        await page.getByTestId('delete-account-button').click();
        await expect(page.getByTestId('delete-account-modal')).toBeVisible();

        // Click cancel
        await page.getByRole('button', { name: 'Cancel' }).click();

        // Modal should close
        await expect(page.getByTestId('delete-account-modal')).not.toBeVisible();
      } finally {
        if (testUserId) {
          await deleteTestUser(testUserId);
        }
      }
    });

    test('should reset form state when modal is closed and reopened', async ({ page }) => {
      const testEmail = `test-deletion-reset-${Date.now()}@example.com`;
      let testUserId: string | undefined;

      try {
        // Create test user
        const user = await createTestUserDirect(testEmail, TEST_PASSWORD);
        testUserId = user.id;

        // Login
        await loginTestUser(page, testEmail, TEST_PASSWORD);

        // Navigate to settings
        await page.goto('/settings');

        // Open modal and enter email
        await page.getByTestId('delete-account-button').click();
        await page.getByTestId('confirm-email-input').fill('some-email@test.com');

        // Close modal
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByTestId('delete-account-modal')).not.toBeVisible();

        // Reopen modal
        await page.getByTestId('delete-account-button').click();
        await expect(page.getByTestId('delete-account-modal')).toBeVisible();

        // Email input should be empty
        await expect(page.getByTestId('confirm-email-input')).toHaveValue('');
      } finally {
        if (testUserId) {
          await deleteTestUser(testUserId);
        }
      }
    });
  });
});
