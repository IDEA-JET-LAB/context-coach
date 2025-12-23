# Story 20.3: Improvement Suggestions Display

Status: Ready

## Story
**As a** developer using Claude Code,
**I want** to see improvement suggestions in a clear UI when my prompt is blocked,
**So that** I can understand the issues and decide how to improve my prompt.

## Dependencies
- **Story 20.1**: Blocking Hook Implementation (creates suggestion.json file)
- **Story 20.2**: Fast Heuristics Engine (provides issue data)
- **Story 19**: VS Code Extension (provides extension infrastructure)

## Acceptance Criteria

1. **Given** the coaching hook writes a suggestion file
   **When** the VS Code extension detects the file change
   **Then** a suggestion panel opens within 500ms
   **And** the original prompt is displayed at the top

2. **Given** the suggestion panel is displayed
   **When** issues are rendered
   **Then** each issue shows: icon (warning/improvement), type label, and message
   **And** issues are sorted by severity (warnings first)
   **And** the suggested improved prompt is shown if available

3. **Given** the suggestion includes an improved prompt
   **When** the user views the panel
   **Then** a side-by-side diff view shows original and improved prompts
   **And** visual highlights indicate additions, removals, and changes
   **And** a "Copy to Clipboard" button is visible for the improved prompt

4. **Given** the user clicks "Copy to Clipboard"
   **When** the copy action completes
   **Then** the improved prompt is copied to clipboard
   **And** a confirmation toast appears
   **And** the panel can be dismissed

5. **Given** suggestions are displayed
   **When** the user clicks "Edit"
   **Then** the original prompt opens in a VS Code editor tab as a temporary file
   **And** the user can manually refine the prompt before resubmitting

6. **Given** the suggestion panel is open
   **When** the user presses Escape or clicks "Dismiss"
   **Then** the panel closes
   **And** the suggestion file is cleared

7. **Given** no suggestion file exists
   **When** the extension starts or reloads
   **Then** no panel is shown
   **And** the file watcher is active for future suggestions

## Technical Context

### File Locations (VS Code Extension)
| File | Purpose |
|------|---------|
| `vscode-extension/src/watchers/suggestionWatcher.ts` | File watcher for suggestion.json |
| `vscode-extension/src/providers/suggestionPanel.ts` | Webview panel provider |
| `vscode-extension/webviews/coaching/SuggestionView.tsx` | React component for panel UI |
| `vscode-extension/webviews/coaching/styles.css` | Panel styling |
| `vscode-extension/src/commands/showSuggestion.ts` | Command handler |

### Suggestion File Location
```
~/.contextor/suggestion.json
```

### Panel UI Wireframe
```
┌─────────────────────────────────────────────────────┐
│  Contextor Coaching                          [X]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Suggestions                                        │
│                                                     │
│  ⚠️ Too Vague                                      │
│  Prompt is very short. Consider adding more        │
│  context.                                          │
│                                                     │
│  💡 Missing Goal                                   │
│  Prompt doesn't have a clear ask. What do you      │
│  want Claude to do?                                │
│                                                     │
│  ─────────────────────────────────────────────     │
│                                                     │
│  Side-by-Side Comparison                           │
│  ┌───────────────────┬─────────────────────────┐   │
│  │ Your Prompt       │ Suggested Improvement   │   │
│  ├───────────────────┼─────────────────────────┤   │
│  │ fix bug           │ Please fix the bug in   │   │
│  │                   │ the authentication      │   │
│  │                   │ module where users      │   │
│  │                   │ cannot log in after     │   │
│  │                   │ password reset. The     │   │
│  │                   │ error occurs in         │   │
│  │                   │ auth.ts line 45.        │   │
│  └───────────────────┴─────────────────────────┘   │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ 📋 Copy  │ │ ✏️ Edit  │ │ ✕ Dismiss          │  │
│  └──────────┘ └──────────┘ └────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Component Architecture
```
SuggestionWatcher
      │
      ├── watches ~/.contextor/suggestion.json
      │
      ▼
SuggestionPanel (WebviewViewProvider)
      │
      ├── receives suggestion data
      │
      ▼
SuggestionView (React)
      │
      ├── IssuesList
      │     ├── IssueItem (warning)
      │     └── IssueItem (improvement)
      ├── SideBySideDiff
      │     ├── OriginalPromptPane
      │     └── SuggestedPromptPane
      └── ActionButtons
            ├── CopyButton
            ├── EditButton
            └── DismissButton
