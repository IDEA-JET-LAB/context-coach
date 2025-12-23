# Story 15.1: Transcript File Discovery

Status: ✅ COMPLETED (2025-12-23)

## PRD Alignment Note

> **Scope Clarification:** The PRD Story 15.1 references "Stop Hook Integration" (adding Stop hook to `.claude/settings.json`). That capability is already implemented in the existing CLI package (`packages/cli`) which generates hooks during `npx @contextor/cli init <token>`.
>
> This story focuses on **transcript file discovery** - a foundational capability needed for:
> - **Epic 17 (Historical Import):** Discovering existing transcripts for bulk import
> - **Epic 15 (Response Capture):** Locating active session files for real-time processing
> - **Epic 18 (Session Recovery):** Identifying interrupted sessions
>
> The discovery service provides the file-system scanning layer that all transcript-related features depend on.

## Story
**As a** Contextor capture system,
**I want** to discover all JSONL transcript files in the Claude Code projects directory,
**So that** I can identify which transcripts are available for response context extraction.

## Acceptance Criteria
1. **Given** a user's machine with Claude Code installed
   **When** the discovery function is called
   **Then** it locates the `~/.claude/projects/` directory
   **And** returns an empty result (not an error) if the directory does not exist

2. **Given** the `.claude/projects/` directory exists
   **When** scanning for project folders
   **Then** it identifies all subdirectories with the normalized path format (`-Users-edgars-...`)
   **And** denormalizes paths for display (`/Users/edgars/...`)

3. **Given** a project folder exists
   **When** listing its contents
   **Then** it finds all `.jsonl` files (session transcripts)
   **And** ignores non-JSONL files

4. **Given** a set of discovered projects
   **When** returning discovery results
   **Then** each project includes: display path, normalized path, session count, total prompt count estimate, oldest/newest session dates

5. **Given** discovery completes
   **When** aggregating totals
   **Then** it provides a summary with total projects, total sessions, total estimated prompts, and date range

