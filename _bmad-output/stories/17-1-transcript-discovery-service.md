# Story 17.1: Transcript Discovery Service

Status: 🔲 Ready

## Story

**As a** user setting up Contextor,
**I want** the system to automatically discover my existing Claude Code transcripts,
**So that** I can import my historical prompts without manually locating files.

## Acceptance Criteria

1. **Given** Claude Code is installed on my machine
   **When** I trigger the discovery process
   **Then** the system scans `~/.claude/projects/` for all project directories
   **And** identifies all JSONL transcript files within each project

2. **Given** transcript files exist in a project directory
   **When** discovery completes
   **Then** I see a summary with:
   - Number of projects found
   - Total session count (JSONL files)
   - Total estimated prompt count
   - Date range (oldest to newest session)

3. **Given** the discovery is running
   **When** a project directory contains no JSONL files
   **Then** it is excluded from the results

4. **Given** the discovery process encounters permission errors
   **When** a directory cannot be read
   **Then** the error is logged but discovery continues for other directories
   **And** the user is notified which directories were skipped

5. **Given** discovery completes successfully
   **When** results are returned
   **Then** each project shows its human-readable path (denormalized from `-Users-edgars-...` format)

6. **Given** I initiate transcript discovery
   **When** scanning for transcript files
   **Then** only files modified within the last 30 days are included by default
   **And** the date range is configurable via optional startDate/endDate parameters

7. **Given** the Claude projects directory does not exist
   **When** discovery is attempted
   **Then** an empty result is returned (graceful handling, not an error)

8. **Given** a directory exists but cannot be read due to permissions
   **When** discovery encounters a permission denied error
   **Then** an error is logged and the directory is added to skipped directories

9. **Given** an invalid path format is provided
   **When** discovery is attempted with that path
   **Then** an error is thrown with a descriptive message

## Tasks / Subtasks

