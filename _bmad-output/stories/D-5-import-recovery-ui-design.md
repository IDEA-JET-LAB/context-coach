# Story D-5: Import & Recovery UI Design

Status: Ready

## Story

**As a** developer with existing Claude Code transcripts,
**I want** intuitive interfaces for importing history and recovering interrupted sessions,
**So that** I can leverage my past work and never lose context.

## Acceptance Criteria

1. **Given** the transcript import feature (Epic 17)
   **When** the UI is designed
   **Then** users can browse discoverable transcript files
   **And** preview sessions before importing
   **And** see progress during batch import
   **And** understand deduplication with clear indicators

2. **Given** the session recovery feature (Epic 18)
   **When** the UI is designed
   **Then** interrupted sessions are surfaced proactively
   **And** users see a snapshot of where they left off
   **And** one-click resume is obvious and accessible
   **And** dismissing recovery is equally easy

3. **Given** both features
   **When** designed
   **Then** they integrate naturally into the existing dashboard
   **And** they don't interrupt normal workflow unless needed
   **And** empty/error states are helpful and actionable

4. **Given** the need for progressive disclosure
   **When** designed
   **Then** simple cases are handled simply (one button)
   **And** complex cases reveal options progressively
   **And** advanced options don't overwhelm new users

## Tasks / Subtasks

