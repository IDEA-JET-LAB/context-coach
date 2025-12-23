'use client';

import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/feedback';

interface EmptyProjectsProps {
  isAdmin?: boolean;
}

export function EmptyProjects({ isAdmin = false }: EmptyProjectsProps) {
  const router = useRouter();

  return (
    <EmptyState
      variant="folder"
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
              onClick: () => router.push('/projects/new'),
            }
          : undefined
      }
    />
  );
}