- [ ] **Task 1: Create discover.ts module** (AC: #1, #3, #5, #6, #7, #8, #9)
  - [ ] Create `lib/import/discover.ts` file
  - [ ] Implement `discoverProjects()` function that scans `~/.claude/projects/`
  - [ ] Add optional `DiscoveryOptions` parameter with `startDate` and `endDate` fields
  - [ ] Default to 30-day window when no date range specified
  - [ ] Handle the normalized path format (`-Users-edgars-project` style)
  - [ ] Denormalize paths for display (convert `-` to `/`, remove leading dash)
  - [ ] Filter out directories with no JSONL files
  - [ ] Filter out files outside the configured date range
  - [ ] Return `DiscoveredProject[]` array

- [ ] **Task 2: Implement session counting** (AC: #2)
  - [ ] Count JSONL files in each project directory
  - [ ] Use file stat to get modification dates for date range
  - [ ] Track oldest and newest session dates per project

- [ ] **Task 3: Implement prompt counting** (AC: #2)
  - [ ] Read JSONL files line by line (streaming for large files)
  - [ ] Count lines with `"type":"user"` to estimate prompt count
  - [ ] Use efficient regex matching for quick counting

- [ ] **Task 4: Add error handling** (AC: #4, #7, #8, #9)
  - [ ] Wrap directory reads in try/catch
  - [ ] Return empty result when Claude projects directory doesn't exist (ENOENT)
  - [ ] Add permission denied errors to skipped directories list
  - [ ] Throw error for invalid path format with descriptive message
  - [ ] Continue discovery when individual directories fail
  - [ ] Collect and return list of skipped directories with reasons
  - [ ] Log errors appropriately

- [ ] **Task 5: Create DiscoveredProject type** (AC: #2, #5)
  - [ ] Define TypeScript interface in `lib/import/types.ts`
  - [ ] Include all required fields per architecture

- [ ] **Task 6: Create discovery API endpoint** (AC: #1, #2)
  - [ ] Create `app/api/import/discover/route.ts`
  - [ ] Accept discovery results from CLI/extension
  - [ ] Validate and store discovery state for user session
  - [ ] Return formatted summary for UI display

## Dev Notes

### Critical Architecture Constraints

**Location:** This runs locally on the user's machine, NOT on the server. The discovery logic executes in:
1. CLI package (`packages/cli/`) - for terminal-based setup
2. VS Code Extension - for extension-based setup

The API endpoint receives discovery results, not performs the discovery.

### DiscoveredProject Interface

From `_bmad-output/architecture-phase2.md` (Line 686):

```typescript
// lib/import/types.ts
export interface DiscoveredProject {
  path: string;              // Human-readable path: /Users/edgars/my-project
  normalizedPath: string;    // Claude's format: -Users-edgars-my-project
  sessionCount: number;      // Number of JSONL files
  totalPrompts: number;      // Estimated user prompt count
  oldestSession: Date;       // First session date
  newestSession: Date;       // Most recent session date
}

export interface DiscoveryOptions {
  startDate?: Date;          // Include files modified on or after this date
  endDate?: Date;            // Include files modified on or before this date
  // Default: 30-day window ending today (per PRD requirement)
}

export interface DiscoveryResult {
  projects: DiscoveredProject[];
  skippedDirectories: Array<{
    path: string;
    reason: string;
  }>;
  totalProjects: number;
  totalSessions: number;
  totalPrompts: number;
  dateRange: {
    oldest: Date;
    newest: Date;
  };
  appliedDateRange: {        // The actual date range used for filtering
    startDate: Date;
    endDate: Date;
  };
}
```

### Discovery Implementation

From architecture (Line 695-743), updated with 30-day window support:

```typescript
// lib/import/discover.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { DiscoveredProject, DiscoveryOptions, DiscoveryResult } from './types';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const DEFAULT_WINDOW_DAYS = 30;

/**
 * Calculate default date range (30-day window ending today)
 */
function getDefaultDateRange(): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DEFAULT_WINDOW_DAYS);
  return { startDate, endDate };
}

/**
 * Check if a file's modification date is within the specified range
 */
function isWithinDateRange(mtime: Date, startDate: Date, endDate: Date): boolean {
  return mtime >= startDate && mtime <= endDate;
}

export async function discoverProjects(options?: DiscoveryOptions): Promise<DiscoveryResult> {
  const projects: DiscoveredProject[] = [];
  const skippedDirectories: Array<{ path: string; reason: string }> = [];

  // Apply date range: use provided dates or default to 30-day window
  const defaultRange = getDefaultDateRange();
  const appliedDateRange = {
    startDate: options?.startDate ?? defaultRange.startDate,
    endDate: options?.endDate ?? defaultRange.endDate,
  };

  try {
    const entries = await fs.readdir(CLAUDE_PROJECTS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectPath = path.join(CLAUDE_PROJECTS_DIR, entry.name);

      try {
        const sessions = await fs.readdir(projectPath);
        const jsonlFiles = sessions.filter(f => f.endsWith('.jsonl'));

        if (jsonlFiles.length === 0) continue;

        // Denormalize path for display
        // -Users-edgars-my-project -> /Users/edgars/my-project
        const displayPath = entry.name.replace(/^-/, '/').replace(/-/g, '/');

        // Count prompts and find date range, filtering by date
        let totalPrompts = 0;
        let oldest = new Date();
        let newest = new Date(0);
        let includedSessionCount = 0;

        for (const session of jsonlFiles) {
          const sessionPath = path.join(projectPath, session);
          const stat = await fs.stat(sessionPath);

          // Skip files outside the date range (30-day window by default)
          if (!isWithinDateRange(stat.mtime, appliedDateRange.startDate, appliedDateRange.endDate)) {
            continue;
          }

          includedSessionCount++;

          if (stat.mtime < oldest) oldest = stat.mtime;
          if (stat.mtime > newest) newest = stat.mtime;

          // Quick prompt count using regex
          const content = await fs.readFile(sessionPath, 'utf-8');
          const matches = content.match(/"type":"user"/g);
          totalPrompts += matches?.length ?? 0;
        }

        // Only include projects that have sessions within the date range
        if (includedSessionCount > 0) {
          projects.push({
            path: displayPath,
            normalizedPath: entry.name,
            sessionCount: includedSessionCount,
            totalPrompts,
            oldestSession: oldest,
            newestSession: newest,
          });
        }
      } catch (e) {
        const error = e as NodeJS.ErrnoException;
        skippedDirectories.push({
          path: entry.name,
          reason: error.code === 'EACCES' ? 'Permission denied' : error.message,
        });
      }
    }
  } catch (e) {
    // Claude directory doesn't exist - return empty result (graceful handling)
    const error = e as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      return {
        projects: [],
        skippedDirectories: [],
        totalProjects: 0,
        totalSessions: 0,
        totalPrompts: 0,
        dateRange: { oldest: new Date(), newest: new Date() },
        appliedDateRange,
      };
    }
    // For other errors (invalid path, etc.), throw with descriptive message
    throw new Error(`Discovery failed: ${error.message}`);
  }

  // Calculate totals
  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);
  const totalPrompts = projects.reduce((sum, p) => sum + p.totalPrompts, 0);

  let dateRange = { oldest: new Date(), newest: new Date(0) };
  for (const p of projects) {
    if (p.oldestSession < dateRange.oldest) dateRange.oldest = p.oldestSession;
    if (p.newestSession > dateRange.newest) dateRange.newest = p.newestSession;
  }

  return {
    projects,
    skippedDirectories,
    totalProjects: projects.length,
    totalSessions,
    totalPrompts,
    dateRange,
    appliedDateRange,
  };
}
```

### Usage Examples

```typescript
// Default: 30-day window
const result = await discoverProjects();

// Custom date range: last 7 days
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
const result = await discoverProjects({
  startDate: weekAgo,
  endDate: new Date(),
});

// All history (no date filtering)
const result = await discoverProjects({
  startDate: new Date(0),  // Unix epoch
  endDate: new Date(),
});
```

### Streaming for Large Files

For very large JSONL files, use streaming instead of reading entire file:

```typescript
import * as readline from 'readline';
import * as fs from 'fs';

async function countPromptsStreaming(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (line.includes('"type":"user"')) {
        count++;
      }
    });

    rl.on('close', () => resolve(count));
    rl.on('error', reject);
  });
}
```

### API Endpoint for Discovery Results

```typescript
// app/api/import/discover/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DiscoveryResult } from '@/lib/import/types';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const discoveryResult: DiscoveryResult = await request.json();

    // Validate required fields
    if (!discoveryResult.projects || !Array.isArray(discoveryResult.projects)) {
      return NextResponse.json(
        { error: 'Invalid discovery result format' },
        { status: 400 }
      );
    }

    // Store discovery result in user's session/state for import flow
    // This could be in-memory, Redis, or a database table

    return NextResponse.json({
      success: true,
      summary: {
        projectCount: discoveryResult.totalProjects,
        sessionCount: discoveryResult.totalSessions,
        promptCount: discoveryResult.totalPrompts,
        dateRange: discoveryResult.dateRange,
        skippedCount: discoveryResult.skippedDirectories.length,
      },
    });
  } catch (error) {
    console.error('Discovery endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to process discovery results' },
      { status: 500 }
    );
  }
}
```

### File Locations

| File | Purpose |
|------|---------|
| `lib/import/types.ts` | TypeScript interfaces for import system |
| `lib/import/discover.ts` | Discovery logic (runs on client machine) |
| `packages/cli/src/commands/import.ts` | CLI command that triggers discovery |
| `app/api/import/discover/route.ts` | API endpoint to receive discovery results |

### Path Normalization Reference

Claude Code normalizes project paths like this:
- `/Users/edgars/my-project` becomes `-Users-edgars-my-project`
- Leading slash becomes leading dash
- All slashes become dashes

To denormalize for display:
```typescript
const displayPath = normalizedPath.replace(/^-/, '/').replace(/-/g, '/');
// -Users-edgars-my-project -> /Users/edgars/my-project
```

### Error Handling Behavior

| Scenario | Behavior |
|----------|----------|
| Directory doesn't exist (`ENOENT`) | Return empty result (graceful) |
| Permission denied (`EACCES`) | Add to skipped directories, continue |
| Invalid path format | Throw error with descriptive message |
| Read error on individual file | Add to skipped directories, continue |

### Common Pitfalls to Avoid

1. **DO NOT** run discovery on the server - it must run locally on user's machine
2. **DO NOT** read entire large files into memory at once - use streaming
3. **DO NOT** fail entire discovery if one directory has permission issues
4. **DO NOT** forget to handle case when `~/.claude/projects/` doesn't exist
5. **DO NOT** count all JSONL lines - only count `"type":"user"` messages
6. **DO NOT** include files outside the date range (default 30 days)

### Verification Checklist

After completing this story, verify:
- [ ] Discovery scans `~/.claude/projects/` directory
- [ ] Projects with no JSONL files are excluded
- [ ] Path denormalization works correctly
- [ ] Session count matches number of JSONL files
- [ ] Prompt count approximately matches user messages
- [ ] Date range reflects oldest and newest session files
- [ ] Permission errors are logged but don't stop discovery
- [ ] Skipped directories are reported to user
- [ ] Empty result returned if Claude directory doesn't exist (not an error)
- [ ] Large files don't cause memory issues
- [ ] Only files modified within last 30 days are included by default
- [ ] Custom date range parameters work correctly
- [ ] `appliedDateRange` is included in the result
- [ ] Invalid path format throws error with descriptive message

## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

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
