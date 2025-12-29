'use client';

/**
 * useRealtimeConversations Hook - Story 25-5: Connect Conversations UI
 *
 * Real-time subscription hooks for conversations using Supabase Realtime.
 * Provides automatic cache invalidation when new prompts or sessions are added.
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { conversationsKeys } from './use-conversations';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Polling interval in milliseconds (5 seconds) as fallback
const POLLING_INTERVAL_MS = 5000;

/**
 * Hook for real-time updates to the conversations list.
 * Subscribes to prompts and sessions table changes for the team.
 *
 * @param teamId - The team ID to subscribe to
 *
 * @example
 * // In a page component
 * const { teamId } = useCurrentTeam();
 * useRealtimeConversations(teamId);
 *
 * // Conversations list will auto-refresh when new prompts arrive
 */
export function useRealtimeConversations(teamId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeActiveRef = useRef<boolean>(false);

  // Memoize Supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), []);

  // Helper to invalidate all conversations queries
  const invalidateConversationsQueries = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === 'conversations';
      },
    });
  }, [queryClient]);

  // Start polling as a fallback when realtime fails
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling

    console.debug('[Conversations] Starting polling fallback for team:', teamId);
    pollingIntervalRef.current = setInterval(() => {
      invalidateConversationsQueries();
    }, POLLING_INTERVAL_MS);
  }, [teamId, invalidateConversationsQueries]);

  // Stop polling when realtime is working
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.debug('[Conversations] Stopped polling, realtime active');
    }
  }, []);

  useEffect(() => {
    if (!teamId) return;

    // Clean up any existing channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`conversations-realtime-${teamId}`)
      // Listen for new prompts
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prompts',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          // Invalidate conversations list
          invalidateConversationsQueries();
        }
      )
      // Listen for session updates (aggregates, ended_at, etc.)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          // Invalidate specific conversation using session_id (string) for URL-based cache keys
          if (payload.new && typeof payload.new === 'object' && 'session_id' in payload.new) {
            const sessionId = (payload.new as { session_id: string }).session_id;
            queryClient.invalidateQueries({
              queryKey: conversationsKeys.detail(sessionId),
            });
          }
          // Also invalidate list for aggregate updates
          invalidateConversationsQueries();
        }
      )
      // Listen for new sessions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sessions',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          invalidateConversationsQueries();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[Realtime] Conversations subscription active for team:', teamId);
          realtimeActiveRef.current = true;
          stopPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] Conversations subscription failed, falling back to polling:', teamId);
          realtimeActiveRef.current = false;
          startPolling();
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      stopPolling();
      realtimeActiveRef.current = false;
    };
  }, [teamId, queryClient, supabase, invalidateConversationsQueries, startPolling, stopPolling]);
}

/**
 * Hook for real-time updates to a specific conversation thread.
 * Subscribes to prompts and prompt_responses changes for the session.
 *
 * IMPORTANT: Session ID vs Session UUID Clarification
 * - sessionUuid: The database UUID (sessions.id), used for subscription filters
 * - sessionIdForCache: The session_id string, used for cache key invalidation
 *
 * @param sessionUuid - The session UUID (database id), NOT the session_id string
 * @param sessionIdForCache - The session_id string used for cache key (URL-friendly)
 *
 * @example
 * // In the thread component
 * const { conversation } = data;
 * useRealtimeConversationThread(conversation.id, conversation.sessionId);
 *
 * // Thread will auto-refresh when new prompts or responses arrive
 */
export function useRealtimeConversationThread(
  sessionUuid: string | undefined,
  sessionIdForCache?: string
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeActiveRef = useRef<boolean>(false);

  // Memoize Supabase client
  const supabase = useMemo(() => createClient(), []);

  // Use sessionIdForCache for cache keys, fallback to sessionUuid if not provided
  const cacheKey = sessionIdForCache || sessionUuid || '';

  // Helper to invalidate the conversation thread
  const invalidateThread = useCallback(() => {
    if (cacheKey) {
      queryClient.invalidateQueries({
        queryKey: conversationsKeys.detail(cacheKey),
      });
    }
  }, [queryClient, cacheKey]);

  // Polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.debug('[Thread] Starting polling fallback for session:', sessionUuid);
    pollingIntervalRef.current = setInterval(() => {
      invalidateThread();
    }, POLLING_INTERVAL_MS);
  }, [sessionUuid, invalidateThread]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.debug('[Thread] Stopped polling, realtime active');
    }
  }, []);

  useEffect(() => {
    if (!sessionUuid) return;

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`thread-${sessionUuid}`)
      // Listen for new prompts in this session
      // IMPORTANT: session_uuid column references sessions.id (UUID), not session_id (string)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prompts',
          filter: `session_uuid=eq.${sessionUuid}`,
        },
        () => {
          invalidateThread();
        }
      )
      // Listen for prompt updates (analysis results)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'prompts',
          filter: `session_uuid=eq.${sessionUuid}`,
        },
        () => {
          invalidateThread();
        }
      )
      // Listen for new responses
      // IMPORTANT: session_uuid column references sessions.id (UUID), not session_id (string)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prompt_responses',
          filter: `session_uuid=eq.${sessionUuid}`,
        },
        () => {
          invalidateThread();
        }
      )
      // Listen for analysis results
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'prompt_analyses',
        },
        () => {
          // Can't filter by session directly, so just invalidate
          invalidateThread();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[Realtime] Thread subscription active for session:', sessionUuid);
          realtimeActiveRef.current = true;
          stopPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] Thread subscription failed, falling back to polling:', sessionUuid);
          realtimeActiveRef.current = false;
          startPolling();
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      stopPolling();
      realtimeActiveRef.current = false;
    };
  }, [sessionUuid, cacheKey, queryClient, supabase, invalidateThread, startPolling, stopPolling]);
}
