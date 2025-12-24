/**
 * Clipboard Service - Story 18-5
 *
 * Provides clipboard operations with error handling for the
 * one-click resume feature.
 *
 * Features:
 * - Copy text to clipboard with error handling
 * - Validate input before copying
 * - Return detailed error information on failure
 */

import * as vscode from "vscode";

/**
 * Result of a clipboard operation.
 */
export interface ClipboardResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if the operation failed */
  error?: string;
}

/**
 * Copies text to the system clipboard.
 *
 * @param text - The text to copy to clipboard
 * @returns Promise resolving to the result of the operation
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  // Validate input
  if (!text) {
    return {
      success: false,
      error: "Empty text provided",
    };
  }

  if (typeof text !== "string") {
    return {
      success: false,
      error: "Invalid text type",
    };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return {
      success: false,
      error: "Empty prompt after trimming",
    };
  }

  try {
    await vscode.env.clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown clipboard error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Reads text from the system clipboard.
 *
 * @returns Promise resolving to the clipboard content or null on error
 */
export async function readFromClipboard(): Promise<string | null> {
  try {
    return await vscode.env.clipboard.readText();
  } catch {
    return null;
  }
}

/**
 * ClipboardService provides clipboard operations as a class for dependency injection.
 */
export class ClipboardService {
  private outputChannel: vscode.OutputChannel | null = null;

  /**
   * Initializes the service with an output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("ClipboardService initialized");
  }

  /**
   * Copies text to the system clipboard.
   */
  async copy(text: string): Promise<ClipboardResult> {
    const result = await copyToClipboard(text);

    if (result.success) {
      this.log(`Copied ${text.length} characters to clipboard`);
    } else {
      this.log(`Clipboard copy failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Reads text from the system clipboard.
   */
  async read(): Promise<string | null> {
    return readFromClipboard();
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [ClipboardService] ${message}`
      );
    }
  }
}

/**
 * Creates a new ClipboardService instance.
 */
export function createClipboardService(): ClipboardService {
  return new ClipboardService();
}
