'use client';

import { useQuery } from '@tanstack/react-query';
import { generateInstallToken } from '@/lib/actions/generate-install-token';

export function useInstallToken(projectId?: string) {
  return useQuery({
    queryKey: ['install-token', projectId],
    queryFn: () => generateInstallToken(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
