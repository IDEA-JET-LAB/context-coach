# Story 18.4: Recovery Notification UI

Status: Ready

## Story

**As a** developer who had a previous session crash,
**I want** to be notified when the extension detects an interrupted session,
**So that** I'm aware of the opportunity to resume and can choose whether to recover.

## Acceptance Criteria

1. **Given** the VS Code extension detects one or more interrupted sessions
   **When** VS Code starts or the extension activates
   **Then** a notification toast appears in the bottom-right corner
   **And** the notification indicates the number of interrupted sessions found

2. **Given** the notification is displayed
   **When** the user reads it
   **Then** it shows a summary: "1 interrupted session detected" or "3 interrupted sessions detected"
   **And** includes action buttons: "View" and "Dismiss"
   > **Note:** The PRD mentions a "Snooze" option. This is deferred to a future enhancement. For MVP, users can dismiss notifications and manually scan later via Command Palette if needed.

3. **Given** the user clicks "View" on the notification
   **When** the recovery panel opens
   **Then** it displays a list of interrupted sessions with:
   - Project name (derived from path)
   - Time since interruption (e.g., "2 hours ago")
   - Last prompt preview (truncated to 50 chars)
   - "Recover" button for each session

4. **Given** the user clicks "Dismiss" on the notification
   **When** the notification closes
   **Then** those sessions are marked as dismissed
   **And** they won't trigger notifications again (unless manually scanned)

5. **Given** multiple interrupted sessions exist
   **When** the recovery panel is open
   **Then** sessions are sorted by recency (most recent first)
   **And** each can be recovered independently

6. **Given** the extension is running
   **When** a new session becomes interrupted (> 15 min stale)
   **Then** a new notification is shown for that session
   **And** it is added to the recovery panel if already open

## Tasks / Subtasks

