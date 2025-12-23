/**
 * Session Types
 * Story 16-1: Sessions Database Schema
 */

/**
 * Reason why a session ended
 */
export type SessionEndReason = 'completed' | 'abandoned' | 'interrupted' | 'unknown';

/**
 * Session record from the database
 */
export interface Session {
  id: string;
  session_id: string;  // Claude Code's session identifier
  user_id: string;
  team_id: string;
  project_id: string | null;
  started_at: string;
  ended_at: string | null;
  end_reason: SessionEndReason | null;
  git_branch: string | null;
  claude_code_version: string | null;
  slug: string | null;
  cwd: string | null;
  total_prompts: number;
  total_tokens: number;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new session
 */
export interface CreateSessionInput {
  session_id: string;
  user_id: string;
  team_id: string;
  project_id?: string;
  started_at?: string;
  git_branch?: string;
  claude_code_version?: string;
  slug?: string;
  cwd?: string;
}

/**
 * Input for updating a session
 */
export interface UpdateSessionInput {
  ended_at?: string;
  end_reason?: SessionEndReason;
  total_prompts?: number;
  total_tokens?: number;
  slug?: string;
}

/**
 * Session with related data for display
 */
export interface SessionWithProject extends Session {
  project: {
    id: string;
    name: string;
  } | null;
}

/**
 * Session with user info for team views
 */
export interface SessionWithUser extends Session {
  user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Session summary for analytics
 */
export interface SessionSummary {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  total_prompts: number;
  total_tokens: number;
  git_branch: string | null;
  slug: string | null;
}
