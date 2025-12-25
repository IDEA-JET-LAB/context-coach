# Story 23-3: Collapsible Status Panel

Status: Completed

## Story

**As a** VS Code extension user,
**I want** to collapse and expand epic categories in the Status panel,
**So that** I can focus on relevant epics without scrolling through the entire list.

## Acceptance Criteria

1. **Given** I navigate to BMAD > Status tab
   **When** the panel loads
   **Then** I see epics grouped with collapsible headers

2. **Given** I see an epic header (e.g., "Epic 17: Transcript Import")
   **When** I click the header
   **Then** the stories within that epic toggle between expanded/collapsed

3. **Given** an epic is collapsed
   **When** I look at the header
   **Then** I see a chevron icon indicating collapsed state and story count badge

4. **Given** an epic is expanded
   **When** I look at the stories
   **Then** I see each story with name and status indicator

## Dependencies

- **Story 19-3**: Sidebar Panel Component

## Technical Notes

- Use React state for expanded/collapsed tracking
- Persist expansion state in component (not across sessions)
- Default: First epic expanded, others collapsed

## Implementation

**Files Created/Modified:**
- `webviews/analytics/src/components/StatusPanel.tsx` - Updated with collapsible sections
- `webviews/analytics/src/styles/index.css` - Added `.epic-header`, `.epic-chevron` styles

**Key Implementation Details:**
- `expandedEpics` state as Set<string> for tracking expanded epics
- `toggleEpic()` function to add/remove from set
- Chevron rotates 90 degrees when expanded
- Story list conditionally rendered based on expansion state

## Tasks / Subtasks

- [x] **Task 1: Add expansion state management**
  - [x] Create expandedEpics state as Set<string>
  - [x] Initialize with first epic expanded
  - [x] Create toggleEpic handler

- [x] **Task 2: Update epic header UI**
  - [x] Add clickable header with cursor pointer
  - [x] Add chevron icon with rotation animation
  - [x] Add story count badge
  - [x] Style active/hover states

- [x] **Task 3: Conditional story rendering**
  - [x] Only render stories when epic is expanded
  - [x] Add smooth height transition (optional)
  - [x] Maintain status indicators

## Dev Estimate

2 hours (Completed)
