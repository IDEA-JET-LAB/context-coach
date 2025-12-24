/**
 * Import System Types - Story 17-1, 17-3, 17-4
 *
 * TypeScript interfaces for the historical import system.
 * Supports transcript discovery, batch processing, and deduplication.
 */

/**
 * A discovered Claude Code project with transcript files.
 */
export interface DiscoveredProject {
  /** Human-readable project path (e.g., /Users/edgars/my-project) */
  path: string;
  /** Normalized path as stored by Claude Code (e.g., -Users-edgars-my-project) */
  normalizedPath: string;
  /** Number of JSONL session files within the date range */
  sessionCount: number;
  /** Estimated user prompt count */
  totalPrompts: number;
  /** Oldest session modification date within range */
  oldestSession: Date;
  /** Newest session modification date within range */
  newestSession: Date;
}

/**
 * Options for transcript discovery.
 */
export interface DiscoveryOptions {
  /** Include files modified on or after this date */
  startDate?: Date;
  /** Include files modified on or before this date */
  endDate?: Date;
  /** Base directory override (for testing). Default: ~/.claude/projects */
  baseDir?: string;
  /** Maximum file size (in bytes) to scan for prompt counting. Default: 100MB */
  maxFileSizeForCounting?: number;
  /** Timeout (in ms) for reading a single file. Default: 30000 */
  readTimeout?: number;
}

/**
 * Directory that was skipped during discovery.
 */
export interface SkippedDirectory {
  /** The path that was skipped */
  path: string;
  /** Reason the directory was skipped */
  reason: string;
}

/**
 * Result of the discovery process.
 */
export interface DiscoveryResult {
  /** List of discovered projects with transcripts */
  projects: DiscoveredProject[];
  /** Directories that were skipped due to errors */
  skippedDirectories: SkippedDirectory[];
  /** Total number of projects with valid transcripts */
  totalProjects: number;
  /** Total session files across all projects */
  totalSessions: number;
  /** Total estimated prompts across all projects */
  totalPrompts: number;
  /** Overall date range of discovered transcripts */
  dateRange: {
    oldest: Date;
    newest: Date;
  };
  /** The actual date range that was applied for filtering */
  appliedDateRange: {
    startDate: Date;
    endDate: Date;
  };
  /** Timestamp when discovery was performed */
  discoveredAt: Date;
}

/**
 * Information about a single transcript file.
 */
export interface TranscriptFileInfo {
  /** File name (typically UUID.jsonl) */
  name: string;
  /** Full path to the file */
  path: string;
  /** File modification time */
  mtime: Date;
  /** File size in bytes */
  size: number;
  /** Estimated number of user prompts */
  estimatedPrompts: number;
}

/**
 * Result of getting transcripts for a specific project.
 */
export interface ProjectTranscriptsResult {
  /** Project path */
  projectPath: string;
  /** List of transcript files */
  files: TranscriptFileInfo[];
  /** Total estimated prompts in all files */
  totalPrompts: number;
}

/**
 * Import state machine type for tracking import workflow.
 * Story 17-2: Import Preview UI
 * Updated Story 17-4: Added skipped count for deduplication
 */
export type ImportState =
  | { phase: 'discovery'; projects?: DiscoveredProject[] }
  | { phase: 'selection'; selected: string[] }
  | { phase: 'importing'; progress: number; total: number }
  | { phase: 'complete'; imported: number; skipped: number; failed: number }
  | { phase: 'skipped' };

/**
 * Result of a batch upload operation.
 * Story 17-4: Deduplication Logic
 */
export interface BatchUploadResult {
  /** Whether the batch upload succeeded (may still have skipped/failed items) */
  success: boolean;
  /** Number of prompts successfully imported */
  imported: number;
  /** Number of prompts skipped due to deduplication */
  skipped: number;
  /** Number of prompts that failed to import */
  failed?: number;
  /** Error message if the entire batch failed */
  error?: string;
}

/**
 * Result of an entire import operation (multiple batches).
 * Story 17-4: Deduplication Logic
 */
export interface ImportResult {
  /** Number of prompts successfully imported */
  success: number;
  /** Number of prompts that failed to import */
  failed: number;
  /** Number of prompts skipped due to deduplication */
  skipped: number;
  /** List of session IDs that failed to import */
  failedSessions: string[];
}

/**
 * Extracted tool usage from an assistant message.
 * Story 17-3: Batch Import Processing
 */
export interface ExtractedToolUse {
  /** Claude API tool_use ID (e.g., toolu_01ABC...) */
  toolId: string;
  /** Tool name (e.g., Read, Edit, Bash, Grep) */
  toolName: string;
  /** Summarized input for display */
  inputSummary: string;
  /** Full input object (optional, for storage) */
  inputFull?: Record<string, unknown>;
}

/**
 * A parsed message from JSONL transcript.
 * Story 17-3: Batch Import Processing
 */
