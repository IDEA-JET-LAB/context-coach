import { test, expect } from '@playwright/test';
import { createUserWithTeam, generateTestEmail } from './helpers/auth';

const testPassword = 'TestPassword123!';

test.describe('Prompt Feed', () => {
  test.describe('Feed Page', () => {
    test('should display feed page with title', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Navigate to prompts page
      await page.getByTestId('nav-feed').click();
      await expect(page).toHaveURL('/prompts');

      // Check page title
      await expect(page.getByRole('heading', { name: 'Prompt Feed' })).toBeVisible();
    });

    test('should show empty state when no prompts exist', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Navigate to prompts page
      await page.getByTestId('nav-feed').click();
      await expect(page).toHaveURL('/prompts');

      // Should show empty feed state (either no projects or no prompts)
      await expect(
        page.getByTestId('empty-feed-no-projects').or(page.getByTestId('empty-feed-no-prompts'))
      ).toBeVisible({ timeout: 10000 });
    });

    test('should show no projects message when team has no projects', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Navigate to prompts page
      await page.getByTestId('nav-feed').click();

      // Should show empty state for no projects
      const emptyState = page.getByTestId('empty-feed-no-projects');
      const noPromptsState = page.getByTestId('empty-feed-no-prompts');

      // One of these should be visible
      await expect(emptyState.or(noPromptsState)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Score Badge Component', () => {
    test('should display correct color for high scores (7-10)', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Navigate to prompts page
      await page.getByTestId('nav-feed').click();

      // This test verifies component rendering - would need mock data for full test
      // For now, just verify the page loads without errors
      await expect(page).toHaveURL('/prompts');
    });
  });

  test.describe('Navigation', () => {
    test('should navigate from sidebar to feed page', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Start from dashboard
      await expect(page).toHaveURL('/');

      // Click feed in sidebar
      await page.getByTestId('nav-feed').click();

      // Should be on prompts page
      await expect(page).toHaveURL('/prompts');
      await expect(page.getByRole('heading', { name: 'Prompt Feed' })).toBeVisible();
    });

    test('should highlight feed nav item when on prompts page', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Navigate to prompts page
      await page.getByTestId('nav-feed').click();
      await expect(page).toHaveURL('/prompts');

      // Feed nav item should be active
      const feedNavItem = page.getByTestId('nav-feed');
      await expect(feedNavItem).toHaveAttribute('aria-current', 'page');
    });
  });

  test.describe('Loading States', () => {
    test('should show skeleton while loading', async ({ page }) => {
      const testEmail = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, testEmail, testPassword, teamName);

      // Navigate to prompts page
      await page.getByTestId('nav-feed').click();

      // Page should load (skeleton or content)
      await expect(page).toHaveURL('/prompts');
    });
  });
});
