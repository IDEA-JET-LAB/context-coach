import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/auth';

test.describe('Landing Page', () => {
  test.describe('Unauthenticated users', () => {
    test('should display landing page at root URL', async ({ page }) => {
      await page.goto('/');

      // Should see the landing page, not a login redirect
      await expect(page).toHaveURL('/');

      // Check for key elements
      await expect(page.getByRole('heading', { name: /Your Context Tutor/i })).toBeVisible();
    });

    test('should display navigation bar with logo and links', async ({ page }) => {
      await page.goto('/');

      // Logo
      await expect(page.getByText('Contextor').first()).toBeVisible();

      // Navigation links (visible on desktop)
      await expect(page.getByRole('link', { name: /Features/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Pricing/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Docs/i })).toBeVisible();

      // Auth buttons
      await expect(page.getByRole('link', { name: /Log In/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Sign Up/i })).toBeVisible();
    });

    test('should display hero section with headline and CTAs', async ({ page }) => {
      await page.goto('/');

      // Headline
      await expect(page.getByRole('heading', { name: /Your Context Tutor/i })).toBeVisible();

      // Subheadline
      await expect(page.getByText(/Help your team master AI prompting/i)).toBeVisible();

      // CTAs
      await expect(page.getByRole('link', { name: /Get Started Free/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /See Demo/i })).toBeVisible();
    });

    test('should display features section with three cards', async ({ page }) => {
      await page.goto('/');

      // Feature titles
      await expect(page.getByText('Automatic Capture')).toBeVisible();
      await expect(page.getByText('AI-Powered Analysis')).toBeVisible();
      await expect(page.getByText('Team Insights')).toBeVisible();

      // Feature descriptions (partial match)
      await expect(page.getByText(/Seamlessly integrates with your existing AI tools/i)).toBeVisible();
      await expect(page.getByText(/Instant scoring across context, clarity/i)).toBeVisible();
      await expect(page.getByText(/Track your team's velocity/i)).toBeVisible();
    });

    test('should display footer with copyright', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText(/© 2025 Contextor\. All rights reserved\./i)).toBeVisible();
    });

    test('should navigate to login page when clicking Log In', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /Log In/i }).click();

      await expect(page).toHaveURL('/login');
    });

    test('should navigate to signup page when clicking Sign Up', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /Sign Up/i }).click();

      await expect(page).toHaveURL('/signup');
    });

    test('should navigate to signup page when clicking Get Started Free CTA', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /Get Started Free/i }).click();

      await expect(page).toHaveURL('/signup');
    });

    test('should scroll to features section when clicking Features link', async ({ page }) => {
      await page.goto('/');

      // Click the features link (it's an anchor link)
      await page.getByRole('link', { name: /Features/i }).click();

      // Check that features section is in view (URL should have #features)
      await expect(page).toHaveURL('/#features');
    });
  });

  test.describe('Authenticated users', () => {
    test('should show landing page with "Go to Dashboard" button for authenticated users', async ({ page }) => {
      // First login using the test user from seed data
      await loginUser(page, 'edgars@test.com', 'password123');

      // Now visit the landing page
      await page.goto('/');

      // Should still be on landing page (no redirect)
      await expect(page).toHaveURL('/');

      // Should see the landing page content
      await expect(page.getByRole('heading', { name: /Your Context Tutor/i })).toBeVisible();

      // Should see "Go to Dashboard" button instead of "Sign Up" and "Log In"
      await expect(page.getByRole('link', { name: /Go to Dashboard/i }).first()).toBeVisible();

      // Should NOT see Login/Sign Up buttons
      await expect(page.getByRole('link', { name: /Log In/i })).toBeHidden();
      await expect(page.getByRole('link', { name: /Sign Up/i })).toBeHidden();
    });

    test('should navigate to dashboard when clicking "Go to Dashboard"', async ({ page }) => {
      // First login
      await loginUser(page, 'edgars@test.com', 'password123');

      // Visit landing page
      await page.goto('/');

      // Click the dashboard button (use first() since there are two - navbar and hero)
      await page.getByRole('link', { name: /Go to Dashboard/i }).first().click();

      // Should navigate to prompts
      await expect(page).toHaveURL('/prompts');
    });
  });

  test.describe('Responsive design', () => {
    test('should hide navigation links on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/');

      // Nav links should be hidden on mobile
      await expect(page.getByRole('link', { name: /Features/i })).toBeHidden();
      await expect(page.getByRole('link', { name: /Pricing/i })).toBeHidden();
      await expect(page.getByRole('link', { name: /Docs/i })).toBeHidden();

      // But auth buttons should still be visible
      await expect(page.getByRole('link', { name: /Log In/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Sign Up/i })).toBeVisible();
    });

    test('should stack CTAs vertically on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/');

      // CTAs should still be visible
      await expect(page.getByRole('link', { name: /Get Started Free/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /See Demo/i })).toBeVisible();
    });

    test('should stack feature cards vertically on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/');

      // All features should be visible (stacked)
      await expect(page.getByText('Automatic Capture')).toBeVisible();
      await expect(page.getByText('AI-Powered Analysis')).toBeVisible();
      await expect(page.getByText('Team Insights')).toBeVisible();
    });
  });

  test.describe('Page performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');

      // Wait for main content to be visible
      await expect(page.getByRole('heading', { name: /Your Context Tutor/i })).toBeVisible();

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds (generous for CI environments)
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
