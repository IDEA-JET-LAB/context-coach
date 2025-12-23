/**
 * Import System Types - Story 17-1, 17-4
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
    /** Optional metadata from transcript */
    metadata?: Record<string, unknown>;
  };
  /** Optional response data */
  response?: {
    /** Response text content */
    text: string;
    /** When the response was created (ISO string) */
    timestamp: string;
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