- [ ] **Task 1: Create notification service** (AC: #1, #2)
  - [ ] Create `packages/vscode-extension/src/services/notificationService.ts`
  - [ ] Implement `showInterruptedSessionNotification(sessions)` function
  - [ ] Use `vscode.window.showInformationMessage()` with buttons
  - [ ] Format message: "{count} interrupted session(s) detected"
  - [ ] Add "View" and "Dismiss" action buttons
  - [ ] Handle button click responses

- [ ] **Task 2: Implement session dismissal tracking** (AC: #4)
  - [ ] Store dismissed session IDs in extension state
  - [ ] Key: `contextor.dismissedSessions` (array of sessionId + timestamp)
  - [ ] Filter out dismissed sessions from detection results
  - [ ] Add expiry for dismissals (7 days - allow re-notification for very old dismissals)
  - [ ] Implement `dismissSession(sessionId)` and `isDismissed(sessionId)` functions

- [ ] **Task 3: Create recovery panel webview** (AC: #3, #5)
  - [ ] Create `packages/vscode-extension/webviews/recovery/` directory
  - [ ] Create React-based webview for session list
  - [ ] Design session card component with:
    - Project name (extract from path: `/Users/x/project` -> "project")
    - Time since interruption using relative time formatting
    - Last prompt preview (50 char truncated)
    - "Recover" button
  - [ ] Sort sessions by lastActivity descending
  - [ ] Style with VS Code theme variables for dark/light mode compatibility

- [ ] **Task 4: Register recovery panel as webview provider** (AC: #3)
  - [ ] Create `packages/vscode-extension/src/providers/recoveryPanel.ts`
  - [ ] Implement `RecoveryPanelProvider` class extending `vscode.WebviewViewProvider`
  - [ ] Register provider with view ID: `contextor.recoveryPanel`
  - [ ] Add view to Activity Bar or Panel area
  - [ ] Handle message passing between webview and extension

- [ ] **Task 5: Wire notification to panel open** (AC: #3)
  - [ ] When "View" clicked, focus/open recovery panel
  - [ ] Use `vscode.commands.executeCommand('contextor.recoveryPanel.focus')`
  - [ ] Pass detected sessions to panel via state update
  - [ ] Ensure panel receives fresh data on open

- [ ] **Task 6: Implement real-time session monitoring** (AC: #6)
  - [ ] Create file system watcher for `~/.claude/projects/`
  - [ ] Watch for session file modifications
  - [ ] Debounce watcher events (10 second cooldown)
  - [ ] Re-run detection when files change
  - [ ] Show new notification for newly-detected sessions
  - [ ] Update panel if already open

- [ ] **Task 7: Add extension commands** (AC: #1, #3)
  - [ ] Register command: `contextor.showRecoveryPanel`
  - [ ] Register command: `contextor.scanInterruptedSessions`
  - [ ] Register command: `contextor.dismissAllSessions`
  - [ ] Add commands to Command Palette
  - [ ] Add keyboard shortcut for quick access (optional)

- [ ] **Task 8: Configure contribution points** (AC: #3)
  - [ ] Add `viewsContainers` contribution for Contextor in Activity Bar (optional)
  - [ ] Add `views` contribution for recovery panel
  - [ ] Add `commands` contributions for all commands
  - [ ] Add `menus` contributions if needed
  - [ ] Update `package.json` with all contribution points

## Dev Notes

### Notification Implementation

```typescript
// packages/vscode-extension/src/services/notificationService.ts

import * as vscode from 'vscode';

export async function showInterruptedSessionNotification(
  sessions: InterruptedSession[]
): Promise<'view' | 'dismiss' | undefined> {
  if (sessions.length === 0) return undefined;

  const count = sessions.length;
  const message = count === 1
    ? '1 interrupted Claude Code session detected'
    : `${count} interrupted Claude Code sessions detected`;

  const action = await vscode.window.showInformationMessage(
    message,
    'View',
    'Dismiss'
  );

  if (action === 'View') {
    await vscode.commands.executeCommand('contextor.recoveryPanel.focus');
    return 'view';
  } else if (action === 'Dismiss') {
    for (const session of sessions) {
      await dismissSession(session.sessionId);
    }
    return 'dismiss';
  }

  return undefined;
}
```

### Dismissal Storage

```typescript
// packages/vscode-extension/src/services/dismissalService.ts

interface DismissedSession {
  sessionId: string;
  dismissedAt: number;
}

const DISMISSAL_KEY = 'contextor.dismissedSessions';
const DISMISSAL_EXPIRY_DAYS = 7;

export class DismissalService {
  constructor(private context: vscode.ExtensionContext) {}

  async dismissSession(sessionId: string): Promise<void> {
    const dismissed = this.getDismissedList();
    dismissed.push({
      sessionId,
      dismissedAt: Date.now(),
    });
    await this.context.globalState.update(DISMISSAL_KEY, dismissed);
  }

  isDismissed(sessionId: string): boolean {
    const dismissed = this.getDismissedList();
    const entry = dismissed.find(d => d.sessionId === sessionId);

    if (!entry) return false;

    // Check expiry
    const expiryMs = DISMISSAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - entry.dismissedAt > expiryMs) {
      // Expired, will be cleaned up
      return false;
    }

    return true;
  }

  private getDismissedList(): DismissedSession[] {
    return this.context.globalState.get<DismissedSession[]>(DISMISSAL_KEY) || [];
  }

  async cleanExpired(): Promise<void> {
    const dismissed = this.getDismissedList();
    const expiryMs = DISMISSAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const valid = dismissed.filter(d => Date.now() - d.dismissedAt < expiryMs);
    await this.context.globalState.update(DISMISSAL_KEY, valid);
  }
}
```

### Recovery Panel Webview Provider

```typescript
// packages/vscode-extension/src/providers/recoveryPanel.ts

import * as vscode from 'vscode';

export class RecoveryPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'contextor.recoveryPanel';

  private _view?: vscode.WebviewView;
  private _sessions: InterruptedSession[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'recover':
          await vscode.commands.executeCommand(
            'contextor.recoverSession',
            data.sessionId
          );
          break;
        case 'dismiss':
          await vscode.commands.executeCommand(
            'contextor.dismissSession',
            data.sessionId
          );
          this.updateSessions(this._sessions.filter(s => s.sessionId !== data.sessionId));
          break;
      }
    });

    // Initial data
    this._updateView();
  }

  public updateSessions(sessions: InterruptedSession[]) {
    this._sessions = sessions;
    this._updateView();
  }

  private _updateView() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateSessions',
        sessions: this._sessions
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Return HTML with React app bundled
    // See webviews/recovery/index.html
  }
}
```

### Session Card React Component

```tsx
// packages/vscode-extension/webviews/recovery/SessionCard.tsx

interface SessionCardProps {
  session: InterruptedSession;
  onRecover: (sessionId: string) => void;
  onDismiss: (sessionId: string) => void;
}

function SessionCard({ session, onRecover, onDismiss }: SessionCardProps) {
  const projectName = session.sessionPath
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/-/g, '/') || 'Unknown Project';

  const timeAgo = formatDistanceToNow(session.lastActivity, { addSuffix: true });
  const promptPreview = session.lastPrompt.slice(0, 50) +
    (session.lastPrompt.length > 50 ? '...' : '');

  return (
    <div className="session-card">
      <div className="session-header">
        <span className="project-name">{projectName}</span>
        <span className="time-ago">{timeAgo}</span>
      </div>
      <p className="prompt-preview">"{promptPreview}"</p>
      <div className="session-meta">
        <span>{session.messageCount} messages</span>
        {session.lastToolUsed && (
          <span>Last tool: {session.lastToolUsed}</span>
        )}
      </div>
      <div className="session-actions">
        <button className="primary" onClick={() => onRecover(session.sessionId)}>
          Recover
        </button>
        <button className="secondary" onClick={() => onDismiss(session.sessionId)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

### File System Watcher

```typescript
// packages/vscode-extension/src/watchers/sessionWatcher.ts

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export function createSessionWatcher(
  onSessionChange: () => void
): vscode.Disposable {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const pattern = new vscode.RelativePattern(claudeDir, '**/*.jsonl');

  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  // Debounce to avoid excessive rescans
  let debounceTimer: NodeJS.Timeout | null = null;
  const debouncedCallback = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onSessionChange, 10000); // 10 second debounce
  };

  watcher.onDidChange(debouncedCallback);
  watcher.onDidCreate(debouncedCallback);

  return watcher;
}
```

### Package.json Contributions

```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "contextor.recoveryPanel",
          "name": "Session Recovery",
          "when": "contextor.hasInterruptedSessions"
        }
      ]
    },
    "commands": [
      {
        "command": "contextor.showRecoveryPanel",
        "title": "Show Recovery Panel",
        "category": "Contextor"
      },
      {
        "command": "contextor.scanInterruptedSessions",
        "title": "Scan for Interrupted Sessions",
        "category": "Contextor"
      },
      {
        "command": "contextor.dismissAllSessions",
        "title": "Dismiss All Interrupted Sessions",
        "category": "Contextor"
      },
      {
        "command": "contextor.recoverSession",
        "title": "Recover Session",
        "category": "Contextor"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "contextor.showRecoveryPanel",
          "when": "true"
        },
        {
          "command": "contextor.scanInterruptedSessions",
          "when": "true"
        }
      ]
    }
  }
}
```

### Styling for VS Code Themes

Use VS Code CSS variables for theme compatibility:

```css
.session-card {
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
}

.project-name {
  color: var(--vscode-foreground);
  font-weight: bold;
}

.time-ago {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.prompt-preview {
  color: var(--vscode-foreground);
  font-style: italic;
  opacity: 0.8;
}

button.primary {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

button.secondary {
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
```

### Test Scenarios

1. No interrupted sessions - notification should not appear
2. One interrupted session - notification shows "1 interrupted session"
3. Multiple sessions - notification shows count correctly
4. Click "View" - recovery panel opens with session list
5. Click "Dismiss" - sessions marked dismissed, no future notifications
6. Dismissed session scanned again - should not re-notify within 7 days
7. Panel shows sessions sorted by recency
8. Session card shows correct project name, time, preview
9. Click "Recover" on card - triggers recovery flow
10. New session becomes stale - notification appears for it
11. File watcher triggers on session file change

## Dependencies

- **Depends on:** Story 18-1 (Interrupted Session Detection)
- **Depends on:** Story 18-3 (Recovery Prompt Generator) - needed to generate recovery prompts for the "Recover" action
- **Depends on:** Story 19-1 (VS Code Extension Scaffold) - this story implements VS Code extension UI components
- **Blocks:** Story 18-5 (One-Click Resume)


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
