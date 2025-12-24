# Story 18.5: One-Click Resume

Status: Done

## Story

**As a** developer wanting to resume an interrupted session,
**I want** to copy a recovery prompt to my clipboard with one click,
**So that** I can immediately paste it into Claude Code and continue where I left off.

## Acceptance Criteria

1. **Given** the user clicks "Recover" on an interrupted session
   **When** the recovery prompt is generated
   **Then** the prompt is automatically copied to the system clipboard
   **And** a confirmation notification appears: "Recovery prompt copied to clipboard"

2. **Given** the clipboard copy succeeds
   **When** the notification is shown
   **Then** it includes a "Paste in Claude Code" instruction
   **And** optionally offers to open the terminal/Claude Code panel

3. **Given** the user has Claude Code extension installed
   **When** the recovery is triggered
   **Then** the system attempts to focus the terminal or Claude Code panel
   **And** the recovery prompt remains on the clipboard ready to paste

4. **Given** clipboard copy fails (permissions, etc.)
   **When** the error occurs
   **Then** a fallback modal opens showing the recovery prompt
   **And** the prompt is selectable for manual copy
   **And** an error message explains what happened

5. **Given** the recovery prompt is used
   **When** the session is successfully resumed
   **Then** the interrupted session is marked as recovered
   **And** it is removed from the recovery panel

6. **Given** the recovery flow completes
   **When** analytics are enabled
   **Then** a "session_recovered" event is logged
   **And** it includes sessionId, method (clipboard/manual), and timeToRecover
   **And** optional properties (promptLength, filesCount, messagesCount) may be included for internal metrics

## Tasks / Subtasks

