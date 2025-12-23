# Story 17.5: Import Progress Tracking

Status: 🔲 Ready

## Dependencies

- **Story 17-1:** Transcript Discovery Service (provides the list of projects/sessions to import)
- **Story 17-3:** Batch Import Processing (provides the batch processing logic this story tracks)

## PRD Alignment Note

This story was added during implementation planning to enhance the user experience for the import feature. While not explicitly defined as a separate story in the PRD, progress tracking is essential for imports that may take several minutes to complete. The PRD's focus was on core functionality (discovery, parsing, import); this story provides the UX layer that makes that functionality usable. This can be considered an implementation detail of PRD Story 17.2 (Import Preview UI) or 17.3 (Batch Import Processing), where real-time feedback is implied but not explicitly specified.

## Story

**As a** user importing historical prompts,
**I want** to see real-time progress during the import,
**So that** I know how long it will take and that it's working correctly.

## Acceptance Criteria

1. **Given** the import has started
   **When** I view the import screen
   **Then** I see a progress indicator showing:
   - Current project being processed
   - Progress bar with percentage
   - Estimated time remaining

2. **Given** the import is processing
   **When** a batch completes
   **Then** the progress bar updates immediately
   **And** the running counts update (imported, skipped, failed)

3. **Given** the import is in progress
   **When** I want to stop the import
   **Then** I can click a "Cancel" button
   **And** the import stops gracefully after the current batch
   **And** all already-imported prompts are kept

4. **Given** the import is processing
   **When** an error occurs with a batch or project
   **Then** I see an error notification
   **And** the import continues with remaining items
   **And** I can expand to see error details

5. **Given** the import completes
   **When** all projects have been processed
   **Then** I see a completion summary with:
   - Total prompts imported
   - Total duplicates skipped
   - Total failures (with error details)
   - Time taken

6. **Given** I am on the import progress screen
   **When** the browser tab loses focus or network hiccups
   **Then** progress tracking continues in the background
   **And** state is recovered when I return

## Tasks / Subtasks

