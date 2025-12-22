'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimePrompts(teamId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Memoize Supabase client to prevent recreation on every render (M36)
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!teamId) return;

    // Clean up any existing channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`prompts-realtime-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prompts',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          // Invalidate cache to refetch with new data
          queryClient.invalidateQueries({ queryKey: ['prompts', teamId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'prompts',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          // Update specific prompt in cache when status changes
          queryClient.invalidateQueries({ queryKey: ['prompts', teamId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prompt_analyses',
        },
        () => {
          // Refetch when analysis completes
          queryClient.invalidateQueries({ queryKey: ['prompts', teamId] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup on unmount - CRITICAL to prevent memory leaks
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [teamId, queryClient, supabase]);
}