- [ ] **Task 1: Design Import Entry Point** (AC: #1, #4)
  - [ ] Design import button/menu item placement in dashboard
  - [ ] Design import modal or dedicated page (evaluate trade-offs)
  - [ ] Design "Start Import" call-to-action for new users
  - [ ] Decision: Modal vs full page vs sidebar panel

- [ ] **Task 2: Design Transcript Discovery UI** (AC: #1)
  - [ ] Design file browser component showing discovered transcripts
  - [ ] Design folder structure visualization
  - [ ] Design file icons/badges for transcript status (new, imported, error)
  - [ ] Design selection controls (select all, individual, date range)
  - [ ] Design search/filter for large transcript collections
  - [ ] Implement as `components/import/transcript-browser.tsx`

- [ ] **Task 3: Design Import Preview** (AC: #1, #4)
  - [ ] Design session preview card (date, duration, prompt count)
  - [ ] Design prompt sample display (first/last few prompts)
  - [ ] Design duplicate indicator (already imported vs new)
  - [ ] Design conflict resolution UI (skip/overwrite options)
  - [ ] Design import settings (date range, project assignment)
  - [ ] Implement as `components/import/import-preview.tsx`

- [ ] **Task 4: Design Import Progress** (AC: #1)
  - [ ] Design progress bar component with session/prompt counts
  - [ ] Design per-file status (importing, complete, error)
  - [ ] Design error handling (retry, skip, view details)
  - [ ] Design completion summary (X sessions, Y prompts imported)
  - [ ] Design cancel import confirmation
  - [ ] Implement as `components/import/import-progress.tsx`

- [ ] **Task 5: Design Import History** (AC: #1)
  - [ ] Design import history log view
  - [ ] Design rollback option per import batch
  - [ ] Design undo confirmation dialog
  - [ ] Implement as `components/import/import-history.tsx`

- [ ] **Task 6: Design Recovery Banner** (AC: #2, #3)
  - [ ] Design non-intrusive banner for dashboard header
  - [ ] Design banner content: "Continue where you left off?"
  - [ ] Design session snapshot preview (last prompt, project, time)
  - [ ] Design "Resume" and "Dismiss" action buttons
  - [ ] Design animation for banner appearance
  - [ ] Implement as `components/recovery/recovery-banner.tsx`

- [ ] **Task 7: Design Recovery Detail** (AC: #2)
  - [ ] Design expanded recovery view (on click or dedicated page)
  - [ ] Design session context visualization (what was being worked on)
  - [ ] Design last prompts list with AI responses
  - [ ] Design "Generate Recovery Prompt" preview
  - [ ] Design recovery options (full context, summary, skip)
  - [ ] Implement as `components/recovery/recovery-detail.tsx`

- [ ] **Task 8: Design Recovery Notification (VS Code)** (AC: #2)
  - [ ] Design VS Code notification for interrupted session
  - [ ] Design sidebar indicator for pending recovery
  - [ ] Design quick-resume from extension
  - [ ] Coordinate with D-4 VS Code design

- [ ] **Task 9: Design Empty and Error States** (AC: #3)
  - [ ] Design "No transcripts found" with help text
  - [ ] Design "No interrupted sessions" confirmation
  - [ ] Design import error state with retry option
  - [ ] Design recovery error state with manual options

## Dev Notes

### Import Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  Discovery      │───▶│  Preview &      │───▶│  Progress       │
│  (Browse files) │    │  Selection      │    │  (Import)       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
   File tree UI          Session cards          Progress bar
   with selection        with details           with status
```

### Recovery Banner Placement

```
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard Header                                                │
├─────────────────────────────────────────────────────────────────┤
│ 💡 Continue where you left off?                                │
│ Last active: "Implementing auth flow..." • 2 hours ago          │
│ [Resume Session] [Dismiss]                                      │
├─────────────────────────────────────────────────────────────────┤
│ Main Content (Feed)                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Component Structure

```
components/
├── import/
│   ├── transcript-browser.tsx    # File discovery/selection
│   ├── import-preview.tsx        # Session preview cards
│   ├── import-progress.tsx       # Progress during import
│   ├── import-history.tsx        # Past imports with rollback
│   └── import-modal.tsx          # Container modal/page
└── recovery/
    ├── recovery-banner.tsx       # Dashboard banner
    ├── recovery-detail.tsx       # Expanded recovery view
    └── recovery-notification.tsx # VS Code notification
```

### Key UI Patterns

| Pattern | Use Case |
|---------|----------|
| File tree | Browsing transcripts by folder |
| Checkbox list | Selecting multiple sessions |
| Progress bar | Import progress |
| Banner notification | Non-intrusive recovery prompt |
| Preview card | Session summary before action |
| Confirmation modal | Destructive actions (rollback) |

### State Management

```typescript
// Import state
interface ImportState {
  step: 'discovery' | 'preview' | 'importing' | 'complete';
  files: DiscoveredFile[];
  selected: string[];
  progress: { current: number; total: number; errors: string[] };
}

// Recovery state
interface RecoveryState {
  interruptedSession: Session | null;
  dismissed: boolean;
  recovering: boolean;
}
```

### Integration Points

| Feature | Dashboard Location |
|---------|-------------------|
| Import button | Projects page or Settings |
| Import modal | Overlay on any page |
| Recovery banner | Dashboard header area |
| Recovery detail | Modal or dedicated route |

## Recommended Tools & Agents

### Pixel Agent (Visual Asset Generator)

Use the **Pixel agent** (`/bmad:custom:agents:pixel`) for import/recovery visual assets:

```
Pixel Commands:
- *generate          → Generate illustrations and icons
- *batch             → Generate cohesive status icon sets
```

**Use Pixel For:**
| Asset Type | Purpose |
|------------|---------|
| Import success illustration | Celebration graphic after successful import |
| Empty transcript state | "No transcripts found" illustration |
| Recovery prompt graphic | Visual for "Continue where you left off?" |
| Progress indicators | Custom progress visuals if needed |
| File type icons | Custom icons for .jsonl transcript files |
| Error state illustration | Friendly error graphic |

**Workflow:**
1. Design the component layout first (with placeholders)
2. Invoke Pixel: `*analyze-component components/import/empty-transcripts.tsx`
3. Pixel suggests appropriate illustration
4. Generate with style consistency: `*generate "friendly illustration, empty folder, dark theme, matches Contextor style"`
5. `*accept` to deploy

### Frontend-Design Skill

Use `/frontend-design` for the React components (import modal, file tree, progress bar, recovery banner).

## Dependencies

- **Depends on:** Story D-1, D-2, D-3 (design system and components)
- **Blocks:** Epic 17 (Import) and Epic 18 (Recovery) implementation

## References

- Epic: Epic D: Phase 2 Design Foundation
- Epic 17: Transcript Import Experience
- Epic 18: Session Recovery
- Architecture: Phase 2 Architecture

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by design agent after completion*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by design agent - list all files created/modified*
