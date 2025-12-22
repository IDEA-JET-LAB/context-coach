'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project } from '@/types/project';

interface RegenerateKeyResponse {
  apiKey: string;
  installToken: string;
  project: Project;
}

interface UseRegenerateKeyOptions {
  onSuccess?: (data: RegenerateKeyResponse) => void;
  onError?: (error: Error) => void;
}

export function useRegenerateKey(options?: UseRegenerateKeyOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
    }: {
      projectId: string;
    }): Promise<RegenerateKeyResponse> => {
      const response = await fetch(`/api/projects/${projectId}/regenerate-key`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to regenerate API key');
      }

      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate project queries
      queryClient.invalidateQueries({ queryKey: ['project', data.project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}
