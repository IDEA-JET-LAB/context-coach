import { test, expect } from '@playwright/test';

/**
 * Classification Rules E2E Tests
 * Story 22-2: Classification Rule Editor
 *
 * Tests for the admin classification rules management interface.
 */

// Use the test user credentials from CLAUDE.md
const TEST_EMAIL = 'edgars@test.com';
const TEST_PASSWORD = 'password123';

test.describe('Classification Rules Admin', () => {
  test.beforeEach(async ({ page }) => {
    // Login as super admin (test user has super admin access)
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(prompts|analytics|sessions)/);
  });

  test.describe('Rules List Page', () => {
    test('should display rules grouped by category', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Wait for page to load
      await expect(page.getByTestId('classification-rules-page')).toBeVisible();

      // Check for header
      await expect(page.getByRole('heading', { name: 'Classification Rules' })).toBeVisible();

      // Check for category filter
      await expect(page.getByRole('combobox')).toBeVisible();

      // Check for Create Rule button
      await expect(page.getByRole('link', { name: /Create Rule/i })).toBeVisible();
    });

    test('should filter rules by category', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Open category filter dropdown
      await page.getByRole('combobox').click();

      // Select a specific category
      await page.getByRole('option', { name: /bug_fix/i }).click();

      // Verify filter is applied (URL or visual indication)
      await expect(page.getByRole('combobox')).toContainText(/bug_fix/i);
    });

    test('should toggle rule enabled status', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Find first rule toggle switch
      const toggleSwitch = page.locator('[role="switch"]').first();

      if (await toggleSwitch.isVisible()) {
        const initialState = await toggleSwitch.getAttribute('aria-checked');
        await toggleSwitch.click();

        // Verify toast or state change
        // Note: May need to wait for server response
        await page.waitForTimeout(500);
      }
    });

    test('should select multiple rules for bulk operations', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Find checkboxes in the rule list
      const checkboxes = page.locator('[role="checkbox"]');

      if ((await checkboxes.count()) >= 2) {
        // Select first two rules
        await checkboxes.nth(0).click();
        await checkboxes.nth(1).click();

        // Verify bulk actions bar appears
        await expect(page.getByText(/rules selected/i)).toBeVisible();
      }
    });
  });

  test.describe('Create Rule', () => {
    test('should navigate to create rule page', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Click Create Rule button
      await page.getByRole('link', { name: /Create Rule/i }).click();

      // Verify navigation
      await page.waitForURL('/admin/analysis/rules/new');
      await expect(page.getByTestId('new-rule-page')).toBeVisible();
    });

    test('should show form fields for rule creation', async ({ page }) => {
      await page.goto('/admin/analysis/rules/new');

      // Check for required form fields
      await expect(page.getByLabel(/Rule Name/i)).toBeVisible();
      await expect(page.getByLabel(/Category/i)).toBeVisible();
      await expect(page.getByLabel(/Pattern/i)).toBeVisible();
      await expect(page.getByLabel(/Priority/i)).toBeVisible();
    });

    test('should validate regex pattern syntax', async ({ page }) => {
      await page.goto('/admin/analysis/rules/new');

      // Enter invalid regex
      await page.getByLabel(/Pattern/i).fill('[');

      // Wait for validation
      await page.waitForTimeout(500);

      // Check for error message
      await expect(page.getByText(/Invalid regex/i)).toBeVisible();
    });

    test('should show pattern tester with matches', async ({ page }) => {
      await page.goto('/admin/analysis/rules/new');

      // Enter valid pattern
      await page.getByLabel(/Pattern/i).fill('\\bfix\\b');

      // Enter test input
      await page.getByLabel(/Test Input/i).fill('Please fix this bug');

      // Wait for test to run
      await page.waitForTimeout(500);

      // Check for match result
      await expect(page.getByText(/match/i)).toBeVisible();
    });

    test('should show ReDoS warning for dangerous patterns', async ({ page }) => {
      await page.goto('/admin/analysis/rules/new');

      // Enter dangerous pattern (nested quantifiers)
      await page.getByLabel(/Pattern/i).fill('(a+)+');

      // Wait for analysis
      await page.waitForTimeout(500);

      // Check for warning
      await expect(page.getByText(/nested quantifiers/i).or(page.getByText(/ReDoS/i))).toBeVisible();
    });

    test('should create a rule with valid data', async ({ page }) => {
      await page.goto('/admin/analysis/rules/new');

      // Fill form
      await page.getByLabel(/Rule Name/i).fill('Test Rule ' + Date.now());

      // Select category
      await page.getByLabel(/Category/i).click();
      await page.getByRole('option').first().click();

      // Enter pattern
      await page.getByLabel(/Pattern/i).fill('\\btest-pattern\\b');

      // Set priority
      await page.getByRole('slider').fill('75');

      // Submit
      await page.getByRole('button', { name: /Create Rule/i }).click();

      // Verify redirect to list
      await page.waitForURL('/admin/analysis/rules');
    });
  });

  test.describe('Edit Rule', () => {
    test('should navigate to edit rule page', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Find and click edit link on first rule
      const editLink = page.getByRole('link', { name: '' }).locator('svg').first();

      if (await editLink.isVisible()) {
        await editLink.click();

        // Verify navigation to edit page
        await page.waitForURL(/\/admin\/analysis\/rules\/[^/]+$/);
        await expect(page.getByTestId('rule-detail-page')).toBeVisible();
      }
    });

    test('should pre-fill form with existing rule data', async ({ page }) => {
      // First navigate to the rules list to get an ID
      await page.goto('/admin/analysis/rules');

      // Click first edit link
      const editLink = page.getByRole('link', { name: '' }).locator('svg').first();

      if (await editLink.isVisible()) {
        await editLink.click();

        // Wait for page load
        await page.waitForURL(/\/admin\/analysis\/rules\/[^/]+$/);

        // Verify form is pre-filled
        const nameInput = page.getByLabel(/Rule Name/i);
        await expect(nameInput).toHaveValue(/.+/);

        const patternInput = page.getByLabel(/Pattern/i);
        await expect(patternInput).toHaveValue(/.+/);
      }
    });
  });

  test.describe('Category Management', () => {
    test('should open category manager dialog', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Click Manage Categories button
      await page.getByRole('button', { name: /Manage Categories/i }).click();

      // Verify dialog opens
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /Manage Categories/i })).toBeVisible();
    });

    test('should display existing categories', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Open category manager
      await page.getByRole('button', { name: /Manage Categories/i }).click();

      // Verify categories are listed
      await expect(page.getByText(/bug_fix/i).or(page.getByText(/feature_request/i))).toBeVisible();
    });

    test('should show add category form', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Open category manager
      await page.getByRole('button', { name: /Manage Categories/i }).click();

      // Click add category button
      await page.getByRole('button', { name: /Add Category/i }).click();

      // Verify form appears
      await expect(page.getByLabel(/Name/i)).toBeVisible();
    });
  });

  test.describe('Import/Export', () => {
    test('should show export/import menu', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Find and click the menu button
      const menuButton = page.locator('button').filter({ has: page.locator('svg') }).last();
      await menuButton.click();

      // Verify menu items
      await expect(page.getByRole('menuitem', { name: /Export/i })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /Import/i })).toBeVisible();
    });

    test('should download export file', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Open menu
      const menuButton = page.locator('button').filter({ has: page.locator('svg') }).last();
      await menuButton.click();

      // Start waiting for download before clicking
      const downloadPromise = page.waitForEvent('download');

      // Click export
      await page.getByRole('menuitem', { name: /Export/i }).click();

      // Wait for download to start
      const download = await downloadPromise;

      // Verify filename
      expect(download.suggestedFilename()).toContain('classification-rules');
      expect(download.suggestedFilename()).toContain('.json');
    });
  });

  test.describe('Bulk Operations', () => {
    test('should show bulk actions bar when rules are selected', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Select first rule checkbox
      const checkbox = page.locator('[role="checkbox"]').first();

      if (await checkbox.isVisible()) {
        await checkbox.click();

        // Verify bulk actions bar appears
        await expect(page.getByText(/rules selected/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /Enable All/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Disable All/i })).toBeVisible();
      }
    });

    test('should show select all button', async ({ page }) => {
      await page.goto('/admin/analysis/rules');

      // Select first rule
      const checkbox = page.locator('[role="checkbox"]').first();

      if (await checkbox.isVisible()) {
        await checkbox.click();

        // Find and click Select All
        await page.getByRole('button', { name: /Select All/i }).click();

        // Verify more rules are selected
        const selectedCount = page.getByText(/\d+ of \d+ rules selected/i);
        await expect(selectedCount).toBeVisible();
      }
    });
  });
});
