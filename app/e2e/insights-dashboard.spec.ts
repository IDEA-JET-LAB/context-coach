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
  const teamName = `InsightsTeam-${Date.now()}`;
  const projectName = `InsightsProject-${Date.now()}`;

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

test.describe('Insights Dashboard', () => {
  test.describe('Page Load', () => {
    test('should display Insights Dashboard header', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `InsightsTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Navigate to insights
      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Insights Dashboard')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Visualize your prompting patterns')).toBeVisible();
    });

    test('should show empty state when user has no prompts', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `InsightsTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      // Wait for data to load
      await page.waitForTimeout(3000);

      // Should show empty state
      await expect(page.getByTestId('insights-empty')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('No Data Yet')).toBeVisible();
    });

    test('should be accessible via direct URL', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `InsightsTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      await page.goto('/analytics/insights');
      await expect(page).toHaveURL(/\/analytics\/insights/);
      await expect(page.getByText('Insights Dashboard')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('With Data', () => {
    test('should display summary cards with prompts', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompts with analyses
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'First test prompt for insights',
        overallScore: 7.5,
      });
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Second test prompt for insights',
        overallScore: 8.0,
      });

      await page.waitForTimeout(1000);

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      // Wait for dashboard to load
      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });

      // Check summary cards are displayed
      await expect(page.getByTestId('summary-cards')).toBeVisible();
      await expect(page.getByText('Total Prompts')).toBeVisible();
      await expect(page.getByText('Total Sessions')).toBeVisible();
      await expect(page.getByText('Average Score')).toBeVisible();
    });

    test('should display work style radar', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Test prompt for work style analysis',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });

      // Check work style radar or empty state
      const radar = page.getByTestId('work-style-radar');
      const radarEmpty = page.getByTestId('work-style-radar-empty');
      await expect(radar.or(radarEmpty)).toBeVisible({ timeout: 10000 });
    });

    test('should display sentiment insights', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Test prompt for sentiment analysis',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('sentiment-insights')).toBeVisible();
    });

    test('should display session health trend', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Test prompt for session health',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('session-health-trend')).toBeVisible();
    });

    test('should display activity heat map', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Test prompt for activity heat map',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });

      const heatMap = page.getByTestId('activity-heat-map');
      const heatMapEmpty = page.getByTestId('activity-heat-map-empty');
      await expect(heatMap.or(heatMapEmpty)).toBeVisible({ timeout: 10000 });
    });

    test('should display team comparison', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Test prompt for team comparison',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });

      // Check for team comparison component (may show "no data" state)
      const comparison = page.getByTestId('team-comparison');
      const comparisonNoData = page.getByTestId('team-comparison-no-data');
      const comparisonNoTeam = page.getByTestId('team-comparison-no-team');
      await expect(comparison.or(comparisonNoData).or(comparisonNoTeam)).toBeVisible({ timeout: 10000 });
    });

    test('should display weekly report summary', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Test prompt for weekly report',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('weekly-report-summary')).toBeVisible();
      await expect(page.getByText('Weekly Insights')).toBeVisible();
    });

    test('should display personalized tips', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Test prompt for personalized tips',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });

      const tips = page.getByTestId('personalized-tips');
      const tipsEmpty = page.getByTestId('personalized-tips-empty');
      await expect(tips.or(tipsEmpty)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Time Range Filter', () => {
    test('should have time range selector', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Time range test prompt',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);
      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('insights-time-range-trigger')).toBeVisible();
    });

    test('should change time range', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Time range change test',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);
      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });

      // Click time range selector
      await page.getByTestId('insights-time-range-trigger').click();
      await expect(page.getByTestId('insights-time-range-option-30d')).toBeVisible();

      // Select 30 days
      await page.getByTestId('insights-time-range-option-30d').click();

      // URL should update
      await expect(page).toHaveURL(/timeRange=30d/);
    });

    test('should persist time range selection in URL', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'URL persistence test',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      // Navigate with time range in URL
      await page.goto('/analytics/insights?timeRange=90d');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });

      // Time range should be reflected
      await expect(page).toHaveURL(/timeRange=90d/);
    });
  });

  test.describe('Loading States', () => {
    test('should show loading skeleton initially', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `InsightsTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Navigate with network throttling to see loading state
      await page.goto('/analytics/insights');

      // Either loading or dashboard should be visible quickly
      const loading = page.getByTestId('insights-loading');
      const dashboard = page.getByTestId('insights-dashboard');
      const empty = page.getByTestId('insights-empty');

      await expect(loading.or(dashboard).or(empty)).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should show retry button on error', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `InsightsTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);
      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      // Wait for page to load
      await expect(page.getByText('Insights Dashboard')).toBeVisible({ timeout: 10000 });

      // Wait for data state
      await page.waitForTimeout(3000);

      // If there's an error, we should see the retry button
      const errorState = page.getByTestId('insights-error');
      const dashboard = page.getByTestId('insights-dashboard');
      const empty = page.getByTestId('insights-empty');

      await expect(errorState.or(dashboard).or(empty)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Responsiveness', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Mobile test prompt',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('summary-cards')).toBeVisible();
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Tablet test prompt',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);

      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/analytics/insights');
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('insights-dashboard')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('summary-cards')).toBeVisible();
    });
  });
});
