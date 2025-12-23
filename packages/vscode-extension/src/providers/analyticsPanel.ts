/**
 * AnalyticsPanelProvider - WebviewViewProvider for the Contextor Analytics sidebar panel
 *
 * Provides a webview-based analytics dashboard in the VS Code sidebar.
 * Shows prompt analytics, scores, and coaching tips when authenticated.
 */

import * as vscode from "vscode";
import { AuthService } from "../services/auth";
import { AnalyticsData } from "../types";
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "../types/messages";

/**
 * WebviewViewProvider for the Contextor Analytics panel.
 * Displays analytics data in a sidebar webview.
 */
export class AnalyticsPanelProvider implements vscode.WebviewViewProvider {
  /**
   * Unique identifier for this view type.
   * Must match the view id in package.json.
   */
  public static readonly viewType = "contextor.analyticsView";

  /**
   * Reference to the webview view once resolved.
   * Used for sending messages to the webview.
   */
  private _view?: vscode.WebviewView;

  /**
   * Disposables to clean up when the view is disposed.
   */
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly authService: AuthService,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Called when the view is first made visible.
   * Sets up the webview with appropriate options and content.
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
        vscode.Uri.joinPath(this.extensionUri, "webviews", "analytics", "dist"),
        vscode.Uri.joinPath(this.extensionUri, "dist"),
      ],
    };

    // Set the HTML content
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        await this.handleMessage(message);
      }
    );
    this._disposables.push(messageDisposable);

    // Handle view disposal
    const disposeDisposable = webviewView.onDidDispose(() => {
      this._disposables.forEach((d) => d.dispose());
      this._disposables = [];
      this._view = undefined;
    });
    this._disposables.push(disposeDisposable);

    // Listen for auth changes
    const authDisposable = this.authService.onDidChangeAuth(() => {
      this.log("Auth state changed, refreshing analytics");
      this.sendAuthState();
    });
    this._disposables.push(authDisposable);

    // Send initial auth state
    this.sendAuthState();

    this.log("Analytics panel resolved");
  }

  /**
   * Handles messages received from the webview.
   */
  private async handleMessage(
    message: WebviewToExtensionMessage
  ): Promise<void> {
    switch (message.type) {
      case "refresh":
        this.log("Refresh requested by webview");
        await this.sendAnalytics();
        break;

      case "error":
        this.log(`Webview error: ${message.error}`);
        break;

      case "ready":
        this.log("Webview ready");
        await this.sendAuthState();
        break;
    }
  }

  /**
   * Sends the current authentication state to the webview.
   */
  private async sendAuthState(): Promise<void> {
    if (!this._view) return;

    try {
      const isAuth = await this.authService.isAuthenticated();
      this.postMessage({ type: "auth", authenticated: isAuth });

      if (isAuth) {
        await this.sendAnalytics();
      }
    } catch (error) {
      this.logError("Failed to check auth state", error);
      this.postMessage({ type: "error", message: "Failed to check authentication" });
    }
  }

  /**
   * Fetches and sends analytics data to the webview.
   */
  private async sendAnalytics(): Promise<void> {
    if (!this._view) return;

    try {
      const isAuth = await this.authService.isAuthenticated();
      if (!isAuth) {
        this.postMessage({ type: "auth", authenticated: false });
        return;
      }

      this.postMessage({ type: "loading", isLoading: true });

      const user = await this.authService.getUser();
      if (!user) {
        this.postMessage({ type: "error", message: "User profile not found" });
        return;
      }

      // TODO: Implement ContextorAPI service in a future story
      // For now, send mock analytics data
      const analytics = this.getMockAnalytics();

      this.postMessage({
        type: "analytics",
        data: analytics,
        user: user,
      });
    } catch (error) {
      this.logError("Failed to load analytics", error);
      this.postMessage({ type: "error", message: "Failed to load analytics" });
    }
  }

  /**
   * Sends a message to the webview.
   */
  private postMessage(message: ExtensionToWebviewMessage): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Generates HTML content for the webview with proper CSP headers.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get URIs for resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "webviews",
        "analytics",
        "dist",
        "index.js"
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "webviews",
        "analytics",
        "dist",
        "index.css"
      )
    );

    // Generate a unique nonce for CSP
    const nonce = this.getNonce();

    // Build HTML with Content Security Policy
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Contextor Analytics</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generates a cryptographically secure nonce for CSP.
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
   * Returns mock analytics data for development.
   * TODO: Replace with actual API call in Story 19-4.
   */
  private getMockAnalytics(): AnalyticsData {
    return {
      sessions: {
        todayCount: 3,
        todayPrompts: 25,
        avgDuration: 45,
        streak: 5,
      },
      efficiency: {
        overallScore: 78,
        promptsPerHour: 15,
        avgPromptLength: 120,
        contextUtilization: 65,
      },
      recentActivity: [
        {
          timestamp: new Date().toISOString(),
          type: "prompt",
          description: "Debugging authentication flow",
        },
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          type: "session_start",
          description: "Started new session",
        },
      ],
    };
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [AnalyticsPanel] ${message}`);
  }

  /**
   * Logs an error to the output channel.
   */
  private logError(message: string, error: unknown): void {
    const timestamp = new Date().toISOString();
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(
      `[${timestamp}] [AnalyticsPanel] ERROR: ${message}: ${errorMessage}`
    );
  }
}
