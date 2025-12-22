'use client';

import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { CliInstructions } from '@/components/onboarding/cli-instructions';

interface EmptyFeedProps {
  projectId?: string;
}

export function EmptyFeed({ projectId }: EmptyFeedProps) {
  return (
    <EmptyState
      icon={Inbox}
      title="Waiting for your first prompt"
      description="Once you start using Claude with the Contextor CLI installed, your prompts will appear here with scores and insights."
    >
      <CliInstructions projectId={projectId} />
    </EmptyState>
  );
}
