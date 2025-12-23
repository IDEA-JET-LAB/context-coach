/**
 * Transcript File Discovery - Story 15-1
 *
 * Scans ~/.claude/projects/ to discover all JSONL transcript files.
 * Provides project-level summaries with session counts and prompt estimates.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type {
  DiscoveredProject,
  DiscoverySummary,
  DiscoveryOptions,
  FileInfo,
} from './types';

/** Default directory name for Claude projects */
const CLAUDE_PROJECTS_DIR = '.claude/projects';

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
 * Denormalize a Claude Code path format to a real filesystem path.
 *
 * Claude Code stores project paths with dashes replacing slashes:
 * -Users-edgars-My-projects -> /Users/edgars/My-projects
 *
 * IMPORTANT: This is tricky because hyphens in original paths are preserved.
 * We must validate the denormalized path exists on disk.
 *
 * @param normalizedPath - The normalized path (e.g., -Users-edgars-My-projects)
 * @returns The denormalized path (e.g., /Users/edgars/My-projects)
 */
export async function denormalizePath(normalizedPath: string): Promise<string> {
  // Try to intelligently denormalize by checking which path actually exists
  // Start with simple approach - just replacing leading dash and all dashes with slashes
  const simpleAttempt = normalizedPath.replace(/^-/, '/').replace(/-/g, '/');

  // Check if this path exists
  try {
    await fs.access(simpleAttempt);
    return simpleAttempt;
  } catch {
    // Simple approach didn't work, try more intelligent denormalization
  }

  // More sophisticated approach: try different hyphen-to-slash combinations
  // by validating each segment exists
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
    if (currentSegment) {
      currentSegment += '-' + segments[i];
    } else {
      currentSegment = segments[i];
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
  try {
    const stat = await fs.stat(filePath);
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
): Promise<FileInfo | null> {
  try {
    const stat = await fs.stat(filePath);

    // Use lstat to check for symlinks
    const lstat = await fs.lstat(filePath);
    if (lstat.isSymbolicLink()) {
      // Follow symlink but verify it's still within safe bounds
      const realPath = await fs.realpath(filePath);
      const claudeDir = getClaudeProjectsDir(options.baseDir);
      if (!isPathSafe(realPath, claudeDir)) {
        console.warn(`[discover] Skipping symlink that escapes projects dir: ${filePath}`);
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
    console.warn(`[discover] Error scanning file ${filePath}:`, error);
    return null;
  }
}

/**
 * Scan a project directory for JSONL session files.
 *
 * @param normalizedPath - The normalized project path (folder name)
 * @param fullPath - Full path to the project directory
 * @param options - Discovery options
 * @returns Discovered project info
 */
async function scanProjectDirectory(
  normalizedPath: string,
  fullPath: string,
  options: DiscoveryOptions = {}
): Promise<DiscoveredProject | null> {
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    // Filter for JSONL files only
    const jsonlFiles = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith('.jsonl')
    );

    if (jsonlFiles.length === 0) {
      return null;
    }

    let estimatedPrompts = 0;
    let oldestSession = new Date();
    let newestSession = new Date(0);

    // Scan each JSONL file
    const fileInfoPromises = jsonlFiles.map((file) =>
      scanFile(path.join(fullPath, file.name), options)
    );

    const fileInfos = await Promise.all(fileInfoPromises);

    for (const info of fileInfos) {
      if (!info) continue;

      estimatedPrompts += info.estimatedPrompts;

      if (info.mtime < oldestSession) {
        oldestSession = info.mtime;
      }
      if (info.mtime > newestSession) {
        newestSession = info.mtime;
      }
    }

    // Denormalize path for display
    const displayPath = await denormalizePath(normalizedPath);

    return {
      displayPath,
      normalizedPath,
      sessionCount: jsonlFiles.length,
      estimatedPrompts,
      oldestSession,
      newestSession,
    };
  } catch (error) {
    console.warn(`[discover] Error scanning project ${normalizedPath}:`, error);
    return null;
  }
}

/**
 * Aggregate discovery results into a summary.
 *
 * @param projects - List of discovered projects
 * @returns Discovery summary with totals
 */
function aggregateDiscovery(projects: DiscoveredProject[]): DiscoverySummary {
  let totalSessions = 0;
  let totalEstimatedPrompts = 0;
  let oldestSession: Date | null = null;
  let newestSession: Date | null = null;

  for (const project of projects) {
    totalSessions += project.sessionCount;
    totalEstimatedPrompts += project.estimatedPrompts;

    if (!oldestSession || project.oldestSession < oldestSession) {
      oldestSession = project.oldestSession;
    }
    if (!newestSession || project.newestSession > newestSession) {
      newestSession = project.newestSession;
    }
  }

  return {
    projects,
    totalProjects: projects.length,
    totalSessions,
    totalEstimatedPrompts,
    oldestSession,
    newestSession,
    discoveredAt: new Date(),
  };
}

/**
 * Discover all Claude Code transcript files.
 *
 * Scans ~/.claude/projects/ for all project directories and their JSONL
 * transcript files. Returns a summary with project-level stats.
 *
 * @param options - Discovery options
 * @returns Discovery summary with all projects and totals
 *
 * @example
 * ```ts
 * const summary = await discoverTranscripts();
 * console.log(`Found ${summary.totalProjects} projects with ${summary.totalSessions} sessions`);
 * for (const project of summary.projects) {
 *   console.log(`  ${project.displayPath}: ${project.sessionCount} sessions`);
 * }
 * ```
 */
export async function discoverTranscripts(
  options: DiscoveryOptions = {}
): Promise<DiscoverySummary> {
  const claudeDir = getClaudeProjectsDir(options.baseDir);

  // Check if directory exists
  try {
    await fs.access(claudeDir);
  } catch {
    console.log('[discover] Claude projects directory not found:', claudeDir);
    return {
      projects: [],
      totalProjects: 0,
      totalSessions: 0,
      totalEstimatedPrompts: 0,
      oldestSession: null,
      newestSession: null,
      discoveredAt: new Date(),
    };
  }

  // List all project directories
  const entries = await fs.readdir(claudeDir, { withFileTypes: true });
  const projects: DiscoveredProject[] = [];

  console.log(`[discover] Scanning ${entries.length} entries in ${claudeDir}`);

  for (const entry of entries) {
    // Skip non-directories
    if (!entry.isDirectory()) continue;

    // Skip hidden directories (except the normalized paths which start with -)
    if (entry.name.startsWith('.') && !entry.name.startsWith('-')) continue;

    // Security check: ensure path doesn't escape
    const projectPath = path.join(claudeDir, entry.name);
    if (!isPathSafe(projectPath, claudeDir)) {
      console.warn(`[discover] Skipping unsafe path: ${entry.name}`);
      continue;
    }

    const project = await scanProjectDirectory(entry.name, projectPath, options);

    if (project) {
      projects.push(project);
    }
  }

  console.log(`[discover] Found ${projects.length} projects with transcripts`);

  return aggregateDiscovery(projects);
}

/**
 * Get transcript files for a specific project.
 *
 * @param normalizedPath - The normalized project path
 * @param options - Discovery options
 * @returns Array of file info objects
 */
export async function getProjectTranscripts(
  normalizedPath: string,
  options: DiscoveryOptions = {}
): Promise<FileInfo[]> {
  const claudeDir = getClaudeProjectsDir(options.baseDir);
  const projectPath = path.join(claudeDir, normalizedPath);

  // Security check
  if (!isPathSafe(projectPath, claudeDir)) {
    throw new Error('Invalid project path');
  }

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    const jsonlFiles = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith('.jsonl')
    );

    const fileInfoPromises = jsonlFiles.map((file) =>
      scanFile(path.join(projectPath, file.name), options)
    );

    const fileInfos = await Promise.all(fileInfoPromises);

    return fileInfos.filter((info): info is FileInfo => info !== null);
  } catch (error) {
    console.warn(`[discover] Error getting transcripts for ${normalizedPath}:`, error);
    return [];
  }
}