```

## Tasks / Subtasks

- [ ] **Task 1: Create File Watcher** (AC: #1, #6)
  - [ ] Create `vscode-extension/src/watchers/suggestionWatcher.ts`
  - [ ] Use `vscode.workspace.createFileSystemWatcher`
  - [ ] Watch `~/.contextor/suggestion.json`
  - [ ] Parse JSON on file change
  - [ ] Trigger `contextor.showSuggestion` command with data
  - [ ] Handle missing/corrupted file gracefully

- [ ] **Task 2: Create Webview Panel Provider** (AC: #2, #5)
  - [ ] Create `vscode-extension/src/providers/suggestionPanel.ts`
  - [ ] Implement `WebviewViewProvider`
  - [ ] Register view in `package.json` contribution
  - [ ] Handle panel lifecycle (open, close, dispose)
  - [ ] Pass suggestion data to webview

- [ ] **Task 3: Create React UI Component with Diff View** (AC: #2, #3)
  - [ ] Create `vscode-extension/webviews/coaching/SuggestionView.tsx`
  - [ ] Render issues list with icons and severity styling
  - [ ] Sort issues: warnings before improvements
  - [ ] Implement side-by-side diff view for original vs suggested prompt
  - [ ] Use diff library (e.g., `diff` or `jsdiff`) to compute changes
  - [ ] Highlight additions (green), removals (red), and unchanged text
  - [ ] Style with VS Code theme variables

- [ ] **Task 4: Implement Copy Functionality** (AC: #4)
  - [ ] Add "Copy to Clipboard" button
  - [ ] Use `navigator.clipboard.writeText()` in webview
  - [ ] Send message to extension for clipboard access
  - [ ] Show confirmation toast using VS Code notifications
  - [ ] Handle copy failures gracefully

- [ ] **Task 5: Implement Panel Close/Dismiss** (AC: #6)
  - [ ] Add "Dismiss" button to action buttons
  - [ ] Handle Escape key press
  - [ ] Clear suggestion file on dismiss
  - [ ] Reset panel state

- [ ] **Task 6: Register Commands and Views** (AC: #1, #7)
  - [ ] Register `contextor.showSuggestion` command
  - [ ] Add view to `package.json` contributes.views
  - [ ] Configure view location (panel or sidebar)
  - [ ] Activate extension on relevant events

- [ ] **Task 7: Implement Edit Functionality** (AC: #5)
  - [ ] Add "Edit" button to action buttons
  - [ ] Create temporary file with original prompt content
  - [ ] Use `vscode.workspace.openTextDocument()` to create temp document
  - [ ] Use `vscode.window.showTextDocument()` to open in editor
  - [ ] Set file language mode to markdown or plaintext
  - [ ] Close suggestion panel when edit mode opens
  - [ ] Clean up temp file on editor close (optional)

## Dev Notes

### File Watcher Implementation
```typescript
// vscode-extension/src/watchers/suggestionWatcher.ts
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export class SuggestionWatcher {
  private watcher: vscode.FileSystemWatcher;
  private suggestionPath: string;

  constructor(private context: vscode.ExtensionContext) {
    this.suggestionPath = path.join(os.homedir(), '.contextor', 'suggestion.json');

    // Create watcher for suggestion file
    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        path.dirname(this.suggestionPath),
        'suggestion.json'
      )
    );

    this.watcher.onDidCreate(this.handleSuggestion.bind(this));
    this.watcher.onDidChange(this.handleSuggestion.bind(this));

    context.subscriptions.push(this.watcher);
  }

  private async handleSuggestion(uri: vscode.Uri): Promise<void> {
    try {
      const content = await fs.promises.readFile(uri.fsPath, 'utf-8');
      const suggestion = JSON.parse(content);

      // Validate suggestion schema
      if (suggestion.version && suggestion.issues && suggestion.original_prompt) {
        await vscode.commands.executeCommand('contextor.showSuggestion', suggestion);
      }
    } catch (error) {
      console.error('[Contextor] Failed to parse suggestion:', error);
    }
  }

  public async clearSuggestion(): Promise<void> {
    try {
      if (fs.existsSync(this.suggestionPath)) {
        await fs.promises.unlink(this.suggestionPath);
      }
    } catch (error) {
      console.error('[Contextor] Failed to clear suggestion:', error);
    }
  }
}
```

### React Component Structure
```typescript
// vscode-extension/webviews/coaching/SuggestionView.tsx
import React from 'react';
import { diffWords } from 'diff';

