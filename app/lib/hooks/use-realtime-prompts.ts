'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Polling interval in milliseconds (5 seconds)
const POLLING_INTERVAL_MS = 5000;

export function useRealtimePrompts(teamId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeActiveRef = useRef<boolean>(false);

  // Memoize Supabase client to prevent recreation on every render (M36)
  const supabase = useMemo(() => createClient(), []);

  // Helper to invalidate all prompts queries for this team
  // Uses predicate to match any query starting with ['prompts', teamId]
  const invalidatePromptsQueries = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) &&
               key[0] === 'prompts' &&
               key[1] === teamId;
      },
    });
  }, [queryClient, teamId]);

  // Start polling as a fallback when realtime fails
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling

    console.debug('[Prompts] Starting polling fallback for team:', teamId);
    pollingIntervalRef.current = setInterval(() => {
      invalidatePromptsQueries();
    }, POLLING_INTERVAL_MS);
  }, [teamId, invalidatePromptsQueries]);

  // Stop polling when realtime is working
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.debug('[Prompts] Stopped polling, realtime active');
    }
  }, []);

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
          invalidatePromptsQueries();
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
          invalidatePromptsQueries();
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
          invalidatePromptsQueries();
        }
      )
      .subscribe((status) => {
        // Log subscription status for debugging
        if (status === 'SUBSCRIBED') {
          console.debug('[Realtime] Prompts subscription active for team:', teamId);
          realtimeActiveRef.current = true;
          stopPolling(); // Stop polling when realtime works
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] Prompts subscription failed, falling back to polling:', teamId);
          realtimeActiveRef.current = false;
          startPolling(); // Start polling as fallback
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount - CRITICAL to prevent memory leaks
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      stopPolling();
      realtimeActiveRef.current = false;
    };
  }, [teamId, queryClient, supabase, invalidatePromptsQueries, startPolling, stopPolling]);
}
