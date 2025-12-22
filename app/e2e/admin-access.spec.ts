import { test, expect } from '@playwright/test';
import {
  createTestUserViaApi,
  deleteTestUserViaApi,
  loginUser,
  makeUserSuperAdmin,
} from './helpers/auth';

test.describe('Admin Access Control', () => {
  let adminUser: { email: string; password: string; id: string };
  let regularUser: { email: string; password: string; id: string };

  test.beforeAll(async () => {
    // Create test users via API
    adminUser = await createTestUserViaApi('admin-test');
    regularUser = await createTestUserViaApi('regular-test');

    // Make one user a super admin
    await makeUserSuperAdmin(adminUser.id);
  });

  test.afterAll(async () => {
    await deleteTestUserViaApi(adminUser.email);
    await deleteTestUserViaApi(regularUser.email);
  });

  test('super admin can access /admin routes', async ({ page }) => {
    await loginUser(page, adminUser.email, adminUser.password);

    // Navigate to admin
    await page.goto('/admin');

    // Should see admin dashboard
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByTestId('admin-dashboard')).toBeVisible();
  });

  test('non-admin user is redirected from /admin to /prompts', async ({ page }) => {
    await loginUser(page, regularUser.email, regularUser.password);

    // Try to access admin
    await page.goto('/admin');

    // Should be redirected to prompts with error param
    await expect(page).toHaveURL(/\/prompts/);
  });

  test('access denied toast appears for non-admin accessing /admin', async ({ page }) => {
    await loginUser(page, regularUser.email, regularUser.password);

    // Try to access admin
    await page.goto('/admin');

    // Should see access denied toast
    await expect(page.getByText(/Access denied/i)).toBeVisible({ timeout: 5000 });
  });

  test('unauthenticated user is redirected to login from /admin', async ({ page }) => {
    // Without logging in, try to access admin
    await page.goto('/admin');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin can navigate between admin sub-routes', async ({ page }) => {
    await loginUser(page, adminUser.email, adminUser.password);

    await page.goto('/admin');
    await expect(page.getByTestId('admin-dashboard')).toBeVisible();

    // Dashboard sidebar should be visible with admin navigation items
    await expect(page.getByTestId('dashboard-sidebar')).toBeVisible();
    // Admin nav items should be visible in the sidebar
    await expect(page.getByTestId('admin-nav-admin-overview')).toBeVisible();
  });

  test('admin status is cached for subsequent requests', async ({ page }) => {
    await loginUser(page, adminUser.email, adminUser.password);

    // First access - should work
    await page.goto('/admin');
    await expect(page.getByTestId('admin-dashboard')).toBeVisible();

    // Navigate away and back - should still work (cached)
    await page.goto('/prompts');
    await page.goto('/admin');
    await expect(page.getByTestId('admin-dashboard')).toBeVisible();
  });
});
