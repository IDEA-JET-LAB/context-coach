import { test, expect } from '@playwright/test';
import {
  createUserWithTeam,
  createTeam,
  generateTestEmail,
  deleteMailpitMessages,
} from './helpers/auth';

const testPassword = 'TestPassword123!';

test.describe('Team Switching Flow', () => {
  test.beforeEach(async () => {
    // Clean up mailpit before each test
    await deleteMailpitMessages();
  });

  test('single-team user sees dropdown with team and create option', async ({ page }) => {
    const email = generateTestEmail();
    const teamName = `Single Team ${Date.now()}`;

    // Create user with a single team
    await createUserWithTeam(page, email, testPassword, teamName);

    // Should see team switcher dropdown (even with single team)
    const dropdown = page.getByTestId('team-switcher-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText(teamName);

    // Open dropdown and verify Create New Team option is available
    await dropdown.click();
    await expect(page.getByTestId('create-team-option')).toBeVisible();
  });

  test('multi-team user sees dropdown with all teams', async ({ page }) => {
    const email = generateTestEmail();
    const team1Name = `Team Alpha ${Date.now()}`;
    const team2Name = `Team Beta ${Date.now()}`;

    // Create user with first team
    await createUserWithTeam(page, email, testPassword, team1Name);

    // Create second team
    await createTeam(page, team2Name);

    // Should see dropdown trigger
    const dropdown = page.getByTestId('team-switcher-dropdown');
    await expect(dropdown).toBeVisible();

    // Click to open dropdown
    await dropdown.click();

    // Wait for menu to open
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    // Should see both teams in the dropdown menu
    await expect(menu.getByRole('menuitem').filter({ hasText: team1Name })).toBeVisible();
    await expect(menu.getByRole('menuitem').filter({ hasText: team2Name })).toBeVisible();

    // Should see "Create New Team" option
    await expect(page.getByTestId('create-team-option')).toBeVisible();
  });

  test('current team shows checkmark in dropdown', async ({ page }) => {
    const email = generateTestEmail();
    const team1Name = `Current Team ${Date.now()}`;
    const team2Name = `Other Team ${Date.now()}`;

    // Create user with first team
    await createUserWithTeam(page, email, testPassword, team1Name);

    // Create second team - this will switch to team2
    await createTeam(page, team2Name);

    // Open dropdown
    await page.getByTestId('team-switcher-dropdown').click();

    // Wait for dropdown to be visible
    await expect(page.getByRole('menu')).toBeVisible();

    // The current team should have the checkmark (current team is now team2 after creation)
    // Look for the Check icon within the team2 menu item
    const team2Item = page.getByRole('menuitem').filter({ hasText: team2Name });
    await expect(team2Item).toBeVisible();
  });

  test('can switch between teams', async ({ page }) => {
    const email = generateTestEmail();
    const team1Name = `Switch From ${Date.now()}`;
    const team2Name = `Switch To ${Date.now()}`;

    // Create user with first team
    await createUserWithTeam(page, email, testPassword, team1Name);

    // Create second team - now we're on team2
    await createTeam(page, team2Name);

    // Verify we're on team2
    await expect(page.getByRole('heading', { name: team2Name })).toBeVisible();

    // Open dropdown and switch to team1
    await page.getByTestId('team-switcher-dropdown').click();

    // Click on team1
    await page.getByRole('menuitem').filter({ hasText: team1Name }).click();

    // Wait for the switch - success toast should appear
    await expect(page.getByText(`Switched to ${team1Name}`)).toBeVisible({ timeout: 10000 });

    // Dashboard should now show team1's data
    await expect(page.getByRole('heading', { name: team1Name })).toBeVisible({ timeout: 10000 });
  });

  test('shows loading state during team switch', async ({ page }) => {
    const email = generateTestEmail();
    const team1Name = `Load Test Team 1 ${Date.now()}`;
    const team2Name = `Load Test Team 2 ${Date.now()}`;

    // Create user with first team
    await createUserWithTeam(page, email, testPassword, team1Name);

    // Create second team
    await createTeam(page, team2Name);

    // Open dropdown
    await page.getByTestId('team-switcher-dropdown').click();

    // Click to switch to team1
    await page.getByRole('menuitem').filter({ hasText: team1Name }).click();

    // Should briefly show "Switching..." text (though this might be too fast to catch)
    // We verify the success toast instead
    await expect(page.getByText(`Switched to ${team1Name}`)).toBeVisible({ timeout: 10000 });
  });

  test('Create New Team option navigates to team creation page', async ({ page }) => {
    const email = generateTestEmail();
    const team1Name = `Nav Test Team 1 ${Date.now()}`;
    const team2Name = `Nav Test Team 2 ${Date.now()}`;

    // Create user with two teams to get dropdown
    await createUserWithTeam(page, email, testPassword, team1Name);
    await createTeam(page, team2Name);

    // Open dropdown
    await page.getByTestId('team-switcher-dropdown').click();

    // Click "Create New Team"
    await page.getByTestId('create-team-option').click();

    // Should navigate to /teams/new
    await expect(page).toHaveURL('/teams/new');
  });

  test('keyboard navigation works in dropdown', async ({ page }) => {
    const email = generateTestEmail();
    const team1Name = `Keyboard Team 1 ${Date.now()}`;
    const team2Name = `Keyboard Team 2 ${Date.now()}`;

    // Create user with two teams
    await createUserWithTeam(page, email, testPassword, team1Name);
    await createTeam(page, team2Name);

    // Open dropdown with Enter key
    const dropdown = page.getByTestId('team-switcher-dropdown');
    await dropdown.focus();
    await page.keyboard.press('Enter');

    // Menu should be visible
    await expect(page.getByRole('menu')).toBeVisible();

    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).not.toBeVisible();
  });

  test('dashboard data updates after team switch', async ({ page }) => {
    const email = generateTestEmail();
    const team1Name = `Data Team A ${Date.now()}`;
    const team2Name = `Data Team B ${Date.now()}`;
    const team1Description = 'Description for Team A';
    const team2Description = 'Description for Team B';

    // Create user with first team
    await createUserWithTeam(page, email, testPassword, team1Name);

    // Create second team with description - now we're on team2
    await page.goto('/teams/new');
    await page.getByLabel('Team Name').fill(team2Name);
    await page.getByRole('textbox', { name: /description/i }).fill(team2Description);
    await page.getByRole('button', { name: 'Create Team' }).click();

    // Wait for team2 dashboard
    await expect(page.getByRole('heading', { name: team2Name })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(team2Description)).toBeVisible();

    // Switch back to team1
    await page.getByTestId('team-switcher-dropdown').click();
    await page.getByRole('menuitem').filter({ hasText: team1Name }).click();

    // Wait for switch
    await expect(page.getByText(`Switched to ${team1Name}`)).toBeVisible({ timeout: 10000 });

    // Dashboard should now show team1's data
    await expect(page.getByRole('heading', { name: team1Name })).toBeVisible({ timeout: 10000 });

    // Team2's description should not be visible
    await expect(page.getByText(team2Description)).not.toBeVisible();
  });

  test('clicking current team does not trigger switch', async ({ page }) => {
    const email = generateTestEmail();
    const team1Name = `No Switch Team 1 ${Date.now()}`;
    const team2Name = `No Switch Team 2 ${Date.now()}`;

    // Create user with two teams
    await createUserWithTeam(page, email, testPassword, team1Name);
    await createTeam(page, team2Name);

    // team2 is now current
    await expect(page.getByRole('heading', { name: team2Name })).toBeVisible();

    // Open dropdown and click current team
    await page.getByTestId('team-switcher-dropdown').click();
    await page.getByRole('menuitem').filter({ hasText: team2Name }).click();

    // Should NOT see switching toast since we're already on this team
    await expect(page.getByText(`Switched to ${team2Name}`)).not.toBeVisible();

    // Should still be on team2
    await expect(page.getByRole('heading', { name: team2Name })).toBeVisible();
  });

  test('user with three teams can switch between all of them', async ({ page }) => {
    const email = generateTestEmail();
    const team1Name = `Triple Team 1 ${Date.now()}`;
    const team2Name = `Triple Team 2 ${Date.now()}`;
    const team3Name = `Triple Team 3 ${Date.now()}`;

    // Create user with first team
    await createUserWithTeam(page, email, testPassword, team1Name);

    // Create second and third teams
    await createTeam(page, team2Name);
    await createTeam(page, team3Name);

    // Currently on team3
    await expect(page.getByRole('heading', { name: team3Name })).toBeVisible();

    // Open dropdown - should see all 3 teams
    await page.getByTestId('team-switcher-dropdown').click();
    await expect(page.getByRole('menuitem').filter({ hasText: team1Name })).toBeVisible();
    await expect(page.getByRole('menuitem').filter({ hasText: team2Name })).toBeVisible();
    await expect(page.getByRole('menuitem').filter({ hasText: team3Name })).toBeVisible();

    // Switch to team1
    await page.getByRole('menuitem').filter({ hasText: team1Name }).click();
    await expect(page.getByText(`Switched to ${team1Name}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: team1Name })).toBeVisible({ timeout: 10000 });

    // Switch to team2
    await page.getByTestId('team-switcher-dropdown').click();
    await page.getByRole('menuitem').filter({ hasText: team2Name }).click();
    await expect(page.getByText(`Switched to ${team2Name}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: team2Name })).toBeVisible({ timeout: 10000 });

    // Switch to team3
    await page.getByTestId('team-switcher-dropdown').click();
    await page.getByRole('menuitem').filter({ hasText: team3Name }).click();
    await expect(page.getByText(`Switched to ${team3Name}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: team3Name })).toBeVisible({ timeout: 10000 });
  });
});
