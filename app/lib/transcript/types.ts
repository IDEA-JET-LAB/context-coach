/**
 * Transcript Discovery Types - Story 15-1
 *
 * Types for transcript file discovery in ~/.claude/projects/
 */

/**
 * Information about a discovered Claude Code project.
 */
export interface DiscoveredProject {
  /** Human-readable project path (e.g., /Users/edgars/project) */
  displayPath: string;
  /** Normalized path as stored by Claude Code (e.g., -Users-edgars-project) */
  normalizedPath: string;
  /** Number of session JSONL files */
  sessionCount: number;
  /** Estimated prompt count (without full parsing) */
  estimatedPrompts: number;
  /** Oldest session modification date */
  oldestSession: Date;
  /** Newest session modification date */
  newestSession: Date;
}

/**
 * Summary of all discovered transcripts.
 */
export interface DiscoverySummary {
  /** List of discovered projects */
  projects: DiscoveredProject[];
  /** Total project count */
  totalProjects: number;
  /** Total session files across all projects */
  totalSessions: number;
  /** Total estimated prompts */
  totalEstimatedPrompts: number;
  /** Overall date range start */
  oldestSession: Date | null;
  /** Overall date range end */
  newestSession: Date | null;
  /** Discovery timestamp */
  discoveredAt: Date;
}

/**
 * Options for transcript discovery.
 */
export interface DiscoveryOptions {
  /** Maximum file size (in bytes) to scan for prompt counting. Default: 100MB */
  maxFileSizeForCounting?: number;
  /** Timeout (in ms) for reading a single file. Default: 30000 */
  readTimeout?: number;
  /** Base directory (for testing). Default: ~/.claude/projects */
  baseDir?: string;
}

/**
 * Result of a single file scan.
 */
export interface FileInfo {
  /** File name (UUID.jsonl) */
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
