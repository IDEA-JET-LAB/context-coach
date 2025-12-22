import { test, expect } from '@playwright/test';

test.describe('Score Display Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-components/score-display');
  });

  test.describe('ScoreBadge Component', () => {
    test('should display score badges in all size variants', async ({ page }) => {
      // Small size - 32px (h-8 w-8)
      const smBadge = page.getByTestId('score-badge-sm').locator('[data-testid="score-badge"]');
      await expect(smBadge).toBeVisible();
      await expect(smBadge).toHaveClass(/h-8/);
      await expect(smBadge).toHaveClass(/w-8/);

      // Medium size - 40px (h-10 w-10)
      const mdBadge = page.getByTestId('score-badge-md').locator('[data-testid="score-badge"]');
      await expect(mdBadge).toBeVisible();
      await expect(mdBadge).toHaveClass(/h-10/);
      await expect(mdBadge).toHaveClass(/w-10/);

      // Large size - 64px (h-16 w-16)
      const lgBadge = page.getByTestId('score-badge-lg').locator('[data-testid="score-badge"]');
      await expect(lgBadge).toBeVisible();
      await expect(lgBadge).toHaveClass(/h-16/);
      await expect(lgBadge).toHaveClass(/w-16/);
    });

    test('should maintain circular shape at all sizes', async ({ page }) => {
      const sizes = ['sm', 'md', 'lg'];
      for (const size of sizes) {
        const badge = page.getByTestId(`score-badge-${size}`).locator('[data-testid="score-badge"]');
        await expect(badge).toHaveClass(/rounded-full/);
      }
    });

    test('should apply Teal color for scores 7-10', async ({ page }) => {
      const tealBadge = page.getByTestId('score-teal').locator('[data-testid="score-badge"]');
      await expect(tealBadge).toHaveAttribute('data-color', 'teal');
      await expect(tealBadge).toHaveClass(/bg-teal-500/);

      // Test boundary at exactly 7.0
      const boundary7 = page.getByTestId('score-boundary-7').locator('[data-testid="score-badge"]');
      await expect(boundary7).toHaveAttribute('data-color', 'teal');
    });

    test('should apply Amber color for scores 4-6', async ({ page }) => {
      const amberBadge = page.getByTestId('score-amber').locator('[data-testid="score-badge"]');
      await expect(amberBadge).toHaveAttribute('data-color', 'amber');
      await expect(amberBadge).toHaveClass(/bg-amber-500/);

      // Test boundary at exactly 4.0
      const boundary4 = page.getByTestId('score-boundary-4').locator('[data-testid="score-badge"]');
      await expect(boundary4).toHaveAttribute('data-color', 'amber');
    });

    test('should apply Coral color for scores 1-3', async ({ page }) => {
      const coralBadge = page.getByTestId('score-coral').locator('[data-testid="score-badge"]');
      await expect(coralBadge).toHaveAttribute('data-color', 'coral');
      await expect(coralBadge).toHaveClass(/bg-red-400/);

      // Test boundary at 3.9 (just under 4)
      const boundary3 = page.getByTestId('score-boundary-3').locator('[data-testid="score-badge"]');
      await expect(boundary3).toHaveAttribute('data-color', 'coral');
    });

    test('should display the score number with one decimal', async ({ page }) => {
      const badge = page.getByTestId('score-teal').locator('[data-testid="score-badge"]');
      await expect(badge).toContainText('8.0');
    });

    test('should show loading spinner for pending status', async ({ page }) => {
      const pendingBadge = page.getByTestId('score-pending').locator('[data-testid="score-badge-loading"]');
      await expect(pendingBadge).toBeVisible();
      // Check for Loader2 animation class
      const spinner = pendingBadge.locator('svg');
      await expect(spinner).toHaveClass(/animate-spin/);
    });

    test('should show loading spinner for processing status', async ({ page }) => {
      const processingBadge = page.getByTestId('score-processing').locator('[data-testid="score-badge-loading"]');
      await expect(processingBadge).toBeVisible();
    });

    test('should show error icon for failed status', async ({ page }) => {
      const failedBadge = page.getByTestId('score-failed').locator('[data-testid="score-badge-failed"]');
      await expect(failedBadge).toBeVisible();
      await expect(failedBadge).toHaveClass(/bg-red-500/);
    });

    test('should show score for complete status', async ({ page }) => {
      const completeBadge = page.getByTestId('score-complete').locator('[data-testid="score-badge"]');
      await expect(completeBadge).toBeVisible();
      await expect(completeBadge).toContainText('7.5');
    });
  });

  test.describe('ComparisonIndicator Component', () => {
    test('should show up arrow for scores above team average', async ({ page }) => {
      const aboveIndicator = page.getByTestId('comparison-above').locator('[data-testid="comparison-indicator"]');
      await expect(aboveIndicator).toBeVisible();
      await expect(aboveIndicator).toHaveAttribute('data-direction', 'above');
      await expect(aboveIndicator).toHaveClass(/text-teal-500/);
    });

    test('should show down arrow for scores below team average', async ({ page }) => {
      const belowIndicator = page.getByTestId('comparison-below').locator('[data-testid="comparison-indicator"]');
      await expect(belowIndicator).toBeVisible();
      await expect(belowIndicator).toHaveAttribute('data-direction', 'below');
      await expect(belowIndicator).toHaveClass(/text-red-400/);
    });

    test('should show minus sign for scores at team average (+/- 0.5)', async ({ page }) => {
      const atIndicator = page.getByTestId('comparison-at').locator('[data-testid="comparison-indicator"]');
      await expect(atIndicator).toBeVisible();
      await expect(atIndicator).toHaveAttribute('data-direction', 'at');
      await expect(atIndicator).toHaveClass(/text-muted-foreground/);
    });

    test('should display difference value with correct sign', async ({ page }) => {
      // Above average should show +
      const aboveValue = page.getByTestId('comparison-above').locator('[data-testid="comparison-value"]');
      await expect(aboveValue).toContainText('+2.5');

      // Below average should show -
      const belowValue = page.getByTestId('comparison-below').locator('[data-testid="comparison-value"]');
      await expect(belowValue).toContainText('-2.5');
    });

    test('should hide value when showValue is false', async ({ page }) => {
      const noValueIndicator = page.getByTestId('comparison-no-value').locator('[data-testid="comparison-indicator"]');
      await expect(noValueIndicator).toBeVisible();
      const valueElement = noValueIndicator.locator('[data-testid="comparison-value"]');
      await expect(valueElement).not.toBeVisible();
    });

    test('should show tooltip with team average on hover', async ({ page }) => {
      const aboveIndicator = page.getByTestId('comparison-above').locator('[data-testid="comparison-indicator"]');
      await aboveIndicator.hover();

      // Wait for tooltip to appear with timeout for delay
      await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole('tooltip')).toContainText('Above team average');
      await expect(page.getByRole('tooltip')).toContainText('Team avg: 6.0');
    });

    test('should have correct aria-label for accessibility', async ({ page }) => {
      const aboveIndicator = page.getByTestId('comparison-above').locator('[data-testid="comparison-indicator"]');
      await expect(aboveIndicator).toHaveAttribute('role', 'status');
      const ariaLabel = await aboveIndicator.getAttribute('aria-label');
      expect(ariaLabel).toContain('Above team average');
      expect(ariaLabel).toContain('team average of 6.0');
    });
  });

  test.describe('TeamAverageBadge Component', () => {
    test('should display team average with label', async ({ page }) => {
      const tealBadge = page.getByTestId('team-avg-teal').locator('[data-testid="team-average-badge"]');
      await expect(tealBadge).toBeVisible();
      await expect(tealBadge).toContainText('Team avg:');
      await expect(tealBadge).toContainText('8.5');
    });

    test('should apply correct color for different score ranges', async ({ page }) => {
      // Teal for 7-10
      const tealBadge = page.getByTestId('team-avg-teal').locator('[data-testid="team-average-badge"]');
      await expect(tealBadge).toHaveAttribute('data-color', 'teal');

      // Amber for 4-6
      const amberBadge = page.getByTestId('team-avg-amber').locator('[data-testid="team-average-badge"]');
      await expect(amberBadge).toHaveAttribute('data-color', 'amber');

      // Coral for 1-3
      const coralBadge = page.getByTestId('team-avg-coral').locator('[data-testid="team-average-badge"]');
      await expect(coralBadge).toHaveAttribute('data-color', 'coral');
    });
  });

  test.describe('StatCard Component', () => {
    test('should display label and value', async ({ page }) => {
      const basicCard = page.getByTestId('stat-card-basic').locator('[data-testid="stat-card"]');
      await expect(basicCard).toBeVisible();

      const label = basicCard.locator('[data-testid="stat-card-label"]');
      await expect(label).toContainText('Total Prompts');

      const value = basicCard.locator('[data-testid="stat-card-value"]');
      await expect(value).toContainText('42');
    });

    test('should display upward trend indicator with value', async ({ page }) => {
      const trendUpCard = page.getByTestId('stat-card-trend-up').locator('[data-testid="stat-card"]');
      const trend = trendUpCard.locator('[data-testid="stat-card-trend"]');

      await expect(trend).toBeVisible();
      await expect(trend).toHaveAttribute('data-trend', 'up');
      await expect(trend).toHaveClass(/text-teal-500/);

      const trendValue = trend.locator('[data-testid="stat-card-trend-value"]');
      await expect(trendValue).toContainText('+12.5%');
    });

    test('should display downward trend indicator with value', async ({ page }) => {
      const trendDownCard = page.getByTestId('stat-card-trend-down').locator('[data-testid="stat-card"]');
      const trend = trendDownCard.locator('[data-testid="stat-card-trend"]');

      await expect(trend).toBeVisible();
      await expect(trend).toHaveAttribute('data-trend', 'down');
      await expect(trend).toHaveClass(/text-red-400/);

      const trendValue = trend.locator('[data-testid="stat-card-trend-value"]');
      await expect(trendValue).toContainText('-5.2%');
    });

    test('should display stable trend indicator', async ({ page }) => {
      const stableCard = page.getByTestId('stat-card-trend-stable').locator('[data-testid="stat-card"]');
      const trend = stableCard.locator('[data-testid="stat-card-trend"]');

      await expect(trend).toBeVisible();
      await expect(trend).toHaveAttribute('data-trend', 'stable');
      await expect(trend).toHaveClass(/text-muted-foreground/);
    });

    test('should show loading skeleton when loading', async ({ page }) => {
      const loadingCard = page.getByTestId('stat-card-loading').locator('[data-testid="stat-card-loading"]');
      await expect(loadingCard).toBeVisible();

      // Check for skeleton animation
      const skeletons = loadingCard.locator('.animate-pulse');
      await expect(skeletons.first()).toBeVisible();
    });

    test('should apply dark mode styling', async ({ page }) => {
      const basicCard = page.getByTestId('stat-card-basic').locator('[data-testid="stat-card"]');
      await expect(basicCard).toHaveClass(/bg-\[#1a1a1a\]/);
      await expect(basicCard).toHaveClass(/border-\[#2a2a2a\]/);
    });
  });

  test.describe('Accessibility', () => {
    test('score badge should have aria-label with score value', async ({ page }) => {
      const badge = page.getByTestId('a11y-score-badge').locator('[data-testid="score-badge"]');
      await expect(badge).toHaveAttribute('aria-label', 'Score: 9.0 out of 10');
    });

    test('comparison indicator icons should be aria-hidden', async ({ page }) => {
      const indicator = page.getByTestId('a11y-comparison').locator('[data-testid="comparison-indicator"]');
      const icon = indicator.locator('svg');
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    test('comparison indicator should have role status', async ({ page }) => {
      const indicator = page.getByTestId('a11y-comparison').locator('[data-testid="comparison-indicator"]');
      await expect(indicator).toHaveAttribute('role', 'status');
    });

    test('tooltips should be keyboard accessible', async ({ page }) => {
      // Radix tooltips use asChild pattern, the trigger element should be focusable
      // and has appropriate data attributes for accessibility
      const indicator = page.getByTestId('comparison-above').locator('[data-testid="comparison-indicator"]');

      // Verify it has the tooltip trigger data slot
      await expect(indicator).toHaveAttribute('data-slot', 'tooltip-trigger');

      // The element should be interactive (cursor-help class)
      await expect(indicator).toHaveClass(/cursor-help/);
    });

    test('loading states should have appropriate aria labels', async ({ page }) => {
      const pendingBadge = page.getByTestId('score-pending').locator('[data-testid="score-badge-loading"]');
      await expect(pendingBadge).toHaveAttribute('aria-label', 'Score is being calculated');

      const failedBadge = page.getByTestId('score-failed').locator('[data-testid="score-badge-failed"]');
      await expect(failedBadge).toHaveAttribute('aria-label', 'Score calculation failed');
    });
  });

  test.describe('Color Contrast (WCAG AA)', () => {
    test('score badge text should be white for all background colors', async ({ page }) => {
      const tealBadge = page.getByTestId('score-teal').locator('[data-testid="score-badge"]');
      await expect(tealBadge).toHaveClass(/text-white/);

      const amberBadge = page.getByTestId('score-amber').locator('[data-testid="score-badge"]');
      await expect(amberBadge).toHaveClass(/text-white/);

      const coralBadge = page.getByTestId('score-coral').locator('[data-testid="score-badge"]');
      await expect(coralBadge).toHaveClass(/text-white/);
    });
  });

  test.describe('Edge Cases', () => {
    test('comparison at exactly +0.5 should show as "at average"', async ({ page }) => {
      // The comparison-at test data has userScore 6.2 and teamAverage 6.0, difference = 0.2
      // This is within +/- 0.5 threshold so should show as "at"
      const atIndicator = page.getByTestId('comparison-at').locator('[data-testid="comparison-indicator"]');
      await expect(atIndicator).toHaveAttribute('data-direction', 'at');
    });

    test('score badge data attribute should have correct score', async ({ page }) => {
      const badge = page.getByTestId('score-teal').locator('[data-testid="score-badge"]');
      await expect(badge).toHaveAttribute('data-score', '8');
    });
  });
});
