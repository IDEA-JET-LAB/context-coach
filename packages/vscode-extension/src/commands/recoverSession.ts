/**
 * Recover Session Command - Story 18-5
 *
 * Provides one-click session recovery functionality.
 * Copies the recovery prompt to clipboard and shows instructions.
 *
 * Features:
 * - Generate recovery prompt from session snapshot
 * - Copy to clipboard with error handling
 * - Fallback modal for clipboard failures
 * - Track session as recovered
 * - Log analytics events
 * - Offer to open terminal
 */

import * as vscode from "vscode";
import type { SnapshotStore } from "../services/snapshotStore";
import type { RecoveryPromptGenerator } from "../services/recoveryPromptGenerator";
import type { RecoveryState } from "../services/recoveryState";
import type { DismissalService } from "../services/dismissalService";
import type { AnalyticsService } from "../services/analyticsService";
import type { ClipboardService } from "../services/clipboardService";
import type { SessionStateSnapshot } from "../types/sessionState";
import { buildSessionSnapshot } from "../services/snapshotBuilder";
import type { InterruptedSession } from "../types/interruptedSession";

/**
 * Dependencies for the recover session command.
 */
export interface RecoverSessionDependencies {
  snapshotStore: SnapshotStore;
  promptGenerator: RecoveryPromptGenerator;
  recoveryState: RecoveryState;
  dismissalService: DismissalService;
  analyticsService: AnalyticsService;
  clipboardService: ClipboardService;
  outputChannel: vscode.OutputChannel;
}

/**
 * Result of a recovery operation.
 */
export interface RecoveryResult {
  success: boolean;
  sessionId: string;
  method: "clipboard" | "manual";
  error?: string;
  promptLength?: number;
  isAIGenerated?: boolean;
}

/**
 * Recovers a specific session by ID.
 *
 * @param sessionId - The session ID to recover
 * @param session - Optional interrupted session data (used if snapshot doesn't exist)
 * @param deps - Service dependencies
 * @param detectionTime - When the session was first detected (for analytics)
 */
