'use client';

import { Terminal, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface EmptyPromptFeedProps {
  hasProjects: boolean;
}

export function EmptyPromptFeed({ hasProjects }: EmptyPromptFeedProps) {
  if (!hasProjects) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        data-testid="empty-feed-no-projects"
      >
        <FolderPlus className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground">No projects yet</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Create a project to start capturing prompts from your AI-assisted development.
        </p>
        <Button asChild className="mt-6">
          <Link href="/projects/new">Create Project</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="empty-feed-no-prompts"
    >
      <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium text-foreground">Waiting for your first prompt</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Install Contextor in your project to start capturing prompts automatically.
      </p>
      <div className="mt-6 p-4 rounded-lg bg-card border border-border text-left">
        <p className="text-xs text-muted-foreground mb-2">Run in your project:</p>
        <code className="text-sm text-foreground font-mono">
          npx @contextor/cli init
        </code>
      </div>
    </div>
  );
}
