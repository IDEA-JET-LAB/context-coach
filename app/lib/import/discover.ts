/**
 * Transcript Discovery Service - Story 17-1
 *
 * Scans ~/.claude/projects/ to discover all JSONL transcript files.
 * Supports date range filtering (default: 30-day window) and provides
 * project-level summaries with session counts and prompt estimates.
 *
 * IMPORTANT: This module is designed to run on the user's local machine
 * (via CLI or VS Code extension), NOT on the server.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createReadStream, Stats } from 'fs';
import { createInterface } from 'readline';
import type {
  DiscoveredProject,
  DiscoveryOptions,
  DiscoveryResult,
  SkippedDirectory,
  TranscriptFileInfo,
  ProjectTranscriptsResult,
} from './types';

/** Default directory name for Claude projects */
const CLAUDE_PROJECTS_DIR = '.claude/projects';

/** Default window for date filtering (30 days) */
const DEFAULT_WINDOW_DAYS = 30;

/** Default max file size for prompt counting (100MB) */
const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Default read timeout (30 seconds) */
const DEFAULT_READ_TIMEOUT = 30000;

/** Pattern to match user messages in JSONL */
const USER_MESSAGE_PATTERN = /"type":\s*"user"/;

/**
 * Get the Claude projects directory path.
 *
 * @param baseDir - Override base directory (for testing)
 * @returns Absolute path to Claude projects directory
 */
export function getClaudeProjectsDir(baseDir?: string): string {
  if (baseDir) {
    return baseDir;
  }
  return path.join(os.homedir(), CLAUDE_PROJECTS_DIR);
}

/**
 * Calculate the default date range (30-day window ending today).
 *
 * @returns Object with startDate and endDate
 */
export function getDefaultDateRange(): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  // Set to end of day
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DEFAULT_WINDOW_DAYS);
  // Set to start of day
  startDate.setHours(0, 0, 0, 0);

  return { startDate, endDate };
}

/**
 * Check if a file's modification date is within the specified range.
 *
 * @param mtime - File modification time
 * @param startDate - Range start (inclusive)
 * @param endDate - Range end (inclusive)
 * @returns True if the date is within range
 */
export function isWithinDateRange(mtime: Date, startDate: Date, endDate: Date): boolean {
  return mtime >= startDate && mtime <= endDate;
}

/**
 * Denormalize a Claude Code path format to a real filesystem path.
 *
 * Claude Code stores project paths with dashes replacing slashes:
 * -Users-edgars-My-projects -> /Users/edgars/My-projects
 *
 * IMPORTANT: This is tricky because hyphens in original paths are preserved.
 * We validate the denormalized path exists on disk when possible.
 *
 * @param normalizedPath - The normalized path (e.g., -Users-edgars-My-projects)
 * @param validateExists - Whether to validate the path exists (default: true)
 * @returns The denormalized path (e.g., /Users/edgars/My-projects)
 */
export async function denormalizePath(
  normalizedPath: string,
  validateExists: boolean = true
): Promise<string> {
  // Simple approach - replace leading dash and all dashes with slashes
  const simpleAttempt = normalizedPath.replace(/^-/, '/').replace(/-/g, '/');

  if (!validateExists) {
    return simpleAttempt;
  }

  // Check if this path exists
  try {
    await fs.access(simpleAttempt);
    return simpleAttempt;
  } catch {
    // Simple approach didn't work, try recursive validation
  }

  // More sophisticated approach: validate each segment
  return await denormalizePathRecursive(normalizedPath);
}

/**
 * Recursively denormalize path by validating each segment.
 *
 * This handles cases where the original path contained hyphens:
 * -Users-edgars-My-projects-DEV should become /Users/edgars/My-projects/DEV
 * not /Users/edgars/My/projects/DEV
 *
 * @param normalizedPath - The normalized path
 * @returns The validated denormalized path
 */
async function denormalizePathRecursive(normalizedPath: string): Promise<string> {
  // Remove leading dash
  const withoutLeadingDash = normalizedPath.replace(/^-/, '');
  const segments = withoutLeadingDash.split('-');

  // Build path progressively, checking if each combination exists
  let currentPath = '';
  let currentSegment = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;

    if (currentSegment) {
      currentSegment += '-' + segment;
    } else {
      currentSegment = segment;
    }

    const testPath = currentPath + '/' + currentSegment;

    try {
      await fs.access(testPath);
      // Path exists, use this segment
      currentPath = testPath;
      currentSegment = '';
    } catch {
      // Path doesn't exist, continue building segment with hyphens
      // Unless we're at the end
      if (i === segments.length - 1) {
        // Last segment, use what we have
        currentPath += '/' + currentSegment;
      }
    }
  }

  return currentPath || '/' + withoutLeadingDash.replace(/-/g, '/');
}

