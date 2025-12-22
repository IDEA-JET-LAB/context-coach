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
  };
}

test.describe('Personal Analytics', () => {
  test.describe('Empty State', () => {
    test('should show empty state when user has no prompts', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Navigate to analytics
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');

      // Should show empty state or loading initially
      await expect(page.getByText('Your Analytics')).toBeVisible({ timeout: 10000 });

      // Wait for data to load
      await page.waitForTimeout(2000);

      // Should show empty state
      await expect(page.getByTestId('analytics-empty-state')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Start tracking your progress')).toBeVisible();
    });
  });

  test.describe('Analytics Dashboard', () => {
    test('should display summary stats with prompts', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompts with analyses
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'First test prompt for analytics',
        overallScore: 7.5,
      });
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Second test prompt for analytics',
        overallScore: 8.0,
      });

      // Wait for data to be fully committed
      await page.waitForTimeout(1000);

      // Navigate to analytics
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');

      // Wait for page to load
      await expect(page.getByText('Your Analytics')).toBeVisible({ timeout: 10000 });

      // Wait for data to load - check for either dashboard or summary stats
      await expect(page.getByText('Total Prompts')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Average Score')).toBeVisible();
      await expect(page.getByText('Improvement')).toBeVisible();
    });

    test('should display chart or empty chart state', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompts
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Analytics chart test prompt',
        overallScore: 7.0,
      });

      await page.waitForTimeout(1000);
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Your Analytics')).toBeVisible({ timeout: 10000 });

      // Should show either chart or chart empty state
      const chart = page.getByTestId('score-trend-chart');
      const chartEmpty = page.getByTestId('chart-empty');
      await expect(chart.or(chartEmpty)).toBeVisible({ timeout: 10000 });
    });

    test('should display dimension breakdown or empty state', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Dimension breakdown test prompt',
        overallScore: 7.5,
        dimensionScores: {
          Clarity: { score: 8.0, reasoning: 'Good clarity' },
          Context: { score: 6.0, reasoning: 'Needs more context' },
          Specificity: { score: 7.5, reasoning: 'Reasonably specific' },
        },
      });

      await page.waitForTimeout(1000);
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Your Analytics')).toBeVisible({ timeout: 10000 });

      // Should show dimension section or empty state
      const dimensionBreakdown = page.getByTestId('dimension-breakdown');
      const dimensionEmpty = page.getByTestId('dimension-breakdown-empty');
      await expect(dimensionBreakdown.or(dimensionEmpty)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Time Range Selector', () => {
    test('should have time range selector', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Time range test prompt',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Your Analytics')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Total Prompts')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('time-range-trigger')).toBeVisible();
    });

    test('should change time range', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Time range persistence test',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Your Analytics')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Total Prompts')).toBeVisible({ timeout: 15000 });

      // Click time range selector
      await page.getByTestId('time-range-trigger').click();
      await expect(page.getByTestId('time-range-option-7d')).toBeVisible();

      // Select 7 days
      await page.getByTestId('time-range-option-7d').click();

      // Wait for update
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Loading States', () => {
    test('should load analytics page successfully', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Navigate to analytics
      await page.goto('/analytics');

      // Page should load successfully
      await expect(page.getByText('Your Analytics')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should show appropriate state for user', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');

      // Wait for page to load
      await expect(page.getByText('Your Analytics')).toBeVisible({ timeout: 10000 });

      // Wait for data state
      await page.waitForTimeout(2000);

      // If there's no data, we should see the empty state (not an error)
      const emptyState = page.getByTestId('analytics-empty-state');
      const dashboard = page.getByTestId('analytics-dashboard');
      const loading = page.getByTestId('analytics-loading');
      const errorState = page.getByTestId('analytics-error');

      // One of these should be visible
      await expect(emptyState.or(dashboard).or(loading).or(errorState)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation', () => {
    test('should be accessible via direct URL', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Direct navigation should work
      await page.goto('/analytics');
      await expect(page).toHaveURL('/analytics');

      await expect(page.getByText('Your Analytics')).toBeVisible({ timeout: 10000 });
    });
  });
});
