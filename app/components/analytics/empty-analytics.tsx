'use client';

import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/feedback';

interface EmptyAnalyticsProps {
  promptCount: number;
  minimumRequired?: number;
}

export function EmptyAnalytics({
  promptCount,
  minimumRequired = 5,
}: EmptyAnalyticsProps) {
  const router = useRouter();
  const remaining = minimumRequired - promptCount;

  return (
    <EmptyState
      variant="analytics"
      title="Not enough data yet"
      description={
        promptCount === 0
          ? 'Start capturing prompts to build your analytics history.'
          : `You need ${remaining} more prompt${remaining === 1 ? '' : 's'} to see trends and analytics.`
      }
      action={{
        label: 'View Feed',
        onClick: () => router.push('/'),
      }}
    />
  );
}
