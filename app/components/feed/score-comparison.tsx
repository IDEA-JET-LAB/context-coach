'use client';

import { cn } from '@/lib/utils';
import { ScoreBadge } from './score-badge';
import { ComparisonIndicator } from './comparison-indicator';
import { TeamAverageBadge } from './team-average-badge';
import { useTeamAverage, type TimeWindow } from '@/lib/hooks/use-team-average';

export interface ScoreComparisonProps {
  score: number;
  teamId: string;
  layout?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  timeWindow?: TimeWindow;
  showTeamAverage?: boolean;
}

export function ScoreComparison({
  score,
  teamId,
  layout = 'horizontal',
  size = 'md',
  timeWindow = '30d',
  showTeamAverage = false,
}: ScoreComparisonProps) {
  const { data, isPending } = useTeamAverage(teamId, timeWindow);

  const hasTeamData = data?.average !== null && data !== undefined;
  const hasMultiplePrompts = hasTeamData && data.count > 1;

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        layout === 'vertical' && 'flex-col'
      )}
      data-testid="score-comparison"
      data-layout={layout}
    >
      <ScoreBadge score={score} size={size} />

      {isPending ? (
        <div
          className="h-4 w-12 animate-pulse rounded bg-[#2a2a2a]"
          data-testid="comparison-loading"
        />
      ) : hasMultiplePrompts && data.average !== null ? (
        <div
          className={cn(
            'flex items-center gap-2',
            layout === 'vertical' && 'flex-col'
          )}
        >
          <ComparisonIndicator
            userScore={score}
            teamAverage={data.average}
            showValue={layout === 'vertical' || size !== 'sm'}
          />
          {showTeamAverage && (
            <TeamAverageBadge average={data.average} />
          )}
        </div>
      ) : (
        <span
          className="text-xs text-muted-foreground"
          data-testid="no-comparison-data"
        >
          {data?.count === 1 ? 'Only prompt' : 'No team data'}
        </span>
      )}
    </div>
  );
}
