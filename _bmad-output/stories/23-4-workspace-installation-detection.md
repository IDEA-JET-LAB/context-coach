# Story 23-4: Workspace Installation Detection

Status: Completed

## Story

**As a** VS Code extension user,
**I want** the extension to detect whether Contextor and BMAD are installed in my workspace,
**So that** I can see appropriate onboarding UI when tools are not installed.

## Acceptance Criteria

1. **Given** I open a workspace without Contextor installed (no `.contextor/config.json`)
   **When** I navigate to any Contextor tab (Analytics, Last Prompt, etc.)
   **Then** I see a "Contextor Not Installed" panel with setup instructions

2. **Given** I open a workspace without BMAD installed (no `_bmad/` folder)
   **When** I navigate to any BMAD tab (Commands, Status, Documents)
   **Then** I see a "BMAD Not Installed" panel with install button

3. **Given** Contextor is not installed
   **When** I view the Not Installed panel
   **Then** I see a "Register Project" button and refresh button

4. **Given** BMAD is not installed
   **When** I view the Not Installed panel
   **Then** I see an "Install BMAD" button and refresh button

5. **Given** I click "Refresh" button
   **When** installation state may have changed
   **Then** the extension re-checks workspace and updates the UI

## Dependencies

- **Story 23-1**: Two-Level Navigation

## Technical Notes

- Check for `.contextor/config.json` to detect Contextor installation
- Check for `_bmad/` folder to detect BMAD installation
- Workspace status checked on panel activation and on refresh
- Status sent to webview via `workspace-status` message

## Implementation

**Files Created/Modified:**
- `src/providers/analyticsPanel.ts` - Added `checkWorkspaceStatus()` method
- `src/types/messages.ts` - Added `WorkspaceStatus` interface and message types
- `webviews/analytics/src/components/NotInstalledPanel.tsx` - New component
- `webviews/analytics/src/App.tsx` - Conditional rendering based on workspace status
- `webviews/analytics/src/styles/index.css` - NotInstalledPanel styles

**Key Implementation Details:**
```typescript
interface WorkspaceStatus {
  contextorInstalled: boolean;
  bmadInstalled: boolean;
  projectId: string | null;
  projectName: string | null;
}
```

- `checkWorkspaceStatus()` uses `vscode.workspace.fs.stat()` for file existence checks
- Reads `.contextor/config.json` to get projectId and projectName if installed
- Status message sent on panel activation

## Tasks / Subtasks

- [x] **Task 1: Add WorkspaceStatus type**
  - [x] Define interface in messages.ts
  - [x] Add workspace-status message type
  - [x] Add refresh-workspace-status webview message

- [x] **Task 2: Implement workspace detection**
  - [x] Create checkWorkspaceStatus() in analyticsPanel.ts
  - [x] Check for .contextor/config.json existence
  - [x] Check for _bmad/ folder existence
  - [x] Parse config.json for project details if present

- [x] **Task 3: Create NotInstalledPanel component**
  - [x] Create component with type prop (contextor | bmad)
  - [x] Add appropriate icon, title, and description
  - [x] Add action button (Register Project / Install BMAD)
  - [x] Add refresh button
  - [x] Style with warning/info theme

- [x] **Task 4: Integrate into App.tsx**
  - [x] Add workspaceStatus state
  - [x] Handle workspace-status message
  - [x] Conditionally render NotInstalledPanel
  - [x] Pass appropriate handlers

## Dev Estimate

3 hours (Completed)
