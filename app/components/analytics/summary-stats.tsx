'use client';

import { StatCard, TrendDirection } from '@/components/dashboard/stat-card';
import { SCORE_DECIMAL_PLACES } from '@/lib/constants/analytics';

interface SummaryStatsProps {
  totalPrompts: number;
  analyzedPrompts: number;
  avgScore: number | null;
  improvement: number | null;
  trend: TrendDirection;
}

export function SummaryStats({
  totalPrompts,
  analyzedPrompts,
  avgScore,
  improvement,
  trend,
}: SummaryStatsProps) {
  // Format average score - show "N/A" when no analyses yet
  const avgScoreDisplay = avgScore !== null
    ? `${avgScore.toFixed(SCORE_DECIMAL_PLACES)}/10`
    : 'N/A';

  // Format improvement - show "N/A" when not enough data
  const improvementDisplay = improvement !== null
    ? `${improvement >= 0 ? '+' : ''}${improvement.toFixed(SCORE_DECIMAL_PLACES)}%`
    : 'N/A';

  // Show hint about awaiting analysis if prompts exist but none analyzed
  const promptsHint = totalPrompts > 0 && analyzedPrompts === 0
    ? 'awaiting analysis'
    : undefined;

  const scoreHint = avgScore === null && totalPrompts > 0
    ? 'analysis in progress'
    : undefined;

  const improvementHint = improvement === null && analyzedPrompts > 0 && analyzedPrompts < 2
    ? 'need more data'
    : improvement === null && totalPrompts > 0
      ? 'analysis in progress'
      : undefined;

  return (
    <div
      className="grid gap-4 md:grid-cols-3"
      data-testid="summary-stats"
      aria-live="polite"
      aria-label="Summary statistics"
    >
      <StatCard
        label="Total Prompts"
        value={totalPrompts}
        trendValue={promptsHint}
      />
      <StatCard
        label="Average Score"
        value={avgScoreDisplay}
        trendValue={scoreHint}
      />
      <StatCard
        label="Improvement"
        value={improvementDisplay}
        trend={improvement !== null ? trend : undefined}
        trendValue={improvementHint ?? (improvement !== null ? 'vs previous period' : undefined)}
      />
    </div>
  );
}
