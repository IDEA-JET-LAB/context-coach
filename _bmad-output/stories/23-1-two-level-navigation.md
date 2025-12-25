# Story 23-1: Two-Level Navigation

Status: Completed

## Story

**As a** VS Code extension user,
**I want** to have organized navigation between Contextor and BMAD features,
**So that** I can easily access relevant functionality without tab clutter.

## Acceptance Criteria

1. **Given** I open the Contextor sidebar panel
   **When** the panel loads
   **Then** I see two primary section tabs: "Contextor" and "BMAD"

2. **Given** I click on "Contextor" primary tab
   **When** the tab becomes active
   **Then** I see secondary tabs: Analytics, Last Prompt, Conversations, Sessions, Import

3. **Given** I click on "BMAD" primary tab
   **When** the tab becomes active
   **Then** I see secondary tabs: Commands, Status, Documents

4. **Given** I am viewing any tab
   **When** the panel re-renders
   **Then** the primary and secondary tab states are visually distinct

## Dependencies

- **Story 19-3**: Sidebar Panel Component (base webview infrastructure)

## Technical Notes

- Primary tabs use full-width buttons with section names
- Secondary tabs use icon-only buttons with tooltips
- Active states use VS Code theme colors for consistency

## Implementation

**Files Created/Modified:**
- `webviews/analytics/src/components/TabNavigation.tsx` - Two-level tab navigation component
- `webviews/analytics/src/styles/index.css` - Tab styling with `.primary-tabs` and `.tab-navigation`
- `webviews/analytics/src/App.tsx` - State management for active tabs

**Key Implementation Details:**
- `PrimarySectionId` type: "contextor" | "bmad"
- `TabId` type: "analytics" | "lastPrompt" | "conversations" | "sessions" | "import" | "commands" | "status" | "documents"
- `getSection()` helper determines which primary section a tab belongs to
- Primary tabs render as full buttons, secondary tabs render as icon buttons

## Tasks / Subtasks

- [x] **Task 1: Update TabNavigation component structure**
  - [x] Add PrimarySectionId type
  - [x] Create contextorTabs and bmadTabs arrays
  - [x] Implement getSection() helper function
  - [x] Add primary tab click handlers

- [x] **Task 2: Add primary tabs UI**
  - [x] Create .primary-tabs container div
  - [x] Add Contextor and BMAD buttons
  - [x] Style active state with border indicator
  - [x] Add hover states

- [x] **Task 3: Conditional secondary tabs**
  - [x] Filter secondary tabs based on active primary section
  - [x] Maintain existing icon button format
  - [x] Preserve badge display for Sessions tab

## Dev Estimate

2 hours (Completed)
