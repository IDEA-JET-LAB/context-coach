import { test, expect } from '@playwright/test';
import { createTestUserViaApi, loginUser, makeUserSuperAdmin } from './helpers/auth';

test.describe('Admin Feedback Tab', () => {
  let testUser: { email: string; password: string; id: string };

  test.beforeAll(async () => {
    // Create test user and make them super admin
    testUser = await createTestUserViaApi('feedback-admin');
    await makeUserSuperAdmin(testUser.id);
  });

  test('admin can access feedback tab and see feedback table', async ({ page }) => {
    // Login as admin user
    await loginUser(page, testUser.email, testUser.password);

    // Navigate to admin settings feedback tab
    await page.goto('/admin/settings?tab=feedback');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should see the feedback tab heading
    await expect(page.getByRole('heading', { name: 'User Feedback' })).toBeVisible({ timeout: 10000 });

    // Should see the description text
    await expect(page.getByText('View and manage feedback submitted by users')).toBeVisible();

    // Should see the feedback table
    await expect(page.getByTestId('feedback-table')).toBeVisible({ timeout: 10000 });

    // Should see filter controls
    await expect(page.getByText('Category:')).toBeVisible();
    await expect(page.getByText('Status:')).toBeVisible();
  });

  test('feedback table displays existing feedback entries', async ({ page }) => {
    // Login as admin user
    await loginUser(page, testUser.email, testUser.password);

    // Navigate to admin settings feedback tab
    await page.goto('/admin/settings?tab=feedback');

    // Wait for table to load
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('feedback-table')).toBeVisible({ timeout: 10000 });

    // Should display at least the test feedback we submitted earlier
    // Look for table rows (either data or "No feedback found" message)
    const tableBody = page.locator('[data-testid="feedback-table"] tbody');
    await expect(tableBody).toBeVisible();

    // Check that either we have feedback entries or the "No feedback found" message
    const rows = tableBody.locator('tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('can filter feedback by category', async ({ page }) => {
    // Login as admin user
    await loginUser(page, testUser.email, testUser.password);

    // Navigate to admin settings feedback tab
    await page.goto('/admin/settings?tab=feedback');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('feedback-filters')).toBeVisible({ timeout: 10000 });

    // Click category filter dropdown
    const categorySelect = page.locator('[data-testid="feedback-filters"]').getByRole('combobox').first();
    await categorySelect.click();

    // Select "Suggestion" category
    await page.getByRole('option', { name: 'Suggestion' }).click();

    // URL should update with category parameter
    await expect(page).toHaveURL(/category=suggestion/);
  });

  test('can filter feedback by status', async ({ page }) => {
    // Login as admin user
    await loginUser(page, testUser.email, testUser.password);

    // Navigate to admin settings feedback tab
    await page.goto('/admin/settings?tab=feedback');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('feedback-filters')).toBeVisible({ timeout: 10000 });

    // Click status filter dropdown (second combobox)
    const statusSelect = page.locator('[data-testid="feedback-filters"]').getByRole('combobox').nth(1);
    await statusSelect.click();

    // Select "New" status
    await page.getByRole('option', { name: 'New' }).click();

    // URL should update with status parameter
    await expect(page).toHaveURL(/status=new/);
  });
});