/**
 * Normalize a filesystem path to Claude Code's format.
 *
 * @param absolutePath - Absolute filesystem path
 * @returns Normalized path with dashes
 */
export function normalizePath(absolutePath: string): string {
  return absolutePath.replace(/^\//, '-').replace(/\//g, '-');
}

/**
 * Check if a path is within the Claude projects directory.
 * Security measure to prevent path traversal.
 *
 * @param filePath - Path to check
 * @param claudeDir - Claude projects directory
 * @returns True if path is safe
 */
export function isPathSafe(filePath: string, claudeDir: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedClaudeDir = path.resolve(claudeDir);
  return resolvedPath.startsWith(resolvedClaudeDir);
}

/**
 * Validate that a path format is acceptable for discovery.
 *
 * @param pathToValidate - Path to validate
 * @throws Error if the path format is invalid
 */
export function validatePathFormat(pathToValidate: string): void {
  // Check for null bytes (security issue)
  if (pathToValidate.includes('\0')) {
    throw new Error('Invalid path format: path contains null bytes');
  }

  // Check for extremely long paths
  if (pathToValidate.length > 4096) {
    throw new Error('Invalid path format: path is too long');
  }

  // Check for valid characters (basic sanity check)
  if (!/^[\w\-./~\\: ]+$/i.test(pathToValidate)) {
    throw new Error('Invalid path format: path contains invalid characters');
  }
}

/**
 * Estimate the number of user prompts in a JSONL file.
 * Uses streaming to avoid loading entire file into memory.
 *
 * @param filePath - Path to the JSONL file
 * @param options - Discovery options
 * @returns Estimated number of user prompts
 */
export async function estimatePromptCount(
  filePath: string,
  options: DiscoveryOptions = {}
): Promise<number> {
  const maxSize = options.maxFileSizeForCounting ?? DEFAULT_MAX_FILE_SIZE;
  const timeout = options.readTimeout ?? DEFAULT_READ_TIMEOUT;

  // Check file size first
  let stat: Stats;
  try {
    stat = await fs.stat(filePath);
    if (stat.size > maxSize) {
      // File too large, estimate based on average line count
      // Rough estimate: 1 user message per 5KB
      return Math.floor(stat.size / 5000);
    }
  } catch {
    return 0;
  }

  return new Promise<number>((resolve) => {
    let count = 0;
    let timeoutId: NodeJS.Timeout | undefined;

    const stream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      rl.close();
      stream.destroy();
    };

    timeoutId = setTimeout(() => {
      cleanup();
      resolve(count);
    }, timeout);

    rl.on('line', (line) => {
      if (USER_MESSAGE_PATTERN.test(line)) {
        count++;
      }
    });

    rl.on('close', () => {
      cleanup();
      resolve(count);
    });

    rl.on('error', () => {
      cleanup();
      resolve(count);
    });

    stream.on('error', () => {
      cleanup();
      resolve(count);
    });
  });
}

/**
 * Scan a single JSONL file and return its info.
 *
 * @param filePath - Path to the JSONL file
 * @param options - Discovery options
 * @returns File info or null if file can't be read
 */
async function scanFile(
  filePath: string,
  options: DiscoveryOptions = {}
): Promise<TranscriptFileInfo | null> {
  try {
    const stat = await fs.stat(filePath);

    // Check for symlinks and verify they're safe
    const lstat = await fs.lstat(filePath);
    if (lstat.isSymbolicLink()) {
      const realPath = await fs.realpath(filePath);
      const claudeDir = getClaudeProjectsDir(options.baseDir);
      if (!isPathSafe(realPath, claudeDir)) {
        console.warn(`[import/discover] Skipping symlink outside projects dir: ${filePath}`);
        return null;
      }
    }

    const estimatedPrompts = await estimatePromptCount(filePath, options);

    return {
      name: path.basename(filePath),
      path: filePath,
      mtime: stat.mtime,
      size: stat.size,
      estimatedPrompts,
    };
  } catch (error) {
    console.warn(`[import/discover] Error scanning file ${filePath}:`, error);
    return null;
  }
}

/**
 * Scan a project directory for JSONL session files within date range.
 *
 * @param normalizedPath - The normalized project path (folder name)
 * @param fullPath - Full path to the project directory
 * @param appliedDateRange - The date range to filter by
 * @param options - Discovery options
 * @returns Discovered project info or null if no valid sessions
 */
