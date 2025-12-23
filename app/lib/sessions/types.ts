/**
 * Session Types - Story 16-3: Session Metadata Capture
 *
 * Types for session metadata extraction, timing, and lifecycle management.
 * These types extend the base session types from lib/types/session.ts
 */

/**
 * Session metadata extracted from transcript context
 */
export interface SessionMetadata {
  /** Current working directory (sanitized - home replaced with ~) */
  cwd: string | null;
  /** Git branch active during the session */
  git_branch: string | null;
  /** Version of Claude Code CLI used */
  claude_code_version: string | null;
  /** Human-readable session name (auto-generated or from custom title) */
  slug: string | null;
}

/**
 * Session timing information
 */
export interface SessionTimingInfo {
  /** When the session started (first message timestamp) */
  started_at: Date;
  /** When the session ended (null for active sessions) */
  ended_at: Date | null;
  /** How the session ended */
  end_reason: SessionEndReason | null;
}

/**
 * Reason why a session ended
 */
export type SessionEndReason = 'completed' | 'abandoned' | 'interrupted' | 'unknown';

/**
 * Information about session end
 */
export interface SessionEndInfo {
  /** When the session ended */
  ended_at: Date;
  /** How the session ended */
  end_reason: SessionEndReason;
}

/**
 * Context information from a transcript
 * This matches the structure of context data in Claude Code transcripts
 */
export interface TranscriptContext {
  /** Claude Code's session identifier (CLAUDE_SESSION_ID) */
  sessionId: string;
  /** ISO timestamp from the transcript entry */
  timestamp: string;
  /** Current working directory */
  cwd?: string;
  /** Git branch */
  gitBranch?: string;
  /** Claude Code version */
  claudeCodeVersion?: string;
  /** User-provided conversation title */
  customConversationTitle?: string;
}

/**
 * A message from a transcript file
 */
export interface TranscriptMessage {
  /** Role of the message author */
  role: 'user' | 'assistant' | 'system';
  /** ISO timestamp of the message */
  timestamp?: string;
  /** Message content (text or structured) */
  content?: string | unknown;
  /** Session context (usually on first message) */
  context?: TranscriptContext;
  /** Tool usage information (for assistant messages) */
  tool_use?: unknown;
  /** Stop reason (for assistant messages) */
  stop_reason?: string;
}

/**
 * Result of session end detection
 */
export interface SessionEndDetectionResult {
  /** Whether the session appears to have ended */
  hasEnded: boolean;
  /** End info if session ended */
  endInfo: SessionEndInfo | null;
  /** Confidence in the detection (for logging/debugging) */
  confidence: 'high' | 'medium' | 'low';
  /** Reason for the detection */
  reason: string;
}

/**
 * Options for closing stale sessions
 */
export interface CloseStaleSessionsOptions {
  /** Minutes of inactivity before session is considered stale (default: 120) */
  timeoutMinutes?: number;
  /** Maximum sessions to close in one batch (default: 100) */
  batchSize?: number;
  /** Only close sessions for specific team (optional) */
  teamId?: string;
}

/**
 * Result of closing stale sessions
 */
export interface CloseStaleSessionsResult {
  /** Number of sessions closed */
  closedCount: number;
  /** IDs of closed sessions */
  closedSessionIds: string[];
  /** Any errors encountered */
  errors: Array<{ sessionId: string; error: string }>;
}

// ============================================================================
// Story 16-5: Multi-Terminal Awareness Types
// ============================================================================

/**
 * Extended session summary for multi-terminal display.
 * Includes context and concurrency information.
 */
export interface MultiTerminalSessionSummary {
  /** Database UUID of the session */
  id: string;
  /** Claude Code session identifier (session_<uuid>) */
  session_id: string;
  /** Human-readable display name for the session */
  displayName: string;
  /** When the session started */
  started_at: string;
  /** When the session ended (null if active) */
  ended_at: string | null;
  /** Duration in minutes (null if active) */
  duration_minutes: number | null;
  /** Whether the session is currently active */
  isActive: boolean;
  /** Session context for differentiation */
  context: {
    cwd: string | null;
    git_branch: string | null;
    project_name: string | null;
  };
  /** Session statistics */
  stats: {
    total_prompts: number;
    avg_prompt_score: number | null;
  };
  /** IDs of sessions that overlap with this one */
  concurrentWith: string[];
}

