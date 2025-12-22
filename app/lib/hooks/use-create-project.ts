'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { CreateProjectInput } from '@/lib/validations/project';
import type { CreateProjectResponse } from '@/types/project';

export function useCreateProject() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<CreateProjectResponse> => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create project');
      }

      return data.data;
    },
    onSuccess: (data) => {
      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast.success(`Project "${data.project.name}" created successfully!`);

      // Redirect to project success page with sensitive data
      // SECURITY NOTE: Using sessionStorage for one-time secret transfer
      // - sessionStorage is isolated per-origin and cleared on tab close
      // - Data is immediately deleted after reading (see project-success-content.tsx)
      // - This is more secure than URL params (which leak in referrer/history)
      // - Alternative would be state management, but route refresh would lose data
      // - Consider using Web Crypto API encryption if XSS is a concern
      sessionStorage.setItem(
        `project-created-${data.project.id}`,
        JSON.stringify({
          apiKey: data.apiKey,
          installToken: data.installToken,
        })
      );

      router.push(`/projects/${data.project.id}/created`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
