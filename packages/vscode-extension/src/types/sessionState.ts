/**
 * Session State Types - Story 18-2
 *
 * TypeScript interfaces for session state snapshots used in interrupted session recovery.
 * Captures comprehensive context about what was happening when a session was interrupted.
 */

/**
 * Complete snapshot of a session's state at the time of interruption.
 * Captures conversation context, file operations, tool usage, and git state.
 */
export interface SessionStateSnapshot {
  /** Session identifier (matches InterruptedSession.sessionId) */
  sessionId: string;
  /** When this snapshot was captured */
  capturedAt: Date;
  /** Recent messages from the conversation (last 20) */
  recentMessages: SummarizedMessage[];
  /** Files that were read, written, or modified */
  filesAffected: FileOperation[];
  /** Tools that were used with usage counts */
  toolsUsed: ToolUsageSummary[];
  /** Operations that started but didn't complete */
  pendingOperations: PendingOperation[];
  /** High-level conversation context */
  conversationContext: ConversationContext;
  /** Git repository context if available */
  gitContext: GitContext | null;
  /** When this snapshot should be cleaned up (7 days from capture) */
  expiresAt: Date;
}

/**
 * A summarized message from the transcript.
 * Content is truncated to prevent storage bloat.
 */
export interface SummarizedMessage {
  /** Unique identifier for the message */
  uuid: string;
  /** Type of message */
  type: "user" | "assistant" | "tool_use" | "tool_result";
  /** Message content (truncated to MAX_CONTENT_LENGTH if longer) */
  content: string;
  /** When the message was created */
  timestamp?: Date;
}

/**
 * Represents a file operation performed during the session.
 */
export interface FileOperation {
  /** Absolute path to the file */
  path: string;
  /** Type of operation performed */
  operation: "read" | "write" | "edit" | "search";
  /** When the file was last accessed */
  lastAccessed: Date;
}

/**
 * Summary of tool usage during the session.
 */
export interface ToolUsageSummary {
  /** Name of the tool (e.g., "Read", "Write", "Bash") */
  name: string;
  /** Number of times the tool was invoked */
  count: number;
  /** Arguments from the last invocation */
  lastArgs: Record<string, unknown>;
  /** When the tool was last used */
  lastInvokedAt: Date;
}

/**
 * An operation that was started but may not have completed.
 * Identified by tool_use without matching tool_result.
 */
export interface PendingOperation {
  /** Name of the tool that was invoked */
  toolName: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** When the operation was started */
  startedAt: Date;
}

/**
 * High-level context about the conversation.
 */
export interface ConversationContext {
  /** The initial task/goal from the first user message */
  initialTask: string;
  /** The most recent task/goal from the last user message */
  currentTask: string;
  /** Description of the last action taken */
  lastAction: string;
  /** Error messages encountered during the session */
  errors: string[];
  /** Blockers or issues identified */
  blockers: string[];
}

/**
 * Git repository context at the time of interruption.
 */
export interface GitContext {
  /** Current branch name */
  branch: string;
  /** Whether there are uncommitted changes */
  hasUncommittedChanges: boolean;
  /** Last git operation performed (e.g., "git commit", "git push") */
  lastGitOperation: string | null;
}

/**
 * Mapping of file tools to operation types.
 */
export const FILE_TOOLS: Record<string, FileOperation["operation"]> = {
  Read: "read",
  Write: "write",
  Edit: "edit",
  Glob: "search",
  Grep: "search",
} as const;

/**
 * Constants for snapshot storage.
 */
export const SNAPSHOT_CONSTANTS = {
  /** Prefix for snapshot storage keys in VS Code globalState */
  STORAGE_PREFIX: "contextor.snapshot.",
  /** Number of days before a snapshot expires */
  EXPIRY_DAYS: 7,
  /** Maximum number of recent messages to capture */
  MAX_RECENT_MESSAGES: 20,
  /** Maximum character length for message content */
  MAX_CONTENT_LENGTH: 2000,
  /** Maximum character length for task descriptions */
  MAX_TASK_LENGTH: 500,
} as const;

/**
 * Extended transcript message type for snapshot building.
 * Extends the base TranscriptMessage with additional fields that may appear.
 */
export interface ExtendedTranscriptMessage {
  /** Type of the message */
  type: string;
  /** UUID of the message */
  uuid?: string;
  /** Timestamp when the message was created */
  timestamp?: string;
  /** Content of the message (varies by type) */
  content?: unknown;
  /** Tool name if this is a tool_use message */
  toolName?: string;
  /** Tool input/arguments for tool_use messages */
  toolInput?: Record<string, unknown>;
  /** Tool ID for matching tool_use with tool_result */
  toolUseId?: string;
}

/**
 * Serialized version of SessionStateSnapshot for storage.
 * Dates are stored as ISO strings.
 */
export interface SerializedSnapshot {
  sessionId: string;
  capturedAt: string;
  recentMessages: Array<Omit<SummarizedMessage, "timestamp"> & { timestamp?: string }>;
  filesAffected: Array<Omit<FileOperation, "lastAccessed"> & { lastAccessed: string }>;
  toolsUsed: Array<Omit<ToolUsageSummary, "lastInvokedAt"> & { lastInvokedAt: string }>;
  pendingOperations: Array<Omit<PendingOperation, "startedAt"> & { startedAt: string }>;
  conversationContext: ConversationContext;
  gitContext: GitContext | null;
  expiresAt: string;
}
