'use client';

import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AnalyticsEmptyStateProps {
  hasAnyData: boolean;
}

export function AnalyticsEmptyState({ hasAnyData }: AnalyticsEmptyStateProps) {
  if (hasAnyData) {
    // User has data but not in selected range
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        data-testid="analytics-empty-range"
      >
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground">No data in this range</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Try selecting a different time range to see your analytics.
        </p>
      </div>
    );
  }

  // User has no data at all
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="analytics-empty-state"
    >
      <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium text-foreground">Start tracking your progress</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        Once you capture some prompts, you'll see your score trends and improvement areas here.
      </p>
      <Link href="/prompts" className="mt-4">
        <Button variant="outline" data-testid="view-prompts-button">
          View Prompts
        </Button>
      </Link>
    </div>
  );
}
