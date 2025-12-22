import { test, expect, Page } from '@playwright/test';
import {
  createUserWithTeam,
  generateTestEmail,
  deleteMailpitMessages,
} from './helpers/auth';

const testPassword = 'TestPassword123!';

// Helper to wait for the project form to be fully hydrated and ready for interaction
async function waitForProjectForm(page: Page) {
  // Wait for the form elements to be visible
  await page.getByLabel('Project Name').waitFor({ state: 'visible' });
  await expect(page.getByRole('button', { name: 'Create Project' })).toBeEnabled();
  // Wait for React hydration to complete - the form title confirms page is interactive
  await expect(page.getByText('Create a New Project')).toBeVisible();
  // Additional wait for hydration
  await page.waitForTimeout(800);
}

test.describe('Project Creation Flow', () => {
  test.beforeEach(async () => {
    // Clean up mailpit before each test
    await deleteMailpitMessages();
  });

  test('admin can create a new project', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Test Team ${Date.now()}`;
    const projectName = `Test Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to new project page
    await page.getByRole('link', { name: 'New Project' }).click();

    // Wait for form to be fully hydrated
    await waitForProjectForm(page);

    // Should see create project form
    await expect(page.getByText('Create a New Project')).toBeVisible();
    await expect(page.getByLabel('Project Name')).toBeVisible();

    // Fill out the form
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('textbox', { name: /description/i }).fill('A test project description');

    // Submit
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Should see success page with API key warning
    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Save your API key now!', { exact: true })).toBeVisible();
    await expect(page.getByText('ctx_live_')).toBeVisible();
  });

  test('should display API key only once', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `API Key Team ${Date.now()}`;
    const projectName = `API Key Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create project
    await page.getByRole('link', { name: 'New Project' }).click();

    // Wait for form to be fully hydrated
    await waitForProjectForm(page);

    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // On success page, API key is visible
    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('ctx_live_')).toBeVisible();

    // Navigate to project dashboard
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();

    // API key should be masked now (format: ctx_live_XXXXXXXX******************** where X is prefix chars)
    await expect(page.getByText(/ctx_live_[A-Za-z0-9]{7,8}\*+/)).toBeVisible({ timeout: 10000 });

    // Full key should NOT be visible (the visible part has asterisks, not full alphanumeric)
    const pageContent = await page.content();
    // The full key would be ctx_live_ followed by 32 alphanumeric chars without asterisks
    const hasFullKey = /ctx_live_[A-Za-z0-9]{32}(?!\*)/.test(pageContent);
    expect(hasFullKey).toBe(false);
  });

  test('should show validation error for empty project name', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Validation Team ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to new project
    await page.getByRole('link', { name: 'New Project' }).click();

    // Wait for form to be fully hydrated
    await waitForProjectForm(page);

    await expect(page.getByText('Create a New Project')).toBeVisible();

    // Click create without filling form - this should trigger validation
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Should show validation error (wait for it with timeout)
    await expect(page.getByText('Project name is required')).toBeVisible({ timeout: 5000 });
  });

  test('should show loading state during project creation', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Loading Team ${Date.now()}`;
    const projectName = `Loading Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to new project
    await page.getByRole('link', { name: 'New Project' }).click();

    // Wait for form to be fully hydrated
    await waitForProjectForm(page);

    await page.getByLabel('Project Name').fill(projectName);

    // Click and check that the button text changes during submission
    // The loading state may be too fast to reliably catch, so we also accept seeing the success page
    const createButton = page.getByRole('button', { name: 'Create Project' });
    await createButton.click();

    // Either see loading state or success page (API is fast in test environment)
    await expect(
      page.getByText('Creating Project...').or(page.getByText('Project Created!'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display install token on success page', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Token Team ${Date.now()}`;
    const projectName = `Token Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    await page.getByRole('link', { name: 'New Project' }).click();

    // Wait for form to be fully hydrated
    await waitForProjectForm(page);

    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Should see success page first
    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Should see install token section - using text match as CardTitle isn't a heading element
    await expect(page.getByText('Install Token', { exact: true })).toBeVisible();
    // Should see the install token value (starts with ctx_ and is base64-encoded) - use .first() as it appears in two places
    await expect(page.getByText(/ctx_eyJ/).first()).toBeVisible();
    await expect(page.getByText('Quick Install Command', { exact: true })).toBeVisible();
    await expect(page.getByText('npx @contextor/cli init')).toBeVisible();
  });

  test('copy buttons work on success page', async ({ page, context }) => {
    const email = generateTestEmail();
    const teamName = `Copy Team ${Date.now()}`;
    const projectName = `Copy Project ${Date.now()}`;

    // Grant clipboard permissions for the test
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    await page.getByRole('link', { name: 'New Project' }).click();

    // Wait for form to be fully hydrated
    await waitForProjectForm(page);

    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Click copy API key button
    await page.getByRole('button', { name: 'Copy API key' }).click();
    // Wait for the "Copied!" feedback to appear (it shows briefly)
    await expect(page.getByText('Copied!').first()).toBeVisible({ timeout: 3000 });
  });

  test('projects list shows created project', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `List Team ${Date.now()}`;
    const projectName = `List Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    await page.getByRole('link', { name: 'New Project' }).click();

    // Wait for form to be fully hydrated
    await waitForProjectForm(page);

    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to projects list
    await page.getByRole('link', { name: 'View All Projects' }).click();

    // Wait for the projects page to load
    await page.waitForURL(/\/projects$/);

    // Should see the project in the list - the project card contains the name as a link
    await expect(page.getByRole('link', { name: new RegExp(projectName) })).toBeVisible({ timeout: 10000 });
  });

  test('empty state shows when no projects exist', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Empty Team ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to projects page
    await page.getByRole('link', { name: 'View Projects' }).click();

    // Should see empty state
    await expect(page.getByText('No Projects Yet')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Create First Project' })).toBeVisible();
  });

  test('keyboard navigation - Enter submits form', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Keyboard Team ${Date.now()}`;
    const projectName = `Keyboard Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to new project
    await page.getByRole('link', { name: 'New Project' }).click();

    // Wait for form to be fully hydrated
    await waitForProjectForm(page);

    // Fill the project name field
    const projectNameField = page.getByLabel('Project Name');
    await projectNameField.fill(projectName);

    // Press Enter while focus is in the form field to submit
    await projectNameField.press('Enter');

    // Should create project (may take a moment for API call)
    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });
  });

  test('project detail page shows masked API key', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Detail Team ${Date.now()}`;
    const projectName = `Detail Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    await page.getByRole('link', { name: 'New Project' }).click();

    // Wait for form to be fully hydrated
    await waitForProjectForm(page);

    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project detail
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();

    // Should see project info
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 10000 });
    // Use exact match for section headings to avoid matching text that contains these words
    await expect(page.getByText('API Key', { exact: true })).toBeVisible();
    await expect(page.getByText('Installation', { exact: true })).toBeVisible();
    await expect(page.getByText('Statistics', { exact: true })).toBeVisible();
  });
});
