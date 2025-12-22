import { test, expect } from '@playwright/test';
import {
  createTestUser,
  loginUser,
  generateTestEmail,
  deleteMailpitMessages,
} from './helpers/auth';

const testPassword = 'TestPassword123!';

test.describe('Team Creation Flow', () => {
  test.beforeEach(async () => {
    // Clean up mailpit before each test
    await deleteMailpitMessages();
  });

  test('should show team creation prompt for new user with no teams', async ({ page }) => {
    const email = generateTestEmail();

    // Create and verify new user
    await createTestUser(page, email, testPassword);

    // Should be on dashboard showing team creation
    await expect(page.getByText('Welcome to Contextor!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Create your first team')).toBeVisible();
  });

  test('should display team creation form with required fields', async ({ page }) => {
    const email = generateTestEmail();
    await createTestUser(page, email, testPassword);

    // Should see form fields
    await expect(page.getByLabel('Team Name')).toBeVisible();
    await expect(page.getByText('Description')).toBeVisible();
    await expect(page.getByLabel('Create team form').getByRole('button', { name: 'Create Team' })).toBeVisible();
  });

  test('should show validation error for empty team name', async ({ page }) => {
    const email = generateTestEmail();
    await createTestUser(page, email, testPassword);

    // Click create without filling form
    await page.getByLabel('Create team form').getByRole('button', { name: 'Create Team' }).click();

    // Should show validation error
    await expect(page.getByText('Team name is required')).toBeVisible();
  });

  test('should create team and redirect to dashboard', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Test Team ${Date.now()}`;

    // Capture console messages and network requests
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Track API requests
    let apiCalled = false;
    page.on('request', request => {
      if (request.url().includes('/api/teams')) {
        console.log('API Request:', request.method(), request.url());
        apiCalled = true;
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/teams')) {
        console.log('API Response:', response.status(), response.url());
      }
    });

    await createTestUser(page, email, testPassword);

    // Wait for the form to be fully hydrated
    await page.waitForTimeout(2000);

    // Fill form
    await page.getByLabel('Team Name').fill(teamName);
    await page.getByRole('textbox', { name: /description/i }).fill('A test team description');

    // Submit the form
    await page.getByLabel('Create team form').getByRole('button', { name: 'Create Team' }).click();

    // Wait a bit for the form submission
    await page.waitForTimeout(5000);

    // Log diagnostics
    console.log('API called:', apiCalled);
    console.log('Console logs:', consoleLogs.slice(-10));

    // Wait for dashboard to appear
    await expect(page.getByRole('heading', { name: teamName })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('You are an admin')).toBeVisible();
  });

  test('should show loading state during team creation', async ({ page }) => {
    const email = generateTestEmail();
    await createTestUser(page, email, testPassword);

    await page.getByLabel('Team Name').fill('Loading Test Team');

    // Click and immediately check for loading state
    const createButton = page.getByLabel('Create team form').getByRole('button', { name: 'Create Team' });
    await createButton.click();

    // Button should show loading state
    await expect(page.getByText('Creating Team...')).toBeVisible();
  });

  test('should allow creating team from /teams/new page', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `New Page Team ${Date.now()}`;

    await createTestUser(page, email, testPassword);

    // Navigate to /teams/new directly
    await page.goto('/teams/new');

    await expect(page.getByText('Create a New Team')).toBeVisible();

    await page.getByLabel('Team Name').fill(teamName);
    await page.getByLabel('Create team form').getByRole('button', { name: 'Create Team' }).click();

    // Should redirect and show team name
    await expect(page.getByText(teamName)).toBeVisible({ timeout: 15000 });
  });

  test('should show dashboard with team info after creation', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Dashboard Team ${Date.now()}`;

    await createTestUser(page, email, testPassword);

    await page.getByLabel('Team Name').fill(teamName);
    await page.getByLabel('Create team form').getByRole('button', { name: 'Create Team' }).click();

    // Verify dashboard elements
    await expect(page.getByRole('heading', { name: teamName })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Team Members', { exact: true })).toBeVisible();
    await expect(page.getByText('Projects', { exact: true })).toBeVisible();
    await expect(page.getByText('Quick Actions', { exact: true })).toBeVisible();
  });

  test('keyboard navigation - Enter submits form', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Keyboard Team ${Date.now()}`;

    await createTestUser(page, email, testPassword);

    // Fill form
    await page.getByLabel('Team Name').fill(teamName);

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Should create team
    await expect(page.getByText(teamName)).toBeVisible({ timeout: 15000 });
  });

  test('should trim whitespace from team name', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = 'Trimmed Team Name';

    await createTestUser(page, email, testPassword);

    // Fill with extra whitespace
    await page.getByLabel('Team Name').fill(`  ${teamName}  `);
    await page.getByLabel('Create team form').getByRole('button', { name: 'Create Team' }).click();

    // Should show trimmed name
    await expect(page.getByRole('heading', { name: teamName })).toBeVisible({ timeout: 15000 });
  });
});