- [ ] **Task 1: Create ImportProgress component** (AC: #1, #2)
  - [ ] Create `components/import/import-progress.tsx` component
  - [ ] Display current project name
  - [ ] Show animated progress bar with percentage
  - [ ] Display running counts (imported, skipped, failed)
  - [ ] Calculate and show estimated time remaining

- [ ] **Task 2: Implement progress state management** (AC: #2, #6)
  - [ ] Create `lib/hooks/use-import-progress.ts` hook
  - [ ] Track progress state with granular updates
  - [ ] Persist progress to session storage
  - [ ] Recover state on page reload

- [ ] **Task 3: Add cancel functionality** (AC: #3)
  - [ ] Add "Cancel Import" button to progress UI
  - [ ] Implement cancellation token pattern
  - [ ] Ensure graceful stop after current batch
  - [ ] Keep all already-imported prompts
  - [ ] Show "Import Cancelled" state

- [ ] **Task 4: Implement error notification system** (AC: #4)
  - [ ] Create `components/import/import-errors.tsx` component
  - [ ] Display inline error notifications as they occur
  - [ ] Collapsible error details
  - [ ] Distinguish between batch errors and project errors

- [ ] **Task 5: Create ImportComplete component** (AC: #5)
  - [ ] Create `components/import/import-complete.tsx` component
  - [ ] Display final summary statistics
  - [ ] Show duration of import
  - [ ] Show breakdown by project (expandable)
  - [ ] "View Your Prompts" button to go to feed

- [ ] **Task 6: Add estimated time calculation** (AC: #1)
  - [ ] Track time per prompt/batch for estimation
  - [ ] Update estimate as import progresses
  - [ ] Handle variable batch sizes
  - [ ] Display in human-readable format ("about 2 minutes")

- [ ] **Task 7: Implement background processing** (AC: #6)
  - [ ] Implement server-side processing with progress updates
  - [ ] Handle visibility change events
  - [ ] Ensure network errors don't lose state
  - [ ] Auto-resume on reconnection if possible

## Dev Notes

### Background Processing Approach

AC #6 requires progress tracking to continue when the browser tab loses focus. There are several approaches to consider:

**Option A: Web Worker (Client-Side)**
- Pros: Simple to implement, no server changes needed
- Cons: Limited to small imports, stops if browser closes, file system access limitations

**Option B: Server-Side Queue with Polling**
- Pros: Handles large imports, survives browser close, more reliable
- Cons: Requires server-side job queue infrastructure, polling adds latency

**Option C: Server-Side with SSE (Server-Sent Events)** - RECOMMENDED
- Pros: Real-time updates, handles large imports, survives brief disconnects
- Cons: Requires SSE endpoint, connection management
- Implementation: Server processes import in background, streams progress via SSE

**Recommendation:** Use Option C (Server-Side with SSE) for production. The import processing should happen server-side via an API endpoint that returns progress via Server-Sent Events. This provides:
1. Real-time progress updates without polling overhead
2. Automatic reconnection handling
3. Ability to resume tracking on page refresh (via session ID)
4. Browser tab can lose focus without losing progress

For MVP, Option B (polling) is acceptable if SSE adds too much complexity.

### Critical Architecture Constraints

**Technology Stack:**
- React 18 with Client Components
- TypeScript strict mode
- Session Storage for state persistence
- Progress updates via callback pattern

### Import Progress Component

```typescript
// components/import/import-progress.tsx
'use client';

import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDuration } from 'date-fns';
import type { ImportProgressState } from '@/lib/import/types';

interface ImportProgressProps {
  state: ImportProgressState;
  onCancel: () => void;
}

export function ImportProgress({ state, onCancel }: ImportProgressProps) {
  const percentage = state.total > 0
    ? Math.round((state.progress / state.total) * 100)
    : 0;

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Importing Your History
        </CardTitle>
        <CardDescription>
          Processing {state.currentProject}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={percentage} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{percentage}% complete</span>
            {state.estimatedTimeRemaining && (
              <span>~{formatEstimate(state.estimatedTimeRemaining)} remaining</span>
            )}
          </div>
        </div>

        {/* Running Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-teal-500">
              {state.imported.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Imported</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-500">
              {state.skipped.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">
              {state.failed.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* Project Progress */}
        <div className="text-center text-sm text-muted-foreground">
          Project {state.projectIndex + 1} of {state.totalProjects}
        </div>

        {/* Errors (if any) */}
        {state.errors.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              {state.errors.length} error(s) encountered
            </div>
          </div>
        )}

        {/* Cancel Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={onCancel}
          disabled={state.cancelling}
        >
          {state.cancelling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cancelling...
            </>
          ) : (
            <>
              <X className="mr-2 h-4 w-4" />
              Cancel Import
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function formatEstimate(seconds: number): string {
  if (seconds < 60) return 'less than a minute';
  if (seconds < 120) return 'about a minute';
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minutes`;
}
```

### Import Progress State Type

```typescript
// lib/import/types.ts (additions)
export interface ImportProgressState {
  currentProject: string;
  projectIndex: number;
  totalProjects: number;
  progress: number;        // Prompts processed
  total: number;           // Total prompts to process
  imported: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
  estimatedTimeRemaining: number | null;  // In seconds
  startedAt: number;       // Timestamp
  cancelling: boolean;
}

export interface ImportError {
  projectPath: string;
  sessionPath?: string;
  message: string;
  timestamp: number;
}

export interface CancellationToken {
  cancelled: boolean;
  cancel: () => void;
}
```

### Import Progress Hook

```typescript
// lib/hooks/use-import-progress.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ImportProgressState, CancellationToken } from '@/lib/import/types';

const STORAGE_KEY = 'contextor-import-progress';

const initialState: ImportProgressState = {
  currentProject: '',
  projectIndex: 0,
  totalProjects: 0,
  progress: 0,
  total: 0,
  imported: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  estimatedTimeRemaining: null,
  startedAt: Date.now(),
  cancelling: false,
};

export function useImportProgress() {
  const [state, setState] = useState<ImportProgressState>(() => {
    // Restore from session storage if available
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // Fall through to default
        }
      }
    }
    return initialState;
  });

  const cancellationTokenRef = useRef<CancellationToken>({
    cancelled: false,
    cancel: () => { cancellationTokenRef.current.cancelled = true; },
  });

  // Persist to session storage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateProgress = useCallback((updates: Partial<ImportProgressState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };

      // Calculate estimated time remaining
      if (newState.progress > 0 && newState.total > 0) {
        const elapsed = (Date.now() - newState.startedAt) / 1000;
        const rate = newState.progress / elapsed; // prompts per second
        const remaining = newState.total - newState.progress;
        newState.estimatedTimeRemaining = rate > 0 ? remaining / rate : null;
      }

      return newState;
    });
  }, []);

  const addError = useCallback((error: Omit<ImportError, 'timestamp'>) => {
    setState(prev => ({
      ...prev,
      errors: [...prev.errors, { ...error, timestamp: Date.now() }],
    }));
  }, []);

  const startImport = useCallback((totalProjects: number, totalPrompts: number) => {
    cancellationTokenRef.current = {
      cancelled: false,
      cancel: () => { cancellationTokenRef.current.cancelled = true; },
    };

    setState({
      ...initialState,
      totalProjects,
      total: totalPrompts,
      startedAt: Date.now(),
    });
  }, []);

  const requestCancel = useCallback(() => {
    cancellationTokenRef.current.cancel();
    setState(prev => ({ ...prev, cancelling: true }));
  }, []);

  const clearProgress = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  }, []);

  return {
    state,
    updateProgress,
    addError,
    startImport,
    requestCancel,
    clearProgress,
    cancellationToken: cancellationTokenRef.current,
  };
}
```

### Import Complete Component

```typescript
// components/import/import-complete.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ImportProgressState } from '@/lib/import/types';

