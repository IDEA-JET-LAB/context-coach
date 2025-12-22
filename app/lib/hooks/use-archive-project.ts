'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ArchiveProjectResponse {
  success: boolean;
}

interface UseArchiveProjectOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useArchiveProject(options?: UseArchiveProjectOptions) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      projectId,
    }: {
      projectId: string;
    }): Promise<ArchiveProjectResponse> => {
      const response = await fetch(`/api/projects/${projectId}/archive`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to archive project');
      }

      return result.data;
    },
    onSuccess: () => {
      // Invalidate projects list to remove archived project from cache
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast.success('Project archived successfully');

      // Redirect to projects list
      router.push('/projects');

      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      options?.onError?.(error);
    },
  });
}
