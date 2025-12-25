# Story 23-6: Install BMAD Button

Status: Completed

## Story

**As a** VS Code extension user,
**I want** to install BMAD directly from the extension,
**So that** I can start using BMAD workflows without manual terminal commands.

## Acceptance Criteria

1. **Given** BMAD is not installed in my workspace
   **When** I click "Install BMAD" button
   **Then** a terminal opens and runs the BMAD installation command

2. **Given** the terminal is running the installation
   **When** the installation completes
   **Then** I can click "Refresh" to update the workspace status

3. **Given** the installation fails
   **When** I check the terminal
   **Then** I see error messages from the installation script

## Dependencies

- **Story 23-4**: Workspace Installation Detection

## Technical Notes

- Uses vscode.window.createTerminal() for terminal creation
- Installation command: `npx bmad-cli init` (or similar)
- Terminal is shown but not focused to allow user to see output
- User must manually refresh after installation completes

## Implementation

**Files Modified:**
- `src/providers/analyticsPanel.ts` - Added `handleInstallBmad()` method

**Key Implementation Details:**
```typescript
private async handleInstallBmad(): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: "BMAD Installation",
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  });
  terminal.show();
  terminal.sendText("npx bmad-cli init");
  vscode.window.showInformationMessage(
    "BMAD installation started. Click 'Refresh' when complete."
  );
}
```

## Tasks / Subtasks

- [x] **Task 1: Add install-bmad message handler**
  - [x] Add case in handleWebviewMessage switch
  - [x] Create handleInstallBmad method

- [x] **Task 2: Implement terminal automation**
  - [x] Create terminal with appropriate name
  - [x] Set working directory to workspace root
  - [x] Send installation command
  - [x] Show terminal to user

- [x] **Task 3: Add user feedback**
  - [x] Show info message about installation
  - [x] Guide user to refresh after completion

## Dev Estimate

1 hour (Completed)
