'use client';

/**
 * useConversations Hook - Story 25-5: Connect Conversations UI
 *
 * TanStack Query hooks for fetching conversations from the API.
 * Provides loading states, error handling, and cache management.
 */

import { useQuery } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useConversations hook
 */
export interface UseConversationsOptions {
  projectId?: string;
  stage?: string;
  hasLoop?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'date' | 'messages' | 'score';
  limit?: number;
  offset?: number;
}

/**
 * Pagination info from API response
 */
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Conversation summary from API
 */
export interface ConversationSummary {
  id: string;
  sessionId: string;
  slug: string | null;
  projectId: string | null;
  projectName: string | null;
  userId: string;
  userName?: string;
  startedAt: string;
  endedAt: string | null;
  userMessageCount: number;
  totalMessages: number;
  primaryStage: string | null;
  hasDebuggingLoop: boolean;
  conversationScore: number | null;
  gitBranch: string | null;
  cwd: string | null;
  claudeCodeVersion: string | null;
}

/**
 * API response shape for conversations list
 */
export interface ConversationsResponse {
  data: {
    conversations: ConversationSummary[];
    pagination: PaginationInfo;
  };
}

/**
 * Conversation detail from thread API
 */
export interface ConversationDetail {
  id: string;
  sessionId: string;
  slug: string | null;
  projectId: string | null;
  projectName: string | null;
  userId: string;
  userName?: string;
  startedAt: string;
  endedAt: string | null;
  duration: number;
  userMessageCount: number;
  totalMessages: number;
  primaryStage: string | null;
  hasDebuggingLoop: boolean;
  conversationScore: number | null;
  stageBreakdown: Record<string, number> | null;
  gitBranch: string | null;
  cwd: string | null;
  claudeCodeVersion: string | null;
}

/**
 * Threaded message from API
 */
export interface ThreadedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sequenceNumber: number;
  promptType?: string;
  score?: number;
  detectedStage?: string;
  isInDebuggingLoop?: boolean;
  analysis?: {
    overallScore: number;
    dimensions: Record<string, number>;
    feedback?: string;
  };
  thinkingSummary?: string;
  thinkingWordCount?: number;
  toolCount?: number;
  toolsUsed?: string[];
  toolExecutions?: Array<{
    id: string;
    toolName: string;
    toolId?: string;
    inputSummary: string;
    outputSummary?: string;
    success?: boolean;
    executionOrder: number;
  }>;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  stopReason?: string;
}

/**
 * API response shape for conversation thread
 */
export interface ConversationThreadResponse {
  data: {
    conversation: ConversationDetail;
    messages: ThreadedMessage[];
  };
}

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for conversations
 * Enables targeted invalidation and type-safe keys
 */
export const conversationsKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationsKeys.all, 'list'] as const,
  list: (options: UseConversationsOptions) =>
    [...conversationsKeys.lists(), options] as const,
  details: () => [...conversationsKeys.all, 'detail'] as const,
  detail: (sessionId: string) =>
    [...conversationsKeys.details(), sessionId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch conversations list with filtering and pagination
 *
 * @param options - Filter and pagination options
 * @returns TanStack Query result with conversations data
 *
 * @example
 * const { data, isPending, error } = useConversations({
 *   projectId: 'proj-123',
 *   stage: 'development',
 *   sortBy: 'date',
 *   limit: 50,
 * });
 */
export function useConversations(options: UseConversationsOptions = {}) {
  return useQuery<ConversationsResponse>({
    queryKey: conversationsKeys.list(options),
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (options.projectId) searchParams.set('project_id', options.projectId);
      if (options.stage) searchParams.set('stage', options.stage);
      if (options.hasLoop !== undefined)
        searchParams.set('has_loop', String(options.hasLoop));
      if (options.dateFrom) searchParams.set('date_from', options.dateFrom);
      if (options.dateTo) searchParams.set('date_to', options.dateTo);
      if (options.sortBy) searchParams.set('sort_by', options.sortBy);
      if (options.limit) searchParams.set('limit', String(options.limit));
      if (options.offset) searchParams.set('offset', String(options.offset));

      const queryString = searchParams.toString();
      const url = queryString
        ? `/api/conversations?${queryString}`
        : '/api/conversations';

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to fetch conversations: ${response.status}`
        );
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Options for the useConversation hook
 */
export interface UseConversationOptions {
  enabled?: boolean;
  includeResponses?: boolean;
  includeTools?: boolean;
}

/**
 * Hook to fetch a single conversation thread
 *
 * @param sessionId - The session ID or UUID
 * @param options - Query options
 * @returns TanStack Query result with conversation thread data
 *
 * @example
 * const { data, isPending, error } = useConversation(sessionId, {
 *   includeResponses: true,
 *   includeTools: true,
 * });
 */
export function useConversation(
  sessionId: string,
  options: UseConversationOptions = {}
) {
  const { enabled = true, includeResponses = true, includeTools = true } = options;

  return useQuery<ConversationThreadResponse>({
    queryKey: conversationsKeys.detail(sessionId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (!includeResponses) searchParams.set('include_responses', 'false');
      if (!includeTools) searchParams.set('include_tools', 'false');

      const queryString = searchParams.toString();
      const url = queryString
        ? `/api/conversations/${sessionId}?${queryString}`
        : `/api/conversations/${sessionId}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to fetch conversation: ${response.status}`
        );
      }

      return response.json();
    },
    enabled: enabled && !!sessionId,
    staleTime: 30 * 1000, // 30 seconds
  });
}
