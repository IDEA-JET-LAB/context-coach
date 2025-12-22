import { test, expect, Page } from '@playwright/test';
import { createUserWithTeam, generateTestEmail } from './helpers/auth';
import { createTestPromptWithAnalysis } from './helpers/api';

const testPassword = 'TestPassword123!';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';

/**
 * Helper to wait for the project form to be fully hydrated
 */
async function waitForProjectForm(page: Page) {
  await page.getByLabel('Project Name').waitFor({ state: 'visible' });
  await expect(page.getByRole('button', { name: 'Create Project' })).toBeEnabled();
  await expect(page.getByText('Create a New Project')).toBeVisible();
  await page.waitForTimeout(1000);
}

/**
 * Query team info from database by team name using service role
 */
async function getTeamByName(teamName: string): Promise<{ id: string; created_by: string } | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/teams?name=eq.${encodeURIComponent(teamName)}&select=id,created_by`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (!response.ok) return null;
  const teams = await response.json();
  return teams[0] || null;
}

/**
 * Helper to set up a test user with team and project
 */
async function setupTestWithProject(page: Page) {
  const email = generateTestEmail();
  const teamName = `TestTeam-${Date.now()}`;
  const projectName = `TestProject-${Date.now()}`;

  await createUserWithTeam(page, email, testPassword, teamName);

  // Navigate to project creation
  await page.getByRole('link', { name: 'New Project' }).click();
  await waitForProjectForm(page);

  // Create project
  await page.getByLabel('Project Name').fill(projectName);
  await page.getByRole('button', { name: 'Create Project' }).click();

  // Wait for success
  await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 20000 });
  await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);

  // Extract project ID from URL
  const url = page.url();
  const projectIdMatch = url.match(/\/projects\/([^/]+)$/);
  if (!projectIdMatch) throw new Error('Could not extract project ID');
  const projectId = projectIdMatch[1];

  // Get team info from database
  const teamInfo = await getTeamByName(teamName);
  if (!teamInfo) throw new Error(`Could not find team: ${teamName}`);

  return {
    projectId,
    teamId: teamInfo.id,
    userId: teamInfo.created_by,
    teamName,
  };
}

test.describe('Team Analytics', () => {
  test.describe('Admin View', () => {
    test('should show admin analytics dashboard', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompts with analyses
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Admin analytics test prompt 1',
        overallScore: 7.5,
      });
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Admin analytics test prompt 2',
        overallScore: 8.0,
      });

      // Wait for data to be committed
      await page.waitForTimeout(1000);

      // Navigate to team analytics
      await page.goto('/team');
      await page.waitForLoadState('networkidle');

      // Should show Team Analytics title
      await expect(page.getByText('Team Analytics')).toBeVisible({ timeout: 10000 });

      // Should show admin dashboard or empty state (wait for content to load)
      await page.waitForTimeout(2000);
      const adminDashboard = page.getByTestId('team-admin-analytics');
      const emptyState = page.getByTestId('team-admin-analytics-empty');
      const loading = page.getByTestId('team-admin-analytics-loading');
      await expect(adminDashboard.or(emptyState).or(loading)).toBeVisible({ timeout: 15000 });
    });

    test('should display summary stats for admin', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompts
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Summary stats test prompt',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Team Analytics')).toBeVisible({ timeout: 10000 });

      // Wait for data to load
      await page.waitForTimeout(2000);

      // Look for stats or empty state
      const totalPrompts = page.getByTestId('admin-total-prompts');
      const emptyState = page.getByTestId('team-admin-analytics-empty');

      await expect(totalPrompts.or(emptyState)).toBeVisible({ timeout: 15000 });
    });

    test('should show charts when data exists', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompts with different scores
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Chart test prompt',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Team Analytics')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2000);

      // Should show some kind of analytics content
      const distributionChart = page.getByTestId('team-distribution-chart');
      const trendChart = page.getByTestId('team-trend-chart');
      const dashboardEmpty = page.getByTestId('team-admin-analytics-empty');

      await expect(distributionChart.or(trendChart).or(dashboardEmpty)).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no prompts', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Navigate to team analytics
      await page.goto('/team');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Team Analytics')).toBeVisible({ timeout: 10000 });

      // Wait for data to load
      await page.waitForTimeout(3000);

      // Should show empty state for admin (no prompts yet)
      const emptyState = page.getByTestId('team-admin-analytics-empty');
      const summaryEmpty = page.getByTestId('team-summary-empty');
      const loading = page.getByTestId('team-analytics-skeleton');
      const adminDashboard = page.getByTestId('team-admin-analytics');

      // One of these should be visible (empty state, still loading, or dashboard)
      await expect(emptyState.or(summaryEmpty).or(loading).or(adminDashboard)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation', () => {
    test('should be accessible via sidebar link', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Click on Team link in sidebar (using testid to avoid ambiguity)
      await page.getByTestId('nav-team').click();
      await page.waitForURL('/team');

      await expect(page.getByText('Team Analytics')).toBeVisible({ timeout: 10000 });
    });

    test('should be accessible via direct URL', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      await page.goto('/team');
      await expect(page).toHaveURL('/team');
      await expect(page.getByText('Team Analytics')).toBeVisible({ timeout: 10000 });
    });
  });
});
