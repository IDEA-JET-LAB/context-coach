'use client';

import { cn } from '@/lib/utils';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
} from 'lucide-react';
import type { InsightsTeamComparison } from '@/lib/types/insights';

export interface TeamComparisonProps {
  teamComparison: InsightsTeamComparison;
  loading?: boolean;
  className?: string;
}

function PercentileBadge({ percentile }: { percentile: number }) {
  const getColor = () => {
    if (percentile >= 75) return 'bg-score-high/10 text-score-high';
    if (percentile >= 50) return 'bg-primary/10 text-primary';
    if (percentile >= 25) return 'bg-score-growth/10 text-score-growth';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getColor())}>
      Top {100 - percentile}%
    </span>
  );
}

export function TeamComparison({
  teamComparison,
  loading = false,
  className,
}: TeamComparisonProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="team-comparison-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!teamComparison.isTeamMember) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="team-comparison-no-team"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Team Comparison</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[150px] text-center">
          <Users className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Join a team to see how you compare
          </p>
        </div>
      </div>
    );
  }

  if (!teamComparison.teamAverages || !teamComparison.comparison) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="team-comparison-no-data"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Team Comparison</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[150px] text-center">
          <Target className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Not enough team data for comparison
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="team-comparison"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Team Comparison</h3>
        </div>
      </div>

      {/* Comparison Metrics */}
      <div className="space-y-3">
        {teamComparison.comparison.map((item) => {
          const TrendIcon = item.isAboveAverage ? TrendingUp : item.difference < 0 ? TrendingDown : Minus;
          const trendColor = item.isAboveAverage
            ? 'text-score-high'
            : item.difference < 0
              ? 'text-score-growth'
              : 'text-muted-foreground';

          // Get the corresponding percentile
          let percentile = 50;
          if (teamComparison.userPercentiles) {
            switch (item.metric) {
              case 'Prompt Score':
                percentile = teamComparison.userPercentiles.promptScore;
                break;
              case 'Session Duration':
                percentile = teamComparison.userPercentiles.sessionDuration;
                break;
              case 'Prompts/Session':
                percentile = teamComparison.userPercentiles.promptsPerSession;
                break;
              case 'Complexity':
                percentile = teamComparison.userPercentiles.complexity;
                break;
            }
          }

          return (
            <div
              key={item.metric}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{item.metric}</span>
                  <PercentileBadge percentile={percentile} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-foreground">
                    {typeof item.userValue === 'number'
                      ? item.userValue.toFixed(1)
                      : item.userValue}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    vs {item.teamAverage.toFixed(1)} avg
                  </span>
                </div>
                {/* Comparison bar */}
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      item.isAboveAverage ? 'bg-score-high' : 'bg-primary'
                    )}
                    style={{
                      width: `${Math.min(100, (item.userValue / (item.teamAverage * 2)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className={cn('flex items-center gap-1', trendColor)}>
                <TrendIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {item.difference > 0 ? '+' : ''}{item.difference.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Team Averages Summary */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Team Benchmarks</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Score:</span>
            <span className="text-foreground font-medium">
              {teamComparison.teamAverages.avgPromptScore.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Duration:</span>
            <span className="text-foreground font-medium">
              {teamComparison.teamAverages.avgSessionDuration.toFixed(0)}m
            </span>
          </div>
        </div>
      </div>

      {/* Accessible description */}
      <span className="sr-only">
        Team comparison showing your metrics against team averages.
        {teamComparison.comparison.map((item) =>
          `${item.metric}: you have ${item.userValue}, team average is ${item.teamAverage}.`
        ).join(' ')}
      </span>
    </div>
  );
}