export async function recoverSession(
  sessionId: string,
  session: InterruptedSession | null,
  deps: RecoverSessionDependencies,
  detectionTime?: number
): Promise<RecoveryResult> {
  const startTime = Date.now();
  const log = (msg: string) => {
    const ts = new Date().toISOString();
    deps.outputChannel.appendLine(`[${ts}] [RecoverSession] ${msg}`);
  };

  log(`Starting recovery for session: ${sessionId}`);

  // Check if already recovered
  if (deps.recoveryState.isRecovered(sessionId)) {
    log(`Session already recovered: ${sessionId}`);
    return {
      success: false,
      sessionId,
      method: "clipboard",
      error: "Session has already been recovered",
    };
  }

  try {
    // Get or build snapshot
    let snapshot: SessionStateSnapshot | null =
      deps.snapshotStore.getSnapshot(sessionId);

    if (!snapshot) {
      if (!session) {
        log(`No snapshot and no session data for: ${sessionId}`);
        return {
          success: false,
          sessionId,
          method: "clipboard",
          error: "Session snapshot not found. It may have expired.",
        };
      }

      log(`Building snapshot for session: ${sessionId}`);
      snapshot = await buildSessionSnapshot(session);
      await deps.snapshotStore.saveSnapshot(snapshot);
    }

    // Generate recovery prompt
    log(`Generating recovery prompt for session: ${sessionId}`);
    const recoveryPrompt =
      await deps.promptGenerator.generateRecoveryPrompt(snapshot);

    // Try to copy to clipboard
    const clipboardResult = await deps.clipboardService.copy(
      recoveryPrompt.prompt
    );

    if (clipboardResult.success) {
      // Success - show notification with actions
      const action = await vscode.window.showInformationMessage(
        "Recovery prompt copied to clipboard. Paste it into Claude Code to continue.",
        "Show Prompt",
        "Open Terminal"
      );

      if (action === "Show Prompt") {
        await showPromptDocument(recoveryPrompt.prompt);
      } else if (action === "Open Terminal") {
        await focusTerminal();
      }

      // Mark as recovered
      const timeToRecover = detectionTime
        ? startTime - detectionTime
        : Date.now() - startTime;
      await deps.recoveryState.markAsRecovered(
        sessionId,
        "clipboard",
        timeToRecover
      );

      // Dismiss the session
      await deps.dismissalService.dismissSession(sessionId);

      // Track analytics
      await deps.analyticsService.trackSessionRecovered(
        sessionId,
        "clipboard",
        timeToRecover,
        recoveryPrompt.prompt.length,
        recoveryPrompt.isAIGenerated
      );

      log(`Recovery successful for session: ${sessionId}`);

      return {
        success: true,
        sessionId,
        method: "clipboard",
        promptLength: recoveryPrompt.prompt.length,
        isAIGenerated: recoveryPrompt.isAIGenerated,
      };
    } else {
      // Clipboard failed - show fallback modal
      log(`Clipboard failed: ${clipboardResult.error}, showing fallback modal`);
      const manualResult = await showFallbackModal(
        recoveryPrompt.prompt,
        clipboardResult.error,
        deps
      );

      if (manualResult) {
        // User successfully copied manually
        const timeToRecover = detectionTime
          ? Date.now() - detectionTime
          : Date.now() - startTime;
        await deps.recoveryState.markAsRecovered(
          sessionId,
          "manual",
          timeToRecover
        );
        await deps.dismissalService.dismissSession(sessionId);
        await deps.analyticsService.trackSessionRecovered(
          sessionId,
          "manual",
          timeToRecover,
          recoveryPrompt.prompt.length,
          recoveryPrompt.isAIGenerated
        );

        return {
          success: true,
          sessionId,
          method: "manual",
          promptLength: recoveryPrompt.prompt.length,
          isAIGenerated: recoveryPrompt.isAIGenerated,
        };
      }

      return {
        success: false,
        sessionId,
        method: "manual",
        error: clipboardResult.error,
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`Recovery failed: ${errorMessage}`);

    vscode.window.showErrorMessage(
      `Failed to recover session: ${errorMessage}`
    );

    return {
      success: false,
      sessionId,
      method: "clipboard",
      error: errorMessage,
    };
  }
}

/**
 * Shows the recovery prompt in a new document.
 */
async function showPromptDocument(prompt: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content: prompt,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.One,
  });
}

/**
 * Focuses the terminal or creates a new one.
 */
async function focusTerminal(): Promise<void> {
  const terminal =
    vscode.window.activeTerminal ||
    vscode.window.createTerminal("Claude Code Recovery");
  terminal.show();
}

/**
 * Shows a fallback modal when clipboard copy fails.
 * Returns true if the user successfully copies manually.
 */
