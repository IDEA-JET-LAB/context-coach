'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const POLLING_INTERVAL = 30000; // 30 seconds fallback

/**
 * RealTimeStatsProvider - Handles real-time updates for admin dashboard stats.
 * Subscribes to Supabase realtime for prompts table changes.
 * Falls back to polling if realtime connection fails.
 *
 * Story 7.2: Admin Dashboard Overview
 */
export function RealTimeStatsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isRealtimeConnected = useRef(false);

  const invalidateStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'health'] });
  }, [queryClient]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return; // Already polling

    pollingRef.current = setInterval(() => {
      if (!isRealtimeConnected.current) {
        invalidateStats();
      }
    }, POLLING_INTERVAL);
  }, [invalidateStats]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Subscribe to prompts table for real-time updates
    const channel = supabase
      .channel('admin-stats-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prompts',
        },
        () => {
          // New prompt inserted - refresh stats
          invalidateStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'prompts',
          filter: 'analysis_status=in.(complete,failed)',
        },
        () => {
          // Analysis completed or failed - refresh health stats
          queryClient.invalidateQueries({ queryKey: ['admin', 'health'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isRealtimeConnected.current = true;
          stopPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          isRealtimeConnected.current = false;
          startPolling();
        }
      });

    // Start polling as a fallback initially
    startPolling();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
      stopPolling();
    };
  }, [supabase, queryClient, invalidateStats, startPolling, stopPolling]);

  return <>{children}</>;
}

/**
 * useRefreshStats - Hook to manually trigger stats refresh.
 * Can be used with a refresh button.
 */
export function useRefreshStats() {
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'health'] });
  }, [queryClient]);

  return { refresh };
}
