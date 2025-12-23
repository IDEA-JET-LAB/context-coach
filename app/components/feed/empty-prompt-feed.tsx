'use client';

import { useRouter } from 'next/navigation';
import { FolderPlus } from 'lucide-react';
import { EmptyState, NoPromptsEmptyState } from '@/components/feedback';

interface EmptyPromptFeedProps {
  hasProjects: boolean;
}

export function EmptyPromptFeed({ hasProjects }: EmptyPromptFeedProps) {
  const router = useRouter();

  if (!hasProjects) {
    return (
      <div data-testid="empty-feed-no-projects">
        <EmptyState
          variant="folder"
          icon={FolderPlus}
          title="No projects yet"
          description="Create a project to start capturing prompts from your AI-assisted development."
          action={{ label: 'Create Project', onClick: () => router.push('/projects/new') }}
        />
      </div>
    );
  }

  return (
    <div data-testid="empty-feed-no-prompts">
      <NoPromptsEmptyState />
    </div>
  );
}
