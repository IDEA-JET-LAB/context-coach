import * as vscode from 'vscode';

/**
 * Command handler for "Contextor: Show Settings"
 *
 * In the future, this will open a settings panel for:
 * - API endpoint configuration
 * - Authentication token management
 * - Notification preferences
 * - Coaching preferences
 */
export async function showSettingsCommand(
  _context: vscode.ExtensionContext
): Promise<void> {
  // Placeholder implementation - will be replaced with settings UI
  vscode.window.showInformationMessage(
    'Contextor Settings coming soon! Configure your API connection and preferences here.'
  );
}