## Tasks / Subtasks
- [ ] **Task 1: Create discovery module structure** (AC: #1, #2)
  - [ ] Create `lib/transcript/discover.ts` file
  - [ ] Define `DiscoveredProject` interface with all required fields
  - [ ] Define `DiscoverySummary` interface for aggregate stats
  - [ ] Add path utility for normalizing/denormalizing Claude Code paths
  - [ ] Handle cross-platform path differences (macOS vs Linux)

- [ ] **Task 2: Implement directory scanning** (AC: #1, #2, #3)
  - [ ] Locate `~/.claude/projects/` using `os.homedir()`
  - [ ] Check directory exists with `fs.access()`
  - [ ] List all subdirectories with `fs.readdir({ withFileTypes: true })`
  - [ ] Filter to only directories (ignore files)
  - [ ] Denormalize each folder name to human-readable path

- [ ] **Task 3: Implement session file discovery** (AC: #3, #4)
  - [ ] For each project folder, list all files
  - [ ] Filter to `.jsonl` extension only
  - [ ] Get file stats for each JSONL (mtime, size)
  - [ ] Track oldest and newest session dates per project
  - [ ] Estimate prompt count from file size or quick line count

- [ ] **Task 4: Implement quick prompt counting** (AC: #4)
  - [ ] Create fast line counter without full parsing
  - [ ] Count lines matching `"type":"user"` pattern for prompt estimate
  - [ ] Use streaming read to avoid loading entire file into memory
  - [ ] Add timeout protection for very large files

- [ ] **Task 5: Aggregate discovery results** (AC: #5)
  - [ ] Calculate total projects discovered
  - [ ] Sum total sessions across all projects
  - [ ] Sum estimated prompts across all projects
  - [ ] Determine overall date range (oldest to newest)
  - [ ] Return `DiscoverySummary` with all aggregates

- [ ] **Task 6: Add error handling and logging** (AC: #1)
  - [ ] Handle missing `.claude` directory gracefully
  - [ ] Handle permission errors on individual files
  - [ ] Log discovery progress with structured format
  - [ ] Return partial results when some files fail

## Dev Notes

### File Location Pattern

Claude Code stores transcripts in:
```
~/.claude/projects/-{path-with-dashes}/[session-uuid].jsonl

Example:
~/.claude/projects/-Users-edgars-My-projects-DEV-context-coach/abc123.jsonl
```

### Path Transformation

```typescript
// Normalize: /Users/edgars/My-projects -> -Users-edgars-My-projects
function normalizePath(absolutePath: string): string {
  return absolutePath.replace(/^\//, '-').replace(/\//g, '-');
}

// Denormalize: -Users-edgars-My-projects -> /Users/edgars/My-projects
function denormalizePath(normalizedPath: string): string {
  return normalizedPath.replace(/^-/, '/').replace(/-/g, '/');
}
```

> **WARNING: Path Denormalization Bug**
>
> The naive `replace(/-/g, '/')` approach shown above has a critical flaw: it incorrectly converts hyphens that were originally in the path (e.g., `My-projects` becomes `My/projects`).
>
> **Correct implementation must:**
> 1. Check if the denormalized path actually exists on disk
> 2. Use path validation against the filesystem to resolve ambiguity
> 3. Consider caching valid project paths to avoid repeated filesystem checks
>
> Example: `-Users-edgars-My-projects-DEV` could be:
> - `/Users/edgars/My-projects/DEV` (correct)
> - `/Users/edgars/My/projects/DEV` (incorrect)
>
> The implementation should validate the denormalized path exists before returning it.

### Implementation Structure

```typescript
// lib/transcript/discover.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

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

const CLAUDE_PROJECTS_DIR = '.claude/projects';

export async function discoverTranscripts(): Promise<DiscoverySummary> {
  const claudeDir = path.join(os.homedir(), CLAUDE_PROJECTS_DIR);
  const projects: DiscoveredProject[] = [];

  // Check if directory exists
  try {
    await fs.access(claudeDir);
  } catch {
    console.log('[discover] Claude projects directory not found');
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

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = path.join(claudeDir, entry.name);
    const project = await scanProjectDirectory(entry.name, projectPath);

    if (project.sessionCount > 0) {
      projects.push(project);
    }
  }

  // Aggregate results
  return aggregateDiscovery(projects);
}

async function scanProjectDirectory(
  normalizedPath: string,
  fullPath: string
): Promise<DiscoveredProject> {
  const files = await fs.readdir(fullPath);
  const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

  let estimatedPrompts = 0;
  let oldestSession = new Date();
  let newestSession = new Date(0);

  for (const file of jsonlFiles) {
    const filePath = path.join(fullPath, file);
    const stat = await fs.stat(filePath);

    if (stat.mtime < oldestSession) oldestSession = stat.mtime;
    if (stat.mtime > newestSession) newestSession = stat.mtime;

    // Quick prompt count estimate
    estimatedPrompts += await estimatePromptCount(filePath);
  }

  return {
    displayPath: denormalizePath(normalizedPath),
    normalizedPath,
    sessionCount: jsonlFiles.length,
    estimatedPrompts,
    oldestSession,
    newestSession,
  };
}

async function estimatePromptCount(filePath: string): Promise<number> {
  const content = await fs.readFile(filePath, 'utf-8');
  const matches = content.match(/"type":"user"/g);
  return matches ? matches.length : 0;
}

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
```

### Performance Considerations

| Operation | Approach | Reason |
|-----------|----------|--------|
| Directory listing | `readdir({ withFileTypes: true })` | Single syscall, no separate `stat` |
| Prompt counting | Pattern match on file content | Faster than JSON parsing |
| Large files | Streaming read with timeout | Prevent memory issues |
| Error handling | Continue on individual failures | Partial results better than none |

### File Structure

| File | Path |
|------|------|
| Discovery Module | `app/lib/transcript/discover.ts` |
| Types | `app/lib/transcript/types.ts` |
| Tests | `app/lib/transcript/__tests__/discover.test.ts` |

### Security Considerations

1. **Path Traversal:** Validate normalized paths don't escape `.claude/projects/`
2. **Symlink Following:** Use `lstat` to detect symlinks, handle appropriately
3. **File Size Limits:** Skip files larger than 100MB for quick count

### Verification Checklist
- [ ] Discovery finds projects in `~/.claude/projects/`
- [ ] Path denormalization produces correct human-readable paths (handles hyphens in original paths)
- [ ] JSONL files are correctly identified
- [ ] Non-JSONL files are ignored
- [ ] Session dates are correctly determined from file mtime
- [ ] Prompt count estimation is reasonably accurate
- [ ] Missing directory returns empty result (not error)
- [ ] Summary aggregates are mathematically correct

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