export interface ParsedMessage {
  /** Message type */
  type: 'user' | 'assistant';
  /** Message content (text) */
  content: string;
  /** Timestamp when the message was created */
  timestamp: string;
  /** Optional UUID from the transcript */
  uuid?: string;
  /** Model name (for assistant messages) */
  model?: string;
  /** Token usage (for assistant messages) */
  tokens?: {
    input: number;
    output: number;
  };
  /** Tool usage (for assistant messages) */
  tools?: ExtractedToolUse[];
}

/**
 * A prompt paired with optional response for import.
 * Story 17-3: Batch Import Processing
 */
export interface PromptResponsePair {
  /** The prompt data */
  prompt: {
    /** Prompt text content */
    text: string;
    /** When the prompt was created (ISO string) */
    timestamp: string;
    /** Optional UUID from transcript */
    uuid?: string;
    /** Optional metadata from transcript */
    metadata?: Record<string, unknown>;
  };
  /** Optional response data */
  response?: {
    /** Response text content */
    text: string;
    /** When the response was created (ISO string) */
    timestamp: string;
    /** Model that generated the response */
    model?: string;
    /** Token usage */
    tokens?: {
      input: number;
      output: number;
    };
    /** Tools used in this response */
    tools?: ExtractedToolUse[];
  };
}

/**
 * A prompt with its computed fingerprint.
 * Story 17-4: Deduplication Logic
 */
export interface PromptWithFingerprint extends PromptResponsePair {
  /** The computed deduplication fingerprint */
  fingerprint: string;
}

/**
 * Result of filtering duplicates from a batch.
 * Story 17-4: Deduplication Logic
 */
export interface DedupResult {
  /** Prompts that are new and should be imported */
  newPairs: PromptWithFingerprint[];
  /** Number of prompts that were duplicates */
  duplicateCount: number;
}

/**
 * Error that occurred during import.
 * Story 17-5: Import Progress Tracking
 */
export interface ImportError {
  /** Project path where error occurred */
  projectPath: string;
  /** Session path (if error is session-specific) */
  sessionPath?: string;
  /** Human-readable error message */
  message: string;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Error type for categorization */
  type: 'project' | 'session' | 'batch' | 'network';
}

/**
 * Cancellation token for stopping import mid-process.
 * Story 17-5: Import Progress Tracking
 */
export interface CancellationToken {
  /** Whether cancellation has been requested */
  cancelled: boolean;
  /** Function to trigger cancellation */
  cancel: () => void;
}

/**
 * Progress state for the import process.
 * Story 17-5: Import Progress Tracking
 */
export interface ImportProgressState {
  /** Name of the current project being processed */
  currentProject: string;
  /** Index of current project (0-based) */
  projectIndex: number;
  /** Total number of projects to process */
  totalProjects: number;
  /** Number of prompts processed so far */
  progress: number;
  /** Total prompts to process */
  total: number;
  /** Number of prompts successfully imported */
  imported: number;
  /** Number of prompts skipped (duplicates) */
  skipped: number;
  /** Number of prompts that failed */
  failed: number;
  /** Errors encountered during import */
  errors: ImportError[];
  /** Estimated seconds remaining (null if not yet calculable) */
  estimatedTimeRemaining: number | null;
  /** Timestamp when import started */
  startedAt: number;
  /** Whether cancellation is in progress */
  cancelling: boolean;
  /** Import status */
  status: 'idle' | 'running' | 'paused' | 'complete' | 'cancelled' | 'error';
}

/**
 * Batch timing info for time estimation.
 * Story 17-5: Import Progress Tracking
 */
