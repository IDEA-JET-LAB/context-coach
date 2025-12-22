'use client';

import { ScoreBadge } from '@/components/feed/score-badge';
import { ComparisonIndicator } from '@/components/feed/comparison-indicator';
import { TeamAverageBadge } from '@/components/feed/team-average-badge';
import { StatCard } from '@/components/dashboard/stat-card';

/**
 * Test page for Score Display components
 * This page is used for E2E testing only
 */
export default function ScoreDisplayTestPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8 text-[#fafafa]">
      <h1 className="text-2xl font-bold mb-8">Score Display Components Test Page</h1>

      {/* ScoreBadge Tests */}
      <section className="mb-12" data-testid="score-badge-section">
        <h2 className="text-xl font-semibold mb-4">ScoreBadge Component</h2>

        {/* Size Variants */}
        <div className="mb-6">
          <h3 className="text-lg mb-2">Size Variants</h3>
          <div className="flex items-center gap-4">
            <div data-testid="score-badge-sm">
              <ScoreBadge score={8.5} size="sm" />
            </div>
            <div data-testid="score-badge-md">
              <ScoreBadge score={8.5} size="md" />
            </div>
            <div data-testid="score-badge-lg">
              <ScoreBadge score={8.5} size="lg" />
            </div>
          </div>
        </div>

        {/* Color Coding */}
        <div className="mb-6">
          <h3 className="text-lg mb-2">Color Coding</h3>
          <div className="flex items-center gap-4">
            <div data-testid="score-teal">
              <ScoreBadge score={8.0} />
              <span className="text-xs text-muted-foreground mt-1 block">Teal (7-10)</span>
            </div>
            <div data-testid="score-amber">
              <ScoreBadge score={5.5} />
              <span className="text-xs text-muted-foreground mt-1 block">Amber (4-6)</span>
            </div>
            <div data-testid="score-coral">
              <ScoreBadge score={2.0} />
              <span className="text-xs text-muted-foreground mt-1 block">Coral (1-3)</span>
            </div>
          </div>
        </div>

        {/* Edge Cases */}
        <div className="mb-6">
          <h3 className="text-lg mb-2">Edge Cases</h3>
          <div className="flex items-center gap-4">
            <div data-testid="score-boundary-7">
              <ScoreBadge score={7.0} />
              <span className="text-xs text-muted-foreground mt-1 block">7.0 (Teal)</span>
            </div>
            <div data-testid="score-boundary-4">
              <ScoreBadge score={4.0} />
              <span className="text-xs text-muted-foreground mt-1 block">4.0 (Amber)</span>
            </div>
            <div data-testid="score-boundary-3">
              <ScoreBadge score={3.9} />
              <span className="text-xs text-muted-foreground mt-1 block">3.9 (Coral)</span>
            </div>
          </div>
        </div>

        {/* Status States */}
        <div className="mb-6">
          <h3 className="text-lg mb-2">Status States</h3>
          <div className="flex items-center gap-4">
            <div data-testid="score-pending">
              <ScoreBadge status="pending" />
              <span className="text-xs text-muted-foreground mt-1 block">Pending</span>
            </div>
            <div data-testid="score-processing">
              <ScoreBadge status="processing" />
              <span className="text-xs text-muted-foreground mt-1 block">Processing</span>
            </div>
            <div data-testid="score-failed">
              <ScoreBadge status="failed" />
              <span className="text-xs text-muted-foreground mt-1 block">Failed</span>
            </div>
            <div data-testid="score-complete">
              <ScoreBadge score={7.5} status="complete" />
              <span className="text-xs text-muted-foreground mt-1 block">Complete</span>
            </div>
          </div>
        </div>
      </section>

      {/* ComparisonIndicator Tests */}
      <section className="mb-12" data-testid="comparison-indicator-section">
        <h2 className="text-xl font-semibold mb-4">ComparisonIndicator Component</h2>

        <div className="flex items-center gap-8">
          <div data-testid="comparison-above">
            <ComparisonIndicator userScore={8.5} teamAverage={6.0} />
            <span className="text-xs text-muted-foreground mt-1 block">Above (+2.5)</span>
          </div>
          <div data-testid="comparison-below">
            <ComparisonIndicator userScore={4.0} teamAverage={6.5} />
            <span className="text-xs text-muted-foreground mt-1 block">Below (-2.5)</span>
          </div>
          <div data-testid="comparison-at">
            <ComparisonIndicator userScore={6.2} teamAverage={6.0} />
            <span className="text-xs text-muted-foreground mt-1 block">At average (+0.2)</span>
          </div>
          <div data-testid="comparison-no-value">
            <ComparisonIndicator userScore={8.0} teamAverage={6.0} showValue={false} />
            <span className="text-xs text-muted-foreground mt-1 block">No value shown</span>
          </div>
        </div>
      </section>

      {/* TeamAverageBadge Tests */}
      <section className="mb-12" data-testid="team-average-badge-section">
        <h2 className="text-xl font-semibold mb-4">TeamAverageBadge Component</h2>

        <div className="flex items-center gap-8">
          <div data-testid="team-avg-teal">
            <TeamAverageBadge average={8.5} />
          </div>
          <div data-testid="team-avg-amber">
            <TeamAverageBadge average={5.5} />
          </div>
          <div data-testid="team-avg-coral">
            <TeamAverageBadge average={2.5} />
          </div>
        </div>
      </section>

      {/* StatCard Tests */}
      <section className="mb-12" data-testid="stat-card-section">
        <h2 className="text-xl font-semibold mb-4">StatCard Component</h2>

        <div className="grid grid-cols-4 gap-4">
          <div data-testid="stat-card-basic">
            <StatCard label="Total Prompts" value={42} />
          </div>
          <div data-testid="stat-card-trend-up">
            <StatCard label="Average Score" value="7.5" trend="up" trendValue="+12.5%" />
          </div>
          <div data-testid="stat-card-trend-down">
            <StatCard label="This Week" value={15} trend="down" trendValue="-5.2%" />
          </div>
          <div data-testid="stat-card-trend-stable">
            <StatCard label="Team Size" value={8} trend="stable" />
          </div>
          <div data-testid="stat-card-loading">
            <StatCard label="Loading" value={0} loading={true} />
          </div>
        </div>
      </section>

      {/* Accessibility Test Elements */}
      <section className="mb-12" data-testid="accessibility-section">
        <h2 className="text-xl font-semibold mb-4">Accessibility Tests</h2>

        <div className="flex items-center gap-8">
          <div data-testid="a11y-score-badge">
            <ScoreBadge score={9.0} />
          </div>
          <div data-testid="a11y-comparison">
            <ComparisonIndicator userScore={7.5} teamAverage={6.0} />
          </div>
        </div>
      </section>
    </div>
  );
}
