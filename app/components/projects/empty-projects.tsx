'use client';

import { FolderOpen } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyProjectsProps {
  isAdmin?: boolean;
}

export function EmptyProjects({ isAdmin = false }: EmptyProjectsProps) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No projects yet"
      description={
        isAdmin
          ? 'Projects help you organize prompts by codebase or application. Create your first project to get started.'
          : 'No projects have been created for this team yet. Contact your team admin to create one.'
      }
      action={
        isAdmin
          ? {
              label: 'Create Project',
              href: '/projects/new',
            }
          : undefined
      }
    />
  );
}
