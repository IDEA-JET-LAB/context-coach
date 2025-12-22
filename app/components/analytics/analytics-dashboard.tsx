'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { usePersonalAnalytics, TimeRange } from '@/lib/hooks/use-personal-analytics';
import { ScoreTrendChart } from './score-trend-chart';
import { SummaryStats } from './summary-stats';
import { DimensionBreakdown } from './dimension-breakdown';
import { TimeRangeSelector } from './time-range-selector';
import { AnalyticsEmptyState } from './analytics-empty-state';
import { Skeleton } from '@/components/ui/skeleton';

const STORAGE_KEY = 'contextor-analytics-time-range';
const VALID_TIME_RANGES: readonly TimeRange[] = ['today', '7d', '30d', '90d', 'all'] as const;

/**
 * Validates time range value from localStorage (M33)
 * Returns validated TimeRange or null if invalid
 */
function validateTimeRange(value: unknown): TimeRange | null {
  if (typeof value !== 'string') return null;
  // Type-safe check against valid values
  if ((VALID_TIME_RANGES as readonly string[]).includes(value)) {
    return value as TimeRange;
  }
  return null;
}

interface AnalyticsDashboardProps {
  userId: string;
}

export function AnalyticsDashboard({ userId }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [mounted, setMounted] = useState(false);

  // Restore time range from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const validated = validateTimeRange(stored);
      if (validated) {
        setTimeRange(validated);
      }
    } catch {
      // localStorage unavailable, use default
    }
  }, []);

  // Persist time range to localStorage
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    localStorage.setItem(STORAGE_KEY, range);
  };

  const { data, isPending, error } = usePersonalAnalytics(userId, timeRange);

  // Show error toast notification
  useEffect(() => {
    if (error) {
      toast.error('Failed to load analytics', {
        description: 'Please try refreshing the page.',
      });
    }
  }, [error]);

  // Show loading state before mount to avoid hydration mismatch
  if (!mounted || isPending) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-500/30 bg-red-500/10 p-4"
        data-testid="analytics-error"
      >
        <p className="text-red-500">Failed to load analytics. Please try again.</p>
      </div>
    );
  }

  if (!data || data.totalPrompts === 0) {
    return <AnalyticsEmptyState hasAnyData={false} />;
  }

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#fafafa]">Your Progress</h2>
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
      </div>

      <SummaryStats
        totalPrompts={data.totalPrompts}
        analyzedPrompts={data.analyzedPrompts}
        avgScore={data.avgScore}
        improvement={data.improvement}
        trend={data.trend}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
          <h3 className="mb-4 font-medium text-[#fafafa]">Score Trend</h3>
          <ScoreTrendChart data={data.trendData} trend={data.trend} />
        </div>

        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
          <DimensionBreakdown dimensions={data.dimensions} />
        </div>
      </div>
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6" data-testid="analytics-loading">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32 bg-[#2a2a2a]" />
        <Skeleton className="h-10 w-[140px] bg-[#2a2a2a]" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 bg-[#2a2a2a]" />
        <Skeleton className="h-24 bg-[#2a2a2a]" />
        <Skeleton className="h-24 bg-[#2a2a2a]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[350px] bg-[#2a2a2a]" />
        <Skeleton className="h-[350px] bg-[#2a2a2a]" />
      </div>
    </div>
  );
}
