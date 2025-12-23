'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { showToast } from '@/components/feedback';
import { useEnhancedPersonalAnalytics } from '@/lib/hooks/use-enhanced-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SummaryCards,
  WorkStyleRadar,
  SentimentInsights,
  SessionHealthTrend,
  ToolUsageInsights,
  ActivityHeatMap,
  TeamComparison,
  WeeklyReportSummary,
  ComparisonPanel,
  PersonalizedTips,
  TimeRangeFilter,
} from '@/components/analytics/insights';
import type { InsightsTimeRange } from '@/lib/types/insights';

const STORAGE_KEY = 'contextor-insights-time-range';
const VALID_TIME_RANGES: InsightsTimeRange[] = ['7d', '30d', '90d', 'all'];

function validateTimeRange(value: unknown): InsightsTimeRange | null {
  if (typeof value !== 'string') return null;
  if ((VALID_TIME_RANGES as string[]).includes(value)) {
    return value as InsightsTimeRange;
  }
  return null;
}

interface InsightsDashboardProps {
  userId: string;
  teamId?: string;
}

export function InsightsDashboard({ userId, teamId }: InsightsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize time range from URL, localStorage, or default
  const [timeRange, setTimeRange] = useState<InsightsTimeRange>(() => {
    const urlTimeRange = searchParams.get('timeRange');
    const validated = validateTimeRange(urlTimeRange);
    if (validated) return validated;

    // Try localStorage on client
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedValidated = validateTimeRange(stored);
        if (storedValidated) return storedValidated;
      } catch {
        // localStorage unavailable
      }
    }
    return '7d';
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update URL and localStorage when time range changes
  const handleTimeRangeChange = (range: InsightsTimeRange) => {
    setTimeRange(range);

    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set('timeRange', range);
    router.replace(`?${params.toString()}`, { scroll: false });

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, range);
    } catch {
      // localStorage unavailable
    }
  };

  const { data, isPending, error, refetch } = useEnhancedPersonalAnalytics(timeRange, teamId);

  // Show error toast
  useEffect(() => {
    if (error) {
      showToast.error('Failed to load insights', {
        description: 'Please try refreshing the page.',
      });
    }
  }, [error]);

  // Loading state
  if (!mounted || isPending) {
    return <InsightsLoadingSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/10 p-6"
        data-testid="insights-error"
      >
        <p className="text-destructive mb-4">Failed to load insights. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (!data || data.summary.totalPrompts === 0) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-8 text-center"
        data-testid="insights-empty"
      >
        <h3 className="text-lg font-medium text-foreground mb-2">No Data Yet</h3>
        <p className="text-muted-foreground mb-4">
          Start submitting prompts to see your personalized insights.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="insights-dashboard">
      {/* Weekly Report at Top */}
      <WeeklyReportSummary weeklyReport={data.weeklyReport} />

      {/* Summary Cards */}
      <SummaryCards summary={data.summary} />

      {/* Time Range Filter */}
      <div className="flex justify-end">
        <TimeRangeFilter value={timeRange} onChange={handleTimeRangeChange} />
      </div>

      {/* Main Grid - 2 columns on large screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Work Style Radar */}
        <WorkStyleRadar
          workStyle={data.workStyle}
          technicalProfile={data.technicalProfile}
        />

        {/* Sentiment Insights */}
        <SentimentInsights sentiment={data.sentiment} />

        {/* Session Health Trend */}
        <SessionHealthTrend sessionHealth={data.sessionHealth} />

        {/* Tool Usage */}
        <ToolUsageInsights toolUsage={data.toolUsage} />

        {/* Activity Heat Map */}
        <ActivityHeatMap heatMap={data.activityHeatMap} />

        {/* Team Comparison */}
        <TeamComparison teamComparison={data.teamComparison} />
      </div>

      {/* Full-width sections */}
      <ComparisonPanel
        currentSummary={data.summary}
        complexity={data.complexity}
        timing={data.timing}
      />

      {/* Personalized Tips */}
      <PersonalizedTips tips={data.personalizedTips} dismissable />
    </div>
  );
}

function InsightsLoadingSkeleton() {
  return (
    <div className="space-y-6" data-testid="insights-loading">
      {/* Weekly Report Skeleton */}
      <Skeleton className="h-48 bg-muted" />

      {/* Summary Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 bg-muted" />
        ))}
      </div>

      {/* Time Range Filter */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-[150px] bg-muted" />
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-[300px] bg-muted" />
        ))}
      </div>

      {/* Comparison Panel Skeleton */}
      <Skeleton className="h-64 bg-muted" />

      {/* Tips Skeleton */}
      <Skeleton className="h-48 bg-muted" />
    </div>
  );
}
