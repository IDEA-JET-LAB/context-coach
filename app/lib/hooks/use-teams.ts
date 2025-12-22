'use client';

import { useQuery } from '@tanstack/react-query';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  role: 'member' | 'admin';
}

async function fetchTeams(): Promise<Team[]> {
  const response = await fetch('/api/teams');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch teams');
  }

  return data.data.teams;
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