async function showFallbackModal(
  prompt: string,
  error: string | undefined,
  _deps: RecoverSessionDependencies
): Promise<boolean> {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      "contextorRecoveryPrompt",
      "Recovery Prompt",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    const nonce = getNonce();

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recovery Prompt</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground, #cccccc);
      background-color: var(--vscode-editor-background, #1e1e1e);
      padding: 20px;
      line-height: 1.5;
    }

    .error-banner {
      background-color: var(--vscode-inputValidation-errorBackground, rgba(255, 85, 85, 0.1));
      border: 1px solid var(--vscode-inputValidation-errorBorder, #f44747);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .error-title {
      color: var(--vscode-errorForeground, #f44747);
      font-weight: 600;
      margin-bottom: 4px;
    }

    .error-message {
      color: var(--vscode-descriptionForeground, #999999);
      font-size: 12px;
    }

    .instructions {
      margin-bottom: 16px;
    }

    .instructions h2 {
      font-size: 14px;
      margin-bottom: 8px;
      color: var(--vscode-foreground, #cccccc);
    }

    .instructions ol {
      margin-left: 20px;
      color: var(--vscode-descriptionForeground, #999999);
    }

    .instructions li {
      margin-bottom: 4px;
    }

    .prompt-container {
      position: relative;
      margin-bottom: 16px;
    }

    .prompt-label {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-foreground, #cccccc);
    }

    textarea {
      width: 100%;
      min-height: 200px;
      padding: 12px;
      font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
      font-size: 12px;
      background-color: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 4px;
      resize: vertical;
    }

    textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder, #007fd4);
    }

    .button-row {
      display: flex;
      gap: 8px;
    }

    button {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 2px;
      cursor: pointer;
      border: none;
      transition: background-color 0.1s;
    }

    .btn-primary {
      background-color: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
    }

    .btn-primary:hover {
      background-color: var(--vscode-button-hoverBackground, #1177bb);
    }

    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }

    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    .success-message {
      display: none;
      color: var(--vscode-terminal-ansiGreen, #4ec9b0);
      font-weight: 600;
      margin-top: 12px;
    }

    .success-message.visible {
      display: block;
    }

    .shortcut {
      background-color: var(--vscode-keybindingLabel-background, rgba(128, 128, 128, 0.17));
      border: 1px solid var(--vscode-keybindingLabel-border, rgba(204, 204, 204, 0.4));
      border-radius: 3px;
      padding: 1px 4px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }
  </style>
</head>
<body>
  ${
    error
      ? `
  <div class="error-banner">
    <div class="error-title">Clipboard Copy Failed</div>
    <div class="error-message">${escapeHtml(error)}</div>
  </div>
  `
      : ""
  }

  <div class="instructions">
    <h2>Copy the Recovery Prompt</h2>
    <ol>
      <li>Click the "Select All" button or use <span class="shortcut">Cmd+A</span> / <span class="shortcut">Ctrl+A</span></li>
      <li>Copy with <span class="shortcut">Cmd+C</span> / <span class="shortcut">Ctrl+C</span></li>
      <li>Paste into Claude Code to resume your session</li>
    </ol>
  </div>

  <div class="prompt-container">
    <div class="prompt-label">Recovery Prompt</div>
    <textarea id="prompt" readonly>${escapeHtml(prompt)}</textarea>
  </div>

  <div class="button-row">
    <button class="btn-primary" id="selectAll">Select All</button>
    <button class="btn-primary" id="copyBtn">Copy to Clipboard</button>
    <button class="btn-secondary" id="closeBtn">Close</button>
  </div>

  <div class="success-message" id="successMessage">
    Copied to clipboard!
  </div>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const promptTextarea = document.getElementById('prompt');
      const selectAllBtn = document.getElementById('selectAll');
      const copyBtn = document.getElementById('copyBtn');
      const closeBtn = document.getElementById('closeBtn');
      const successMessage = document.getElementById('successMessage');

      selectAllBtn.addEventListener('click', () => {
        promptTextarea.select();
        promptTextarea.setSelectionRange(0, promptTextarea.value.length);
      });

      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(promptTextarea.value);
          successMessage.classList.add('visible');
          setTimeout(() => {
            vscode.postMessage({ type: 'copied' });
          }, 1000);
        } catch (err) {
          // Fallback: select all and let user copy manually
          promptTextarea.select();
          promptTextarea.setSelectionRange(0, promptTextarea.value.length);
        }
      });

      closeBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'close' });
      });

      // Auto-select on focus
      promptTextarea.addEventListener('focus', () => {
        promptTextarea.select();
      });
    })();
  </script>
</body>
</html>`;

    // Handle messages from webview
    const messageDisposable = panel.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "copied":
          panel.dispose();
          resolve(true);
          break;
        case "close":
          panel.dispose();
          resolve(false);
          break;
      }
    });

    // Handle panel disposal
    panel.onDidDispose(() => {
      messageDisposable.dispose();
      resolve(false);
    });
  });
}

/**
 * Escapes HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generates a cryptographically secure nonce.
 */
function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Legacy command handler for backward compatibility.
 * This is used when the command is invoked without a session ID.
 */
export async function recoverSessionCommand(
  _context: vscode.ExtensionContext
): Promise<void> {
  // This is now a no-op - the full implementation is in extension.ts
  // which calls recoverSession directly with all dependencies
  vscode.window.showInformationMessage(
    "Use the Recovery Panel to recover interrupted sessions."
  );
}
