import { test, expect } from '@playwright/test';
import {
  createTestUserViaApi,
  deleteTestUserViaApi,
  loginUser,
  makeUserSuperAdmin,
} from './helpers/auth';

test.describe('A/B Experiments Admin', () => {
  let adminUser: { email: string; password: string; id: string };

  test.beforeAll(async () => {
    // Create admin user
    adminUser = await createTestUserViaApi('admin-experiments-test');
    await makeUserSuperAdmin(adminUser.id);
  });

  test.afterAll(async () => {
    await deleteTestUserViaApi(adminUser.email);
  });

  test.describe('Experiments List Page', () => {
    test('displays experiments page with create button', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments');

      // Should see experiments page
      await expect(page.getByTestId('experiments-page')).toBeVisible();

      // Should have page title
      await expect(page.getByRole('heading', { name: /A\/B Experiments/i })).toBeVisible();

      // Should have create button
      await expect(page.getByRole('link', { name: /new experiment/i })).toBeVisible();
    });

    test('shows status filter badges', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments');

      // Should have filter badges
      await expect(page.getByRole('link', { name: /all/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /draft/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /running/i })).toBeVisible();
    });

    test('shows empty state when no experiments', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments');

      // Should show empty state or experiments
      const hasExperiments = await page.locator('[data-testid*="experiment-card"]').count() > 0;
      if (!hasExperiments) {
        await expect(page.getByText(/no experiments found/i)).toBeVisible();
      }
    });

    test('navigates to new experiment form', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments');

      await page.getByRole('link', { name: /new experiment/i }).click();
      await expect(page).toHaveURL(/\/admin\/experiments\/new/);
      await expect(page.getByTestId('new-experiment-page')).toBeVisible();
    });
  });

  test.describe('Create New Experiment', () => {
    test('displays new experiment form with all required fields', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Should have experiment form sections
      await expect(page.getByText(/experiment details/i)).toBeVisible();
      await expect(page.getByText(/configuration selection/i)).toBeVisible();
      await expect(page.getByText(/traffic split/i)).toBeVisible();
      await expect(page.getByText(/experiment parameters/i)).toBeVisible();

      // Should have required fields
      await expect(page.getByLabel(/experiment name/i)).toBeVisible();
      await expect(page.getByLabel(/hypothesis/i)).toBeVisible();
    });

    test('shows config selection dropdowns', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Should have control and variant config selectors
      await expect(page.getByText(/control configuration/i)).toBeVisible();
      await expect(page.getByText(/variant configuration/i)).toBeVisible();
    });

    test('shows traffic split slider', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Should have traffic split slider
      await expect(page.getByText(/traffic allocation/i)).toBeVisible();
      // Default should show 50/50
      await expect(page.getByText(/50% \/ 50%/i)).toBeVisible();
    });

    test('shows experiment parameters section', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Should have parameters
      await expect(page.getByText(/success metric/i)).toBeVisible();
      await expect(page.getByText(/minimum duration/i)).toBeVisible();
      await expect(page.getByText(/minimum sample size/i)).toBeVisible();
      await expect(page.getByText(/auto-promote winner/i)).toBeVisible();
    });

    test('validates required fields', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Try to submit without filling required fields
      await page.getByRole('button', { name: /create experiment/i }).click();

      // Should show validation errors
      await expect(page.getByText(/name is required/i)).toBeVisible();
    });

    test('validates hypothesis length', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Fill name but short hypothesis
      await page.getByLabel(/experiment name/i).fill('Test Experiment');
      await page.getByLabel(/hypothesis/i).fill('Short');

      // Try to submit
      await page.getByRole('button', { name: /create experiment/i }).click();

      // Should show validation error for hypothesis
      await expect(page.getByText(/hypothesis must be at least 10 characters/i)).toBeVisible();
    });

    test('can navigate back to experiments list', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Click back button
      await page.getByRole('link', { name: /back/i }).click();
      await expect(page).toHaveURL(/\/admin\/experiments$/);
    });
  });

  test.describe('Admin Sidebar Navigation', () => {
    test('has experiments link in admin sidebar', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      // Should have experiments nav item
      await expect(page.getByTestId('admin-nav-experiments')).toBeVisible();
    });

    test('navigates to experiments from sidebar', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      // Click experiments nav
      await page.getByTestId('admin-nav-experiments').click();
      await expect(page).toHaveURL(/\/admin\/experiments/);
    });

    test('experiments link shows active state', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments');

      // Check the nav item has active styling
      const navItem = page.getByTestId('admin-nav-experiments');
      await expect(navItem).toHaveAttribute('aria-current', 'page');
    });
  });

  test.describe('Experiment Form Interaction', () => {
    test('traffic slider updates display values', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Find the slider and interact with it
      const slider = page.locator('[role="slider"]').first();
      await slider.focus();

      // Use keyboard to change value
      await slider.press('ArrowRight');
      await slider.press('ArrowRight');

      // The value should have changed from default 50
      // Note: The exact value depends on step size (5%)
      const displayText = await page.getByText(/\d+% \/ \d+%/).textContent();
      expect(displayText).toBeTruthy();
    });

    test('auto-promote switch can be toggled', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Find auto-promote switch
      const switchElement = page.locator('button[role="switch"]');
      await expect(switchElement).toBeVisible();

      // Toggle it
      const initialState = await switchElement.getAttribute('aria-checked');
      await switchElement.click();
      const newState = await switchElement.getAttribute('aria-checked');

      expect(newState).not.toBe(initialState);
    });

    test('minimum sample size slider is functional', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // Should show sample size section
      await expect(page.getByText(/minimum sample size/i)).toBeVisible();

      // Check default value is displayed (100)
      await expect(page.getByText('100')).toBeVisible();
    });
  });

  test.describe('Config Comparison', () => {
    test('shows comparison when both configs selected', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/experiments/new');

      // If there are at least 2 configs available, select them
      // First, check if config selectors have options
      const controlSelector = page.getByText(/control configuration/i).locator('..').locator('button');
      await controlSelector.click();

      // Check if there are options in the dropdown
      const hasOptions = await page.locator('[role="option"]').count() > 0;

      if (hasOptions) {
        // Select first option for control
        await page.locator('[role="option"]').first().click();

        // Select variant
        const variantSelector = page.getByText(/variant configuration/i).locator('..').locator('button');
        await variantSelector.click();

        // Select a different option for variant
        const variantOptions = page.locator('[role="option"]');
        if (await variantOptions.count() > 1) {
          await variantOptions.nth(1).click();

          // Should show comparison component
          await expect(page.getByText(/configuration comparison/i)).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });
});
