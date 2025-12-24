/**
 * Recovery Panel Provider - Story 18-4
 *
 * WebviewViewProvider for the Session Recovery panel.
 * Displays interrupted sessions with recovery and dismiss options.
 *
 * Features:
 * - List of interrupted sessions sorted by recency
 * - Session cards with project name, time ago, last prompt preview
 * - Recover and Dismiss buttons per session
 * - Real-time updates when sessions change
 * - VS Code theme-compatible styling
 */

import * as vscode from "vscode";
import type { InterruptedSession } from "../types/interruptedSession";
import type { SnapshotStore } from "../services/snapshotStore";
import type { RecoveryPromptGenerator } from "../services/recoveryPromptGenerator";
import type { DismissalService } from "../services/dismissalService";

/**
 * Message types from webview to extension.
 */
export type RecoveryWebviewMessage =
  | { type: "ready" }
  | { type: "recover"; sessionId: string }
  | { type: "dismiss"; sessionId: string }
  | { type: "dismissAll" }
  | { type: "refresh" };

/**
 * Message types from extension to webview.
 */
export type RecoveryExtensionMessage =
  | { type: "updateSessions"; sessions: RecoverySessionData[] }
  | { type: "loading"; isLoading: boolean }
  | { type: "error"; message: string }
  | { type: "recoverySuccess"; sessionId: string; prompt: string };

/**
 * Session data formatted for the webview.
 */
export interface RecoverySessionData {
  /** Session ID */
  sessionId: string;
  /** Project name extracted from path */
  projectName: string;
  /** Relative time (e.g., "2 hours ago") */
  timeAgo: string;
  /** Last prompt preview (truncated to 50 chars) */
  lastPromptPreview: string;
  /** Full path for recovery */
  sessionPath: string;
  /** Number of messages */
  messageCount: number;
  /** Last tool used */
  lastTool: string | null;
}

/**
 * WebviewViewProvider for the Session Recovery panel.
 */
export class RecoveryPanelProvider implements vscode.WebviewViewProvider {
  /**
   * Unique identifier for this view type.
   * Must match the view id in package.json.
   */
  public static readonly viewType = "contextor.recoveryPanel";

  /**
   * Reference to the webview view.
   */
  private _view?: vscode.WebviewView;

  /**
   * Current list of interrupted sessions.
   */
  private sessions: InterruptedSession[] = [];

