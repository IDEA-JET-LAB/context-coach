import * as vscode from "vscode";
import { showAnalyticsCommand } from "./commands/showAnalytics";
import { showSettingsCommand } from "./commands/showSettings";
import { signInCommand, signOutCommand } from "./commands/auth";
import { AuthService } from "./services/auth";
import { AnalyticsPanelProvider } from "./providers/analyticsPanel";

/**
 * Output channel for Contextor extension logging
 */
let outputChannel: vscode.OutputChannel;

/**
 * Auth service instance (singleton per session)
 */
let authService: AuthService;

/**
 * Called when the extension is activated.
 * Activation happens on VS Code startup (onStartupFinished).
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel("Contextor");
  outputChannel.appendLine("Contextor extension is now active");

  // Initialize auth service
  authService = new AuthService(context, outputChannel);

  // Register commands
  context.subscriptions.push(
    // Analytics and settings commands
    vscode.commands.registerCommand("contextor.showAnalytics", () =>
      showAnalyticsCommand(context)
    ),
    vscode.commands.registerCommand("contextor.showSettings", () =>
      showSettingsCommand(context)
    ),

    // Auth commands
    vscode.commands.registerCommand("contextor.signIn", () =>
      signInCommand(authService)
    ),
    vscode.commands.registerCommand("contextor.signOut", () =>
      signOutCommand(authService)
    )
  );

  // Register URI handler for OAuth callback
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
        outputChannel.appendLine(`URI handler received: ${uri.path}`);

        // Handle OAuth callback
        if (uri.path === "/callback") {
          return authService.handleCallback(uri);
        }

        outputChannel.appendLine(`Unknown URI path: ${uri.path}`);
      },
    })
  );

  // Register Analytics Panel WebviewViewProvider
  const analyticsPanelProvider = new AnalyticsPanelProvider(
    context.extensionUri,
    authService,
    outputChannel
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AnalyticsPanelProvider.viewType,
      analyticsPanelProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );
  outputChannel.appendLine("Contextor: Analytics panel registered");

  // Check authentication status on startup
  checkAuthStatus();

  // Log activation complete
  outputChannel.appendLine("Contextor: All commands registered");
  console.log("Contextor extension is now active");
}

/**
 * Checks and displays authentication status on startup.
 */
async function checkAuthStatus(): Promise<void> {
  try {
    const isAuthenticated = await authService.isAuthenticated();
    if (isAuthenticated) {
      const user = await authService.getUser();
      outputChannel.appendLine(
        `Authenticated as: ${user?.email || "unknown user"}`
      );
    } else {
      outputChannel.appendLine("Not authenticated");
    }
  } catch (error) {
    outputChannel.appendLine(
      `Error checking auth status: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  if (outputChannel) {
    outputChannel.appendLine("Contextor extension deactivated");
    outputChannel.dispose();
  }
  console.log("Contextor extension deactivated");
}
