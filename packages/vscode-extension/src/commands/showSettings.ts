import * as vscode from "vscode";

/**
 * Command handler for "Contextor: Show Settings"
 *
 * Opens VS Code Settings UI filtered to Contextor extension options.
 * This allows users to configure:
 * - API endpoint URL
 * - Auto-refresh interval
 * - Notification preferences
 * - Status bar visibility
 */
export async function showSettingsCommand(
  _context: vscode.ExtensionContext
): Promise<void> {
  // Open VS Code Settings UI filtered to Contextor settings
  // The filter query uses @ext:<publisher>.<extension-id> format
  await vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "@ext:contextor.contextor-vscode"
  );
}
