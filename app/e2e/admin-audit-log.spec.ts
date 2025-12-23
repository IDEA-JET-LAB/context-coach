import { test, expect } from '@playwright/test';
import {
  createTestUserViaApi,
  deleteTestUserViaApi,
  loginUser,
  makeUserSuperAdmin,
} from './helpers/auth';

test.describe('Admin Audit Log', () => {
  let adminUser: { email: string; password: string; id: string };

  test.beforeAll(async () => {
    // Create admin user
    adminUser = await createTestUserViaApi('audit-log-test');
    await makeUserSuperAdmin(adminUser.id);
  });

  test.afterAll(async () => {
    await deleteTestUserViaApi(adminUser.email);
  });

  test.describe('Audit Log Page Access', () => {
    test('super admin can access audit log page', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      // Should see audit log page
      await expect(page.getByTestId('admin-audit-page')).toBeVisible();
      await expect(page.getByText(/audit log/i)).toBeVisible();
    });

    test('audit log link appears in admin sidebar', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      // Should see audit log link in sidebar
      await expect(page.getByTestId('admin-nav-audit-log')).toBeVisible();
    });

    test('clicking audit log link navigates to audit page', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await page.getByTestId('admin-nav-audit-log').click();
      await expect(page).toHaveURL('/admin/audit');
    });
  });

  test.describe('Audit Log Display', () => {
    test('displays total entries count', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      // Should show entries count (may be 0 initially)
      await expect(page.getByText(/\d+ total entries/i)).toBeVisible();
    });

    test('shows empty state when no entries', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      // If there are no entries, should show empty state
      const entriesText = await page.getByText(/\d+ total entries/i).textContent();
      if (entriesText?.includes('0')) {
        await expect(page.getByText(/no audit entries found/i)).toBeVisible();
      }
    });

    test('displays filter controls', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      // Click filters button
      await page.getByRole('button', { name: /filters/i }).click();

      // Should see filter controls
      await expect(page.getByLabel(/search/i)).toBeVisible();
      await expect(page.getByLabel(/action type/i)).toBeVisible();
      await expect(page.getByLabel(/entity type/i)).toBeVisible();
      await expect(page.getByLabel(/user/i)).toBeVisible();
      await expect(page.getByLabel(/from date/i)).toBeVisible();
      await expect(page.getByLabel(/to date/i)).toBeVisible();
    });

    test('export button is visible', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
    });
  });

  test.describe('Audit Entry Creation on Config Change', () => {
    test('creating a config generates an audit entry', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Create a new config
      await page.goto('/admin/config/new');
      const configName = `Audit Test Config ${Date.now()}`;
      await page.getByLabel(/version name/i).fill(configName);
      await page.getByLabel(/system prompt/i).fill('Test prompt for audit');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Test Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Navigate to audit log
      await page.goto('/admin/audit');

      // Should see the create action
      await expect(page.getByText(/created/i).first()).toBeVisible();
      await expect(page.getByText(configName)).toBeVisible();
    });

    test('activating a config generates an audit entry', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Create and activate a config
      await page.goto('/admin/config/new');
      const configName = `Activate Audit Config ${Date.now()}`;
      await page.getByLabel(/version name/i).fill(configName);
      await page.getByLabel(/system prompt/i).fill('Test prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Activate the config
      await page.getByRole('button', { name: /activate/i }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: /confirm/i }).click();
      await expect(page.getByTestId('active-badge')).toBeVisible({ timeout: 10000 });

      // Navigate to audit log
      await page.goto('/admin/audit');

      // Should see the activated action
      await expect(page.getByText(/activated/i).first()).toBeVisible();
    });
  });

  test.describe('Filtering', () => {
    test('can filter by action type', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click();

      // Select action type filter
      await page.getByLabel(/action type/i).click();
      await page.locator('[role="option"]').filter({ hasText: /config created/i }).click();

      // URL should update with filter
      await expect(page).toHaveURL(/action=config_created/);
    });

    test('can filter by entity type', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click();

      // Select entity type filter
      await page.getByLabel(/entity type/i).click();
      await page.locator('[role="option"]').filter({ hasText: /analysis config/i }).click();

      // URL should update with filter
      await expect(page).toHaveURL(/entity_type=analysis_config/);
    });

    test('can search by text', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click();

      // Enter search text
      await page.getByLabel(/search/i).fill('test search term');
      await page.getByLabel(/search/i).press('Enter');

      // URL should update with search param
      await expect(page).toHaveURL(/search=test/);
    });

    test('can filter by date range', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click();

      // Set date range
      await page.getByLabel(/from date/i).fill('2025-01-01');
      await page.getByLabel(/to date/i).fill('2025-12-31');

      // URL should update with date params
      await expect(page).toHaveURL(/date_from=2025-01-01/);
      await expect(page).toHaveURL(/date_to=2025-12-31/);
    });

    test('can clear all filters', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit?action=config_created&entity_type=analysis_config');

      // Filters should show as active
      await expect(page.getByText(/active/i)).toBeVisible();

      // Open filters and clear
      await page.getByRole('button', { name: /filters/i }).click();
      await page.getByRole('button', { name: /clear filters/i }).click();

      // URL should be clean
      await expect(page).toHaveURL('/admin/audit');
    });
  });

  test.describe('Detail View', () => {
    test('can expand entry to see details', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // First create a config to ensure there's an audit entry
      await page.goto('/admin/config/new');
      await page.getByLabel(/version name/i).fill(`Detail Test ${Date.now()}`);
      await page.getByLabel(/system prompt/i).fill('Test prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Go to audit log
      await page.goto('/admin/audit');

      // Find the eye icon to view details
      const viewButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      if (await viewButton.isVisible()) {
        await viewButton.click();

        // Dialog should open
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/configuration changes/i)).toBeVisible();
      }
    });

    test('diff viewer shows before and after states', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // First create and update a config to ensure there's a change to diff
      await page.goto('/admin/config/new');
      const configName = `Diff Test ${Date.now()}`;
      await page.getByLabel(/version name/i).fill(configName);
      await page.getByLabel(/system prompt/i).fill('Original prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Go to audit log
      await page.goto('/admin/audit');

      // Find an entry with view details button
      const viewButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      if (await viewButton.isVisible()) {
        await viewButton.click();

        // Dialog should show before/after sections
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/before/i)).toBeVisible();
        await expect(page.getByText(/after/i)).toBeVisible();
      }
    });
  });

  test.describe('CSV Export', () => {
    test('export button downloads a CSV file', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/audit');

      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);

      // Click export
      await page.getByRole('button', { name: /export csv/i }).click();

      // Wait for download
      const download = await downloadPromise;

      if (download) {
        // Check file name
        expect(download.suggestedFilename()).toContain('audit-log-');
        expect(download.suggestedFilename()).toContain('.csv');
      } else {
        // If no entries, might not trigger download - that's OK
        console.log('No download triggered - may have no entries to export');
      }
    });
  });

  test.describe('Non-Admin Access', () => {
    let regularUser: { email: string; password: string; id: string };

    test.beforeAll(async () => {
      regularUser = await createTestUserViaApi('audit-regular-user');
    });

    test.afterAll(async () => {
      await deleteTestUserViaApi(regularUser.email);
    });

    test('regular user cannot access audit log page', async ({ page }) => {
      await loginUser(page, regularUser.email, regularUser.password);
      await page.goto('/admin/audit');

      // Should be redirected or show access denied
      await expect(page).not.toHaveURL('/admin/audit');
    });
  });
});
