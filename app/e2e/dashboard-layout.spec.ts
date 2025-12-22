import { test, expect } from '@playwright/test';
import { createUserWithTeam, generateTestEmail, loginUser } from './helpers/auth';

const testPassword = 'TestPassword123!';

test.describe('Dashboard Layout & Navigation', () => {
  test.describe('Layout Structure', () => {
    test('should display sidebar, header, and main content area', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Verify sidebar exists and is 64px wide
      const sidebar = page.getByTestId('dashboard-sidebar');
      await expect(sidebar).toBeVisible();
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox?.width).toBe(64);

      // Verify header exists
      const header = page.getByTestId('dashboard-header');
      await expect(header).toBeVisible();

      // Verify main content area exists
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('should have dark mode styling with correct background color', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Check that the layout has the dark background
      const layoutDiv = page.locator('div.bg-\\[\\#0a0a0a\\]').first();
      await expect(layoutDiv).toBeVisible();
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display all navigation icons with tooltips', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Check all navigation items exist
      await expect(page.getByTestId('nav-feed')).toBeVisible();
      await expect(page.getByTestId('nav-analytics')).toBeVisible();
      await expect(page.getByTestId('nav-team')).toBeVisible();
      await expect(page.getByTestId('nav-projects')).toBeVisible();
      await expect(page.getByTestId('nav-settings')).toBeVisible();

      // Check tooltips appear on hover
      await page.getByTestId('nav-analytics').hover();
      await expect(page.getByText('Analytics')).toBeVisible();
    });

    test('should navigate to Feed section', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Navigate to Feed (prompts) page
      await page.getByTestId('nav-feed').click();
      await expect(page).toHaveURL('/prompts');
      await expect(page.getByRole('heading', { name: 'Prompt Feed' })).toBeVisible();
    });

    test('should navigate to Analytics section', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      await page.getByTestId('nav-analytics').click();
      await expect(page).toHaveURL('/analytics');
      await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    });

    test('should navigate to Team section', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      await page.getByTestId('nav-team').click();
      await expect(page).toHaveURL('/team');
      await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    });

    test('should navigate to Projects section', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      await page.getByTestId('nav-projects').click();
      await expect(page).toHaveURL('/projects');
    });

    test('should navigate to Settings section', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      await page.getByTestId('nav-settings').click();
      await expect(page).toHaveURL('/settings');
    });

    test('should highlight current section in sidebar', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Navigate to Feed first
      await page.getByTestId('nav-feed').click();
      await expect(page).toHaveURL('/prompts');

      // Feed should have aria-current
      const feedLink = page.getByTestId('nav-feed');
      await expect(feedLink).toHaveAttribute('aria-current', 'page');

      // Navigate to Analytics
      await page.getByTestId('nav-analytics').click();
      await expect(page).toHaveURL('/analytics');

      // Analytics should now have aria-current
      const analyticsLink = page.getByTestId('nav-analytics');
      await expect(analyticsLink).toHaveAttribute('aria-current', 'page');

      // Feed should NOT have aria-current anymore
      await expect(feedLink).not.toHaveAttribute('aria-current', 'page');
    });

    test('should support keyboard navigation', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Focus the analytics link directly and verify it's focusable
      const analyticsLink = page.getByTestId('nav-analytics');
      await analyticsLink.focus();
      await expect(analyticsLink).toBeFocused();

      // Press Enter to navigate
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('/analytics');
    });
  });

  test.describe('Header', () => {
    test('should display team switcher', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Team switcher should be visible
      const teamSwitcher = page.getByTestId('team-switcher-dropdown');
      await expect(teamSwitcher).toBeVisible();
      await expect(teamSwitcher).toContainText(teamName);
    });

    test('should display user avatar and name', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // User info should be visible
      await expect(page.getByTestId('user-avatar')).toBeVisible();
      await expect(page.getByTestId('user-name')).toBeVisible();
    });

    test('should have logout button that signs out user', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Click logout
      await page.getByTestId('logout-button').click();

      // Should be redirected to login
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Authentication Protection', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Try to access dashboard directly without logging in
      await page.goto('/');

      // Should be redirected to login (may include query params like ?expired=true)
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated users from analytics to login', async ({ page }) => {
      await page.goto('/analytics');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated users from team to login', async ({ page }) => {
      await page.goto('/team');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated users from projects to login', async ({ page }) => {
      await page.goto('/projects');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated users from settings to login', async ({ page }) => {
      await page.goto('/settings');
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
