'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface CurrentTeam {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export function useCurrentTeam() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['current-team'],
    queryFn: async (): Promise<CurrentTeam | null> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return null;

      const teamId = session.user.app_metadata?.team_id;
      if (!teamId) return null;

      const { data, error } = await supabase
        .from('teams')
        .select('id, name, description, created_at')
        .eq('id', teamId)
        .single();

      if (error) {
        console.error('[useCurrentTeam] Error fetching team:', error);
        return null;
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
