'use client';

import { MetricCard } from '@/components/analytics/metric-card';
import { SCORE_DECIMAL_PLACES } from '@/lib/constants/analytics';
import { FileText, Target, TrendingUp as TrendingUpIcon } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'stable';

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

  // Calculate change string for improvement
  const improvementChange = improvement !== null
    ? `${improvement >= 0 ? '+' : ''}${improvement.toFixed(SCORE_DECIMAL_PLACES)}%`
    : undefined;

  return (
    <div
      className="grid gap-4 md:grid-cols-3"
      data-testid="summary-stats"
      aria-live="polite"
      aria-label="Summary statistics"
    >
      <MetricCard
        title="Total Prompts"
        value={totalPrompts}
        subtitle={promptsHint}
        icon={FileText}
      />
      <MetricCard
        title="Average Score"
        value={avgScoreDisplay}
        subtitle={scoreHint}
        icon={Target}
      />
      <MetricCard
        title="Improvement"
        value={improvementDisplay}
        trend={improvement !== null ? trend : undefined}
        change={improvementChange}
        subtitle={improvementHint ?? (improvement !== null ? 'vs previous period' : undefined)}
        icon={TrendingUpIcon}
      />
    </div>
  );
}
