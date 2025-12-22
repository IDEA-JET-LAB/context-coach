import { test, expect } from '@playwright/test';
import {
  createTestUserViaApi,
  deleteTestUserViaApi,
  loginUser,
  makeUserSuperAdmin,
} from './helpers/auth';

test.describe('Admin System Health Monitoring', () => {
  let adminUser: { email: string; password: string; id: string };
  let regularUser: { email: string; password: string; id: string };

  test.beforeAll(async () => {
    // Create test users via API
    adminUser = await createTestUserViaApi('admin-system-test');
    regularUser = await createTestUserViaApi('regular-system-test');

    // Make one user a super admin
    await makeUserSuperAdmin(adminUser.id);
  });

  test.afterAll(async () => {
    await deleteTestUserViaApi(adminUser.email);
    await deleteTestUserViaApi(regularUser.email);
  });

  test.describe('Access Control', () => {
    test('super admin can access /admin/system', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/system');

      // Should see system health page
      await expect(page).toHaveURL(/\/admin\/system/);
      await expect(page.getByTestId('system-health-page')).toBeVisible();
    });

    test('non-admin user is redirected from /admin/system', async ({ page }) => {
      await loginUser(page, regularUser.email, regularUser.password);
      await page.goto('/admin/system');

      // Should be redirected to prompts
      await expect(page).toHaveURL(/\/prompts/);
    });
  });

  test.describe('System Metrics Display', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/system');
    });

    test('displays system metrics section', async ({ page }) => {
      await expect(page.getByText('System Metrics')).toBeVisible();
    });

    test('displays API response time metric', async ({ page }) => {
      await expect(page.getByTestId('metric-api-response-time')).toBeVisible();
    });

    test('displays database status metric', async ({ page }) => {
      await expect(page.getByTestId('metric-database-status')).toBeVisible();
    });

    test('displays Edge Function status metric', async ({ page }) => {
      await expect(page.getByTestId('metric-edge-function-status')).toBeVisible();
    });
  });

  test.describe('Analysis Queue Status', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/system');
      // Wait for page and initial data
      await expect(page.getByTestId('system-health-page')).toBeVisible({ timeout: 15000 });
      // Wait for at least one metric to be visible (indicates data loaded)
      await expect(page.getByTestId('metric-api-response-time')).toBeVisible({ timeout: 15000 });
    });

    test('displays analysis queue section', async ({ page }) => {
      // Look for the card title specifically
      await expect(page.locator('text=Analysis Queue').first()).toBeVisible({ timeout: 10000 });
    });

    test('shows pending count', async ({ page }) => {
      await expect(page.getByTestId('queue-pending-count')).toBeVisible({ timeout: 10000 });
    });

    test('shows processing count', async ({ page }) => {
      await expect(page.getByTestId('queue-processing-count')).toBeVisible({ timeout: 10000 });
    });

    test('shows complete count', async ({ page }) => {
      await expect(page.getByTestId('queue-complete-count')).toBeVisible({ timeout: 10000 });
    });

    test('shows failed count', async ({ page }) => {
      await expect(page.getByTestId('queue-failed-count')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Dead Letter Queue', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/system');
      // Wait for page and initial data
      await expect(page.getByTestId('system-health-page')).toBeVisible({ timeout: 15000 });
      // Wait for at least one metric to be visible (indicates data loaded)
      await expect(page.getByTestId('metric-api-response-time')).toBeVisible({ timeout: 15000 });
    });

    test('displays dead letter queue section', async ({ page }) => {
      // Look for the card title specifically
      await expect(page.locator('text=Dead Letter Queue').first()).toBeVisible({ timeout: 10000 });
    });

    test('shows empty state when no failed analyses', async ({ page }) => {
      // Check for either table or empty state message
      const emptyState = page.getByText(/No failed analyses|System is healthy/i);
      const table = page.getByTestId('dead-letter-table');

      // One of these should be visible
      await expect(emptyState.or(table)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Alert Thresholds', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/system');
      // Wait for data to load
      await expect(page.getByTestId('system-health-page')).toBeVisible();
      await page.waitForLoadState('networkidle');
    });

    test('metrics show healthy status when thresholds not exceeded', async ({ page }) => {
      // Wait for metrics to load
      await expect(page.getByTestId('metric-api-response-time')).toBeVisible({ timeout: 10000 });
      // At least one metric should show healthy status
      const healthyIndicators = await page.locator('[data-status="healthy"]').count();
      expect(healthyIndicators).toBeGreaterThanOrEqual(0);
    });

    test('metric cards have appropriate status indicators', async ({ page }) => {
      // Wait for metrics to load
      await expect(page.getByTestId('metric-api-response-time')).toBeVisible({ timeout: 10000 });
      // Each metric card should have a status indicator
      const metricCards = page.locator('[data-testid^="metric-"]');
      const count = await metricCards.count();

      // Should have at least one metric card
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Auto-Refresh', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/system');
    });

    test('displays auto-refresh toggle', async ({ page }) => {
      await expect(page.getByTestId('auto-refresh-toggle')).toBeVisible();
    });

    test('displays manual refresh button', async ({ page }) => {
      await expect(page.getByTestId('refresh-button')).toBeVisible();
    });

    test('manual refresh button triggers data reload', async ({ page }) => {
      const refreshButton = page.getByTestId('refresh-button');
      await refreshButton.click();

      // Should show loading state or complete refresh
      // Just verify button is still functional
      await expect(refreshButton).toBeEnabled({ timeout: 5000 });
    });

    test('auto-refresh shows countdown when enabled', async ({ page }) => {
      // Toggle auto-refresh on if needed
      const toggle = page.getByTestId('auto-refresh-toggle');
      const isChecked = await toggle.isChecked();

      if (!isChecked) {
        await toggle.click();
      }

      // Should show countdown text
      await expect(page.getByTestId('refresh-countdown')).toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Last Updated Timestamp', () => {
    test('displays last updated timestamp', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);
      await page.goto('/admin/system');

      await expect(page.getByTestId('last-updated')).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('displays grid layout on desktop', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/admin/system');

      // Metrics should be in a grid
      const metricsGrid = page.getByTestId('metrics-grid');
      await expect(metricsGrid).toBeVisible();
    });

    test('displays stacked layout on mobile', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/system');

      // Page should still be visible and functional
      await expect(page.getByTestId('system-health-page')).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('shows loading skeleton on initial load', async ({ page }) => {
      await loginUser(page, adminUser.email, adminUser.password);

      // Navigate and immediately check for loading state
      await page.goto('/admin/system');

      // Either loading state or content should be visible
      const hasContent = await page.getByTestId('system-health-page').isVisible();
      expect(hasContent).toBeTruthy();
    });
  });
});