export interface BatchTimingInfo {
  /** Number of items in the batch */
  count: number;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Summary of a completed import.
 * Story 17-5: Import Progress Tracking
 */
export interface ImportSummary {
  /** Total prompts imported */
  imported: number;
  /** Total prompts skipped (duplicates) */
  skipped: number;
  /** Total prompts failed */
  failed: number;
  /** Number of projects processed */
  projectsProcessed: number;
  /** Total duration in seconds */
  durationSeconds: number;
  /** Errors that occurred */
  errors: ImportError[];
  /** Whether import was cancelled */
  cancelled: boolean;
}

/**
 * Request body for batch upload API.
 * Story 17-3: Batch Import Processing
 */
export interface BatchUploadRequest {
  /** Array of prompt-response pairs to import */
  pairs: PromptWithFingerprint[];
  /** Project path for context */
  projectPath: string;
  /** Unique import operation ID for resume support */
  importId: string;
  /** Team ID for the import */
  teamId: string;
  /** User ID for the import */
  userId: string;
}

/**
 * Response from batch upload API.
 * Story 17-3: Batch Import Processing
 */
export interface BatchUploadResponse {
  /** Whether the batch was processed successfully */
  success: boolean;
  /** Number of prompts imported in this batch */
  imported: number;
  /** Number of prompts skipped (duplicates) */
  skipped: number;
  /** Number of existing prompts that got responses added */
  updated?: number;
  /** Error message if batch failed */
  error?: string;
}

/**
 * Import state record for resume capability.
 * Story 17-3: Batch Import Processing
 */
export interface ImportStateRecord {
  /** Unique import ID */
  id: string;
  /** User ID who started the import */
  userId: string;
  /** Team ID for the import */
  teamId: string;
  /** Project paths being imported */
  projectPaths: string[];
  /** Current project index */
  currentProjectIndex: number;
  /** Last completed batch number */
  lastCompletedBatch: number;
  /** Number of prompts imported so far */
  importedCount: number;
  /** Number of prompts skipped so far */
  skippedCount: number;
  /** Number of prompts failed so far */
  failedCount: number;
  /** Import status */
  status: 'in_progress' | 'complete' | 'failed' | 'cancelled';
  /** When the import was started */
  startedAt: string;
  /** When the import was last updated */
  updatedAt: string;
}

/**
 * Orchestrator progress callback data.
 * Story 17-3: Batch Import Processing
 */
export interface OrchestratorProgress {
  /** Current project being processed */
  currentProject: string;
  /** Index of the current project (0-based) */
  projectIndex: number;
  /** Total number of projects */
  totalProjects: number;
  /** Progress within current project (sessions processed) */
  sessionProgress: number;
  /** Total sessions in current project */
  totalSessions: number;
}

/**
 * Orchestrator result after processing all projects.
 * Story 17-3: Batch Import Processing
 */
export interface OrchestratorResult {
  /** Total prompts imported across all projects */
  totalImported: number;
  /** Total prompts failed across all projects */
  totalFailed: number;
  /** Total prompts skipped (duplicates) */
  totalSkipped: number;
  /** Per-project import results */
  projectResults: Map<string, ImportResult>;
}

/**
 * Project details within an import metadata.
 * Story 17-6: Import History & Rollback
 */
export interface ImportProjectDetail {
  /** Human-readable project path */
  path: string;
  /** Normalized path as stored by Claude Code */
  normalizedPath: string;
  /** Number of prompts successfully imported from this project */
  promptsImported: number;
  /** Number of duplicate prompts skipped */
  promptsSkipped: number;
  /** Number of prompts that failed to import */
  promptsFailed: number;
  /** Error messages encountered during import */
  errors: string[];
  /** When this project's import completed */
  completedAt?: string;
}

/**
 * Rich metadata for an import batch.
 * Story 17-6: Import History & Rollback
 */
export interface ImportMetadata {
  /** Breakdown by project */
  projects: ImportProjectDetail[];
  /** Total import duration in milliseconds */
  totalDurationMs: number;
  /** Schema version for future migrations */
  version: string;
  /** Rollback error message if partial rollback occurred */
  rollbackError?: string;
  /** IDs of prompts that were deleted during partial rollback */
  deletedPromptIds?: string[];
  /** Count of prompts remaining after partial rollback */
  remainingCount?: number;
}

/**
 * Import record status values.
 * Story 17-6: Import History & Rollback
 */
export type ImportRecordStatus =
  | 'pending'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'cancelled'
  | 'rolled_back'
  | 'partially_rolled_back'
  | 'rolling_back';

/**
 * A historical import record.
 * Story 17-6: Import History & Rollback
 */
export interface ImportRecord {
  /** Unique import ID */
  id: string;
  /** User who performed the import */
  userId: string;
  /** Import status */
  status: ImportRecordStatus;
  /** Total prompts successfully imported */
  promptsImported: number;
  /** Total prompts skipped as duplicates */
  promptsSkipped: number;
  /** Total prompts that failed */
  promptsFailed: number;
  /** Rich metadata with project breakdown */
  metadata: ImportMetadata;
  /** When the import started */
  startedAt: string | null;
  /** When the import completed */
  completedAt: string | null;
  /** When the record was created */
  createdAt: string;
  /** Optional project path (for single-project imports) */
  projectPath?: string;
  /** Session count */
  sessionCount?: number;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Database row for historical_imports table.
 * Story 17-6: Import History & Rollback
 */
export interface HistoricalImportRow {
  id: string;
  user_id: string;
  project_path: string | null;
  session_count: number;
  prompt_count: number;
  prompts_imported: number;
  prompts_skipped: number;
  prompts_failed: number;
  status: ImportRecordStatus;
  error_message: string | null;
  metadata: ImportMetadata;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/**
 * Converts a database row to an ImportRecord.
 * Story 17-6: Import History & Rollback
 */
export function rowToImportRecord(row: HistoricalImportRow): ImportRecord {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    promptsImported: row.prompts_imported,
    promptsSkipped: row.prompts_skipped,
    promptsFailed: row.prompts_failed,
    metadata: row.metadata || { projects: [], totalDurationMs: 0, version: '1.0' },
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    projectPath: row.project_path ?? undefined,
    sessionCount: row.session_count,
    errorMessage: row.error_message ?? undefined,
  };
}
