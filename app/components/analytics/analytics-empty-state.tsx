'use client';

import { useRouter } from 'next/navigation';
import { EmptyState, NoAnalyticsDataEmptyState } from '@/components/feedback';

interface AnalyticsEmptyStateProps {
  hasAnyData: boolean;
}

export function AnalyticsEmptyState({ hasAnyData }: AnalyticsEmptyStateProps) {
  const router = useRouter();

  if (hasAnyData) {
    // User has data but not in selected range
    return (
      <div data-testid="analytics-empty-range">
        <EmptyState
          variant="analytics"
          title="No data in this range"
          description="Try selecting a different time range to see your analytics."
          size="sm"
        />
      </div>
    );
  }

  // User has no data at all
  return (
    <div data-testid="analytics-empty-state">
      <EmptyState
        variant="analytics"
        title="Start tracking your progress"
        description="Once you capture some prompts, you'll see your score trends and improvement areas here."
        action={{ label: 'View Prompts', onClick: () => router.push('/prompts') }}
      />
    </div>
  );
}
