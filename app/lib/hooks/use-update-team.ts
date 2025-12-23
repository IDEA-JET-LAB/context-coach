'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/feedback';
import type { UpdateTeamInput } from '@/lib/validations/team';

interface UpdateTeamParams extends UpdateTeamInput {
  teamId: string;
}

interface UpdateTeamResponse {
  team: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
  };
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ teamId, name, description }: UpdateTeamParams): Promise<UpdateTeamResponse> => {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update team');
      }

      return data.data;
    },
    onSuccess: (_, { teamId }) => {
      // Invalidate all team-related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['current-team'] });
      showToast.success('Team settings updated');
      // Refresh server components to update the page heading
      router.refresh();
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });
}
