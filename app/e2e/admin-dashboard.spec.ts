import { test, expect } from '@playwright/test';
import {
  createTestUserViaApi,
  deleteTestUserViaApi,
  loginUser,
  makeUserSuperAdmin,
} from './helpers/auth';

test.describe('Admin Dashboard Overview', () => {
  let adminUser: { email: string; password: string; id: string };

  test.beforeAll(async () => {
    // Create a single admin user for all tests
    adminUser = await createTestUserViaApi('admin-dashboard-test');
    await makeUserSuperAdmin(adminUser.id);
  });

  test.afterAll(async () => {
    if (adminUser?.email) {
      await deleteTestUserViaApi(adminUser.email);
    }
  });

  test.describe('Metric Cards', () => {
    test('displays total users count', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      // Wait for dashboard to load
      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      // Check for total users stat card
      const usersCard = page.getByTestId('stat-total-users');
      await expect(usersCard).toBeVisible();

      // Should display a number >= 1 (at least our test user exists)
      const value = await usersCard.getByTestId('stat-value').textContent();
      expect(parseInt(value?.replace(/,/g, '') || '0')).toBeGreaterThanOrEqual(1);
    });

    test('displays total teams count', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const teamsCard = page.getByTestId('stat-total-teams');
      await expect(teamsCard).toBeVisible();

      const value = await teamsCard.getByTestId('stat-value').textContent();
      // Teams count can be 0 or more
      expect(parseInt(value?.replace(/,/g, '') || '0')).toBeGreaterThanOrEqual(0);
    });

    test('displays total prompts count', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const promptsCard = page.getByTestId('stat-total-prompts');
      await expect(promptsCard).toBeVisible();

      // Prompts count can be 0 or more
      const value = await promptsCard.getByTestId('stat-value').textContent();
      expect(parseInt(value?.replace(/,/g, '') || '0')).toBeGreaterThanOrEqual(0);
    });

    test('displays prompts today count', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const todayCard = page.getByTestId('stat-prompts-today');
      await expect(todayCard).toBeVisible();

      const value = await todayCard.getByTestId('stat-value').textContent();
      expect(parseInt(value?.replace(/,/g, '') || '0')).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Trend Indicators', () => {
    test('displays trend percentage for prompts', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const promptsCard = page.getByTestId('stat-total-prompts');
      await expect(promptsCard).toBeVisible();

      // Check for trend indicator
      const trendIndicator = promptsCard.getByTestId('stat-trend');
      await expect(trendIndicator).toBeVisible();

      // Should show percentage with vs last period text
      await expect(trendIndicator).toContainText(/vs last period/i);
    });

    test('trend arrow shows correct direction', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const promptsCard = page.getByTestId('stat-total-prompts');

      // Wait for the trend indicator to be visible (data loaded)
      const trendIndicator = promptsCard.getByTestId('stat-trend');
      await expect(trendIndicator).toBeVisible({ timeout: 10000 });

      // Should have an arrow icon (up, down, or neutral) - wait for SVG to render
      await expect(trendIndicator.locator('svg').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('System Health Indicators', () => {
    test('displays analysis success rate', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const successRateCard = page.getByTestId('health-success-rate');
      await expect(successRateCard).toBeVisible();

      // Should show percentage
      await expect(successRateCard).toContainText('%');
    });

    test('displays average analysis time', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const avgTimeCard = page.getByTestId('health-avg-time');
      await expect(avgTimeCard).toBeVisible();

      // Should show time unit (s for seconds)
      await expect(avgTimeCard).toContainText('s');
    });

    test('displays API error rate', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const errorRateCard = page.getByTestId('health-error-rate');
      await expect(errorRateCard).toBeVisible();

      // Should show percentage
      await expect(errorRateCard).toContainText('%');
    });

    test('health indicators have status icon', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const successRateCard = page.getByTestId('health-success-rate');
      await expect(successRateCard).toBeVisible();

      // Should have a status icon
      const statusIcon = successRateCard.locator('[data-testid="health-status-icon"]');
      await expect(statusIcon).toBeVisible();
    });

    test('health indicators show tooltip on info hover', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const successRateCard = page.getByTestId('health-success-rate');
      const infoIcon = successRateCard.locator('[data-testid="health-info-icon"]');

      await infoIcon.hover();

      // Tooltip should appear
      await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Responsive Layout', () => {
    test('displays metrics grid on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      // Metrics grid should be visible
      const metricsGrid = page.getByTestId('metrics-grid');
      await expect(metricsGrid).toBeVisible();
    });

    test('displays metrics grid on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      // Metrics grid should be visible
      const metricsGrid = page.getByTestId('metrics-grid');
      await expect(metricsGrid).toBeVisible();
    });
  });

  test.describe('Section Headers', () => {
    test('displays Platform Overview section', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();
      await expect(page.getByText('Platform Overview')).toBeVisible();
    });

    test('displays System Health section', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();
      await expect(page.getByText('System Health')).toBeVisible();
    });

    test('displays last updated timestamp', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();
      await expect(page.getByTestId('last-updated')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('stat cards have proper ARIA role and label', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const usersCard = page.getByTestId('stat-total-users');
      await expect(usersCard).toHaveAttribute('role', 'status');

      const ariaLabel = await usersCard.getAttribute('aria-label');
      expect(ariaLabel).toContain('Total Users');
    });

    test('health indicators have proper ARIA role', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin');

      await expect(page.getByTestId('admin-dashboard')).toBeVisible();

      const successRateCard = page.getByTestId('health-success-rate');
      await expect(successRateCard).toHaveAttribute('role', 'status');
    });
  });

  test.describe('Error Handling', () => {
    test('dashboard renders even with API errors', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Mock API failure for stats
      await page.route('**/api/admin/stats', route =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Error' }) })
      );

      await page.goto('/admin');

      // Dashboard should still render
      await expect(page.getByTestId('admin-dashboard')).toBeVisible();
    });
  });
});
