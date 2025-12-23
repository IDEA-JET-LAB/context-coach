'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/components/feedback';
import { useRouter } from 'next/navigation';

interface SwitchTeamInput {
  teamId: string;
}

interface SwitchTeamResponse {
  team: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    created_by: string | null;
  };
}

export function useSwitchTeam() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ teamId }: SwitchTeamInput): Promise<SwitchTeamResponse> => {
      const response = await fetch('/api/teams/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to switch team');
      }

      return data.data;
    },
    onSuccess: async (data) => {
      // Refresh session to get new JWT with updated team_id claim
      const { error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('[useSwitchTeam] Error refreshing session:', error);
        showToast.error('Please refresh the page to complete team switch');
        return;
      }

      // Clear all cached queries to ensure fresh data for new team context
      queryClient.clear();

      // Show success toast
      showToast.success(`Switched to ${data.team.name}`);

      // Navigate to team dashboard with fresh context
      router.push('/team');
      router.refresh();
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });
}
