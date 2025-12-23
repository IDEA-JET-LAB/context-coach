'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/components/feedback';
import type { UpdateProjectInput } from '@/lib/validations/project';
import type { Project } from '@/types/project';

interface UpdateProjectResponse {
  project: Project;
}

interface UseUpdateProjectOptions {
  onSuccess?: (data: UpdateProjectResponse) => void;
  onError?: (error: Error) => void;
}

export function useUpdateProject(options?: UseUpdateProjectOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: UpdateProjectInput;
    }): Promise<UpdateProjectResponse> => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to update project');
      }

      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate project queries
      queryClient.invalidateQueries({ queryKey: ['project', data.project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      showToast.success('Project updated successfully');
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      showToast.error(error.message);
      options?.onError?.(error);
    },
  });
}
