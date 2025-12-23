/**
 * Session Metadata Extraction - Story 16-3: Session Metadata Capture
 *
 * Extracts session metadata from transcript context including:
 * - Working directory (sanitized)
 * - Git branch
 * - Claude Code version
 * - Human-readable session slug
 */

import type { SessionMetadata, TranscriptContext, TranscriptMessage } from './types';

/**
 * Common home directory patterns for different OSes
 */
const HOME_PATTERNS: RegExp[] = [
  // macOS and Linux: /Users/username or /home/username
  /^\/(?:Users|home)\/[^/]+/,
  // Windows: C:\Users\username
  /^[A-Za-z]:\\Users\\[^\\]+/,
];

/**
 * Sanitize a file path by replacing the home directory with ~
 *
 * This helps protect user privacy and makes paths more readable.
 *
 * @param path - The raw path from transcript context
 * @returns Sanitized path with ~ replacing home dir, or null if undefined/empty
 *
 * @example
 * sanitizePath('/Users/john/projects/my-app')
 * // Returns: '~/projects/my-app'
 *
 * sanitizePath('/home/jane/code')
 * // Returns: '~/code'
 *
 * sanitizePath('C:\\Users\\bob\\projects')
 * // Returns: '~\\projects'
 */
export function sanitizePath(path: string | undefined): string | null {
  if (!path || path.trim() === '') {
    return null;
  }

  const trimmedPath = path.trim();

  // Try each home pattern
  for (const pattern of HOME_PATTERNS) {
    const match = trimmedPath.match(pattern);
    if (match) {
      // Replace the matched home directory with ~
      return '~' + trimmedPath.slice(match[0].length);
    }
  }

  // No home directory pattern matched, return as-is
  return trimmedPath;
}

/**
 * Generate a human-readable slug for a session
 *
 * Priority order:
 * 1. Custom conversation title (if user provided one)
 * 2. Git branch name (cleaned up)
 * 3. Project folder name from cwd
 * 4. "session-{timestamp}" fallback
 *
 * @param context - Transcript context containing session info
 * @returns Human-readable slug or null
 *
 * @example
 * generateSlug({ customConversationTitle: 'Fix Login Bug' })
 * // Returns: 'fix-login-bug'
 *
 * generateSlug({ gitBranch: 'feature/user-auth' })
 * // Returns: 'feature-user-auth'
 *
 * generateSlug({ cwd: '/Users/john/projects/my-awesome-app' })
 * // Returns: 'my-awesome-app'
 */
export function generateSlug(context: TranscriptContext): string | null {
  // Priority 1: Custom conversation title
  if (context.customConversationTitle && context.customConversationTitle.trim()) {
    return slugify(context.customConversationTitle);
  }

  // Priority 2: Git branch name
  if (context.gitBranch && context.gitBranch.trim()) {
    // Clean up branch name (remove remote prefix, replace / with -)
    const branchName = context.gitBranch
      .replace(/^origin\//, '')
      .replace(/^refs\/heads\//, '');
    return slugify(branchName);
  }

  // Priority 3: Project folder name from cwd
  if (context.cwd && context.cwd.trim()) {
    const folderName = extractFolderName(context.cwd);
    if (folderName) {
      return slugify(folderName);
    }
  }

  // Priority 4: Timestamp-based fallback
  if (context.timestamp) {
    try {
      const date = new Date(context.timestamp);
      if (!isNaN(date.getTime())) {
        // Format: session-YYYYMMDD-HHMM
        const dateStr = date.toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(0, 12);
        return `session-${dateStr}`;
      }
    } catch {
      // Ignore date parsing errors
    }
  }

  return null;
}

/**
 * Convert a string to a URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Replace forward/back slashes with hyphens
    .replace(/[/\\]+/g, '-')
    // Remove non-alphanumeric except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length
    .slice(0, 64);
}

/**
 * Extract the folder name from a path
 */
function extractFolderName(path: string): string | null {
  // Handle both Unix and Windows paths
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? null) : null;
}

/**
 * Extract session metadata from transcript context
 *
 * @param context - Transcript context containing session info
 * @returns Extracted session metadata
 *
 * @example
 * const metadata = extractSessionMetadata({
 *   sessionId: 'abc123',
 *   timestamp: '2025-01-15T10:30:00Z',
 *   cwd: '/Users/john/projects/my-app',
 *   gitBranch: 'feature/auth',
 *   claudeCodeVersion: '1.2.3',
 *   customConversationTitle: 'Implement Login'
 * });
 * // Returns: {
 * //   cwd: '~/projects/my-app',
 * //   git_branch: 'feature/auth',
 * //   claude_code_version: '1.2.3',
 * //   slug: 'implement-login'
 * // }
 */
export function extractSessionMetadata(context: TranscriptContext): SessionMetadata {
  return {
    cwd: sanitizePath(context.cwd),
    git_branch: context.gitBranch?.trim() || null,
    claude_code_version: context.claudeCodeVersion?.trim() || null,
    slug: generateSlug(context),
  };
}

/**
 * Extract started_at from the first message timestamp in a transcript
 *
 * @param messages - Array of transcript messages
 * @returns Date of first message, or current date if no valid timestamps found
 *
 * @example
 * const startedAt = extractStartedAt([
 *   { role: 'user', timestamp: '2025-01-15T10:30:00Z', content: 'Hello' },
 *   { role: 'assistant', timestamp: '2025-01-15T10:30:05Z', content: 'Hi!' }
 * ]);
 * // Returns: Date('2025-01-15T10:30:00Z')
 */
export function extractStartedAt(messages: Array<{ timestamp?: string }>): Date {
  // Find the first message with a valid timestamp
  for (const message of messages) {
    if (message.timestamp) {
      try {
        const date = new Date(message.timestamp);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch {
        // Continue to next message
      }
    }
  }

  // Fallback to current time if no valid timestamps found
  return new Date();
}

/**
 * Extract the last message timestamp from a transcript
 *
 * @param messages - Array of transcript messages
 * @returns Date of last message, or null if no valid timestamps found
 */
export function extractLastMessageTimestamp(messages: Array<{ timestamp?: string }>): Date | null {
  // Iterate backwards to find the last message with a valid timestamp
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message && message.timestamp) {
      try {
        const date = new Date(message.timestamp);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch {
        // Continue to previous message
      }
    }
  }

  return null;
}

/**
 * Extract context from the first message that has it
 *
 * @param messages - Array of transcript messages
 * @returns TranscriptContext or null if none found
 */
export function extractContextFromMessages(messages: TranscriptMessage[]): TranscriptContext | null {
  for (const message of messages) {
    if (message.context) {
      return message.context;
    }
  }
  return null;
}

/**
 * Calculate session duration in seconds
 *
 * @param startedAt - Session start time
 * @param endedAt - Session end time (or current time if null)
 * @returns Duration in seconds
 */
export function calculateSessionDuration(startedAt: Date, endedAt: Date | null): number {
  const end = endedAt || new Date();
  const durationMs = end.getTime() - startedAt.getTime();
  return Math.max(0, Math.floor(durationMs / 1000));
}
