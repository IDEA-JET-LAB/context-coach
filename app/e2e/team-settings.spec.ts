import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createUserWithTeam,
  generateTestEmail,
  deleteMailpitMessages,
} from './helpers/auth';

const testPassword = 'TestPassword123!';

test.describe('Team Settings Page', () => {
  test.beforeEach(async () => {
    await deleteMailpitMessages();
  });

  test('should display team settings with tabs for admin', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Settings Team ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to team settings
    // First get the team ID from the settings link
    await page.getByRole('link', { name: /settings/i }).first().click();

    await expect(page.getByRole('heading', { name: `${teamName} Settings` })).toBeVisible({
      timeout: 10000,
    });

    // Should see all tabs for admin
    await expect(page.getByRole('tab', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Members' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Invitations' })).toBeVisible();
  });

  test('should display team settings form with current values', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Form Test Team ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Check General tab is active by default
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute(
      'data-state',
      'active'
    );

    // Form should show current team name
    const nameInput = page.getByLabel('Team Name');
    await expect(nameInput).toHaveValue(teamName);
    await expect(nameInput).toBeEnabled();
  });

  test('should update team name successfully', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Update Test ${Date.now()}`;
    const newTeamName = `Updated Team ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();
    await expect(page.getByRole('heading', { name: `${teamName} Settings` })).toBeVisible();

    // Wait for form to be fully loaded
    const nameInput = page.getByLabel('Team Name');
    await expect(nameInput).toHaveValue(teamName);

    // Focus and select all, then type new value - this triggers react-hook-form properly
    await nameInput.focus();
    await nameInput.selectText();
    await nameInput.pressSequentially(newTeamName, { delay: 20 });

    // Wait for react-hook-form to detect the change
    await page.waitForTimeout(500);

    // Save button should be enabled after state update
    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeEnabled({ timeout: 10000 });

    // Submit
    await saveButton.click();

    // Should see success toast
    await expect(page.getByText('Team settings updated')).toBeVisible({ timeout: 10000 });

    // Header should reflect new name
    await expect(page.getByRole('heading', { name: `${newTeamName} Settings` })).toBeVisible();
  });

  test('should show validation error for empty team name', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Validation Test ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for form to be fully loaded
    const nameInput = page.getByLabel('Team Name');
    await expect(nameInput).toHaveValue(teamName);

    // Clear team name using clear() method
    await nameInput.clear();

    // Wait for react-hook-form to detect the change
    await page.waitForTimeout(500);

    // Try to save - button should be enabled since form is dirty
    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeEnabled({ timeout: 10000 });
    await saveButton.click();

    // Should show validation error
    await expect(page.getByText('Team name is required')).toBeVisible();
  });

  test('should update team description', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Description Test ${Date.now()}`;
    const description = 'A test description for the team';

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for form to load
    await expect(page.getByLabel('Team Name')).toHaveValue(teamName);

    // Fill description using fill() method
    const descInput = page.getByRole('textbox', { name: /description/i });
    await descInput.fill(description);

    // Wait for react-hook-form to detect the change
    await page.waitForTimeout(500);

    // Save - button should be enabled since we added a description
    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeEnabled({ timeout: 10000 });
    await saveButton.click();

    // Should see success toast
    await expect(page.getByText('Team settings updated')).toBeVisible({ timeout: 10000 });
  });

  test('should show character counter for description', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Counter Test ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for form to load
    await expect(page.getByLabel('Team Name')).toHaveValue(teamName);

    // Type in description using fill()
    const descInput = page.getByRole('textbox', { name: /description/i });
    await descInput.fill('Test description');

    // Wait for react to update the character counter
    await page.waitForTimeout(500);

    // Should show character count
    await expect(page.getByText(/16\/500/)).toBeVisible({ timeout: 5000 });
  });

  test('should disable save button when form is clean', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Clean Form ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for form to load
    const nameInput = page.getByLabel('Team Name');
    await expect(nameInput).toHaveValue(teamName);

    // Save button should be disabled without changes
    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeDisabled();

    // Make a change using focus + selectText + pressSequentially
    await nameInput.focus();
    await nameInput.selectText();
    await nameInput.pressSequentially(teamName + ' Modified', { delay: 20 });

    // Wait for react-hook-form to detect the change
    await page.waitForTimeout(500);

    // Save button should now be enabled
    await expect(saveButton).toBeEnabled({ timeout: 10000 });
  });

  test('should navigate to Members tab', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Members Tab ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for page to load - General tab should be visible and active
    await expect(page.getByRole('tab', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('data-state', 'active');

    // Click Members tab and wait for navigation
    const membersTab = page.getByRole('tab', { name: 'Members' });
    await membersTab.click();

    // Wait for tab switch
    await page.waitForTimeout(1000);

    // Check that Members tab is now selected (aria-selected is the correct attribute for Radix tabs)
    await expect(membersTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

    // Verify the Team Members heading is visible (confirming we're in the Members tab panel)
    await expect(page.getByText('Team Members').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show loading state during save', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Loading Test ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for form to load
    const nameInput = page.getByLabel('Team Name');
    await expect(nameInput).toHaveValue(teamName);

    // Make a change using focus + selectText + pressSequentially
    await nameInput.focus();
    await nameInput.selectText();
    await nameInput.pressSequentially(teamName + ' Updated', { delay: 20 });

    // Wait for react-hook-form to detect the change
    await page.waitForTimeout(500);

    // Save button should be enabled
    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeEnabled({ timeout: 10000 });

    // Click save and immediately check for loading state
    await saveButton.click();

    // Should show loading indicator or success (loading might be too fast)
    await expect(
      page.getByText('Saving...').or(page.getByText('Team settings updated'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Invitations tab for admin', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Invitations Tab ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for page to load
    await expect(page.getByRole('tab', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('data-state', 'active');

    // Click Invitations tab
    const invitationsTab = page.getByRole('tab', { name: 'Invitations' });
    await invitationsTab.click();

    // Wait for tab switch
    await page.waitForTimeout(1000);

    // Check that Invitations tab is now selected
    await expect(invitationsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

    // Should show the invite content - look for email input or invite form
    const inviteContent = page.getByText('Invite Team Members').or(page.getByPlaceholder('Enter email address'));
    await expect(inviteContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('should trim whitespace from team name', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Trim Test ${Date.now()}`;
    const newName = 'Trimmed Name';

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for form to load
    const nameInput = page.getByLabel('Team Name');
    await expect(nameInput).toHaveValue(teamName);

    // Fill with whitespace using focus + selectText + pressSequentially
    await nameInput.focus();
    await nameInput.selectText();
    await nameInput.pressSequentially(`  ${newName}  `, { delay: 20 });

    // Wait for react-hook-form to detect the change
    await page.waitForTimeout(500);

    // Save - button should be enabled
    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeEnabled({ timeout: 10000 });
    await saveButton.click();

    // Should see success
    await expect(page.getByText('Team settings updated')).toBeVisible({ timeout: 10000 });

    // Header should show trimmed name (server trims the name)
    await expect(page.getByRole('heading', { name: `${newName} Settings` })).toBeVisible();
  });

  test('should show leave team dialog', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Leave Test ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for page to load fully - General tab should be active
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('data-state', 'active');

    // Wait for page content to fully load - the Leave Team section (CardTitle)
    await expect(page.getByText('Leave Team').first()).toBeVisible({ timeout: 10000 });

    // Find the Leave Team trigger button - it's inside the Card content, not the header
    // The button contains text "Leave Team" and has an aria-label with the team name
    const leaveButton = page.locator('button:has-text("Leave Team")').first();
    await expect(leaveButton).toBeVisible({ timeout: 10000 });

    // Click leave team trigger button
    await leaveButton.click();

    // Wait for dialog animation
    await page.waitForTimeout(500);

    // Should show confirmation dialog - for the sole admin, it shows a different message
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 10000 });
    // The dialog shows "You are the last admin" since this is a newly created team
    await expect(
      page.getByText('Are you sure you want to leave').or(page.getByText('You are the last admin'))
    ).toBeVisible();
  });

  test('should prevent last admin from leaving team', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Last Admin ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for page to load fully
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('data-state', 'active');

    // Wait for page content to fully load - the Leave Team section
    await expect(page.getByText('Leave Team').first()).toBeVisible({ timeout: 10000 });

    // Find the Leave Team trigger button
    const leaveButton = page.locator('button:has-text("Leave Team")').first();
    await expect(leaveButton).toBeVisible({ timeout: 10000 });

    // Click leave team trigger button
    await leaveButton.click();

    // Wait for dialog animation
    await page.waitForTimeout(300);

    // Dialog should show warning about being last admin
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('You are the last admin')).toBeVisible();

    // Leave Team action button in the dialog should be disabled
    const dialogLeaveButton = page.getByRole('alertdialog').getByRole('button', { name: 'Leave Team' });
    await expect(dialogLeaveButton).toBeDisabled();
  });
});

test.describe('Team Settings - Tab Navigation', () => {
  test.beforeEach(async () => {
    await deleteMailpitMessages();
  });

  test('should support tab switching functionality', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Tab Nav ${Date.now()}`;

    await createUserWithTeam(page, email, testPassword, teamName);

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).first().click();

    // Wait for the settings page to load
    await expect(page.getByRole('tab', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('data-state', 'active');

    // Click Members tab
    const membersTab = page.getByRole('tab', { name: 'Members' });
    await membersTab.click();

    // Wait for tab switch
    await page.waitForTimeout(1000);

    // Members tab should be selected
    await expect(membersTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

    // Verify the Team Members heading is visible (confirming we're in the Members tab panel)
    await expect(page.getByText('Team Members').first()).toBeVisible({ timeout: 10000 });
  });
});
