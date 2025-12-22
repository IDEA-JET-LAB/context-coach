'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useEffect } from 'react';
import type { OnboardingStatus } from '@/lib/utils/onboarding-steps';

export function useOnboardingStatus() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('onboarding-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_members' },
        () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'projects' },
        () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prompts' },
        () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  return useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async (): Promise<OnboardingStatus> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check team membership
      const { data: teams } = await supabase
        .from('team_members')
        .select('id, team_id')
        .eq('user_id', user.id)
        .limit(1);

      const hasTeam = (teams?.length ?? 0) > 0;
      const teamId = teams?.[0]?.team_id ?? null;

      // Check projects (RLS filters by team_id from JWT)
      let hasProject = false;
      if (teamId) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('team_id', teamId)
          .limit(1);
        hasProject = (projects?.length ?? 0) > 0;
      }

      // Check for prompts (indicates CLI is installed and working)
      const { data: prompts } = await supabase
        .from('prompts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const hasCapturedPrompt = (prompts?.length ?? 0) > 0;

      return {
        'create-team': hasTeam,
        'create-project': hasProject,
        'install-cli': hasCapturedPrompt,
        'capture-prompt': hasCapturedPrompt,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
