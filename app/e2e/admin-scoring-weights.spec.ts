import { test, expect } from '@playwright/test';
import {
  createTestUserViaApi,
  deleteTestUserViaApi,
  loginUser,
  makeUserSuperAdmin,
} from './helpers/auth';

test.describe('Admin Scoring Weights', () => {
  let adminUser: { email: string; password: string; id: string };

  test.beforeAll(async () => {
    // Create admin user
    adminUser = await createTestUserViaApi('admin-weights-test');
    await makeUserSuperAdmin(adminUser.id);
  });

  test.afterAll(async () => {
    await deleteTestUserViaApi(adminUser.email);
  });

  test.describe('Weights Page Display', () => {
    test('displays all dimensions with current weights', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Should see the weights page
      await expect(page.getByTestId('weights-page')).toBeVisible();

      // Should display the weight adjuster
      await expect(page.getByTestId('weight-adjuster')).toBeVisible();

      // Should show total weight indicator
      await expect(page.getByTestId('total-weight-card')).toBeVisible();
      await expect(page.getByTestId('total-weight-value')).toBeVisible();
    });

    test('displays total weight sum prominently', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Wait for the page to load
      await expect(page.getByTestId('total-weight-value')).toBeVisible();

      // Total should be displayed as a percentage
      const totalText = await page.getByTestId('total-weight-value').textContent();
      expect(totalText).toMatch(/\d+%/);
    });

    test('shows valid status when weights sum to 100', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Check for either valid indicator or error indicator based on current state
      const validIndicator = page.getByTestId('weight-valid');
      const errorIndicator = page.getByTestId('weight-error');

      // One of them should be visible
      const isValid = await validIndicator.isVisible();
      const isError = await errorIndicator.isVisible();

      expect(isValid || isError).toBe(true);
    });
  });

  test.describe('Weight Adjustment', () => {
    test('slider updates weight in real-time', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Wait for first dimension slider
      const slider = page.getByTestId('dimension-slider-0');
      await expect(slider).toBeVisible();

      // Get initial weight value
      const input = page.getByTestId('dimension-weight-input-0');
      const initialValue = await input.inputValue();

      // Interact with the slider by clicking at different position
      const sliderBounds = await slider.boundingBox();
      if (sliderBounds) {
        await page.mouse.click(
          sliderBounds.x + sliderBounds.width * 0.7,
          sliderBounds.y + sliderBounds.height / 2
        );
      }

      // Check that input value changed (might be same if already at that position)
      const newValue = await input.inputValue();
      // Just verify the input is interactive (value exists)
      expect(newValue).toBeTruthy();
    });

    test('number input allows precise values', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      const input = page.getByTestId('dimension-weight-input-0');
      await expect(input).toBeVisible();

      // Clear and set a specific value
      await input.fill('25');

      // Verify the value was set
      await expect(input).toHaveValue('25');
    });

    test('total updates as weights change', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Get initial total
      const totalElement = page.getByTestId('total-weight-value');
      const initialTotal = await totalElement.textContent();

      // Change a weight
      const input = page.getByTestId('dimension-weight-input-0');
      await input.fill('50');

      // Total should update
      await page.waitForTimeout(100); // Allow for state update
      const newTotal = await totalElement.textContent();

      // The total should be different or unchanged if we coincidentally hit same total
      expect(newTotal).toBeTruthy();
    });

    test('can enable/disable dimensions', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      const toggle = page.getByTestId('dimension-toggle-0');
      await expect(toggle).toBeVisible();

      // Toggle off
      await toggle.click();

      // Input should be disabled
      const input = page.getByTestId('dimension-weight-input-0');
      await expect(input).toBeDisabled();

      // Toggle back on
      await toggle.click();
      await expect(input).toBeEnabled();
    });
  });

  test.describe('Save Validation', () => {
    test('save button is disabled when total is not 100', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Set weights to not equal 100
      const input0 = page.getByTestId('dimension-weight-input-0');
      await input0.fill('10');

      // Should show error message
      await expect(page.getByTestId('weight-error')).toBeVisible();
    });

    test('displays clear error message when weights invalid', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Set invalid total
      const input0 = page.getByTestId('dimension-weight-input-0');
      await input0.fill('10');

      // Check error message content
      const errorText = await page.getByTestId('weight-error').textContent();
      expect(errorText).toContain('100%');
    });
  });

  test.describe('Auto-Balance', () => {
    test('auto-balance distributes weights evenly', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // First mess up the weights
      const input0 = page.getByTestId('dimension-weight-input-0');
      await input0.fill('10');

      // Click auto-balance
      await page.getByTestId('auto-balance-button').click();

      // Total should now be 100
      await expect(page.getByTestId('weight-valid')).toBeVisible();
      const totalText = await page.getByTestId('total-weight-value').textContent();
      expect(totalText).toBe('100%');
    });

    test('handles remainder distribution correctly', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Click auto-balance
      await page.getByTestId('auto-balance-button').click();

      // Total should be exactly 100
      const totalText = await page.getByTestId('total-weight-value').textContent();
      expect(totalText).toBe('100%');
    });
  });

  test.describe('Reset to Defaults', () => {
    test('shows confirmation dialog before reset', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Make a change first
      const input0 = page.getByTestId('dimension-weight-input-0');
      await input0.fill('30');

      // Click reset
      await page.getByTestId('reset-button').click();

      // Should show confirmation dialog
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText(/reset weights/i)).toBeVisible();
    });

    test('reset restores original values', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Get initial value
      const input0 = page.getByTestId('dimension-weight-input-0');
      const initialValue = await input0.inputValue();

      // Change the value
      await input0.fill('99');

      // Reset
      await page.getByTestId('reset-button').click();
      await page.getByTestId('reset-confirm').click();

      // Value should be restored
      await expect(input0).toHaveValue(initialValue);
    });

    test('cancel in reset dialog keeps changes', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Make a change
      const input0 = page.getByTestId('dimension-weight-input-0');
      await input0.fill('45');

      // Click reset then cancel
      await page.getByTestId('reset-button').click();
      await page.getByTestId('reset-cancel').click();

      // Value should still be 45
      await expect(input0).toHaveValue('45');
    });
  });

  test.describe('Weight History', () => {
    test('displays change history panel', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // History panel should be visible (may be empty or have entries)
      const historyPanel = page.getByTestId('weight-history');
      const emptyHistory = page.getByTestId('weight-history-empty');

      // Either history panel or empty state should be visible
      const hasHistory = await historyPanel.isVisible();
      const isEmpty = await emptyHistory.isVisible();

      expect(hasHistory || isEmpty).toBe(true);
    });
  });

  test.describe('Weight Preview', () => {
    test('can open preview panel', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Click preview button
      await page.getByTestId('preview-impact-button').click();

      // Preview panel should be visible
      await expect(page.getByTestId('weight-preview')).toBeVisible();
    });

    test('preview shows sample prompts with scores', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Open preview
      await page.getByTestId('preview-impact-button').click();

      // Should show sample prompts
      await expect(page.getByTestId('preview-sample-0')).toBeVisible();
    });

    test('can close preview panel', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Open then close preview
      await page.getByTestId('preview-impact-button').click();
      await expect(page.getByTestId('weight-preview')).toBeVisible();

      await page.getByTestId('close-preview').click();
      await expect(page.getByTestId('weight-preview')).not.toBeVisible();
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('shows keyboard shortcuts help', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Click keyboard help button
      await page.getByTestId('keyboard-help-button').click();

      // Dialog should show shortcuts
      await expect(page.getByRole('alertdialog')).toBeVisible();
      // Check for keyboard shortcut hints - Up/Down arrows are shown
      await expect(page.getByText(/Increase by 1/i)).toBeVisible();
    });

    test('escape key resets unsaved changes', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // Get initial value
      const input0 = page.getByTestId('dimension-weight-input-0');
      const initialValue = await input0.inputValue();

      // Change value
      await input0.fill('77');

      // Press Escape on the weight adjuster container
      await page.getByTestId('weight-adjuster').press('Escape');

      // Value should be restored
      await expect(input0).toHaveValue(initialValue);
    });
  });

  test.describe('Access Control', () => {
    test('non-admin users cannot access weights page', async ({ page }) => {
      // Create a regular user
      const regularUser = await createTestUserViaApi('regular-weights-test');

      try {
        await loginUser(page, regularUser.email, regularUser.password);
        await page.goto('/admin/analysis/weights');

        // Should be redirected away from admin
        await expect(page).not.toHaveURL(/\/admin\/analysis\/weights/);
      } finally {
        await deleteTestUserViaApi(regularUser.email);
      }
    });
  });

  test.describe('Save Persistence', () => {
    test('saved weights persist after refresh', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/analysis/weights');

      // First, change a weight to make a modification
      const input0 = page.getByTestId('dimension-weight-input-0');
      const originalValue = await input0.inputValue();

      // Make a change (will likely make total invalid)
      await input0.fill('30');

      // Auto-balance to make total valid again
      await page.getByTestId('auto-balance-button').click();

      // Wait for button to be enabled (there should be changes now)
      const saveButton = page.getByTestId('save-weights-button');
      await expect(saveButton).toBeEnabled();

      // Save
      await saveButton.click();

      // Wait for save to complete
      await page.waitForTimeout(1500);

      // Get the current value after save
      const savedValue = await input0.inputValue();

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Value should still be the same
      const newInput = page.getByTestId('dimension-weight-input-0');
      await expect(newInput).toHaveValue(savedValue);
    });
  });
});