- [ ] **Task 1: Implement clipboard copy functionality** (AC: #1, #4)
  - [ ] Create `packages/vscode-extension/src/services/clipboardService.ts`
  - [ ] Use `vscode.env.clipboard.writeText()` for clipboard access
  - [ ] Wrap in try-catch for error handling
  - [ ] Return success/failure result
  - [ ] Handle empty prompt edge case

- [ ] **Task 2: Create recovery command handler** (AC: #1, #2)
  - [ ] Register command: `contextor.recoverSession`
  - [ ] Accept sessionId as argument
  - [ ] Load session snapshot from store
  - [ ] Generate recovery prompt (using Story 18-3's generator)
  - [ ] Copy to clipboard
  - [ ] Show success notification with guidance

- [ ] **Task 3: Implement success notification** (AC: #2)
  - [ ] Show notification: "Recovery prompt copied to clipboard"
  - [ ] Include instruction text in notification body
  - [ ] Add action button: "Open Terminal" (optional)
  - [ ] Add action button: "Show Prompt" (for verification)
  - [ ] Auto-dismiss after 10 seconds

- [ ] **Task 4: Implement fallback modal for clipboard failure** (AC: #4)
  - [ ] Create webview-based modal or use `vscode.window.showInputBox` (read-only mode)
  - [ ] Display the full recovery prompt in a selectable text area
  - [ ] Show error message explaining clipboard failure
  - [ ] Provide "Copy" button that retries clipboard
  - [ ] Provide "Close" button to dismiss

- [ ] **Task 5: Mark sessions as recovered** (AC: #5)
  - [ ] Add `recoveredSessions` to extension state
  - [ ] Store sessionId with recoveredAt timestamp
  - [ ] Remove session from interrupted sessions list
  - [ ] Update recovery panel to hide recovered sessions
  - [ ] Optionally track recovery success rate

- [ ] **Task 6: Implement analytics tracking** (AC: #6)
  - [ ] Create `packages/vscode-extension/src/services/analyticsService.ts`
  - [ ] Define `session_recovered` event schema
  - [ ] Track: sessionId, method, time_to_recover (from detection to recovery)
  - [ ] Send to Contextor API if user has opted in
  - [ ] Respect privacy settings (no tracking if disabled)
  - [ ] Queue events for batch sending

- [ ] **Task 7: Claude Code integration research spike** (AC: #3)
  - [ ] Research Claude Code extension API (if public)
  - [ ] Check if Claude Code exposes input field focus command
  - [ ] Check if Claude Code has paste/submit API
  - [ ] **Exit criteria:**
    - Decision document created at `docs/research/claude-code-integration.md`
    - Document answers: (1) Is direct integration possible? (2) What commands are available? (3) Recommended approach
    - Time-boxed to 4 hours maximum
    - If no public API found, document fallback to terminal focus approach

- [ ] **Task 8: Wire up recovery panel actions** (AC: #1, #5)
  - [ ] Connect "Recover" button in panel to `contextor.recoverSession` command
  - [ ] Pass sessionId through webview message
  - [ ] Update panel state after recovery
  - [ ] Handle concurrent recovery attempts (disable button during process)
  - [ ] Show loading state while generating prompt

## Dev Notes

### Clipboard Service

```typescript
// packages/vscode-extension/src/services/clipboardService.ts

import * as vscode from 'vscode';

export interface ClipboardResult {
  success: boolean;
  error?: string;
}

export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Empty prompt' };
  }

  try {
    await vscode.env.clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
```

### Recovery Command Handler

```typescript
// packages/vscode-extension/src/commands/recoverSession.ts

import * as vscode from 'vscode';
import { generateRecoveryPrompt } from '../services/recoveryPromptGenerator';
import { copyToClipboard } from '../services/clipboardService';
import { snapshotStore } from '../services/snapshotStore';
import { markAsRecovered } from '../services/recoveryState';
import { trackEvent } from '../services/analyticsService';

export async function recoverSession(sessionId: string): Promise<void> {
  const startTime = Date.now();

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Generating recovery prompt...',
      cancellable: false
    },
    async () => {
      // Get snapshot
      const snapshot = snapshotStore.getSnapshot(sessionId);
      if (!snapshot) {
        vscode.window.showErrorMessage('Session snapshot not found. It may have expired.');
        return;
      }

      // Generate prompt
      const prompt = await generateRecoveryPrompt(snapshot);

      // Copy to clipboard
      const result = await copyToClipboard(prompt);

      if (result.success) {
        // Show success notification
        const action = await vscode.window.showInformationMessage(
          'Recovery prompt copied to clipboard. Paste it into Claude Code to continue.',
          'Show Prompt',
          'Open Terminal'
        );

        if (action === 'Show Prompt') {
          showPromptModal(prompt);
        } else if (action === 'Open Terminal') {
          vscode.commands.executeCommand('workbench.action.terminal.focus');
        }

        // Mark as recovered
        await markAsRecovered(sessionId);

        // Track analytics
        trackEvent('session_recovered', {
          sessionId,
          method: 'clipboard',
          timeToRecover: Date.now() - startTime,
        });
      } else {
        // Show fallback modal
        showFallbackModal(prompt, result.error);
      }
    }
  );
}
```

### Success Notification with Actions

```typescript
async function showSuccessNotification(prompt: string): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    'Recovery prompt copied to clipboard. Paste it into Claude Code to continue.',
    { modal: false },
    'Show Prompt',
    'Open Terminal'
  );

  switch (action) {
    case 'Show Prompt':
      // Open read-only document with prompt
      const doc = await vscode.workspace.openTextDocument({
        content: prompt,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { preview: true });
      break;

    case 'Open Terminal':
      await vscode.commands.executeCommand('workbench.action.terminal.focus');
      break;
  }
}
```

### Fallback Modal Implementation

```typescript
// For clipboard failure - show modal with selectable text

async function showFallbackModal(prompt: string, error?: string): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'contextorRecoveryPrompt',
    'Recovery Prompt',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          padding: 20px;
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
        }
        .error {
          color: var(--vscode-errorForeground);
          background: var(--vscode-inputValidation-errorBackground);
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 16px;
        }
        textarea {
          width: 100%;
          height: 200px;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          padding: 10px;
          font-family: monospace;
          resize: vertical;
        }
        button {
          margin-top: 10px;
          padding: 8px 16px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          cursor: pointer;
        }
        .instructions {
          margin-top: 16px;
          color: var(--vscode-descriptionForeground);
        }
      </style>
    </head>
    <body>
      ${error ? `<div class="error">Clipboard error: ${error}</div>` : ''}
      <p>Copy the prompt below and paste it into Claude Code:</p>
      <textarea id="prompt" readonly>${escapeHtml(prompt)}</textarea>
      <button onclick="copyPrompt()">Copy to Clipboard</button>
      <p class="instructions">
        1. Select all text in the box above (Cmd/Ctrl+A)<br>
        2. Copy (Cmd/Ctrl+C)<br>
        3. Open Claude Code<br>
        4. Paste (Cmd/Ctrl+V)
      </p>
      <script>
        const vscode = acquireVsCodeApi();
        function copyPrompt() {
          navigator.clipboard.writeText(document.getElementById('prompt').value)
            .then(() => vscode.postMessage({ type: 'copied' }))
            .catch(() => vscode.postMessage({ type: 'copyFailed' }));
        }
      </script>
    </body>
    </html>
  `;

  panel.webview.onDidReceiveMessage(message => {
    if (message.type === 'copied') {
      vscode.window.showInformationMessage('Prompt copied to clipboard');
      panel.dispose();
    }
  });
}
```

### Recovery State Management

```typescript
// packages/vscode-extension/src/services/recoveryState.ts

interface RecoveredSession {
  sessionId: string;
  recoveredAt: number;
}

const RECOVERED_KEY = 'contextor.recoveredSessions';

export class RecoveryState {
  constructor(private context: vscode.ExtensionContext) {}

  async markAsRecovered(sessionId: string): Promise<void> {
    const recovered = this.getRecoveredList();
    recovered.push({
      sessionId,
      recoveredAt: Date.now(),
    });
    await this.context.globalState.update(RECOVERED_KEY, recovered);

    // Also clear the snapshot
    await snapshotStore.deleteSnapshot(sessionId);
  }

  isRecovered(sessionId: string): boolean {
    const recovered = this.getRecoveredList();
    return recovered.some(r => r.sessionId === sessionId);
  }

  private getRecoveredList(): RecoveredSession[] {
    return this.context.globalState.get<RecoveredSession[]>(RECOVERED_KEY) || [];
  }
}
```

### Analytics Event Schema

```typescript
interface SessionRecoveredEvent {
  event: 'session_recovered';
  properties: {
    // Required properties (per AC#6)
    sessionId: string;
    method: 'clipboard' | 'manual';
    timeToRecover: number;  // ms from detection to recovery

    // Optional internal metrics (not required by AC)
    promptLength?: number;
    isAIGenerated?: boolean;
    filesCount?: number;
    messagesCount?: number;
  };
}

async function trackEvent(name: string, properties: Record<string, unknown>): Promise<void> {
  // Check if analytics enabled
  const config = vscode.workspace.getConfiguration('contextor');
  if (!config.get('analytics.enabled', true)) {
    return;
  }

  // Queue event for sending
  eventQueue.push({ name, properties, timestamp: Date.now() });

  // Send if queue is large enough or flush timer
  if (eventQueue.length >= 10) {
    await flushEvents();
  }
}
```

### Claude Code Integration (Future)

Research needed for potential direct integration:

```typescript
// Placeholder for future Claude Code API integration

interface ClaudeCodeIntegration {
  // Check if Claude Code extension is installed
  isInstalled(): boolean;

  // Focus the Claude Code input field
  focusInput(): Promise<boolean>;

  // Submit a prompt directly (if API allows)
  submitPrompt(prompt: string): Promise<boolean>;
}

// Current implementation - just focus terminal
async function attemptClaudeCodeFocus(): Promise<void> {
  // Check if Claude Code is installed
  const claudeExtension = vscode.extensions.getExtension('anthropic.claude-code');

  if (claudeExtension) {
    // Try to find and execute Claude Code focus command
    // (pending API research)
    console.log('Claude Code found, attempting focus...');
  }

  // Fallback to terminal
  await vscode.commands.executeCommand('workbench.action.terminal.focus');
}
```

### Test Scenarios

1. Click "Recover" - prompt copied, notification shown
2. Clipboard fails - fallback modal appears with prompt
3. Click "Show Prompt" in notification - opens document with prompt
4. Click "Open Terminal" - focuses terminal
5. Session marked as recovered after successful copy
6. Recovered session removed from panel
7. Analytics event sent with correct properties
8. Analytics disabled - no event sent
9. Fallback modal "Copy" button works
10. Empty prompt handled gracefully
11. Session not found (expired) - error message shown
12. Concurrent recovery attempts handled (button disabled)
13. Progress indicator shown during generation

### UX Flow Diagram

```
User clicks "Recover"
        │
        ▼
┌─────────────────┐
│ Show progress   │
│ indicator       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Load snapshot   │
│ Generate prompt │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Copy to         │
│ clipboard       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Success    Failure
    │         │
    ▼         ▼
┌─────────┐ ┌───────────┐
│ Show    │ │ Show      │
│ toast   │ │ fallback  │
│ with    │ │ modal     │
│ actions │ └───────────┘
└────┬────┘
     │
     ▼
┌─────────────────┐
│ Mark session    │
│ as recovered    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Track analytics │
│ event           │
└─────────────────┘
```

## Dependencies

- **Depends on:**
  - Story 18-1 (Interrupted Session Detection) - provides session detection
  - Story 18-2 (Session State Snapshot) - provides snapshot storage
  - Story 18-3 (Recovery Prompt Generator) - provides prompt generation
  - Story 18-4 (Recovery Notification UI) - provides recovery panel UI
  - Story 19-1 (Extension Scaffold) - provides VS Code extension infrastructure
- **Blocks:** None (this is the final story in Epic 18)


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

- Created ClipboardService with error handling and validation
- Created RecoveryState service for tracking recovered sessions
- Created AnalyticsService with privacy controls and event batching
- Created recoverSession command with progress indicator
- Created fallback webview modal for clipboard failures
- Added analytics.enabled setting
- 100 unit tests (26 clipboard + 31 recovery state + 24 analytics + 19 command)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-24 | Initial implementation | Claude Opus 4.5 |

### File List

- `packages/vscode-extension/src/services/clipboardService.ts` (created)
- `packages/vscode-extension/src/services/recoveryState.ts` (created)
- `packages/vscode-extension/src/services/analyticsService.ts` (created)
- `packages/vscode-extension/src/commands/recoverSession.ts` (created)
- `packages/vscode-extension/src/services/__tests__/clipboardService.test.ts` (created)
- `packages/vscode-extension/src/services/__tests__/recoveryState.test.ts` (created)
- `packages/vscode-extension/src/services/__tests__/analyticsService.test.ts` (created)
- `packages/vscode-extension/src/commands/__tests__/recoverSession.test.ts` (created)
- `packages/vscode-extension/src/extension.ts` (modified)
- `packages/vscode-extension/src/providers/recoveryPanelProvider.ts` (modified)
- `packages/vscode-extension/package.json` (modified)
