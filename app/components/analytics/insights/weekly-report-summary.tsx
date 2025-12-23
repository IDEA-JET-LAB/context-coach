'use client';

import { cn } from '@/lib/utils';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import type { InsightsWeeklyReport } from '@/lib/types/insights';

export interface WeeklyReportSummaryProps {
  weeklyReport: InsightsWeeklyReport;
  loading?: boolean;
  className?: string;
}

export function WeeklyReportSummary({
  weeklyReport,
  loading = false,
  className,
}: WeeklyReportSummaryProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="weekly-report-loading"
      >
        <div className="h-4 w-48 animate-pulse rounded bg-muted mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const weekStart = new Date(weeklyReport.weekStartDate);
  const weekEnd = new Date(weeklyReport.weekEndDate);
  const dateRange = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;

  const comparison = weeklyReport.comparisonToPreviousWeek;

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="weekly-report-summary"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Weekly Insights</h3>
        </div>
        <span className="text-xs text-muted-foreground">{dateRange}</span>
      </div>

      {/* Highlights */}
      {weeklyReport.highlights.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-score-high" />
            <p className="text-xs text-muted-foreground">Highlights</p>
          </div>
          <div className="space-y-2">
            {weeklyReport.highlights.map((highlight, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 rounded-lg bg-score-high/5 border border-score-high/10"
              >
                <ChevronRight className="h-4 w-4 text-score-high shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{highlight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week over Week Comparison */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <ComparisonCard
          label="Prompts"
          current={comparison.totalPrompts.current}
          previous={comparison.totalPrompts.previous}
          change={comparison.totalPrompts.change}
        />
        <ComparisonCard
          label="Avg Score"
          current={comparison.avgScore.current}
          previous={comparison.avgScore.previous}
          change={comparison.avgScore.change}
          decimals={1}
        />
        <ComparisonCard
          label="Sessions"
          current={comparison.sessionCount.current}
          previous={comparison.sessionCount.previous}
          change={comparison.sessionCount.change}
        />
      </div>

      {/* Notable Changes */}
      {weeklyReport.notableChanges.length > 0 && (
        <div className="mb-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Notable Changes</p>
          <div className="space-y-2">
            {weeklyReport.notableChanges.slice(0, 3).map((change, index) => {
              const TrendIcon = change.isImprovement ? TrendingUp : TrendingDown;
              const trendColor = change.isImprovement ? 'text-score-high' : 'text-score-growth';

              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <span className="text-xs text-muted-foreground">{change.metric}</span>
                  <div className={cn('flex items-center gap-1', trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    <span className="text-xs font-medium">
                      {change.changePercent > 0 ? '+' : ''}{change.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievements */}
      {weeklyReport.achievementsUnlocked.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-1 mb-2">
            <Trophy className="h-3.5 w-3.5 text-score-high" />
            <p className="text-xs text-muted-foreground">Achievements Unlocked</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {weeklyReport.achievementsUnlocked.map((achievement) => (
              <span
                key={achievement.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-score-high/10 text-score-high text-xs font-medium"
                title={achievement.description}
              >
                <Trophy className="h-3 w-3" />
                {achievement.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {weeklyReport.highlights.length === 0 &&
        weeklyReport.notableChanges.length === 0 &&
        comparison.totalPrompts.current === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No activity this week yet</p>
          </div>
        )}

      {/* Accessible description */}
      <span className="sr-only">
        Weekly insights report for {dateRange}.
        This week: {comparison.totalPrompts.current} prompts,
        {comparison.sessionCount.current} sessions,
        average score {comparison.avgScore.current}.
        {weeklyReport.highlights.length > 0 && ` Highlights: ${weeklyReport.highlights.join('. ')}`}
      </span>
    </div>
  );
}

interface ComparisonCardProps {
  label: string;
  current: number;
  previous: number;
  change: number;
  decimals?: number;
}

function ComparisonCard({ label, current, previous, change, decimals = 0 }: ComparisonCardProps) {
  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const trendColor = change > 0
    ? 'text-score-high'
    : change < 0
      ? 'text-score-growth'
      : 'text-muted-foreground';

  return (
    <div className="p-2 rounded-lg bg-muted/30 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold text-foreground">
        {decimals > 0 ? current.toFixed(decimals) : current}
      </p>
      <div className={cn('flex items-center justify-center gap-0.5 text-xs', trendColor)}>
        <TrendIcon className="h-3 w-3" />
        <span>
          {change > 0 ? '+' : ''}{decimals > 0 ? change.toFixed(decimals) : change}
        </span>
      </div>
    </div>
  );
}
