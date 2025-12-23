'use client';

import { useQuery } from '@tanstack/react-query';
import { generateInstallToken } from '@/lib/actions/generate-install-token';

export function useInstallToken(projectId?: string) {
  return useQuery({
    queryKey: ['install-token', projectId],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return generateInstallToken(projectId);
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes - token is valid for 1 hour
    retry: false, // Don't retry on error (e.g., missing encryption key)
  });
}