interface SuggestionViewProps {
  suggestion: {
    original_prompt: string;
    issues: Array<{
      type: string;
      severity: 'warning' | 'improvement';
      message: string;
    }>;
    suggested_prompt?: string;
  };
  onCopy: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}

const SEVERITY_ICONS = {
  warning: '⚠️',
  improvement: '💡'
};

const SEVERITY_LABELS = {
  too_vague: 'Too Vague',
  no_context: 'No Context',
  missing_goal: 'Missing Goal',
  ambiguous: 'Ambiguous',
  too_long: 'Too Long'
};

export const SuggestionView: React.FC<SuggestionViewProps> = ({
  suggestion,
  onCopy,
  onEdit,
  onDismiss
}) => {
  // Sort issues: warnings first
  const sortedIssues = [...suggestion.issues].sort((a, b) => {
    if (a.severity === 'warning' && b.severity !== 'warning') return -1;
    if (a.severity !== 'warning' && b.severity === 'warning') return 1;
    return 0;
  });

  return (
    <div className="suggestion-panel">
      <h2>Contextor Coaching</h2>

      <section className="issues-list">
        <h3>Suggestions</h3>
        {sortedIssues.map((issue, index) => (
          <div key={index} className={`issue issue-${issue.severity}`}>
            <span className="issue-icon">{SEVERITY_ICONS[issue.severity]}</span>
            <span className="issue-type">{SEVERITY_LABELS[issue.type]}</span>
            <p className="issue-message">{issue.message}</p>
          </div>
        ))}
      </section>

      {suggestion.suggested_prompt && (
        <section className="side-by-side-diff">
          <h3>Side-by-Side Comparison</h3>
          <div className="diff-container">
            <div className="diff-pane original">
              <h4>Your Prompt</h4>
              <pre>{suggestion.original_prompt}</pre>
            </div>
            <div className="diff-pane suggested">
              <h4>Suggested Improvement</h4>
              <pre>{suggestion.suggested_prompt}</pre>
            </div>
          </div>
        </section>
      )}

      <div className="action-buttons">
        <button className="btn-copy" onClick={onCopy}>
          Copy
        </button>
        <button className="btn-edit" onClick={onEdit}>
          Edit
        </button>
        <button className="btn-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
};
```

### VS Code Theme Integration
```css
/* vscode-extension/webviews/coaching/styles.css */
.suggestion-panel {
  padding: 16px;
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}

.issue-warning {
  border-left: 3px solid var(--vscode-editorWarning-foreground);
  background: var(--vscode-inputValidation-warningBackground);
}

.issue-improvement {
  border-left: 3px solid var(--vscode-editorInfo-foreground);
  background: var(--vscode-inputValidation-infoBackground);
}

.btn-copy {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.btn-edit {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.btn-dismiss {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.side-by-side-diff {
  margin: 16px 0;
}

.diff-container {
  display: flex;
  gap: 16px;
}

.diff-pane {
  flex: 1;
  min-width: 0;
}

.diff-pane pre {
  padding: 8px;
  border-radius: 4px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  overflow-x: auto;
}
```

### Extension Package.json Contributions
```json
{
  "contributes": {
    "commands": [
      {
        "command": "contextor.showSuggestion",
        "title": "Contextor: Show Suggestion"
      }
    ],
    "views": {
      "explorer": [
        {
          "type": "webview",
          "id": "contextor.suggestionPanel",
          "name": "Contextor Coaching",
          "when": "contextor.hasSuggestion"
        }
      ]
    }
  }
}
```

### Message Passing (Webview to Extension)
```typescript
// In webview
vscode.postMessage({ type: 'copy', text: suggestion.suggested_prompt });
vscode.postMessage({ type: 'edit', text: suggestion.original_prompt });
vscode.postMessage({ type: 'dismiss' });

// In extension
panel.webview.onDidReceiveMessage(async (message) => {
  switch (message.type) {
    case 'copy':
      await vscode.env.clipboard.writeText(message.text);
      vscode.window.showInformationMessage('Copied to clipboard!');
      break;
    case 'edit':
      // Create temp file with prompt for manual editing
      const doc = await vscode.workspace.openTextDocument({
        content: message.text,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
      await suggestionWatcher.clearSuggestion();
      break;
    case 'dismiss':
      await suggestionWatcher.clearSuggestion();
      break;
  }
});
```


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
