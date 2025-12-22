import { test, expect } from '@playwright/test';
import {
  createTestUserViaApi,
  deleteTestUserViaApi,
  loginUser,
  makeUserSuperAdmin,
} from './helpers/auth';
import {
  createTestTeam,
  createTestProject,
  createTestPrompt,
  deleteTestTeam,
} from './helpers/api';

test.describe('Admin Team Overview', () => {
  let adminUser: { email: string; password: string; id: string };
  let regularUser: { email: string; password: string; id: string };
  let testTeam: { id: string; name: string };
  let testProject: { id: string; api_key: string };

  test.beforeAll(async () => {
    // Create test users via API
    adminUser = await createTestUserViaApi('admin-teams-test');
    regularUser = await createTestUserViaApi('regular-teams-test');

    // Make one user a super admin
    await makeUserSuperAdmin(adminUser.id);

    // Create a team and project for the regular user
    testTeam = await createTestTeam(regularUser.id, `Test Team ${Date.now()}`);
    testProject = await createTestProject(testTeam.id, regularUser.id, 'Test Project');

    // Create some test prompts
    await createTestPrompt(testTeam.id, testProject.id, 'test-user-1', 'First test prompt');
    await createTestPrompt(testTeam.id, testProject.id, 'test-user-1', 'Second test prompt');
  });

  test.afterAll(async () => {
    // Clean up in reverse order of creation - handle undefined values gracefully
    if (testTeam?.id) {
      await deleteTestTeam(testTeam.id);
    }
    if (adminUser?.email) {
      await deleteTestUserViaApi(adminUser.email);
    }
    if (regularUser?.email) {
      await deleteTestUserViaApi(regularUser.email);
    }
  });

  test.describe('Teams List Page', () => {
    test('super admin can access teams list page', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/teams');

      // Should see teams list page
      await expect(page).toHaveURL(/\/admin\/teams/);
      await expect(page.getByTestId('admin-teams-page')).toBeVisible();
    });

    test('teams list displays team with correct stats', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/teams');

      // Wait for table to load (not skeleton)
      await expect(page.getByTestId('teams-table')).toBeVisible({ timeout: 15000 });

      // Find our test team row - wait longer for data to load
      const teamRow = page.getByRole('row').filter({ hasText: testTeam.name });
      await expect(teamRow).toBeVisible({ timeout: 10000 });

      // Verify stats are displayed (member count, project count, prompts count)
      // Team should have 1 member (regularUser), 1 project, 2 prompts
      await expect(teamRow.getByTestId('member-count')).toContainText('1');
      await expect(teamRow.getByTestId('project-count')).toContainText('1');
      await expect(teamRow.getByTestId('prompts-count')).toContainText('2');
    });

    test('clicking team row navigates to team detail', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/teams');

      // Wait for table to load (not skeleton)
      await expect(page.getByTestId('teams-table')).toBeVisible({ timeout: 15000 });

      // Wait for the team row to be visible and clickable
      const teamRow = page.getByRole('row').filter({ hasText: testTeam.name });
      await expect(teamRow).toBeVisible({ timeout: 10000 });

      // Click on the team row
      await teamRow.click();

      // Should navigate to team detail page
      await expect(page).toHaveURL(new RegExp(`/admin/teams/${testTeam.id}`), { timeout: 10000 });
    });

    test('keyboard navigation works on team rows', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/teams');

      // Wait for table to load (not skeleton)
      await expect(page.getByTestId('teams-table')).toBeVisible({ timeout: 15000 });

      // Find team row and wait for it
      const teamRow = page.getByRole('row').filter({ hasText: testTeam.name });
      await expect(teamRow).toBeVisible({ timeout: 10000 });

      // Focus and press Enter
      await teamRow.focus();
      await page.keyboard.press('Enter');

      // Should navigate to team detail page
      await expect(page).toHaveURL(new RegExp(`/admin/teams/${testTeam.id}`), { timeout: 10000 });
    });

    test('search filters teams by name', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/teams');

      // Wait for table to load (not skeleton)
      await expect(page.getByTestId('teams-table')).toBeVisible({ timeout: 15000 });

      // Type in search input
      const searchInput = page.getByPlaceholder(/search teams/i);
      await searchInput.fill(testTeam.name.slice(0, 10));

      // Wait for debounce and results - wait for table to reload
      await page.waitForTimeout(500);
      await expect(page.getByTestId('teams-table')).toBeVisible({ timeout: 10000 });

      // Our team should still be visible
      const teamRow = page.getByRole('row').filter({ hasText: testTeam.name });
      await expect(teamRow).toBeVisible({ timeout: 10000 });
    });

    test('search with no results shows empty state', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/teams');

      // Wait for table to load
      await expect(page.getByTestId('teams-table')).toBeVisible();

      // Search for non-existent team
      const searchInput = page.getByPlaceholder(/search teams/i);
      await searchInput.fill('nonexistent-team-xyz-123456');

      // Wait for debounce and results
      await page.waitForTimeout(400);

      // Should show empty state
      await expect(page.getByText(/no teams found/i)).toBeVisible();
    });

    test('loading skeleton is shown while fetching data', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Navigate but intercept network to delay response
      await page.route('**/api/admin/teams*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto('/admin/teams');

      // Should see skeleton initially
      await expect(page.getByTestId('teams-table-skeleton')).toBeVisible();

      // Then data should load
      await expect(page.getByTestId('teams-table')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Team Detail Page', () => {
    test('team detail page shows team name and description', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Should see team detail page
      await expect(page.getByTestId('admin-team-detail')).toBeVisible();

      // Team name should be visible
      await expect(page.getByRole('heading', { name: testTeam.name })).toBeVisible();
    });

    test('team detail page shows breadcrumb navigation', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Breadcrumb should show Admin > Teams > Team Name
      const breadcrumb = page.getByLabel('breadcrumb');
      await expect(breadcrumb).toBeVisible();
      await expect(breadcrumb.getByText('Teams')).toBeVisible();
    });

    test('team detail page shows team members list', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Members section should be visible
      await expect(page.getByTestId('team-members-section')).toBeVisible();

      // Should show member count
      await expect(page.getByText(/team members/i)).toBeVisible();
    });

    test('team members display with role badges', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Wait for members table
      await expect(page.getByTestId('team-members-section')).toBeVisible();

      // Role badge should be visible
      await expect(page.getByTestId('role-badge')).toBeVisible();
    });

    test('team detail page shows projects list', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Wait for page to load
      await expect(page.getByTestId('admin-team-detail')).toBeVisible({ timeout: 10000 });

      // Projects section should be visible
      await expect(page.getByTestId('team-projects-section')).toBeVisible({ timeout: 10000 });

      // Should show our test project - use exact match to avoid matching description
      await expect(page.getByRole('cell', { name: 'Test Project', exact: true })).toBeVisible({ timeout: 5000 });
    });

    test('project API key is not exposed in detail view', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Wait for projects section
      await expect(page.getByTestId('team-projects-section')).toBeVisible();

      // Full API key should NOT be visible in page content
      const pageContent = await page.content();
      expect(pageContent).not.toContain(testProject.api_key);
    });

    test('team settings are displayed as read-only', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Settings section should be visible
      await expect(page.getByTestId('team-settings-section')).toBeVisible();

      // Should show "View only" indicator
      await expect(page.getByText(/view only/i)).toBeVisible();
    });

    test('no edit/delete actions are available', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Wait for page to load
      await expect(page.getByTestId('admin-team-detail')).toBeVisible();

      // Should NOT have any edit or delete buttons
      await expect(page.getByRole('button', { name: /edit/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /delete/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /remove/i })).not.toBeVisible();
    });

    test('activity summary shows recent prompts count', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Activity section should be visible
      await expect(page.getByTestId('team-activity-section')).toBeVisible();

      // Should show prompts count for last 7 days
      await expect(page.getByText(/last 7 days/i)).toBeVisible();
    });

    test('non-existent team shows error state', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/teams/00000000-0000-0000-0000-000000000000');

      // Should show error or not found state
      await expect(page.getByRole('heading', { name: /team not found/i })).toBeVisible();
    });

    test('clicking Teams breadcrumb returns to teams list', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto(`/admin/teams/${testTeam.id}`);

      // Click on Teams in breadcrumb
      const breadcrumb = page.getByLabel('breadcrumb');
      await breadcrumb.getByRole('link', { name: 'Teams' }).click();

      // Should navigate back to teams list
      await expect(page).toHaveURL(/\/admin\/teams$/);
    });
  });

  test.describe('Access Control', () => {
    test('non-admin user cannot access admin teams page', async ({ page }) => {
      await loginUser(page, regularUser.email, regularUser.password);
      await page.goto('/admin/teams');

      // Should be redirected away from admin
      await expect(page).not.toHaveURL(/\/admin\/teams/);
    });

    test('unauthenticated user cannot access admin teams page', async ({ page }) => {
      await page.goto('/admin/teams');

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
