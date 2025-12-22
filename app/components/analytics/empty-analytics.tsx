'use client';

import { BarChart2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyAnalyticsProps {
  promptCount: number;
  minimumRequired?: number;
}

export function EmptyAnalytics({
  promptCount,
  minimumRequired = 5,
}: EmptyAnalyticsProps) {
  const remaining = minimumRequired - promptCount;

  return (
    <EmptyState
      icon={BarChart2}
      title="Not enough data yet"
      description={
        promptCount === 0
          ? 'Start capturing prompts to build your analytics history.'
          : `You need ${remaining} more prompt${remaining === 1 ? '' : 's'} to see trends and analytics.`
      }
      action={{
        label: 'View Feed',
        href: '/',
      }}
    />
  );
}
