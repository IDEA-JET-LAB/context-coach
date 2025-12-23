'use client';

import { NoPromptsEmptyState } from '@/components/feedback';
import { CliInstructions } from '@/components/onboarding/cli-instructions';

interface EmptyFeedProps {
  projectId?: string;
}

export function EmptyFeed({ projectId }: EmptyFeedProps) {
  return (
    <div className="space-y-6">
      <NoPromptsEmptyState />
      <CliInstructions projectId={projectId} />
    </div>
  );
}
