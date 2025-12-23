import * as vscode from 'vscode';

/**
 * Command handler for importing prompt history from Claude Code
 *
 * In the future, this will:
 * - Discover Claude Code session files
 * - Parse and validate prompt data
 * - Batch import to Contextor backend
 * - Show progress and results
 */
export async function importHistoryCommand(
  _context: vscode.ExtensionContext
): Promise<void> {
  // Placeholder implementation
  vscode.window.showInformationMessage(
    'Import History coming soon! This will import your Claude Code prompt history.'
  );
}
