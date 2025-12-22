'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeTeamAverage(teamId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`team-average-updates-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prompt_analyses',
        },
        () => {
          // Debounce to prevent rapid invalidations
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ['team-average', teamId],
            });
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [teamId, queryClient, supabase]);
}
