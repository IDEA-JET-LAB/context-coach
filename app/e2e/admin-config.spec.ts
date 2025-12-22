import { test, expect } from '@playwright/test';
import {
  createTestUserViaApi,
  deleteTestUserViaApi,
  loginUser,
  makeUserSuperAdmin,
} from './helpers/auth';

test.describe('Analysis Config Editor', () => {
  let adminUser: { email: string; password: string; id: string };

  test.beforeAll(async () => {
    // Create admin user
    adminUser = await createTestUserViaApi('admin-config-test');
    await makeUserSuperAdmin(adminUser.id);
  });

  test.afterAll(async () => {
    await deleteTestUserViaApi(adminUser.email);
  });

  test.describe('Config List Page', () => {
    test('displays all config versions with status', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config');

      // Should see config list page
      await expect(page.getByTestId('config-list-page')).toBeVisible();

      // Should display at least the default config
      await expect(page.getByTestId('config-version-card').first()).toBeVisible();

      // Default config should be marked as active
      await expect(page.getByTestId('active-badge').first()).toBeVisible();
    });

    test('shows Create New Version button', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config');

      await expect(page.getByRole('link', { name: /create new version/i })).toBeVisible();
    });

    test('displays config details - version name, status, created date', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config');

      const configCard = page.getByTestId('config-version-card').first();
      await expect(configCard).toBeVisible();

      // Should show version info
      await expect(configCard.getByTestId('config-name')).toBeVisible();
      await expect(configCard.getByTestId('config-created-date')).toBeVisible();
    });
  });

  test.describe('Create New Config', () => {
    test('navigates to new config form', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config');

      await page.getByRole('link', { name: /create new version/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/new/);
      await expect(page.getByTestId('new-config-form')).toBeVisible();
    });

    test('can set version name, system prompt, and AI model', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config/new');

      // Fill basic fields
      await page.getByLabel(/version name/i).fill('Test Config v2');
      await page.getByLabel(/system prompt/i).fill('You are a test prompt analyzer.');

      // Select AI model - use text content since shadcn Select uses different structure
      await page.getByTestId('model-select-trigger').click();
      await page.locator('[role="option"]').filter({ hasText: 'GPT-4o Mini' }).click();

      // Fields should be filled
      await expect(page.getByLabel(/version name/i)).toHaveValue('Test Config v2');
    });

    test('can add and remove dimensions', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config/new');

      // Initially no dimensions
      await expect(page.getByTestId('dimension-card')).toHaveCount(0);

      // Add dimension
      await page.getByRole('button', { name: /add dimension/i }).click();
      await expect(page.getByTestId('dimension-card')).toHaveCount(1);

      // Add another dimension
      await page.getByRole('button', { name: /add dimension/i }).click();
      await expect(page.getByTestId('dimension-card')).toHaveCount(2);

      // Remove first dimension
      await page.getByTestId('remove-dimension-0').click();
      await expect(page.getByTestId('dimension-card')).toHaveCount(1);
    });

    test('displays weight validation warning when total is not 100', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config/new');

      // Add dimension with non-100 weight
      await page.getByRole('button', { name: /add dimension/i }).click();

      // Should show warning about weights
      await expect(page.getByTestId('weight-warning')).toBeVisible();
    });

    test('auto-balance distributes weights evenly', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config/new');

      // Add 5 dimensions
      for (let i = 0; i < 5; i++) {
        await page.getByRole('button', { name: /add dimension/i }).click();
      }

      // Click auto-balance
      await page.getByRole('button', { name: /auto-balance/i }).click();

      // Total should be 100
      await expect(page.getByTestId('total-weight')).toContainText('100%');
    });

    test('saves new config as inactive', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config/new');

      // Fill form
      await page.getByLabel(/version name/i).fill(`Test Config ${Date.now()}`);
      await page.getByLabel(/system prompt/i).fill('You are a test prompt analyzer.');

      // Add dimension
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Test Dimension');
      await page.getByTestId('dimension-0-prompt-template').fill('Evaluate test prompt');
      await page.getByTestId('dimension-0-scoring-criteria').fill('1-10 scoring');

      // Set weight to 100
      await page.getByTestId('dimension-0-weight-input').fill('100');

      // Save
      await page.getByRole('button', { name: /save config/i }).click();

      // Should redirect to detail page
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Should show as inactive
      await expect(page.getByTestId('inactive-badge')).toBeVisible();
    });

    test('prevents save if weights do not sum to 100', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/config/new');

      // Fill required fields
      await page.getByLabel(/version name/i).fill('Test Invalid Config');
      await page.getByLabel(/system prompt/i).fill('Test prompt');

      // Add dimension with weight not equal to 100
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Test Dimension');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('50');

      // Try to save
      await page.getByRole('button', { name: /save config/i }).click();

      // Should show error - use test id to be specific
      await expect(page.getByTestId('weight-warning')).toBeVisible();
    });
  });

  test.describe('Config Detail/Edit Page', () => {
    test('displays config details for inactive config', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Create a new config first
      await page.goto('/admin/config/new');
      const configName = `Test Detail Config ${Date.now()}`;
      await page.getByLabel(/version name/i).fill(configName);
      await page.getByLabel(/system prompt/i).fill('Test prompt for display');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Test Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/, { timeout: 15000 });

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Should see config details - the h2 title shows the config name
      await expect(page.getByRole('heading', { level: 2, name: configName })).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('config-system-prompt')).toBeVisible();
    });

    test('allows editing inactive config', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Create a new config first
      await page.goto('/admin/config/new');
      const configName = `Editable Config ${Date.now()}`;
      await page.getByLabel(/version name/i).fill(configName);
      await page.getByLabel(/system prompt/i).fill('Original prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Original Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Edit should be available for inactive config
      await expect(page.getByRole('button', { name: /edit/i })).toBeVisible();

      // Click edit
      await page.getByRole('button', { name: /edit/i }).click();

      // Should be in edit mode
      await expect(page.getByLabel(/version name/i)).toBeEditable();
    });

    test('shows Activate button for inactive configs', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Create a new config
      await page.goto('/admin/config/new');
      await page.getByLabel(/version name/i).fill(`Activate Test ${Date.now()}`);
      await page.getByLabel(/system prompt/i).fill('Test prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Activate button should be visible
      await expect(page.getByRole('button', { name: /activate/i })).toBeVisible();
    });
  });

  test.describe('Config Activation', () => {
    test('activating a config shows confirmation dialog', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Create and navigate to new config
      await page.goto('/admin/config/new');
      await page.getByLabel(/version name/i).fill(`Confirm Activate ${Date.now()}`);
      await page.getByLabel(/system prompt/i).fill('Test prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Click activate
      await page.getByRole('button', { name: /activate/i }).click();

      // Confirmation dialog should appear
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText(/are you sure/i)).toBeVisible();
    });

    test('confirming activation marks config as active', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Create new config
      await page.goto('/admin/config/new');
      const configName = `Active Config ${Date.now()}`;
      await page.getByLabel(/version name/i).fill(configName);
      await page.getByLabel(/system prompt/i).fill('Test prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Activate
      await page.getByRole('button', { name: /activate/i }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: /confirm/i }).click();

      // Should now show active badge
      await expect(page.getByTestId('active-badge')).toBeVisible();

      // Edit button should be hidden for active config
      await expect(page.getByRole('button', { name: /^edit$/i })).not.toBeVisible();
    });

    test('activating a config deactivates the previous one', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Create first config and activate it
      await page.goto('/admin/config/new');
      const config1Name = `First Config ${Date.now()}`;
      await page.getByLabel(/version name/i).fill(config1Name);
      await page.getByLabel(/system prompt/i).fill('First prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Dim1');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();

      // Wait for redirect to complete
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/, { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      const config1Url = page.url();

      await page.getByRole('button', { name: /activate/i }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: /confirm/i }).click();
      await expect(page.getByTestId('active-badge')).toBeVisible({ timeout: 10000 });

      // Create second config and activate it
      await page.goto('/admin/config/new');
      const config2Name = `Second Config ${Date.now()}`;
      await page.getByLabel(/version name/i).fill(config2Name);
      await page.getByLabel(/system prompt/i).fill('Second prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Dim2');
      await page.getByTestId('dimension-0-prompt-template').fill('Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();

      // Wait for redirect to complete
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/, { timeout: 15000 });
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /activate/i }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: /confirm/i }).click();
      await expect(page.getByTestId('active-badge')).toBeVisible({ timeout: 10000 });

      // Go back to first config - should now be inactive
      await page.goto(config1Url);
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('inactive-badge')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Config Duplication', () => {
    test('duplicating a config creates a copy', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Create a config
      await page.goto('/admin/config/new');
      const originalName = `Original Config ${Date.now()}`;
      await page.getByLabel(/version name/i).fill(originalName);
      await page.getByLabel(/system prompt/i).fill('Original system prompt');
      await page.getByRole('button', { name: /add dimension/i }).click();
      await page.getByTestId('dimension-0-name').fill('Original Dim');
      await page.getByTestId('dimension-0-prompt-template').fill('Original Template');
      await page.getByTestId('dimension-0-scoring-criteria').fill('Original Criteria');
      await page.getByTestId('dimension-0-weight-input').fill('100');
      await page.getByRole('button', { name: /save config/i }).click();
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);

      // Click duplicate
      await page.getByRole('button', { name: /duplicate/i }).click();

      // Should be on new config page with copied values
      await expect(page).toHaveURL(/\/admin\/config\/[a-f0-9-]+$/);
      await expect(page.getByText(/copy of/i)).toBeVisible();
    });
  });

  test.describe('Active Config is Read-Only', () => {
    test('active config cannot be edited', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Navigate to the default active config
      await page.goto('/admin/config');

      // Find and click on the active config
      const activeCard = page.getByTestId('config-version-card').filter({ has: page.getByTestId('active-badge') }).first();
      await activeCard.getByRole('link', { name: /view/i }).click();

      // Should not have edit button
      await expect(page.getByRole('button', { name: /^edit$/i })).not.toBeVisible();

      // Should show read-only indicator
      await expect(page.getByText(/read-only|active configs cannot be edited/i)).toBeVisible();
    });
  });
});
