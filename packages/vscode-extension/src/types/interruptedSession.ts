/**
 * Interrupted Session Types - Story 18-1
 *
 * TypeScript interfaces for crash detection and session recovery.
 * Supports identification of Claude Code sessions that ended abnormally.
 */

/**
 * A recent Claude Code session available for recovery.
 */
export interface InterruptedSession {
  /** Full path to the session JSONL file */
  sessionPath: string;
  /** Session ID (typically UUID, extracted from filename) */
  sessionId: string;
  /** Human-readable session slug (e.g., "ticklish-spinning-starlight") */
  slug: string;
  /** Last modification time of the session file */
  lastActivity: Date;
  /** The last user prompt in the session (truncated to 100 chars) */
  lastPrompt: string;
  /** The last tool that was used, if any */
  lastToolUsed: string | null;
  /** Total number of messages in the session */
  messageCount: number;
  /** Working directory of the session */
  cwd?: string;
  /** Git branch if available */
  gitBranch?: string;
}

/**
 * Options for configuring the session recovery service.
 */
export interface CrashDetectorOptions {
  /**
   * Maximum number of recent sessions to show for recovery.
   * Default: 5
   */
  recentSessionsLimit?: number;

  /**
   * Maximum age in minutes to scan.
   * Sessions older than this are not shown.
   * Default: 10080 minutes (7 days)
   */
  maxAge?: number;

  /**
   * Base directory override (for testing).
   * Default: ~/.claude/projects
   */
  baseDir?: string;

  /**
   * Timeout in milliseconds for parsing a single file.
   * Default: 5000ms
   */
  fileTimeout?: number;

  /**
   * Maximum number of concurrent file scans.
   * Default: 10
   */
  concurrency?: number;
}

/**
 * Result of scanning a single session file.
 */
export interface SessionScanResult {
  /** Whether the scan was successful */
  success: boolean;
  /** The session info if interrupted and valid */
  session?: InterruptedSession;
  /** Error message if scan failed */
  error?: string;
  /** Whether the session was skipped (too old, too new, or properly ended) */
  skipped?: boolean;
  /** Reason for skipping if applicable */
  skipReason?: string;
}

/**
 * Result of the crash detection scan.
 */
export interface CrashDetectionResult {
  /** List of detected interrupted sessions */
  interruptedSessions: InterruptedSession[];
  /** Total number of files scanned */
  totalFilesScanned: number;
  /** Number of files that failed to parse */
  failedFiles: number;
  /** Number of files skipped (too old, too new, or properly ended) */
  skippedFiles: number;
  /** Duration of the scan in milliseconds */
  durationMs: number;
  /** Timestamp when the scan was performed */
  scannedAt: Date;
  /** Any errors encountered during the scan */
  errors: string[];
}

/**
 * Message types that appear in Claude Code JSONL transcripts.
 */
export type MessageType =
  | 'user'
  | 'assistant'
  | 'tool_use'
  | 'tool_result'
  | 'summary'
  | 'system'
  | 'error'
  | 'init';

/**
 * A parsed message from a JSONL transcript line.
 */
export interface TranscriptMessage {
  /** Type of the message */
  type: MessageType;
  /** Timestamp when the message was created */
  timestamp?: string;
  /** Content of the message (varies by type) */
  content?: unknown;
  /** Tool name if this is a tool_use message */
  toolName?: string;
  /** UUID of the message */
  uuid?: string;
}

/**
 * Internal session analysis result.
 */
export interface SessionAnalysis {
  /** Number of messages in the session */
  messageCount: number;
  /** Last user prompt text (truncated) */
  lastPrompt: string;
  /** Last tool used */
  lastToolUsed: string | null;
  /** Session slug from first message */
  slug: string;
  /** Working directory */
  cwd?: string;
  /** Git branch */
  gitBranch?: string;
  /** Whether parsing was successful */
  parseSuccess: boolean;
  /** Error if parsing failed */
  parseError?: string;
}

/**
 * Configuration keys for session recovery VS Code settings.
 */
export const CRASH_DETECTION_CONFIG_KEYS = {
  RECENT_SESSIONS_LIMIT: 'contextor.recovery.recentSessionsLimit',
  MAX_AGE: 'contextor.recovery.maxAge',
  AUTO_SCAN: 'contextor.recovery.autoScan',
} as const;

/**
 * Default values for session recovery configuration.
 */
export const DEFAULT_CRASH_DETECTION_CONFIG = {
  recentSessionsLimit: 10, // show last 10 sessions
  maxAge: 1440, // 24 hours in minutes (matches package.json)
  autoScan: true,
  fileTimeout: 5000, // 5 seconds
  concurrency: 10,
} as const;
