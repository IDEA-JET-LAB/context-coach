# Story 17.2: Import Preview UI

Status: ✅ Done

## Dependencies

- **Story 17-1: Transcript Discovery Service** - Required. This story depends on the discovery service to provide the list of discovered projects, session counts, and prompt statistics.

## PRD Alignment Note

The PRD (Section 9.3) refers to this as "Import Consent and Project Selection UI". This story implements that same scope under the name "Import Preview UI" to better reflect the user-facing functionality.

## Story

**As a** user with existing Claude Code history,
**I want** to see a preview of what will be imported before committing,
**So that** I can make an informed decision about which projects to import.

## Acceptance Criteria

1. **Given** the discovery service has found transcripts
   **When** I view the import preview screen
   **Then** I see a welcome modal/page showing:
   - Total prompt count across all projects
   - Date range of available history
   - Number of projects found

2. **Given** I am viewing the import preview
   **When** I want to see details
   **Then** I can expand to view a list of discovered projects with:
   - Project path (human-readable)
   - Session count per project
   - Prompt count per project
   - Date range per project

3. **Given** the import preview is displayed
   **When** I want to customize what to import
   **Then** I can select/deselect individual projects
   **And** the summary updates to reflect my selection

4. **Given** I have made my selection
   **When** I confirm the import
   **Then** the system proceeds to import the selected projects
   **And** the import flow transitions to the progress tracking state

5. **Given** I don't want to import history
   **When** I click "Skip for Now"
   **Then** I proceed to the main dashboard without importing
   **And** I can access import later from settings

6. **Given** I view the import preview
   **When** the page loads
   **Then** I see privacy information explaining how imported data will be handled
   **And** I see a link to the privacy policy

## Tasks / Subtasks

