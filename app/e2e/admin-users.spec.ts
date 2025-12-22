import { test, expect } from '@playwright/test';
import {
  createTestUserViaApi,
  deleteTestUserViaApi,
  loginUser,
  makeUserSuperAdmin,
} from './helpers/auth';
import { createTestTeam, createTestPrompt, createTestProject } from './helpers/api';

// Run tests serially to avoid race conditions with user creation
test.describe.configure({ mode: 'serial' });

test.describe('Admin User Management', () => {
  let adminUser: { email: string; password: string; id: string };
  let testUser1: { email: string; password: string; id: string };
  let testUser2: { email: string; password: string; id: string };
  let regularUser: { email: string; password: string; id: string };
  let testTeam: { id: string; name: string };
  let testProject: { id: string; api_key: string };

  test.beforeAll(async () => {
    // Create admin user
    adminUser = await createTestUserViaApi('admin-users');
    await makeUserSuperAdmin(adminUser.id);

    // Create regular user (for access control tests)
    regularUser = await createTestUserViaApi('regular-users');

    // Create test users that we'll manage
    testUser1 = await createTestUserViaApi('test-user-1');
    testUser2 = await createTestUserViaApi('test-user-2');

    // Create a team and project for testUser1 to have some data
    testTeam = await createTestTeam(testUser1.id, 'Test Team for Admin');
    testProject = await createTestProject(testTeam.id, testUser1.id, 'Test Project');

    // Create some prompts for testUser1
    await createTestPrompt(testTeam.id, testProject.id, testUser1.id, 'First test prompt');
    await createTestPrompt(testTeam.id, testProject.id, testUser1.id, 'Second test prompt');
  });

  test.afterAll(async () => {
    await deleteTestUserViaApi(adminUser.email);
    await deleteTestUserViaApi(regularUser.email);
    await deleteTestUserViaApi(testUser1.email);
    await deleteTestUserViaApi(testUser2.email);
  });

  test.describe('Access Control', () => {
    test('regular user cannot access /admin/users', async ({ page }) => {
      await loginUser(page, regularUser.email, regularUser.password);
      await page.goto('/admin/users');

      // Should be redirected away from admin
      await expect(page).not.toHaveURL(/\/admin\/users/);
    });

    test('super admin can access /admin/users', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users');

      await expect(page).toHaveURL(/\/admin\/users/);
      await expect(page.getByTestId('admin-users-page')).toBeVisible();
    });
  });

  test.describe('Users List', () => {
    test('displays list of users in table', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users');

      // Should see the users table
      await expect(page.getByTestId('users-table')).toBeVisible();

      // Should see column headers
      await expect(page.getByRole('columnheader', { name: /email/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /last active/i })).toBeVisible();
    });

    test('shows test users in the list', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users');

      // Wait for table to load
      await expect(page.getByTestId('users-table')).toBeVisible();

      // Search for test user 1
      await page.getByTestId('users-search').fill(testUser1.email);
      await page.waitForTimeout(500); // Debounce wait

      // Should see the test user
      await expect(page.getByText(testUser1.email)).toBeVisible();
    });

    test('search filters users by email', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users');

      const searchInput = page.getByTestId('users-search');
      await searchInput.fill('test-user-1');
      await page.waitForTimeout(1000); // Debounce + network wait

      // Should show filtered results - wait for table to update
      await expect(page.getByText(testUser1.email)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(testUser2.email)).not.toBeVisible();
    });

    test('status filter works correctly', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users');

      // Filter by active status
      await page.getByTestId('status-filter').click();
      await page.getByRole('option', { name: /active/i }).click();

      // Should only show active users
      await expect(page.getByTestId('users-table')).toBeVisible();
      // Verify the filter is applied (URL should update)
      await expect(page).toHaveURL(/status=active/);
    });

    test('clear filters button resets all filters', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users?search=test&status=active');

      await page.getByTestId('clear-filters').click();

      // URL should be clean (no search or status params)
      await page.waitForURL((url) => {
        return !url.searchParams.has('search') && !url.searchParams.has('status');
      }, { timeout: 10000 });

      // Search input should be empty
      await expect(page.getByTestId('users-search')).toHaveValue('');
    });
  });

  test.describe('Pagination', () => {
    test('pagination controls are visible', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users');

      await expect(page.getByTestId('users-pagination')).toBeVisible();
      await expect(page.getByTestId('page-size-select')).toBeVisible();
    });

    test('page size selector changes results per page', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users');

      // Change page size
      await page.getByTestId('page-size-select').click();
      await page.getByRole('option', { name: '25' }).click();

      // URL should update
      await expect(page).toHaveURL(/pageSize=25/);
    });

    test('pagination state is synced with URL', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users?page=1&pageSize=10');

      // Should show correct pagination info
      await expect(page.getByTestId('users-pagination')).toBeVisible();
    });
  });

  test.describe('User Detail Page', () => {
    test('clicking a user row navigates to detail page', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/users');

      // Search for test user
      await page.getByTestId('users-search').fill(testUser1.email);
      await page.waitForTimeout(500);

      // Click on the user row
      await page.getByRole('row').filter({ hasText: testUser1.email }).click();

      // Should navigate to detail page
      await expect(page).toHaveURL(new RegExp(`/admin/users/${testUser1.id}`));
    });

    test('user detail page shows user information', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${testUser1.id}`);

      await expect(page.getByTestId('user-detail-page')).toBeVisible();

      // Should show user email
      await expect(page.getByTestId('user-email')).toContainText(testUser1.email);

      // Should show account status
      await expect(page.getByTestId('user-status')).toBeVisible();

      // Should show teams section
      await expect(page.getByTestId('user-teams')).toBeVisible();

      // Should show prompts count
      await expect(page.getByTestId('user-prompts-count')).toBeVisible();
    });

    test('user detail page shows teams the user belongs to', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${testUser1.id}`);

      // Should show the test team
      await expect(page.getByText(testTeam.name)).toBeVisible();
    });

    test('user detail page shows correct prompts count', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${testUser1.id}`);

      // Should show at least 2 prompts (we created 2 in setup)
      const promptsCount = page.getByTestId('user-prompts-count');
      await expect(promptsCount).toBeVisible();
      // The count should be >= 2
      const countText = await promptsCount.textContent();
      const count = parseInt(countText?.match(/\d+/)?.[0] || '0');
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Disable Account', () => {
    let userToDisable: { email: string; password: string; id: string };

    test.beforeAll(async () => {
      userToDisable = await createTestUserViaApi('user-to-disable');
    });

    test.afterAll(async () => {
      await deleteTestUserViaApi(userToDisable.email);
    });

    test('disable account button is visible on user detail page', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${userToDisable.id}`);

      await expect(page.getByTestId('disable-account-btn')).toBeVisible();
    });

    test('disable account shows confirmation dialog', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${userToDisable.id}`);

      await page.getByTestId('disable-account-btn').click();

      // Should show confirmation dialog
      await expect(page.getByTestId('disable-account-dialog')).toBeVisible();
      await expect(page.getByText(/prevent the user from logging in/i)).toBeVisible();
    });

    test('can disable an account after confirmation', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${userToDisable.id}`);

      await page.getByTestId('disable-account-btn').click();
      await page.getByTestId('confirm-disable-btn').click();

      // Should show success message
      await expect(page.getByText(/account disabled/i)).toBeVisible({ timeout: 10000 });

      // Status should update to disabled
      await expect(page.getByTestId('user-status')).toContainText(/disabled/i);
    });

    test('can re-enable a disabled account', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${userToDisable.id}`);

      // Should now show Enable button instead of Disable
      await expect(page.getByTestId('enable-account-btn')).toBeVisible();

      await page.getByTestId('enable-account-btn').click();
      await page.getByTestId('confirm-enable-btn').click();

      // Should show success message
      await expect(page.getByText(/account enabled/i)).toBeVisible({ timeout: 10000 });

      // Status should update to active
      await expect(page.getByTestId('user-status')).toContainText(/active/i);
    });
  });

  test.describe('Delete Account', () => {
    let userToDelete: { email: string; password: string; id: string };

    test.beforeEach(async () => {
      userToDelete = await createTestUserViaApi('user-to-delete');
    });

    test.afterEach(async () => {
      // Clean up - user may already be deleted
      try {
        await deleteTestUserViaApi(userToDelete.email);
      } catch {
        // User already deleted
      }
    });

    test('delete account button is visible on user detail page', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${userToDelete.id}`);

      await expect(page.getByTestId('delete-account-btn')).toBeVisible();
    });

    test('delete account shows multi-step confirmation dialog', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${userToDelete.id}`);

      await page.getByTestId('delete-account-btn').click();

      // Should show confirmation dialog with email input
      await expect(page.getByTestId('delete-account-dialog')).toBeVisible();
      await expect(page.getByTestId('delete-email-confirm')).toBeVisible();
    });

    test('delete button is disabled until email is typed correctly', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${userToDelete.id}`);

      await page.getByTestId('delete-account-btn').click();

      const confirmBtn = page.getByTestId('confirm-delete-btn');
      await expect(confirmBtn).toBeDisabled();

      // Type wrong email
      await page.getByTestId('delete-email-confirm').fill('wrong@email.com');
      await expect(confirmBtn).toBeDisabled();

      // Type correct email
      await page.getByTestId('delete-email-confirm').fill(userToDelete.email);
      await expect(confirmBtn).toBeEnabled();
    });

    test('can delete an account after email confirmation', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/users/${userToDelete.id}`);

      await page.getByTestId('delete-account-btn').click();
      await page.getByTestId('delete-email-confirm').fill(userToDelete.email);
      await page.getByTestId('confirm-delete-btn').click();

      // Should show success message and redirect
      await expect(page.getByText(/account deleted/i)).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL('/admin/users');
    });

    test('deleted user no longer appears in users list', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // First delete the user
      await page.goto(`/admin/users/${userToDelete.id}`);
      await page.getByTestId('delete-account-btn').click();
      await page.getByTestId('delete-email-confirm').fill(userToDelete.email);
      await page.getByTestId('confirm-delete-btn').click();

      // Wait for redirect
      await expect(page).toHaveURL('/admin/users');

      // Search for the deleted user
      await page.getByTestId('users-search').fill(userToDelete.email);
      await page.waitForTimeout(500);

      // Should not find the user
      await expect(page.getByText(userToDelete.email)).not.toBeVisible();
    });
  });

  test.describe('Audit Logging', () => {
    // Note: Audit logs are internal - we verify they exist via API in unit tests
    // Here we just verify the UI actions complete successfully which implies logging
    test('disable action completes (implies audit log created)', async ({ page }) => {
      const userForAudit = await createTestUserViaApi('user-for-audit');

      try {
        await loginUser(page, adminUser.email, adminUser.password);
        await page.goto(`/admin/users/${userForAudit.id}`);

        await page.getByTestId('disable-account-btn').click();
        await page.getByTestId('confirm-disable-btn').click();

        // Success implies audit log was created
        await expect(page.getByText(/account disabled/i)).toBeVisible({ timeout: 10000 });
      } finally {
        await deleteTestUserViaApi(userForAudit.email);
      }
    });
  });
});
