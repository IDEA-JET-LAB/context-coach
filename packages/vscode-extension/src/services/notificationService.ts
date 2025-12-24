/**
 * Notification Service - Story 18-4
 *
 * Handles toast notifications for interrupted session recovery.
 * Shows notification toasts when interrupted sessions are detected
 * with options to view or dismiss.
 *
 * Features:
 * - Session count display (singular/plural)
 * - View and Dismiss buttons
 * - Debounced notifications to prevent spam
 * - Integration with recovery panel
 */

import * as vscode from "vscode";
import type { InterruptedSession } from "../types/interruptedSession";

/**
 * Result of showing an interrupted session notification.
 */
export type NotificationAction = "view" | "dismiss" | undefined;

/**
 * Notification service configuration.
 */
export interface NotificationServiceConfig {
  /** Minimum time between notifications in milliseconds */
  debounceMs?: number;
  /** Whether to suppress notifications (for testing) */
  suppressNotifications?: boolean;
}

/**
 * Default notification service configuration.
 */
export const DEFAULT_NOTIFICATION_CONFIG: Required<NotificationServiceConfig> = {
  debounceMs: 30000, // 30 seconds
  suppressNotifications: false,
};

/**
 * NotificationService handles showing toast notifications for interrupted sessions.
 */
export class NotificationService implements vscode.Disposable {
  private outputChannel: vscode.OutputChannel | null = null;
  private readonly config: Required<NotificationServiceConfig>;
  private lastNotificationTime = 0;
  private readonly disposables: vscode.Disposable[] = [];

  /** Callback when user clicks "View" */
  private onViewCallback: ((sessions: InterruptedSession[]) => void) | null = null;

  /** Callback when user clicks "Dismiss" */
  private onDismissCallback: ((sessions: InterruptedSession[]) => void) | null = null;

  constructor(config?: NotificationServiceConfig) {
    this.config = {
      ...DEFAULT_NOTIFICATION_CONFIG,
      ...config,
    };
  }

  /**
   * Sets the output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("NotificationService initialized");
  }

  /**
   * Disposes of resources.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
    this.onViewCallback = null;
    this.onDismissCallback = null;
  }

  /**
   * Registers a callback for when the user clicks "View".
   */
  onView(callback: (sessions: InterruptedSession[]) => void): void {
    this.onViewCallback = callback;
  }

  /**
   * Registers a callback for when the user clicks "Dismiss".
   */
  onDismiss(callback: (sessions: InterruptedSession[]) => void): void {
    this.onDismissCallback = callback;
  }

  /**
   * Shows a notification for interrupted sessions.
   *
   * @param sessions - The interrupted sessions to notify about
   * @returns The action taken by the user
   */
  async showInterruptedSessionNotification(
    sessions: InterruptedSession[]
  ): Promise<NotificationAction> {
    if (sessions.length === 0) {
      return undefined;
    }

    // Check if notifications are suppressed (for testing)
    if (this.config.suppressNotifications) {
      this.log("Notification suppressed (testing mode)");
      return undefined;
    }

    // Check debounce
    const now = Date.now();
    if (now - this.lastNotificationTime < this.config.debounceMs) {
      this.log("Notification debounced");
      return undefined;
    }

    this.lastNotificationTime = now;

    // Format message with correct plurality
    const message = this.formatNotificationMessage(sessions.length);

    this.log(`Showing notification: ${message}`);

    // Show notification with View and Dismiss buttons
    const action = await vscode.window.showInformationMessage(
      message,
      "View",
      "Dismiss"
    );

    if (action === "View") {
      this.log("User clicked View");
      this.onViewCallback?.(sessions);
      return "view";
    } else if (action === "Dismiss") {
      this.log("User clicked Dismiss");
      this.onDismissCallback?.(sessions);
      return "dismiss";
    }

    this.log("User dismissed notification without action");
    return undefined;
  }

  /**
   * Shows a notification for a single new stale session.
   * Used for real-time monitoring.
   *
   * @param session - The newly detected stale session
   * @returns The action taken by the user
   */
  async showNewStaleSessionNotification(
    session: InterruptedSession
  ): Promise<NotificationAction> {
    if (this.config.suppressNotifications) {
      return undefined;
    }

    // Check debounce
    const now = Date.now();
    if (now - this.lastNotificationTime < this.config.debounceMs) {
      this.log("New stale session notification debounced");
      return undefined;
    }

    this.lastNotificationTime = now;

    const projectName = this.extractProjectName(session.sessionPath);
    const message = `Claude Code session "${projectName}" has been inactive for 15+ minutes. Would you like to recover it?`;

    this.log(`Showing new stale session notification for: ${projectName}`);

    const action = await vscode.window.showInformationMessage(
      message,
      "View",
      "Dismiss"
    );

    if (action === "View") {
      this.onViewCallback?.([session]);
      return "view";
    } else if (action === "Dismiss") {
      this.onDismissCallback?.([session]);
      return "dismiss";
    }

    return undefined;
  }

  /**
   * Formats the notification message based on session count.
   */
  private formatNotificationMessage(count: number): string {
    if (count === 1) {
      return "1 interrupted Claude Code session detected";
    }
    return `${count} interrupted Claude Code sessions detected`;
  }

  /**
   * Extracts project name from session path.
   * Session path format: ~/.claude/projects/-Users-username-project-name/session.jsonl
   */
  private extractProjectName(sessionPath: string): string {
    const parts = sessionPath.split("/");
    const projectDir = parts[parts.length - 2];

    if (projectDir && projectDir.startsWith("-")) {
      // Convert normalized path back to readable name
      // e.g., "-Users-username-project-name" -> "project-name"
      const pathParts = projectDir.slice(1).split("-");
      // Get the last meaningful part (usually the project name)
      return pathParts[pathParts.length - 1] || projectDir;
    }

    return projectDir || "Unknown project";
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [NotificationService] ${message}`
      );
    }
  }
}

/**
 * Creates a NotificationService instance.
 */
export function createNotificationService(
  config?: NotificationServiceConfig
): NotificationService {
  return new NotificationService(config);
}
