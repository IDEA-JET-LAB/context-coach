import { test, expect } from '@playwright/test';
import {
  createUserWithTeam,
  generateTestEmail,
  deleteMailpitMessages,
} from './helpers/auth';

const testPassword = 'TestPassword123!';

test.describe('Project Management Flow', () => {
  test.beforeEach(async () => {
    // Clean up mailpit before each test
    await deleteMailpitMessages();
  });

  test('admin can navigate to project settings', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Settings Team ${Date.now()}`;
    const projectName = `Settings Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Wait for success
    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project dashboard
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 10000 });

    // Click settings button
    await page.getByRole('link', { name: 'Settings' }).click();

    // Should see settings page
    await expect(page.getByRole('heading', { name: 'Project Settings' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('General')).toBeVisible();
    await expect(page.getByText('API Keys')).toBeVisible();
  });

  test('admin can update project name and description', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Update Team ${Date.now()}`;
    const projectName = `Update Project ${Date.now()}`;
    const newProjectName = `Updated Project ${Date.now()}`;
    const newDescription = 'Updated description';

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project settings
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();

    // Update project name
    await page.getByLabel('Project Name').clear();
    await page.getByLabel('Project Name').fill(newProjectName);
    await page.getByLabel(/description/i).fill(newDescription);

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Should show success toast
    await expect(page.getByText('Project updated successfully')).toBeVisible({ timeout: 5000 });
  });

  test('admin can regenerate API key', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Regen Team ${Date.now()}`;
    const projectName = `Regen Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project settings
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();

    // Go to API Keys tab
    await page.getByText('API Keys').click();

    // Click regenerate button
    await page.getByRole('button', { name: 'Regenerate API Key' }).click();

    // Should see warning dialog
    await expect(page.getByText('This will immediately invalidate the current API key')).toBeVisible();

    // Confirm regeneration
    await page.getByRole('button', { name: 'Regenerate Key' }).click();

    // Should see new API key
    await expect(page.getByText('New API Key Generated')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Save your API key now')).toBeVisible();

    // New API key should be displayed in the dialog (full key, not masked)
    await expect(page.locator('#api-key-display')).toContainText('ctx_live_');
  });

  test('regenerated API key can be copied', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Copy Key Team ${Date.now()}`;
    const projectName = `Copy Key Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project settings
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();

    // Go to API Keys tab and regenerate
    await page.getByText('API Keys').click();
    await page.getByRole('button', { name: 'Regenerate API Key' }).click();

    // Wait for confirmation dialog
    await expect(page.getByText('This will immediately invalidate the current API key')).toBeVisible();
    await page.getByRole('button', { name: 'Regenerate Key' }).click();

    // Wait for new key dialog
    await expect(page.getByText('New API Key Generated')).toBeVisible({ timeout: 10000 });

    // Copy API key
    await page.getByRole('button', { name: 'Copy API key' }).click();
    await expect(page.getByText('API Key copied to clipboard')).toBeVisible({ timeout: 5000 });
  });

  test('admin can archive project', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Archive Team ${Date.now()}`;
    const projectName = `Archive Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project settings
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();

    // Go to Danger Zone tab
    await page.getByText('Danger Zone').click();

    // Click archive button
    await page.getByRole('button', { name: 'Archive Project' }).click();

    // Should see confirmation dialog
    await expect(page.getByText('This will archive the project and immediately invalidate its API key')).toBeVisible();

    // Type project name to confirm
    await page.getByLabel(/Confirm project name/i).fill(projectName);

    // Archive (click the action button inside dialog, not the trigger)
    // The dialog has two buttons: Cancel and Archive Project
    // We need to click the one that's NOT disabled
    await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Archive Project' }).click();

    // Should redirect to projects list
    await expect(page).toHaveURL(/\/projects$/, { timeout: 10000 });

    // Should show success toast
    await expect(page.getByText('Project archived successfully')).toBeVisible();
  });

  test('archived project not in active list', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `List Team ${Date.now()}`;
    const projectName = `List Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project settings
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();

    // Go to Danger Zone and archive
    await page.getByText('Danger Zone').click();
    await page.getByRole('button', { name: 'Archive Project' }).click();
    await expect(page.getByText('This will archive the project and immediately invalidate its API key')).toBeVisible();
    await page.getByLabel(/Confirm project name/i).fill(projectName);
    await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Archive Project' }).click();

    // Should be on projects list
    await expect(page).toHaveURL(/\/projects$/, { timeout: 10000 });

    // Project should NOT be in the list
    await expect(page.getByText(projectName)).not.toBeVisible({ timeout: 5000 });
  });

  test('archive confirmation requires exact project name', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Confirm Team ${Date.now()}`;
    const projectName = `Confirm Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project settings
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();

    // Go to Danger Zone
    await page.getByText('Danger Zone').click();
    await page.getByRole('button', { name: 'Archive Project' }).click();

    // Wait for dialog
    await expect(page.getByText('This will archive the project and immediately invalidate its API key')).toBeVisible();

    // Type wrong project name
    await page.getByLabel(/Confirm project name/i).fill('Wrong Name');

    // Archive button inside dialog should be disabled
    const dialogArchiveButton = page.locator('[role="alertdialog"]').getByRole('button', { name: 'Archive Project' });
    await expect(dialogArchiveButton).toBeDisabled();

    // Type correct name
    await page.getByLabel(/Confirm project name/i).clear();
    await page.getByLabel(/Confirm project name/i).fill(projectName);

    // Archive button should be enabled
    await expect(dialogArchiveButton).toBeEnabled();
  });

  test('settings form shows validation errors', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Validation Team ${Date.now()}`;
    const projectName = `Validation Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project settings
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();

    // Clear project name and try to save
    await page.getByLabel('Project Name').clear();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Should show validation error
    await expect(page.getByText('Project name is required')).toBeVisible();
  });

  test('settings tabs are navigable', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Tabs Team ${Date.now()}`;
    const projectName = `Tabs Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project settings
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();

    // General tab should be default
    await expect(page.getByText('Project Details')).toBeVisible();

    // Switch to API Keys tab
    await page.getByText('API Keys').click();
    await expect(page.getByText('Use this key to authenticate API requests')).toBeVisible();

    // Switch to Danger Zone tab
    await page.getByText('Danger Zone').click();
    await expect(page.getByText('Irreversible and destructive actions')).toBeVisible();

    // Switch back to General
    await page.getByText('General').first().click();
    await expect(page.getByText('Project Details')).toBeVisible();
  });

  test('installation instructions are visible on API Keys tab', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Install Team ${Date.now()}`;
    const projectName = `Install Project ${Date.now()}`;

    // Create user with team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Create a project
    await page.getByRole('link', { name: 'New Project' }).click();
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 15000 });

    // Go to project settings
    await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();

    // Switch to API Keys tab
    await page.getByText('API Keys').click();

    // Should see installation instructions
    await expect(page.getByText('Installation')).toBeVisible();
    await expect(page.getByText('npx @contextor/cli init')).toBeVisible();
  });
});