async function scanProjectDirectory(
  normalizedPath: string,
  fullPath: string,
  appliedDateRange: { startDate: Date; endDate: Date },
  options: DiscoveryOptions = {}
): Promise<{ project: DiscoveredProject | null; skipped: SkippedDirectory | null }> {
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    // Filter for JSONL files only
    const jsonlFiles = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith('.jsonl')
    );

    if (jsonlFiles.length === 0) {
      return { project: null, skipped: null };
    }

    let totalPrompts = 0;
    let oldestSession = new Date();
    let newestSession = new Date(0);
    let includedSessionCount = 0;

    // Scan each JSONL file
    for (const file of jsonlFiles) {
      const filePath = path.join(fullPath, file.name);

      try {
        const stat = await fs.stat(filePath);

        // Skip files outside the date range
        if (!isWithinDateRange(stat.mtime, appliedDateRange.startDate, appliedDateRange.endDate)) {
          continue;
        }

        includedSessionCount++;

        if (stat.mtime < oldestSession) {
          oldestSession = stat.mtime;
        }
        if (stat.mtime > newestSession) {
          newestSession = stat.mtime;
        }

        // Count prompts
        const prompts = await estimatePromptCount(filePath, options);
        totalPrompts += prompts;
      } catch (fileError) {
        console.warn(`[import/discover] Error reading file ${filePath}:`, fileError);
        // Continue with other files
      }
    }

    // Only return project if it has sessions within the date range
    if (includedSessionCount === 0) {
      return { project: null, skipped: null };
    }

    // Denormalize path for display
    const displayPath = await denormalizePath(normalizedPath, false);

    return {
      project: {
        path: displayPath,
        normalizedPath,
        sessionCount: includedSessionCount,
        totalPrompts,
        oldestSession,
        newestSession,
      },
      skipped: null,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const reason = err.code === 'EACCES' ? 'Permission denied' : err.message;

    return {
      project: null,
      skipped: {
        path: normalizedPath,
        reason,
      },
    };
  }
}

/**
 * Discover all Claude Code projects with transcript files.
 *
 * Scans ~/.claude/projects/ for all project directories and their JSONL
 * transcript files. Filters by date range (default: last 30 days) and
 * returns a comprehensive summary.
 *
 * @param options - Discovery options
 * @returns Discovery result with all projects and totals
 *
 * @example
 * ```ts
 * // Default: 30-day window
 * const result = await discoverProjects();
 * console.log(`Found ${result.totalProjects} projects with ${result.totalSessions} sessions`);
 *
 * // Custom date range: last 7 days
 * const weekAgo = new Date();
 * weekAgo.setDate(weekAgo.getDate() - 7);
 * const result = await discoverProjects({
 *   startDate: weekAgo,
 *   endDate: new Date(),
 * });
 *
 * // All history (no date filtering)
 * const result = await discoverProjects({
 *   startDate: new Date(0),
 *   endDate: new Date(),
 * });
 * ```
 */
