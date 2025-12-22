import { test, expect, Page } from '@playwright/test';
import { createUserWithTeam, generateTestEmail } from './helpers/auth';
import { createTestPromptWithAnalysis, createTestPrompt } from './helpers/api';

const testPassword = 'TestPassword123!';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';

/**
 * Helper to wait for the project form to be fully hydrated
 */
async function waitForProjectForm(page: Page) {
  await page.getByLabel('Project Name').waitFor({ state: 'visible' });
  await expect(page.getByRole('button', { name: 'Create Project' })).toBeEnabled();
  await expect(page.getByText('Create a New Project')).toBeVisible();
  // Wait for hydration and ensure input is interactive
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
 * Helper to set up a test with user, team, project, and prompt
 * Uses UI for user/team/project creation, API for prompt creation
 */
async function setupTestWithPrompt(
  page: Page,
  options: {
    text?: string;
    overallScore?: number;
    withAnalysis?: boolean;
  } = {}
) {
  const email = generateTestEmail();
  const teamName = `TestTeam-${Date.now()}`;
  const projectName = `TestProject-${Date.now()}`;

  // Create user with team via UI (this works reliably)
  await createUserWithTeam(page, email, testPassword, teamName);

  // Navigate to project creation
  await page.getByRole('link', { name: 'New Project' }).click();
  await waitForProjectForm(page);

  // Create project
  await page.getByLabel('Project Name').fill(projectName);
  await page.getByRole('button', { name: 'Create Project' }).click();

  // Wait for success and navigate to dashboard
  await expect(page.getByText('Project Created!')).toBeVisible({ timeout: 20000 });
  await page.getByRole('link', { name: 'Go to Project Dashboard' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);

  // Extract project ID from URL
  const url = page.url();
  const projectIdMatch = url.match(/\/projects\/([^/]+)$/);
  if (!projectIdMatch) throw new Error('Could not extract project ID');
  const projectId = projectIdMatch[1];

  // Get team info from database (using team name we just created)
  const teamInfo = await getTeamByName(teamName);
  if (!teamInfo) throw new Error(`Could not find team: ${teamName}`);

  const teamId = teamInfo.id;
  const userId = teamInfo.created_by;

  // Create prompt via API
  const promptText = options.text || 'Test prompt for E2E testing';

  let prompt;
  if (options.withAnalysis !== false) {
    const result = await createTestPromptWithAnalysis(teamId, projectId, userId, {
      text: promptText,
      overallScore: options.overallScore,
    });
    prompt = result.prompt;
  } else {
    prompt = await createTestPrompt(teamId, projectId, userId, promptText);
  }

  return { prompt, projectId, teamId, userId };
}

test.describe('Prompt Detail View', () => {
  test.describe('Navigation to Detail View', () => {
    test('should navigate to prompt detail when clicking on prompt row', async ({ page }) => {
      const { prompt } = await setupTestWithPrompt(page, {
        text: 'Test prompt for detail navigation',
      });

      // Navigate to feed
      await page.getByTestId('nav-feed').click();
      await expect(page).toHaveURL('/prompts');

      // Wait for prompt to appear in feed
      const promptRow = page.getByTestId('prompt-row').filter({ hasText: 'Test prompt for detail' });
      await expect(promptRow).toBeVisible({ timeout: 10000 });
      await promptRow.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(`/prompts/${prompt.id}`);
    });

    test('should show back button in detail view', async ({ page }) => {
      const { prompt } = await setupTestWithPrompt(page, {
        text: 'Test prompt for back button',
      });

      await page.goto(`/prompts/${prompt.id}`);
      await page.waitForLoadState('networkidle');

      // Should show back button
      const backButton = page.getByTestId('back-button');
      await expect(backButton).toBeVisible({ timeout: 10000 });
      await expect(backButton).toContainText('Back to feed');
    });

    test('should navigate back to feed when clicking back button', async ({ page }) => {
      const { prompt } = await setupTestWithPrompt(page, {
        text: 'Test prompt for back navigation',
      });

      // Navigate to feed first
      await page.getByTestId('nav-feed').click();
      const promptRow = page.getByTestId('prompt-row').filter({ hasText: 'Test prompt for back' });
      await expect(promptRow).toBeVisible({ timeout: 10000 });
      await promptRow.click();

      // Wait for detail view
      await expect(page.getByTestId('back-button')).toBeVisible({ timeout: 10000 });

      // Click back button
      await page.getByTestId('back-button').click();

      // Should be back at feed
      await expect(page).toHaveURL('/prompts');
    });
  });

  test.describe('Prompt Content Display', () => {
    test('should display full prompt text', async ({ page }) => {
      const promptText = 'This is a comprehensive test prompt with detailed instructions for testing.';
      const { prompt } = await setupTestWithPrompt(page, { text: promptText });

      await page.goto(`/prompts/${prompt.id}`);

      // Should display full prompt text
      const promptTextElement = page.getByTestId('prompt-full-text');
      await expect(promptTextElement).toBeVisible({ timeout: 10000 });
      await expect(promptTextElement).toContainText(promptText);
    });

    test('should display prompt metadata', async ({ page }) => {
      const { prompt } = await setupTestWithPrompt(page, {
        text: 'Test prompt for metadata display',
      });

      await page.goto(`/prompts/${prompt.id}`);

      // Should display date
      await expect(page.getByTestId('prompt-date')).toBeVisible({ timeout: 10000 });

      // Should display word/char count
      await expect(page.getByTestId('prompt-stats')).toBeVisible();
    });
  });

  test.describe('Score Display', () => {
    test('should display overall score prominently', async ({ page }) => {
      const { prompt } = await setupTestWithPrompt(page, {
        text: 'Test prompt for score display',
        overallScore: 8.5,
      });

      await page.goto(`/prompts/${prompt.id}`);

      // Should display score badge with large size
      const scoreBadge = page.getByTestId('score-badge');
      await expect(scoreBadge).toBeVisible({ timeout: 10000 });
      await expect(scoreBadge).toContainText('8.5');
    });

    test('should display teal color for high scores (7-10)', async ({ page }) => {
      const { prompt } = await setupTestWithPrompt(page, {
        text: 'Test prompt high score',
        overallScore: 8.0,
      });

      await page.goto(`/prompts/${prompt.id}`);

      const scoreBadge = page.getByTestId('score-badge');
      await expect(scoreBadge).toBeVisible({ timeout: 10000 });
      await expect(scoreBadge).toHaveAttribute('data-color', 'teal');
    });

    test('should display amber color for medium scores (4-6)', async ({ page }) => {
      const { prompt } = await setupTestWithPrompt(page, {
        text: 'Test prompt medium score',
        overallScore: 5.0,
      });

      await page.goto(`/prompts/${prompt.id}`);

      const scoreBadge = page.getByTestId('score-badge');
      await expect(scoreBadge).toBeVisible({ timeout: 10000 });
      await expect(scoreBadge).toHaveAttribute('data-color', 'amber');
    });
  });

  test.describe('Dimension Breakdown', () => {
    test('should display dimension cards with scores', async ({ page }) => {
      const { prompt } = await setupTestWithPrompt(page, {
        text: 'Test prompt for dimension breakdown',
      });

      await page.goto(`/prompts/${prompt.id}`);

      // Should show dimension breakdown section
      await expect(page.getByTestId('dimension-breakdown')).toBeVisible({ timeout: 10000 });

      // Should show at least one dimension card
      await expect(page.getByTestId('dimension-card').first()).toBeVisible();

      // Each dimension card should have a score
      await expect(page.getByTestId('dimension-score').first()).toBeVisible();
    });
  });

  test.describe('Analysis States', () => {
    test('should show pending state for prompts being analyzed', async ({ page }) => {
      const { prompt } = await setupTestWithPrompt(page, {
        text: 'Test prompt pending analysis',
        withAnalysis: false,
      });

      await page.goto(`/prompts/${prompt.id}`);

      // Should show analyzing state
      await expect(page.getByTestId('analyzing-state')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should show not found state for non-existent prompt', async ({ page }) => {
      // First create user with team so we're logged in
      const email = generateTestEmail();
      const teamName = `TestTeam-${Date.now()}`;
      await createUserWithTeam(page, email, testPassword, teamName);

      // Use a valid UUID format that doesn't exist
      await page.goto('/prompts/00000000-0000-0000-0000-000000000000');

      // Should show not found state
      await expect(page.getByTestId('prompt-not-found')).toBeVisible({ timeout: 10000 });
    });
  });
});