/**
 * Input for generating session display names.
 */
export interface SessionDisplayNameInput {
  /** Database UUID */
  id: string;
  /** Session start time */
  started_at: string;
  /** Current working directory */
  cwd: string | null;
  /** Git branch */
  git_branch: string | null;
  /** User-provided slug/title */
  slug: string | null;
  /** Project name */
  project_name?: string | null;
}

/**
 * Generate a human-readable display name for a session.
 *
 * Priority order:
 * 1. User-provided slug (if exists)
 * 2. Git branch + folder name (if both exist)
 * 3. Git branch only
 * 4. Last folder from cwd
 * 5. Time-based name (e.g., "Session at 10:30 AM")
 *
 * If multiple sessions have the same base name, a number suffix is added.
 *
 * @param session - Session data for name generation
 * @param allSessions - All sessions to check for duplicates
 * @returns Human-readable display name
 *
 * @example
 * generateSessionDisplayName(
 *   { id: 'a', started_at: '...', cwd: '/home/user/project', git_branch: 'feature/auth' },
 *   []
 * ); // "feature/auth (project)"
 */
export function generateSessionDisplayName(
  session: SessionDisplayNameInput,
  allSessions: SessionDisplayNameInput[] = []
): string {
  // Priority 1: User-provided slug
  if (session.slug) {
    return makeUnique(session.slug, session.id, allSessions);
  }

  // Extract folder name from cwd
  const folderName = session.cwd
    ? session.cwd.split('/').filter(Boolean).pop() || null
    : null;

  // Priority 2: Git branch + folder name
  if (session.git_branch && folderName) {
    const name = `${session.git_branch} (${folderName})`;
    return makeUnique(name, session.id, allSessions);
  }

  // Priority 3: Git branch only
  if (session.git_branch) {
    return makeUnique(session.git_branch, session.id, allSessions);
  }

  // Priority 4: Folder name only
  if (folderName) {
    return makeUnique(folderName, session.id, allSessions);
  }

  // Priority 5: Project name
  if (session.project_name) {
    return makeUnique(session.project_name, session.id, allSessions);
  }

  // Priority 6: Time-based name
  const startDate = new Date(session.started_at);
  const timeStr = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return makeUnique(`Session at ${timeStr}`, session.id, allSessions);
}

/**
 * Make a display name unique by adding a number suffix if needed.
 */
function makeUnique(
  baseName: string,
  sessionId: string,
  allSessions: SessionDisplayNameInput[]
): string {
  // Check if this exact name is used by another session
  const otherSessionsWithSameName = allSessions.filter(s => {
    if (s.id === sessionId) return false;
    const otherName = generateBaseDisplayName(s);
    return otherName === baseName;
  });

  if (otherSessionsWithSameName.length === 0) {
    return baseName;
  }

  // Find this session's position among sessions with the same name
  const sessionsWithSameName = allSessions.filter(s => {
    const name = generateBaseDisplayName(s);
    return name === baseName;
  });

  // Sort by start time to get consistent numbering
  sessionsWithSameName.sort((a, b) =>
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  const position = sessionsWithSameName.findIndex(s => s.id === sessionId);
  if (position === -1 || position === 0) {
    return baseName;
  }

  return `${baseName} #${position + 1}`;
}

/**
 * Generate the base display name (without uniqueness suffix).
 */
function generateBaseDisplayName(session: SessionDisplayNameInput): string {
  if (session.slug) {
    return session.slug;
  }

  const folderName = session.cwd
    ? session.cwd.split('/').filter(Boolean).pop() || null
    : null;

  if (session.git_branch && folderName) {
    return `${session.git_branch} (${folderName})`;
  }

  if (session.git_branch) {
    return session.git_branch;
  }

  if (folderName) {
    return folderName;
  }

  if (session.project_name) {
    return session.project_name;
  }

  const startDate = new Date(session.started_at);
  const timeStr = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `Session at ${timeStr}`;
}

/**
 * Calculate session duration in minutes.
 *
 * @param startedAt - Session start timestamp
 * @param endedAt - Session end timestamp (null if active)
 * @returns Duration in minutes, or null if session is active
 */
export function calculateDurationMinutes(
  startedAt: string,
  endedAt: string | null
): number | null {
  if (!endedAt) {
    return null;
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  return Math.round((end - start) / 60000);
}
