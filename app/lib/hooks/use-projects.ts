'use client';

import { useQuery } from '@tanstack/react-query';
import type { Project } from '@/types/project';

interface ProjectsResponse {
  projects: Project[];
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<ProjectsResponse> => {
      const response = await fetch('/api/projects');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch projects');
      }

      return data.data;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async (): Promise<Project> => {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch project');
      }

      return data.data.project;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
  });
}