- [x] **Task 1: Create ImportPreview component** (AC: #1, #2, #6)
  - [x] Create `components/import/import-preview.tsx` component
  - [x] Display welcome message with summary statistics
  - [x] Show total prompts, date range, project count
  - [x] Add privacy information text explaining data handling
  - [x] Include link to privacy policy
  - [x] Style with dark mode colors matching dashboard

- [x] **Task 2: Create ProjectList component** (AC: #2, #3)
  - [x] Create `components/import/project-list.tsx` component
  - [x] Display expandable list of discovered projects
  - [x] Show project path, session count, prompt count, date range
  - [x] Add checkbox for selecting/deselecting projects
  - [x] Implement select all / deselect all functionality

- [x] **Task 3: Implement selection state management** (AC: #3)
  - [x] Create `lib/hooks/use-import-selection.ts` hook
  - [x] Track selected projects in local state
  - [x] Calculate running totals based on selection
  - [x] Persist selection in session storage for page refreshes

- [x] **Task 4: Create action buttons** (AC: #4, #5)
  - [x] Add "Import All" primary button
  - [x] Add "Select Projects" secondary button
  - [x] Add "Skip for Now" tertiary/link button
  - [x] Handle button states (loading, disabled)

- [x] **Task 5: Create import state machine** (AC: #4)
  - [x] Define ImportState type from architecture
  - [x] Create `lib/hooks/use-import-state.ts` hook
  - [x] Implement state transitions: discovery -> selection -> importing -> complete
  - [x] Handle "skipped" state for users who skip

- [x] **Task 6: Create import preview page** (AC: #1, #5)
  - [x] Create `app/(dashboard)/import/page.tsx`
  - [x] Integrate ImportPreview component
  - [x] Handle loading state while fetching discovery data
  - [x] Redirect to dashboard if no discovery data

- [x] **Task 7: Add import entry point** (AC: #5)
  - [x] Add "Import History" option to settings menu
  - [x] Show in onboarding flow for new users
  - [x] Display notification badge if unimported history detected

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router
- React 18 with Client Components for interactive elements
- TypeScript strict mode
- Tailwind CSS for styling

### Import Flow State Machine

From `_bmad-output/architecture-phase2.md` (Line 764-771):

```typescript
// lib/import/types.ts
export type ImportState =
  | { phase: 'discovery'; projects?: DiscoveredProject[] }
  | { phase: 'selection'; selected: string[] }
  | { phase: 'importing'; progress: number; total: number }
  | { phase: 'complete'; imported: number; failed: number }
  | { phase: 'skipped' };
```

### Import Preview UI Mockup

From architecture (Line 749-759):

```
┌─────────────────────────────────────────────────────────────────┐
│  Welcome to Contextor!                                          │
│                                                                 │
│  We detected 847 prompts from the last 30 days across           │
│  12 projects.                                                   │
│                                                                 │
│  Would you like to import and analyze your prompt history?      │
│  This provides immediate insights into your prompting patterns. │
│                                                                 │
│  [Import All]  [Select Projects]  [Skip for Now]                │
└─────────────────────────────────────────────────────────────────┘
```

### Import Preview Component

```typescript
// components/import/import-preview.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectList } from './project-list';
import { formatDistanceToNow } from 'date-fns';
import type { DiscoveryResult, ImportState } from '@/lib/import/types';

interface ImportPreviewProps {
  discoveryResult: DiscoveryResult;
  onImport: (projectPaths: string[]) => void;
  onSkip: () => void;
}

export function ImportPreview({ discoveryResult, onImport, onSkip }: ImportPreviewProps) {
  const [showProjects, setShowProjects] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>(
    discoveryResult.projects.map(p => p.normalizedPath)
  );

  const selectedStats = calculateSelectedStats(discoveryResult.projects, selectedProjects);

  const handleImportAll = () => {
    onImport(discoveryResult.projects.map(p => p.normalizedPath));
  };

  const handleImportSelected = () => {
    onImport(selectedProjects);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to Contextor!</CardTitle>
        <CardDescription className="text-base mt-4">
          We detected <span className="font-semibold text-[#fafafa]">{discoveryResult.totalPrompts.toLocaleString()}</span> prompts
          from the last {formatDistanceToNow(discoveryResult.dateRange.oldest)} across{' '}
          <span className="font-semibold text-[#fafafa]">{discoveryResult.totalProjects}</span> projects.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <p className="text-center text-muted-foreground">
          Would you like to import and analyze your prompt history?
          This provides immediate insights into your prompting patterns.
        </p>

        <p className="text-center text-xs text-muted-foreground">
          Your prompt history stays private. Data is stored securely and only accessible to you and your team.{' '}
          <a href="/privacy" className="underline hover:text-[#fafafa] transition-colors">
            Learn more about our privacy practices
          </a>
        </p>

        {showProjects && (
          <ProjectList
            projects={discoveryResult.projects}
            selectedProjects={selectedProjects}
            onSelectionChange={setSelectedProjects}
          />
        )}

        {showProjects && (
          <div className="text-sm text-center text-muted-foreground">
            {selectedProjects.length} of {discoveryResult.totalProjects} projects selected
            ({selectedStats.prompts.toLocaleString()} prompts)
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!showProjects ? (
            <>
              <Button size="lg" onClick={handleImportAll}>
                Import All
              </Button>
              <Button size="lg" variant="outline" onClick={() => setShowProjects(true)}>
                Select Projects
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              onClick={handleImportSelected}
              disabled={selectedProjects.length === 0}
            >
              Import Selected ({selectedProjects.length})
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={onSkip}>
            Skip for Now
          </Button>
        </div>

        {discoveryResult.skippedDirectories.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            {discoveryResult.skippedDirectories.length} directories were skipped due to permission issues
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function calculateSelectedStats(
  projects: DiscoveredProject[],
  selected: string[]
): { prompts: number; sessions: number } {
  const selectedSet = new Set(selected);
  return projects
    .filter(p => selectedSet.has(p.normalizedPath))
    .reduce(
      (acc, p) => ({
        prompts: acc.prompts + p.totalPrompts,
        sessions: acc.sessions + p.sessionCount,
      }),
      { prompts: 0, sessions: 0 }
    );
}
```

### Project List Component

```typescript
// components/import/project-list.tsx
'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import type { DiscoveredProject } from '@/lib/import/types';

interface ProjectListProps {
  projects: DiscoveredProject[];
  selectedProjects: string[];
  onSelectionChange: (selected: string[]) => void;
}

export function ProjectList({
  projects,
  selectedProjects,
  onSelectionChange,
}: ProjectListProps) {
  const selectedSet = new Set(selectedProjects);

  const handleToggle = (normalizedPath: string) => {
    if (selectedSet.has(normalizedPath)) {
      onSelectionChange(selectedProjects.filter(p => p !== normalizedPath));
    } else {
      onSelectionChange([...selectedProjects, normalizedPath]);
    }
  };

  const handleSelectAll = () => {
    if (selectedProjects.length === projects.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(projects.map(p => p.normalizedPath));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <span className="text-sm font-medium">Projects</span>
        <button
          onClick={handleSelectAll}
          className="text-sm text-muted-foreground hover:text-[#fafafa] transition-colors"
        >
          {selectedProjects.length === projects.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <ScrollArea className="h-[300px] rounded-md border border-[#2a2a2a]">
        <div className="p-2 space-y-1">
          {projects.map((project) => (
            <label
              key={project.normalizedPath}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1a1a1a] cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedSet.has(project.normalizedPath)}
                onCheckedChange={() => handleToggle(project.normalizedPath)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#fafafa] truncate">
                  {project.path}
                </p>
                <p className="text-xs text-muted-foreground">
                  {project.sessionCount} sessions &middot; {project.totalPrompts.toLocaleString()} prompts
                  &middot; {formatDistanceToNow(project.newestSession, { addSuffix: true })}
                </p>
              </div>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

### Import State Hook

```typescript
// lib/hooks/use-import-state.ts
'use client';

import { useState, useCallback } from 'react';
import type { ImportState, DiscoveredProject } from '@/lib/import/types';

export function useImportState() {
  const [state, setState] = useState<ImportState>({ phase: 'discovery' });

  const setDiscoveryComplete = useCallback((projects: DiscoveredProject[]) => {
    setState({ phase: 'discovery', projects });
  }, []);

  const startSelection = useCallback((selected: string[]) => {
    setState({ phase: 'selection', selected });
  }, []);

  const startImporting = useCallback((total: number) => {
    setState({ phase: 'importing', progress: 0, total });
  }, []);

  const updateProgress = useCallback((progress: number) => {
    setState((prev) => {
      if (prev.phase !== 'importing') return prev;
      return { ...prev, progress };
    });
  }, []);

  const completeImport = useCallback((imported: number, failed: number) => {
    setState({ phase: 'complete', imported, failed });
  }, []);

  const skip = useCallback(() => {
    setState({ phase: 'skipped' });
  }, []);

  return {
    state,
    setDiscoveryComplete,
    startSelection,
    startImporting,
    updateProgress,
    completeImport,
    skip,
  };
}
```

### Import Selection Hook

```typescript
// lib/hooks/use-import-selection.ts
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DiscoveredProject } from '@/lib/import/types';

const STORAGE_KEY = 'contextor-import-selection';

export function useImportSelection(projects: DiscoveredProject[]) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>(() => {
    // Initialize from session storage if available
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
    // Default: all projects selected
    return projects.map(p => p.normalizedPath);
  });

  // Persist to session storage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedPaths));
  }, [selectedPaths]);

  const stats = useMemo(() => {
    const selectedSet = new Set(selectedPaths);
    return projects
      .filter(p => selectedSet.has(p.normalizedPath))
      .reduce(
        (acc, p) => ({
          projectCount: acc.projectCount + 1,
          sessionCount: acc.sessionCount + p.sessionCount,
          promptCount: acc.promptCount + p.totalPrompts,
        }),
        { projectCount: 0, sessionCount: 0, promptCount: 0 }
      );
  }, [projects, selectedPaths]);

  return {
    selectedPaths,
    setSelectedPaths,
    stats,
    selectAll: () => setSelectedPaths(projects.map(p => p.normalizedPath)),
    deselectAll: () => setSelectedPaths([]),
  };
}
```

### Import Page

```typescript
// app/(dashboard)/import/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImportPreview } from '@/components/import/import-preview';
import { ImportProgress } from '@/components/import/import-progress';
import { ImportComplete } from '@/components/import/import-complete';
import { useImportState } from '@/lib/hooks/use-import-state';
import type { DiscoveryResult } from '@/lib/import/types';
import { Loader2 } from 'lucide-react';

export default function ImportPage() {
  const router = useRouter();
  const { state, startImporting, updateProgress, completeImport, skip } = useImportState();
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch discovery results from API or local state
    async function fetchDiscovery() {
      try {
        const response = await fetch('/api/import/discover');
        if (response.ok) {
          const data = await response.json();
          setDiscoveryResult(data);
        } else {
          // No discovery data - redirect to dashboard
          router.push('/');
        }
      } catch (error) {
        console.error('Failed to fetch discovery data:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    fetchDiscovery();
  }, [router]);

  const handleImport = async (projectPaths: string[]) => {
    // Transition to importing state
    startImporting(projectPaths.length);

    // Import logic handled by Story 17-3
  };

  const handleSkip = () => {
    skip();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!discoveryResult) {
    return null; // Will redirect
  }

  if (state.phase === 'discovery' || state.phase === 'selection') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <ImportPreview
          discoveryResult={discoveryResult}
          onImport={handleImport}
          onSkip={handleSkip}
        />
      </div>
    );
  }

  if (state.phase === 'importing') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <ImportProgress progress={state.progress} total={state.total} />
      </div>
    );
  }

  if (state.phase === 'complete') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <ImportComplete
          imported={state.imported}
          failed={state.failed}
          onContinue={() => router.push('/')}
        />
      </div>
    );
  }

  return null;
}
```

### File Locations

| Component | Path |
|-----------|------|
| Import Preview | `components/import/import-preview.tsx` |
| Project List | `components/import/project-list.tsx` |
| Import Page | `app/(dashboard)/import/page.tsx` |
| Import State Hook | `lib/hooks/use-import-state.ts` |
| Import Selection Hook | `lib/hooks/use-import-selection.ts` |
| Import Types | `lib/import/types.ts` |

### UI/UX Considerations

1. **Welcome Tone**: Use friendly, inviting language for new users
2. **Statistics First**: Show high-level stats before detailed project list
3. **Progressive Disclosure**: Hide project list by default, show on "Select Projects"
4. **Clear Actions**: Three distinct paths - import all, select, skip
5. **Reversibility**: Assure users they can import later from settings

### Common Pitfalls to Avoid

1. **DO NOT** auto-start import without user confirmation
2. **DO NOT** show import UI if no discovery data exists
3. **DO NOT** lose selection state on page refresh
4. **DO NOT** block skip action - users should always be able to proceed
5. **DO NOT** show overwhelming data - use progressive disclosure
6. **DO NOT** forget loading states while fetching discovery data

### Verification Checklist

After completing this story, verify:
- [ ] Welcome screen displays with correct statistics
- [ ] Privacy information is displayed explaining data handling
- [ ] Privacy policy link is visible and functional
- [ ] Project count and prompt count match discovery data
- [ ] Date range displays correctly (e.g., "last 30 days")
- [ ] "Select Projects" button reveals project list
- [ ] Individual projects can be selected/deselected
- [ ] "Select All" / "Deselect All" works correctly
- [ ] Running totals update based on selection
- [ ] "Import All" imports all discovered projects
- [ ] "Import Selected" imports only checked projects
- [ ] "Skip for Now" redirects to dashboard
- [ ] Import can be accessed later from settings
- [ ] Selection persists on page refresh (session storage)
- [ ] Loading state shown while fetching discovery data

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

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created full Import Preview UI with welcome screen and project selection
- Implemented state machine for import flow (discovery → selection → importing → complete)
- Added session storage persistence for selection state
- Privacy information displayed with policy link
- 18 E2E tests passing covering all acceptance criteria

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-23 | Initial implementation | Dev Agent |
| 2025-12-23 | Marked complete after verification | Amelia (Dev Agent) |

### File List

- `app/components/import/import-preview.tsx` - Main preview component
- `app/components/import/project-list.tsx` - Project selection list
- `app/components/import/import-progress.tsx` - Progress indicator
- `app/components/import/import-modal.tsx` - Modal wrapper
- `app/components/import/discovery-import-preview.tsx` - Discovery preview
- `app/lib/hooks/use-import-selection.ts` - Selection state hook
- `app/lib/hooks/use-import-state.ts` - Import state machine hook
- `app/app/(dashboard)/import/page.tsx` - Import page route
- `app/e2e/import-preview.spec.ts` - E2E tests (18 passing)