interface ImportCompleteProps {
  state: ImportProgressState;
  onViewPrompts: () => void;
  onClose: () => void;
}

export function ImportComplete({ state, onViewPrompts, onClose }: ImportCompleteProps) {
  const [showErrors, setShowErrors] = useState(false);
  const duration = Math.round((Date.now() - state.startedAt) / 1000);

  const success = state.failed === 0;

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          {success ? (
            <CheckCircle2 className="h-12 w-12 text-teal-500" />
          ) : (
            <AlertCircle className="h-12 w-12 text-amber-500" />
          )}
        </div>
        <CardTitle>
          {success ? 'Import Complete!' : 'Import Completed with Errors'}
        </CardTitle>
        <CardDescription>
          Imported in {formatDuration(duration)}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-teal-500/10 p-3">
            <p className="text-2xl font-bold text-teal-500">
              {state.imported.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Imported</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3">
            <p className="text-2xl font-bold text-amber-500">
              {state.skipped.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Duplicates</p>
          </div>
          <div className="rounded-lg bg-red-500/10 p-3">
            <p className="text-2xl font-bold text-red-400">
              {state.failed.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* Error Details */}
        {state.errors.length > 0 && (
          <div className="rounded-lg border border-[#2a2a2a] overflow-hidden">
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="flex w-full items-center justify-between p-3 text-sm text-muted-foreground hover:bg-[#1a1a1a]"
            >
              <span>{state.errors.length} errors occurred</span>
              {showErrors ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showErrors && (
              <div className="max-h-48 overflow-y-auto border-t border-[#2a2a2a] p-3 space-y-2">
                {state.errors.map((error, index) => (
                  <div key={index} className="text-xs">
                    <p className="font-medium text-red-400 truncate">
                      {error.projectPath}
                    </p>
                    <p className="text-muted-foreground">{error.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button className="w-full" onClick={onViewPrompts}>
            View Your Prompts
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes} minutes`;
}
```

### Cancellation Integration in Batch Processing

```typescript
// lib/import/batch.ts (update importProject)
export async function importProject(
  projectPath: string,
  onProgress: (count: number, total: number) => void,
  cancellationToken?: CancellationToken
): Promise<ImportResult> {
  const sessions = await listSessions(projectPath);
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;
  const failedSessions: string[] = [];

  for (const session of sessions) {
    // Check for cancellation before processing each session
    if (cancellationToken?.cancelled) {
      break;
    }

    try {
      const pairs = await extractPairsFromSession(session);

      for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
        // Check for cancellation before each batch
        if (cancellationToken?.cancelled) {
          break;
        }

        const batch = pairs.slice(i, i + BATCH_SIZE);
        const result = await uploadBatchWithRetry(batch);

        if (result.success) {
          success += result.imported || batch.length;
          skipped += result.skipped || 0;
        } else {
          failed += batch.length;
        }
      }
    } catch (e) {
      const error = e as Error;
      console.error(`Failed to process session ${session}:`, error.message);
      failedSessions.push(session);
      failed += 1;
    }

    processed += 1;
    onProgress(processed, sessions.length);
  }

  return {
    success,
    failed,
    skipped,
    failedSessions,
    cancelled: cancellationToken?.cancelled || false,
  };
}
```

### File Locations

| Component | Path |
|-----------|------|
| Import Progress | `components/import/import-progress.tsx` |
| Import Complete | `components/import/import-complete.tsx` |
| Import Errors | `components/import/import-errors.tsx` |
| Progress Hook | `lib/hooks/use-import-progress.ts` |
| Import Types | `lib/import/types.ts` |

### Time Estimation Algorithm

```typescript
// The estimation uses a simple rate-based calculation:
// 1. Track elapsed time since start
// 2. Calculate prompts/second rate
// 3. Estimate remaining = (total - processed) / rate

// For more accuracy, use a rolling average of recent batches:
function calculateEstimate(
  batches: Array<{ count: number; duration: number }>,
  remaining: number
): number | null {
  if (batches.length === 0) return null;

  // Use last 10 batches for rolling average
  const recent = batches.slice(-10);
  const totalCount = recent.reduce((sum, b) => sum + b.count, 0);
  const totalDuration = recent.reduce((sum, b) => sum + b.duration, 0);

  if (totalDuration === 0) return null;

  const rate = totalCount / totalDuration; // prompts per ms
  return remaining / rate / 1000; // Convert to seconds
}
```

### Common Pitfalls to Avoid

1. **DO NOT** update UI on every prompt - batch updates to prevent flicker
2. **DO NOT** block cancel until current batch completes - check often
3. **DO NOT** lose state on page refresh - use session storage
4. **DO NOT** show raw error messages to users - sanitize them
5. **DO NOT** forget to clean up session storage after completion
6. **DO NOT** calculate time remaining on first few batches - wait for stable rate
7. **DO NOT** block UI thread during import - use async properly

### Verification Checklist

After completing this story, verify:
- [ ] Progress bar updates in real-time as batches complete
- [ ] Current project name displays correctly
- [ ] Percentage calculation is accurate
- [ ] Running counts update after each batch
- [ ] Estimated time remaining updates and is reasonable
- [ ] Cancel button stops import gracefully
- [ ] Already-imported prompts are kept after cancel
- [ ] Error notifications appear inline
- [ ] Error details can be expanded
- [ ] Completion summary shows all categories
- [ ] Duration displays correctly
- [ ] Progress survives page refresh (session storage)
- [ ] "View Your Prompts" navigates to feed


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
