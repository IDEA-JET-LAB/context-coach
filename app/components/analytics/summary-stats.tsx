'use client';

import { StatCard, TrendDirection } from '@/components/dashboard/stat-card';
import { SCORE_DECIMAL_PLACES } from '@/lib/constants/analytics';

interface SummaryStatsProps {
  totalPrompts: number;
  avgScore: number;
  improvement: number;
  trend: TrendDirection;
}

export function SummaryStats({ totalPrompts, avgScore, improvement, trend }: SummaryStatsProps) {
  const improvementDisplay = `${improvement >= 0 ? '+' : ''}${improvement.toFixed(SCORE_DECIMAL_PLACES)}%`;

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
      />
      <StatCard
        label="Average Score"
        value={`${avgScore.toFixed(SCORE_DECIMAL_PLACES)}/10`}
      />
      <StatCard
        label="Improvement"
        value={improvementDisplay}
        trend={trend}
        trendValue="vs previous period"
      />
    </div>
  );
}
