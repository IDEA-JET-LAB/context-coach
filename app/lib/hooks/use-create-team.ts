'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/components/feedback';
import { useRouter } from 'next/navigation';
import type { CreateTeamInput } from '@/lib/validations/team';

interface CreateTeamResponse {
  team: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
  };
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (input: CreateTeamInput): Promise<CreateTeamResponse> => {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create team');
      }

      return data.data;
    },
    onSuccess: async (data) => {
      // Refresh session to get new JWT with team_id claim
      const { error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('[useCreateTeam] Error refreshing session:', error);
        showToast.error('Please refresh the page to complete team setup');
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['current-team'] });

      showToast.success(`Team "${data.team.name}" created successfully!`);

      // Force page reload to refetch server data and go to dashboard
      window.location.href = '/home';
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });
}