  /**
   * Disposables for cleanup.
   */
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly snapshotStore: SnapshotStore,
    private readonly promptGenerator: RecoveryPromptGenerator,
    private readonly dismissalService: DismissalService,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Called when the view is first made visible.
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "webviews", "recovery", "dist"),
        vscode.Uri.joinPath(this.extensionUri, "dist"),
      ],
    };

    // Set the HTML content
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      async (message: RecoveryWebviewMessage) => {
        await this.handleMessage(message);
      }
    );
    this.disposables.push(messageDisposable);

    // Handle view disposal
    const disposeDisposable = webviewView.onDidDispose(() => {
      this.disposables.forEach((d) => d.dispose());
      this.disposables.length = 0;
      this._view = undefined;
    });
    this.disposables.push(disposeDisposable);

    this.log("Recovery panel resolved");
  }

  /**
   * Updates the sessions displayed in the panel.
   */
  updateSessions(sessions: InterruptedSession[]): void {
    // Filter out dismissed sessions
    this.sessions = this.dismissalService.filterDismissed(sessions);

    // Sort by last activity (most recent first)
    this.sessions.sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
    );

    // Update context for conditional view visibility
    void vscode.commands.executeCommand(
      "setContext",
      "contextor.hasInterruptedSessions",
      this.sessions.length > 0
    );

    // Send to webview
    this.sendSessionsToWebview();
  }

  /**
   * Handles messages from the webview.
   */
  private async handleMessage(message: RecoveryWebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.log("Webview ready");
        this.sendSessionsToWebview();
        break;

      case "recover":
        await this.handleRecover(message.sessionId);
        break;

      case "dismiss":
        await this.handleDismiss(message.sessionId);
        break;

      case "dismissAll":
        await this.handleDismissAll();
        break;

      case "refresh":
        this.log("Refresh requested");
        this.sendSessionsToWebview();
        break;
    }
  }

  /**
   * Handles recovering a session.
   * Story 18-5: Delegates to the recoverSession command for full implementation.
   */
  private async handleRecover(sessionId: string): Promise<void> {
    this.log(`Recovering session: ${sessionId}`);

    // Delegate to the recoverSession command which handles:
    // - Clipboard copy with fallback modal
    // - Analytics tracking
    // - Recovery state management
    // - Success/error notifications
    await vscode.commands.executeCommand("contextor.recoverSession", sessionId);
  }

  /**
   * Handles dismissing a single session.
   */
  private async handleDismiss(sessionId: string): Promise<void> {
    this.log(`Dismissing session: ${sessionId}`);

    await this.dismissalService.dismissSession(sessionId);

    // Remove from current list
    this.sessions = this.sessions.filter((s) => s.sessionId !== sessionId);
    this.sendSessionsToWebview();
  }

  /**
   * Handles dismissing all sessions.
   */
  private async handleDismissAll(): Promise<void> {
    this.log("Dismissing all sessions");

    const sessionIds = this.sessions.map((s) => s.sessionId);
    await this.dismissalService.dismissSessions(sessionIds);

    this.sessions = [];
    this.sendSessionsToWebview();
  }

  /**
   * Sends session data to the webview.
   */
  private sendSessionsToWebview(): void {
    const sessionData = this.sessions.map((session) =>
      this.formatSessionForWebview(session)
    );

    this.postMessage({ type: "updateSessions", sessions: sessionData });
  }

  /**
   * Formats a session for display in the webview.
   */
  private formatSessionForWebview(session: InterruptedSession): RecoverySessionData {
    return {
      sessionId: session.sessionId,
      projectName: this.extractProjectName(session.sessionPath),
      timeAgo: this.formatTimeAgo(session.lastActivity),
      lastPromptPreview: this.truncatePrompt(session.lastPrompt, 50),
      sessionPath: session.sessionPath,
      messageCount: session.messageCount,
      lastTool: session.lastToolUsed,
    };
  }

  /**
   * Extracts project name from session path.
   */
  private extractProjectName(sessionPath: string): string {
    const parts = sessionPath.split("/");
    const projectDir = parts[parts.length - 2];

    if (projectDir && projectDir.startsWith("-")) {
      // Convert normalized path back to readable name
      // e.g., "-Users-username-project-name" -> "project-name"
      const pathParts = projectDir.slice(1).split("-");
      // Get the last meaningful part
      return pathParts[pathParts.length - 1] || projectDir;
    }

    return projectDir || "Unknown";
  }

  /**
   * Formats a date as relative time.
   */
  private formatTimeAgo(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return days === 1 ? "1 day ago" : `${days} days ago`;
    }
    if (hours > 0) {
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    }
    if (minutes > 0) {
      return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
    }
    return "Just now";
  }

  /**
   * Truncates a prompt to a maximum length.
   */
  private truncatePrompt(prompt: string, maxLength: number): string {
    // Remove newlines and normalize whitespace
    const normalized = prompt.replace(/\s+/g, " ").trim();

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return normalized.substring(0, maxLength - 3) + "...";
  }

  /**
   * Posts a message to the webview.
   */
  private postMessage(message: RecoveryExtensionMessage): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Generates HTML content for the webview.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    // For now, we'll use inline HTML since the webview is simple
    // In a production scenario, this would reference a bundled React app
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Recovery</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      padding: 8px;
      line-height: 1.4;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .header h2 {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--vscode-sideBarSectionHeader-foreground);
    }

    .dismiss-all {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      background: none;
      border: none;
      padding: 2px 4px;
    }

    .dismiss-all:hover {
      color: var(--vscode-textLink-activeForeground);
      text-decoration: underline;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state-icon {
      font-size: 32px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .empty-state-text {
      font-size: 12px;
    }

    .sessions-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .session-card {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 10px;
    }

    .session-card:hover {
      border-color: var(--vscode-focusBorder);
    }

    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }

    .project-name {
      font-weight: 600;
      font-size: 13px;
      color: var(--vscode-foreground);
      word-break: break-word;
    }

    .time-ago {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      margin-left: 8px;
    }

    .last-prompt {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      word-break: break-word;
    }

    .session-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .session-actions {
      display: flex;
      gap: 8px;
    }

    button {
      font-family: var(--vscode-font-family);
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 2px;
      cursor: pointer;
      border: none;
    }

    .btn-primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn-primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .loading::after {
      content: '';
      width: 20px;
      height: 20px;
      border: 2px solid var(--vscode-button-background);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      color: var(--vscode-errorForeground);
      padding: 12px;
      text-align: center;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="loading"></div>
  </div>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const root = document.getElementById('root');
      let sessions = [];
      let isLoading = false;

      // Notify extension that webview is ready
      vscode.postMessage({ type: 'ready' });

      // Handle messages from extension
      window.addEventListener('message', event => {
        const message = event.data;

        switch (message.type) {
          case 'updateSessions':
            sessions = message.sessions;
            render();
            break;

          case 'loading':
            isLoading = message.isLoading;
            render();
            break;

          case 'error':
            showError(message.message);
            break;

          case 'recoverySuccess':
            // Session recovered - will be removed from list
            break;
        }
      });

      function render() {
        if (isLoading) {
          root.innerHTML = '<div class="loading"></div>';
          return;
        }

        if (sessions.length === 0) {
          root.innerHTML = \`
            <div class="empty-state">
              <div class="empty-state-icon">&#x2714;</div>
              <div class="empty-state-text">No interrupted sessions</div>
            </div>
          \`;
          return;
        }

        const sessionsHtml = sessions.map(session => \`
          <div class="session-card" data-session-id="\${session.sessionId}">
            <div class="session-header">
              <span class="project-name">\${escapeHtml(session.projectName)}</span>
              <span class="time-ago">\${escapeHtml(session.timeAgo)}</span>
            </div>
            <div class="last-prompt">\${escapeHtml(session.lastPromptPreview)}</div>
            <div class="session-meta">
              <span>\${session.messageCount} messages</span>
              \${session.lastTool ? \`<span>Last: \${escapeHtml(session.lastTool)}</span>\` : ''}
            </div>
            <div class="session-actions">
              <button class="btn-primary recover-btn">Recover</button>
              <button class="btn-secondary dismiss-btn">Dismiss</button>
            </div>
          </div>
        \`).join('');

        root.innerHTML = \`
          <div class="header">
            <h2>Interrupted Sessions (\${sessions.length})</h2>
            <button class="dismiss-all" id="dismiss-all">Dismiss All</button>
          </div>
          <div class="sessions-list">
            \${sessionsHtml}
          </div>
        \`;

        // Add event listeners
        document.getElementById('dismiss-all')?.addEventListener('click', () => {
          vscode.postMessage({ type: 'dismissAll' });
        });

        document.querySelectorAll('.recover-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const card = e.target.closest('.session-card');
            const sessionId = card?.dataset.sessionId;
            if (sessionId) {
              vscode.postMessage({ type: 'recover', sessionId });
            }
          });
        });

        document.querySelectorAll('.dismiss-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const card = e.target.closest('.session-card');
            const sessionId = card?.dataset.sessionId;
            if (sessionId) {
              vscode.postMessage({ type: 'dismiss', sessionId });
            }
          });
        });
      }

      function showError(message) {
        root.innerHTML = \`<div class="error">\${escapeHtml(message)}</div>\`;
      }

      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Generates a cryptographically secure nonce.
   */
  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(
      `[${timestamp}] [RecoveryPanel] ${message}`
    );
  }
}
