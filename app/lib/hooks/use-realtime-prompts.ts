'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimePrompts(teamId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!teamId) return;

    // Create client inside effect to avoid dependency issues
    const supabase = createClient();

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
        (payload) => {
          console.log('[Realtime] New prompt received:', payload.new);
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
        (payload) => {
          console.log('[Realtime] Prompt updated:', payload.new);
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
        (payload) => {
          console.log('[Realtime] Analysis completed:', payload.new);
          // Refetch when analysis completes
          queryClient.invalidateQueries({ queryKey: ['prompts', teamId] });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup on unmount - CRITICAL to prevent memory leaks
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [teamId, queryClient]);
}
