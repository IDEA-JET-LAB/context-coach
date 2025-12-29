/**
 * Conversation Types - Story 25-2: Conversations List Endpoint
 *
 * Types for the conversations list API endpoint.
 */

/**
 * Valid project stages for filtering and display.
 * Combines Phase 2 and Phase 3 stage values.
 */
export type ProjectStage =
  | 'architecture'
  | 'specification'
  | 'development'
  | 'debugging'
  | 'enhancement'
  | 'planning'
  | 'implementation'
  | 'refactoring'
  | 'testing'
  | 'documentation'
  | 'review'
  | 'exploration'
  | 'unknown';

/**
 * Breakdown of prompt counts per development stage.
 */
export interface StageBreakdown {
  architecture?: number;
  specification?: number;
  development?: number;
  debugging?: number;
  enhancement?: number;
  planning?: number;
  implementation?: number;
  refactoring?: number;
  testing?: number;
  documentation?: number;
  review?: number;
  exploration?: number;
  unknown?: number;
}

/**
 * Summary of a conversation (session) for the list view.
 */
export interface ConversationSummary {
  /** Database UUID of the session */
  id: string;
  /** Claude Code session identifier (session_<uuid>) */
  sessionId: string;
  /** Human-readable name for the session */
  slug: string | null;
  /** Associated project UUID */
  projectId: string | null;
  /** Associated project name */
  projectName: string | null;
  /** User who owns the session */
  userId: string;
  /** User's display name */
  userName?: string;
  /** When the session started (ISO 8601) */
  startedAt: string;
  /** When the session ended (ISO 8601, null if active) */
  endedAt: string | null;
  /** Count of user messages in the session (Phase 3) */
  userMessageCount: number;
  /** Total message count (prompts) */
  totalMessages: number;
  /** Primary detected project stage (Phase 3) */
  primaryStage: ProjectStage | null;
  /** Whether a debugging loop was detected (Phase 3) */
  hasDebuggingLoop: boolean;
  /** Aggregate conversation score (Phase 3) */
  conversationScore: number | null;
  /** Breakdown of prompts by stage (Phase 3) */
  stageBreakdown: StageBreakdown | null;
  /** Git branch during the session */
  gitBranch: string | null;
  /** Current working directory */
  cwd: string | null;
  /** Claude Code CLI version */
  claudeCodeVersion: string | null;
}

/**
 * Pagination information for list responses.
 */
export interface PaginationInfo {
  /** Total number of matching conversations */
  total: number;
  /** Maximum results per page */
  limit: number;
  /** Current offset (starting record) */
  offset: number;
  /** Whether more results exist beyond this page */
  hasMore: boolean;
}

/**
 * Successful response from GET /api/conversations.
 */
export interface ConversationsResponse {
  data: {
    conversations: ConversationSummary[];
    pagination: PaginationInfo;
  };
}

/**
 * Error response from conversations endpoint.
 */
export interface ConversationsErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Sort options for conversation list.
 */
export type ConversationSortBy = 'date' | 'messages' | 'score';
