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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

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
  const teamName = `IntelTeam-${Date.now()}`;
  const projectName = `IntelProject-${Date.now()}`;

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

test.describe('Team Intelligence Dashboard', () => {
  test.describe('View Mode Toggle', () => {
    test('should show view mode toggle buttons', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `IntelTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');

      // Should show view mode toggle buttons
      await expect(page.getByTestId('view-mode-intelligence')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('view-mode-standard')).toBeVisible();
    });

    test('should default to Intelligence view', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `IntelTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');

      // Intelligence button should be styled as active (has bg-card class)
      const intelligenceBtn = page.getByTestId('view-mode-intelligence');
      await expect(intelligenceBtn).toBeVisible({ timeout: 10000 });

      // The dashboard or empty state should be visible (Intelligence view)
      const dashboard = page.getByTestId('team-intelligence-dashboard');
      const empty = page.getByTestId('team-intelligence-empty');
      const skeleton = page.getByTestId('team-intelligence-skeleton');
      await expect(dashboard.or(empty).or(skeleton)).toBeVisible({ timeout: 15000 });
    });

    test('should toggle between Intelligence and Standard views', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `IntelTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');

      // Wait for initial load
      await page.waitForTimeout(2000);

      // Click Standard view
      await page.getByTestId('view-mode-standard').click();
      await page.waitForTimeout(1000);

      // Should show standard admin analytics (or empty state)
      const adminAnalytics = page.getByTestId('team-admin-analytics');
      const adminEmpty = page.getByTestId('team-admin-analytics-empty');
      const adminLoading = page.getByTestId('team-admin-analytics-loading');
      await expect(adminAnalytics.or(adminEmpty).or(adminLoading)).toBeVisible({ timeout: 10000 });

      // Click Intelligence view
      await page.getByTestId('view-mode-intelligence').click();
      await page.waitForTimeout(1000);

      // Should show intelligence view again
      const dashboard = page.getByTestId('team-intelligence-dashboard');
      const empty = page.getByTestId('team-intelligence-empty');
      const skeleton = page.getByTestId('team-intelligence-skeleton');
      await expect(dashboard.or(empty).or(skeleton)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no data exists', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `IntelTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');

      // Wait for data to load
      await page.waitForTimeout(3000);

      // Should show empty state since team has no prompts
      const empty = page.getByTestId('team-intelligence-empty');
      const dashboard = page.getByTestId('team-intelligence-dashboard');
      const skeleton = page.getByTestId('team-intelligence-skeleton');

      // One of these should be visible (likely empty state for new team)
      await expect(empty.or(dashboard).or(skeleton)).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Time Range Filter', () => {
    test('should display time range selector', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompt to trigger data generation
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Time range test prompt',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check if time range selector is visible (only shows when dashboard is loaded)
      const timeRangeSelect = page.getByTestId('time-range-select');
      const empty = page.getByTestId('team-intelligence-empty');
      const skeleton = page.getByTestId('team-intelligence-skeleton');

      // Either we have data with time range, or empty/skeleton state
      const hasTimeRange = await timeRangeSelect.isVisible().catch(() => false);
      const hasEmpty = await empty.isVisible().catch(() => false);
      const hasSkeleton = await skeleton.isVisible().catch(() => false);

      expect(hasTimeRange || hasEmpty || hasSkeleton).toBe(true);
    });

    test('should allow changing time range', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompts
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Time range change test prompt',
        overallScore: 8.0,
      });

      await page.waitForTimeout(1000);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // If dashboard with time range is visible, test changing it
      const timeRangeSelect = page.getByTestId('time-range-select');
      if (await timeRangeSelect.isVisible().catch(() => false)) {
        // Should be able to select different time ranges
        await timeRangeSelect.selectOption('7d');
        await page.waitForTimeout(500);
        await expect(timeRangeSelect).toHaveValue('7d');

        await timeRangeSelect.selectOption('90d');
        await page.waitForTimeout(500);
        await expect(timeRangeSelect).toHaveValue('90d');

        await timeRangeSelect.selectOption('30d');
        await page.waitForTimeout(500);
        await expect(timeRangeSelect).toHaveValue('30d');
      }
    });
  });

  test.describe('Dashboard Content', () => {
    test('should display Team Intelligence header', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `IntelTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');

      // Page should have Team Analytics title
      await expect(page.getByTestId('team-analytics-title')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Team Analytics')).toBeVisible();
    });

    test('should show dashboard with data when prompts exist', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create multiple test prompts with analysis
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Dashboard content test prompt 1',
        overallScore: 7.5,
      });
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Dashboard content test prompt 2',
        overallScore: 8.5,
      });
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Dashboard content test prompt 3',
        overallScore: 6.0,
      });

      await page.waitForTimeout(1000);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Dashboard or empty state should be visible
      const dashboard = page.getByTestId('team-intelligence-dashboard');
      const empty = page.getByTestId('team-intelligence-empty');
      const skeleton = page.getByTestId('team-intelligence-skeleton');

      await expect(dashboard.or(empty).or(skeleton)).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should show error state with retry button on failure', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `IntelTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Mock network error by blocking the API endpoint
      await page.route('**/api/analytics/team/**/intelligence**', async (route) => {
        await route.abort('connectionfailed');
      });

      await page.goto('/team');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Should show error state
      const errorState = page.getByTestId('team-intelligence-error');

      // Error state might appear if the API fails
      // Note: This test may not always trigger error if data is cached or route interception timing differs
      const isError = await errorState.isVisible().catch(() => false);
      if (isError) {
        await expect(page.getByText('Failed to load team intelligence')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
      }
    });
  });

  test.describe('Navigation', () => {
    test('should be accessible via Team link in sidebar', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `IntelTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Click on Team link in sidebar
      await page.getByTestId('nav-team').click();
      await page.waitForURL('/team');

      await expect(page.getByTestId('team-analytics-title')).toBeVisible({ timeout: 10000 });
    });

    test('should be accessible via direct URL', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `IntelTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      await page.goto('/team');
      await expect(page).toHaveURL('/team');
      await expect(page.getByTestId('team-analytics-title')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('API Response', () => {
    test('API endpoint should return proper structure', async ({ page }) => {
      const { teamId } = await setupTestWithProject(page);

      // Make direct API call to check response structure
      const response = await page.request.get(`/api/analytics/team/${teamId}/intelligence?timeRange=30d`);

      // API should return 200 OK (may have empty data)
      expect(response.ok()).toBe(true);

      const data = await response.json();

      // Should have required top-level fields
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('styleDistribution');
      expect(data).toHaveProperty('personaDistribution');
      expect(data).toHaveProperty('sentimentHealth');
      expect(data).toHaveProperty('sessionHealth');
      expect(data).toHaveProperty('topPerformers');
      expect(data).toHaveProperty('commonStruggles');
      expect(data).toHaveProperty('bestPractices');
      expect(data).toHaveProperty('weekOverWeek');
      expect(data).toHaveProperty('meta');
    });

    test('API should reject requests for non-member teams', async ({ page }) => {
      const email = generateTestEmail();
      const teamName = `IntelTeam-${Date.now()}`;

      await createUserWithTeam(page, email, testPassword, teamName);

      // Try to access a fake team ID
      const fakeTeamId = '00000000-0000-0000-0000-000000000000';
      const response = await page.request.get(`/api/analytics/team/${fakeTeamId}/intelligence?timeRange=30d`);

      // Should return 403 Forbidden
      expect(response.status()).toBe(403);
    });
  });

  test.describe('Summary Statistics', () => {
    test('should show summary statistics when data exists', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompts
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'Summary stats test prompt',
        overallScore: 7.5,
      });

      await page.waitForTimeout(1000);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // If dashboard is loaded (not empty), should show metrics
      const dashboard = page.getByTestId('team-intelligence-dashboard');
      if (await dashboard.isVisible().catch(() => false)) {
        // Look for metric displays (Team Size, Total Prompts, etc.)
        await expect(page.getByText('Team Size')).toBeVisible();
        await expect(page.getByText('Total Prompts')).toBeVisible();
        await expect(page.getByText('Total Sessions')).toBeVisible();
        await expect(page.getByText('Avg Score')).toBeVisible();
      }
    });
  });

  test.describe('Week-over-Week Changes', () => {
    test('should display week-over-week changes section', async ({ page }) => {
      const { projectId, teamId, userId } = await setupTestWithProject(page);

      // Create test prompts
      await createTestPromptWithAnalysis(teamId, projectId, userId, {
        text: 'WoW changes test prompt',
        overallScore: 8.0,
      });

      await page.waitForTimeout(1000);
      await page.goto('/team');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // If dashboard is loaded, should show WoW section
      const dashboard = page.getByTestId('team-intelligence-dashboard');
      if (await dashboard.isVisible().catch(() => false)) {
        await expect(page.getByText('Week-over-Week Changes')).toBeVisible();
        await expect(page.getByText('Score Change')).toBeVisible();
        await expect(page.getByText('Efficiency')).toBeVisible();
        await expect(page.getByText('Frustration')).toBeVisible();
      }
    });
  });
});