export async function discoverProjects(
  options: DiscoveryOptions = {}
): Promise<DiscoveryResult> {
  const claudeDir = getClaudeProjectsDir(options.baseDir);

  // Calculate applied date range
  const defaultRange = getDefaultDateRange();
  const appliedDateRange = {
    startDate: options.startDate ?? defaultRange.startDate,
    endDate: options.endDate ?? defaultRange.endDate,
  };

  // Validate base directory if provided
  if (options.baseDir) {
    try {
      validatePathFormat(options.baseDir);
    } catch (error) {
      throw new Error(`Discovery failed: ${(error as Error).message}`);
    }
  }

  // Check if directory exists
  try {
    await fs.access(claudeDir);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    // Directory doesn't exist - return empty result (graceful handling)
    if (err.code === 'ENOENT') {
      console.log('[import/discover] Claude projects directory not found:', claudeDir);
      return {
        projects: [],
        skippedDirectories: [],
        totalProjects: 0,
        totalSessions: 0,
        totalPrompts: 0,
        dateRange: {
          oldest: new Date(),
          newest: new Date(),
        },
        appliedDateRange,
        discoveredAt: new Date(),
      };
    }

    // For other errors (permissions, etc.), throw with descriptive message
    throw new Error(`Discovery failed: ${err.message}`);
  }

  const projects: DiscoveredProject[] = [];
  const skippedDirectories: SkippedDirectory[] = [];

  // List all project directories
  let entries;
  try {
    entries = await fs.readdir(claudeDir, { withFileTypes: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    throw new Error(`Discovery failed: Unable to read projects directory: ${err.message}`);
  }

  console.log(`[import/discover] Scanning ${entries.length} entries in ${claudeDir}`);

  for (const entry of entries) {
    // Skip non-directories
    if (!entry.isDirectory()) continue;

    // Skip hidden directories (except normalized paths which start with -)
    if (entry.name.startsWith('.') && !entry.name.startsWith('-')) continue;

    // Security check: ensure path doesn't escape
    const projectPath = path.join(claudeDir, entry.name);
    if (!isPathSafe(projectPath, claudeDir)) {
      skippedDirectories.push({
        path: entry.name,
        reason: 'Path traversal detected',
      });
      console.warn(`[import/discover] Skipping unsafe path: ${entry.name}`);
      continue;
    }

    const result = await scanProjectDirectory(
      entry.name,
      projectPath,
      appliedDateRange,
      options
    );

    if (result.project) {
      projects.push(result.project);
    }
    if (result.skipped) {
      skippedDirectories.push(result.skipped);
    }
  }

  console.log(`[import/discover] Found ${projects.length} projects with transcripts`);

  // Calculate totals and date range
  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);
  const totalPrompts = projects.reduce((sum, p) => sum + p.totalPrompts, 0);

  let dateRange = {
    oldest: new Date(),
    newest: new Date(0),
  };

  for (const p of projects) {
    if (p.oldestSession < dateRange.oldest) {
      dateRange.oldest = p.oldestSession;
    }
    if (p.newestSession > dateRange.newest) {
      dateRange.newest = p.newestSession;
    }
  }

  // Handle case when no projects were found
  if (projects.length === 0) {
    dateRange = {
      oldest: new Date(),
      newest: new Date(),
    };
  }

  return {
    projects,
    skippedDirectories,
    totalProjects: projects.length,
    totalSessions,
    totalPrompts,
    dateRange,
    appliedDateRange,
    discoveredAt: new Date(),
  };
}

/**
 * Get transcript files for a specific project.
 *
 * @param normalizedPath - The normalized project path
 * @param options - Discovery options
 * @returns Project transcripts result with file list
 */
export async function getProjectTranscripts(
  normalizedPath: string,
  options: DiscoveryOptions = {}
): Promise<ProjectTranscriptsResult> {
  const claudeDir = getClaudeProjectsDir(options.baseDir);
  const projectPath = path.join(claudeDir, normalizedPath);

  // Security check
  if (!isPathSafe(projectPath, claudeDir)) {
    throw new Error('Invalid project path: path traversal detected');
  }

  // Validate path format
  try {
    validatePathFormat(normalizedPath);
  } catch (error) {
    throw new Error(`Invalid project path: ${(error as Error).message}`);
  }

  const displayPath = await denormalizePath(normalizedPath, false);

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    const jsonlFiles = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith('.jsonl')
    );

    const fileInfoPromises = jsonlFiles.map((file) =>
      scanFile(path.join(projectPath, file.name), options)
    );

    const fileInfos = await Promise.all(fileInfoPromises);
    const validFiles = fileInfos.filter((info): info is TranscriptFileInfo => info !== null);

    // Apply date range filter if provided
    let filteredFiles = validFiles;
    if (options.startDate || options.endDate) {
      const defaultRange = getDefaultDateRange();
      const startDate = options.startDate ?? defaultRange.startDate;
      const endDate = options.endDate ?? defaultRange.endDate;

      filteredFiles = validFiles.filter((f) =>
        isWithinDateRange(f.mtime, startDate, endDate)
      );
    }

    const totalPrompts = filteredFiles.reduce((sum, f) => sum + f.estimatedPrompts, 0);

    return {
      projectPath: displayPath,
      files: filteredFiles,
      totalPrompts,
    };
  } catch (error) {
    console.warn(`[import/discover] Error getting transcripts for ${normalizedPath}:`, error);
    return {
      projectPath: displayPath,
      files: [],
      totalPrompts: 0,
    };
  }
}

/**
 * Check if the Claude projects directory exists.
 *
 * @param baseDir - Optional override for testing
 * @returns True if the directory exists
 */
export async function claudeProjectsExist(baseDir?: string): Promise<boolean> {
  const claudeDir = getClaudeProjectsDir(baseDir);
  try {
    await fs.access(claudeDir);
    return true;
  } catch {
    return false;
  }
}
